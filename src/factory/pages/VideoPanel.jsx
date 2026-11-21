// test-video-v1 (21 nov. 2026) — Le test de l'agent Créative Vidéo passe par la MÊME machine que la production :
// Render lance le job Cloud Run « video-adstack » (/video-jobs/start), puis on suit son état (/video-jobs/status).
// Plus de Video Lab local. La commande fournit brief, photo et aspects ; la synthèse du test (souvent celle que
// l'Analyste vient de produire) est transmise à la machine sans toucher à la commande du client.
// L'emplacement 9 est réservé aux tests : il n'écrase jamais une vidéo de la production.
import { COMP_FILES, loadSkills } from '../prod/state'
import React, { useEffect, useState } from 'react'
import { vctGetAll } from '../vctApi'
import { useAgentMem, useTick, syntheseMemorisee, heureCourte } from '../agentStore'
import { commandeToBrief } from '../prod/engine'
import { prodv2ExtractAngles, NIVEAU_LIB } from '../prod/verbatim'
import { niveauCT } from '../ctApi'
import { getCommandes, SERVER } from '../api'
import { alertDlg, confirmDlg } from '../ui'

const SLOT_TEST = 9
const JH = { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' }
const RUN0 = { execution: null, cmd: null, busy: false, etat: null, error: '', t0: 0 }
let POLL = null

export default function VideoPanel({ competenceOnly }) {
  const [m, set] = useAgentMem('creative-video', { ctId: '', angle: 0, syn: '', cmdId: null, briefInfo: '', run: RUN0, last: null, startErr: '', prep: '' })
  const run = m.run && 'execution' in m.run ? m.run : RUN0
  const setRun = (f) => set((p) => ({ run: typeof f === 'function' ? f(p.run && 'execution' in p.run ? p.run : RUN0) : f }))
  const secLive = useTick(run.t0, run.busy)
  const [cts, setCts] = useState(null), [comp, setComp] = useState('Chargement…')
  const [listeCmd, setListeCmd] = useState(null), [busyCmd, setBusyCmd] = useState(false)

  const poll = async (cmd, ex) => {
    try {
      const q = new URLSearchParams({ commande_id: cmd, slot: String(SLOT_TEST), execution: ex, test: '1' })
      const r = await fetch(SERVER + '/video-jobs/status?' + q, { headers: JH })
      if (!r.ok) throw new Error('HTTP ' + r.status)
      const e = await r.json()
      const fini = e.etat === 'termine' || e.etat === 'echec'
      if (fini) { clearInterval(POLL); POLL = null }
      setRun((x) => (x.execution !== ex ? x : { ...x, etat: e, busy: !fini, error: e.etat === 'echec' ? (e.erreur || 'Échec de la production vidéo.') : '', soft: '' }))
      if (e.etat === 'termine' && e.video_url) set({ last: { video_url: e.video_url, historique_url: e.historique_url || '', dossier_url: e.dossier_url || '', cout: e.cout_usd, ts: Date.now() } })
    } catch (err) { setRun((x) => ({ ...x, soft: 'Le serveur ne répond pas (' + err.message + '). La vidéo continue sur la machine ; nouvel essai dans 10 s.' })) }
  }

  useEffect(() => {
    if (competenceOnly) { loadSkills().then(() => setComp(COMP_FILES['COMPETENCE_CREATIVE_VIDEO.md'] || 'Compétence introuvable.')); return }
    vctGetAll().then(setCts).catch((e) => setCts({ error: e.message }))
    if (run.busy && run.execution && run.cmd && !POLL) { POLL = setInterval(() => poll(run.cmd, run.execution), 10000); poll(run.cmd, run.execution) }
  }, [])

  if (competenceOnly) return <div className="fx-comp"><textarea className="fx-ta mono comp" readOnly value={comp} /><p className="fx-s wrap">Compétence de l'agent Créative Vidéo (la même que celle de la machine de production).</p></div>

  const ct = Array.isArray(cts) ? cts.find((x) => x.id === m.ctId) : null
  const nivCT = ct ? ((ct.awareness || []).map(niveauCT).find(Boolean) || '') : ''
  const angles = m.syn && m.syn.trim() ? prodv2ExtractAngles(m.syn, 0) : []
  const ai = Math.min(m.angle || 0, Math.max(angles.length - 1, 0))

  const ouvrirCommandes = async () => { setBusyCmd(true); try { setListeCmd(await getCommandes()) } catch (e) { alertDlg('Commandes : ' + e.message) } finally { setBusyCmd(false) } }
  const choisirCommande = async (id) => {
    const c = (listeCmd || []).find((x) => String(x.id) === id); if (!c) return
    setBusyCmd(true)
    try {
      const brief = commandeToBrief(c)
      const pid = (c.product || {}).id
      let syn = '', src = ''
      const synTest = syntheseMemorisee([pid && 'p' + pid, c.id != null && 'c' + c.id])
      if (synTest) { syn = synTest.texte; src = 'synthèse du dernier test Analyste (' + heureCourte(synTest.t) + ')' }
      else if (c.deliverables && c.deliverables.synthesis) { syn = c.deliverables.synthesis; src = 'synthèse de la commande' }
      else if (pid) { try { const rc = await (await fetch(`${SERVER}/products/${pid}/renewal-context`, { headers: JH })).json(); if (rc && rc.syntheseExistante) { syn = rc.syntheseExistante; src = 'dernière synthèse du produit' } } catch (_) {} }
      const aPhoto = !!(c.photo_nobg || (c.product || {}).photo_base64 || (c.product || {}).photo_url || ((c.product || {}).photos_produit || []).length)
      set({ cmdId: String(c.id), syn: syn || m.syn || '', angle: 0, briefInfo: `${brief.produit || '?'}${brief.marque ? ' · ' + brief.marque : ''}${aPhoto ? ' · photo produit ✓' : ' · ⚠ aucune photo produit'}${syn ? ' · ' + src : ' · ⚠ pas de synthèse : collez-la ci-dessous'}` })
      setListeCmd(null)
    } catch (e) { alertDlg(e.message) } finally { setBusyCmd(false) }
  }

  const start = async () => {
    const fail = (t) => set({ startErr: t, prep: '' })
    const manque = [!m.cmdId && 'une commande (elle fournit le brief, la photo et les aspects)', !m.ctId && 'le CT vidéo', !(m.syn || '').trim() && 'la synthèse', !angles.length && 'un angle (la synthèse doit contenir ses angles)'].filter(Boolean)
    if (manque.length) return fail('Il manque : ' + manque.join(', ') + '.')
    set({ startErr: '', prep: 'Lancement de la machine vidéo…' })
    try {
      const r = await fetch(SERVER + '/video-jobs/start', { method: 'POST', headers: JH, body: JSON.stringify({ commande_id: m.cmdId, ct_id: m.ctId, slot: SLOT_TEST, angle: angles[ai], niveau: nivCT ? NIVEAU_LIB[nivCT] : '', synthese: m.syn, test: true, forcer: true }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || j.error || !j.execution) throw new Error(j.error || (r.status === 404 ? 'le serveur Render n\'a pas la route /video-jobs/start' : 'HTTP ' + r.status))
      const t0 = Date.now()
      set({ prep: '', run: { execution: j.execution, cmd: m.cmdId, busy: true, etat: { etape: 'La machine démarre', pct: 1, journal: [] }, error: '', t0, ct: ct ? ct.name : m.ctId, angle: angles[ai], niveau: nivCT ? NIVEAU_LIB[nivCT] : '' } })
      clearInterval(POLL); POLL = setInterval(() => poll(m.cmdId, j.execution), 10000); poll(m.cmdId, j.execution)
    } catch (e) { fail('Échec au lancement : ' + e.message) }
  }
  const annuler = async () => {
    if (!(await confirmDlg('Arrêter cette vidéo de test ? Ce qui est déjà parti chez Google (un clip en cours) reste facturé.', { ok: 'Arrêter la vidéo', danger: true }))) return
    try {
      const r = await fetch(SERVER + '/video-jobs/cancel', { method: 'POST', headers: JH, body: JSON.stringify({ execution: run.execution }) })
      if (!r.ok) throw new Error('HTTP ' + r.status)
      clearInterval(POLL); POLL = null; setRun((x) => ({ ...x, busy: false, error: 'Vidéo arrêtée par vous.' }))
    } catch (e) { alertDlg("Impossible d'arrêter : " + e.message) }
  }
  const relancer = async () => { if (await confirmDlg('Lancer une nouvelle vidéo de test avec ces réglages ? Nouvelle production complète (budget jusqu’à 15 $).', { ok: 'Lancer' })) start() }

  const e = run.etat || {}, journal = e.journal || []
  const fini = e.etat === 'termine' || e.etat === 'echec' || (!run.busy && run.execution)
  const vUrl = e.etat === 'termine' ? e.video_url : null
  return (
    <div className="fx-test">
      <div className="fx-hint" style={{ marginBottom: 12 }}>Ce test tourne sur la même machine Google Cloud que la production (même moteur, même montage). Aucun serveur à allumer. Rien n'est envoyé au client.</div>
      <div className="fx-fld"><div className="fx-lab up">COMMANDE (brief, photo produit, aspects)</div>
        <div className="fx-btnrow"><button className="fx-btn" disabled={busyCmd} onClick={ouvrirCommandes}>{busyCmd ? '…' : 'Prendre une commande'}</button></div>
        {listeCmd && <select className="fx-in full" defaultValue="" onChange={(ev) => choisirCommande(ev.target.value)}>
          <option value="" disabled>{listeCmd.length ? 'Choisissez une commande…' : 'Aucune commande'}</option>
          {listeCmd.map((b) => <option key={b.id} value={b.id}>{(b.product || {}).nom || 'Produit'} · {(b.product || {}).marque || ''} · {b.quantity || 6} créatives · {b.status}</option>)}
        </select>}
        <div className="fx-s">{m.cmdId ? m.briefInfo : 'Aucune commande choisie'}</div></div>
      <div className="fx-fld"><div className="fx-lab up">CT VIDÉO (CHOISI PAR VOUS)</div>
        <select className="fx-in full" value={m.ctId} onChange={(ev) => set({ ctId: ev.target.value })}>
          {cts === null ? <option>Chargement de la galerie…</option> : !Array.isArray(cts) ? <option>Galerie illisible : {cts.error}</option> : !cts.length ? <option value="">Galerie CT vidéo vide</option> : [<option key="" value="" disabled>Choisissez un CT vidéo…</option>, ...cts.map((r) => <option key={r.id} value={r.id}>{r.name}{r.awareness.length ? '  ·  ' + r.awareness.join(', ') : '  ·  sans niveau'}</option>)]}
        </select>
        {ct && <div className="fx-hint">{nivCT ? 'Niveau de conscience donné par ce CT : ' + NIVEAU_LIB[nivCT] + '. ' : '⚠ Ce CT n\'a pas de balise de niveau : la machine lira celui écrit dans sa fiche. '}{ct.meta || ''}</div>}</div>
      <div className="fx-fld"><div className="fx-lab up">SYNTHÈSE DE L'ANALYSTE</div><textarea className="fx-ta" rows={6} value={m.syn} onChange={(ev) => set({ syn: ev.target.value, angle: 0 })} placeholder="Reprise automatiquement du dernier test Analyste sur cette commande, ou collez-la ici…" /></div>
      <div className="fx-fld"><div className="fx-lab up">ANGLE À PRODUIRE</div>
        {angles.length ? <select className="fx-in full" value={ai} onChange={(ev) => set({ angle: Number(ev.target.value) })}>{angles.map((t, i) => <option key={i} value={i}>Angle {i + 1} — {t}</option>)}</select> : <div className="fx-s">Les angles de la synthèse apparaîtront ici.</div>}</div>
      <div className="fx-launch">
        <button className="fx-btn primary big" disabled={run.busy || !!m.prep} onClick={run.execution && !run.busy ? relancer : start}>{m.prep ? 'Lancement…' : run.busy ? 'Vidéo en cours…' : run.execution ? 'Lancer une nouvelle vidéo' : 'Générer la vidéo'}</button>
        {run.busy && <button className="fx-btn danger big" onClick={annuler} style={{ marginLeft: 8 }}>Arrêter</button>}
        <span className="fx-s">{run.busy ? Math.floor(secLive / 60) + ' min ' + (secLive % 60) + ' s' : ''}</span></div>
      {m.prep && <div className="fx-hint">{m.prep}</div>}
      {m.startErr && <div className="fx-err">{m.startErr} <button className="fx-btn sm" onClick={() => set({ startErr: '' })}>Fermer</button></div>}
      {run.execution && <div className="fx-vprog">
        <div><b>{run.ct}</b>{run.niveau ? ' · ' + run.niveau : ''}{run.angle ? ' · ' + run.angle : ''}</div>
        <div><b>Étape :</b> {e.etape || '…'}{e.pct != null ? ' · ' + e.pct + ' %' : ''}</div>
        {journal.slice(-3).map((l, i) => <div key={i} className="fx-s wrap">{String(l && (l.t || l.msg || l) || '').slice(0, 220)}</div>)}
        {e.cout_usd != null && <div className="fx-s">Coût : {Number(e.cout_usd).toFixed(2)} $</div>}
        {run.soft && <div className="fx-s" style={{ color: 'var(--wa)' }}>{run.soft}</div>}
        {run.error && <div style={{ color: 'var(--er)', marginTop: 6 }}>Erreur : {run.error}</div>}</div>}
      {vUrl && <div className="fx-vres"><video src={vUrl} controls playsInline /><div><a className="fx-btn primary" href={vUrl + '?download=video-test.mp4'} download>Télécharger la vidéo</a></div></div>}
      {!vUrl && m.last && <div className="fx-vres"><div className="fx-s">Dernière vidéo de test ({new Date(m.last.ts).toLocaleString('fr-FR')}) :</div><video src={m.last.video_url} controls playsInline /></div>}
      {fini && (e.historique_url || e.dossier_url || (m.last && (m.last.historique_url || m.last.dossier_url))) && <div className="fx-hist"><div className="fx-s wrap">Journal, plans, prompts, images et coûts sont enregistrés. Téléchargez l'historique et envoyez-le moi après chaque test.</div>
        <div className="fx-acts">
          {(e.historique_url || (m.last && m.last.historique_url)) && <a className="fx-btn" href={e.historique_url || m.last.historique_url} target="_blank" rel="noreferrer">Historique complet</a>}
          {(e.dossier_url || (m.last && m.last.dossier_url)) && <a className="fx-btn" href={e.dossier_url || m.last.dossier_url} target="_blank" rel="noreferrer">Dossier de production</a>}
        </div></div>}
    </div>
  )
}
