import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { AGENTS } from './Agents'
import { useAgentMem, usePersist, useTick, setLive, isLive, memoriserSynthese, syntheseLocaleOuServeur, heureCourte, rangerSyntheseServeur, synthesesServeur, syntheseServeur } from '../agentStore'
import SynthesesEnregistrees from './SynthesesEnregistrees'
import { COMP_FILES, SERVER, CT_IMAGES, loadSkills } from '../prod/state'
import * as V from '../prod/verbatim'
import { commandeToBrief, commandePhoto } from '../prod/engine'
import { prodv2State } from '../prod/state'
import { getCommandes } from '../api'
import { ctGetAll, ctGetBase64, loadCTImages, niveauCT, ctMemoriser } from '../ctApi'
import VideoPanel from './VideoPanel'
import { AgentArt } from '../Art'
import { alertDlg, confirmDlg, toast } from '../ui'
import { writeSkills, getBackupDir } from '../backup'

const Lab = ({ children }) => <div className="fx-lab up">{children}</div>
const Seg = ({ value, options, onChange }) => <div className="fx-pills">{options.map(([v, l]) => <button key={v} type="button" className={'fx-pill' + (value === v ? ' on' : '')} onClick={() => onChange(v)}>{l}</button>)}</div>

function Competence({ a }) {
  const [text, setText] = useState(null)
  const [saved, setSaved] = useState(false)
  useEffect(() => { loadSkills().then(() => setText(COMP_FILES[a.file] || '')) }, [a.file])
  const save = async () => {
    COMP_FILES[a.file] = text; setSaved(true); setTimeout(() => setSaved(false), 1500)
    const r = await writeSkills({ [a.file]: text })
    toast(r.ok ? `Enregistrée pour cette session et dans le dossier de secours « ${r.dir} »` : r.reason === 'no-dir' ? 'Enregistrée pour cette session. Aucun dossier de secours choisi (page Agents).' : 'Enregistrée pour cette session, mais le dossier de secours n’a pas été mis à jour : ' + r.reason)
  }
  const dl = () => { const x = document.createElement('a'); x.href = URL.createObjectURL(new Blob([text || ''], { type: 'text/markdown' })); x.download = a.file; x.click() }
  return (
    <div className="fx-comp">
      <div className="fx-comp-bar"><span className="mono">{a.file}</span>
        <span><button className="fx-btn sm" onClick={dl}>Télécharger</button> <button className="fx-btn sm primary" onClick={save}>{saved ? '✓' : 'Sauvegarder'}</button></span></div>
      <textarea className="fx-ta mono comp" value={text == null ? 'Chargement…' : text} disabled={text == null} onChange={(e) => setText(e.target.value)} />
      <p className="fx-s wrap">Les modifications s'appliquent à cette session du navigateur. Si un dossier de secours est choisi (page Agents), le fichier y est aussi mis à jour. Pour qu'elles deviennent permanentes dans Factory, il faut une mise à jour du code.</p>
    </div>
  )
}

const parseImg = (o, def) => (o && o.data ? { b64: o.data, mime: o.mime || def } : null)
// Un brief de test = exactement un brief de production (même contenu que celui envoyé aux agents en vrai).
async function readBrief(file) {
  const brief = JSON.parse(await file.text())
  return { brief, photo: parseImg(brief.photo_produit, 'image/png'), logo: parseImg(brief.logo, 'image/png'), rctx: null, cles: [], briefName: file.name }
}
async function briefFromCommande(b) {
  const brief = commandeToBrief(b)
  const photo = await commandePhoto(b)
  let rctx = null
  const pid = (b.product || {}).id
  if (pid) { try { rctx = await (await fetch(`${SERVER}/products/${pid}/renewal-context`, { headers: { 'ngrok-skip-browser-warning': '1' } })).json() } catch (_) {} }
  // La synthèse vient avec la commande : celle de la commande, sinon la dernière hypothèse stockée pour ce produit.
  const synCmd = b.deliverables && b.deliverables.synthesis ? b.deliverables.synthesis : ''
  const synProd = rctx && rctx.syntheseExistante ? rctx.syntheseExistante : ''
  const cles = [pid && 'p' + pid, b.id != null && 'c' + b.id].filter(Boolean)
  const synTest = await syntheseLocaleOuServeur(cles)   // v5.74 (+ syntheses-coffre-v1 : aussi depuis le serveur) : l'hypothèse que tu viens de générer dans le test Analyste
  const syn = synTest ? synTest.texte : (synCmd || synProd)
  const synSrc = synTest ? ' · synthèse du dernier test Analyste reprise (' + heureCourte(synTest.t) + ')' : synCmd ? ' · synthèse de la commande reprise' : synProd ? ' · dernière synthèse du produit reprise' : ' · ⚠ aucune synthèse pour cette commande'
  return { brief, photo, logo: null, rctx, cles, briefName: `Commande · ${brief.produit || '?'}${brief.marque ? ' · ' + brief.marque : ''}${rctx && rctx.estRenouvellement ? ' (renouvellement)' : ''}${synSrc}`, syn }
}
// Les agents de production lisent un état partagé : on le prête le temps du test, puis on le rend tel quel.
async function withProd(patch, fn) {
  if (prodv2State.ui.running) throw new Error('Une production est en cours : attends sa fin avant de tester un agent.')
  const old = {}; Object.keys(patch).forEach((k) => { old[k] = prodv2State[k] })
  Object.assign(prodv2State, patch)
  try { return await fn() } finally { Object.assign(prodv2State, old) }
}
// Le niveau de conscience d'une créative vient de son CT (balise « awareness » posée dans la galerie), jamais d'un bouton.
const RANG_NIV = { problem: 0, solution: 0, product: 1, most: 2 }
function niveauDuCT(rec) { const l = (rec && rec.awareness) || []; for (const a of l) { const k = niveauCT(a); if (k) return k } return '' }

function BriefSource({ m, set }) {
  const ref = useRef(null)
  const [list, setList] = useState(null), [busy, setBusy] = useState(false)
  const onFile = async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return
    try { const r = await readBrief(f); set({ ...r, output: '', marche: '', outErr: false }) } catch (err) { alertDlg('JSON invalide : ' + err.message) }
  }
  const openList = async () => { setBusy(true); try { setList(await getCommandes()) } catch (e) { alertDlg('Commandes : ' + e.message) } finally { setBusy(false) } }
  const pick = async (id) => {
    const b = list.find((x) => String(x.id) === id); if (!b) return
    setBusy(true)
    try { const r = await briefFromCommande(b); set({ ...r, synthese: r.syn || m.synthese || '', output: '', marche: '', outErr: false }); setList(null) } catch (e) { alertDlg(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="fx-fld"><Lab>BRIEF CLIENT</Lab>
      <input ref={ref} type="file" accept="application/json" hidden onChange={onFile} />
      <div className="fx-btnrow">
        <button className="fx-btn" onClick={() => ref.current.click()}>Charger un brief.json</button>
        <button className="fx-btn" disabled={busy} onClick={openList}>{busy ? '…' : 'Prendre une commande'}</button>
      </div>
      {list && <select className="fx-in" defaultValue="" onChange={(e) => pick(e.target.value)}>
        <option value="" disabled>{list.length ? 'Choisis une commande…' : 'Aucune commande'}</option>
        {list.map((b) => <option key={b.id} value={b.id}>{(b.product || {}).nom || 'Produit'} · {(b.product || {}).marque || ''} · {b.quantity || 6} créatives · {b.status}</option>)}
      </select>}
      <div className="fx-s">{m.briefName ? m.briefName + (m.photo ? ' · photo produit chargée' : ' · ⚠ pas de photo produit') : 'Aucun brief chargé'}</div>
      {m.photo && <img className="fx-minithumb" src={`data:${m.photo.mime};base64,${m.photo.b64}`} alt="" />}
    </div>
  )
}

// Le CT est choisi À LA MAIN dans la galerie validée (les CT « À valider » n'y sont pas encore).
function CTPicker({ m, set }) {
  const [list, setList] = useState(null), [q, setQ] = useState(''), [f, setF] = useState(''), nav = useNavigate()
  useEffect(() => { ctGetAll().then(setList).catch((e) => setList({ error: e.message })) }, [])
  const ok = Array.isArray(list)
  const choisi = ok ? list.find((r) => r.id === m.ct) : null
  const vis = ok ? list.filter((r) => (!f || niveauDuCT(r) === f) && (!q || (r.name + ' ' + (r.meta || '') + ' ' + (r.niche || '')).toLowerCase().includes(q.toLowerCase()))) : []
  const niv = choisi ? niveauDuCT(choisi) : ''
  return (
    <div className="fx-fld"><div className="fx-lab-row"><Lab>CT (CHOISI PAR VOUS)</Lab><button className="fx-link-btn" onClick={() => nav('/galerie')}>Gérer la galerie</button></div>
      {choisi && <div className="fx-ctchoice"><img className="fx-minithumb" src={choisi.url} alt="" /><div><b>{choisi.name}</b>
        <div className="fx-s">{niv ? 'Niveau de conscience donné par ce CT : ' + V.NIVEAU_LIB[niv] : '⚠ Ce CT n\'a pas de niveau de conscience : balisez-le dans la galerie avant de tester.'}</div>
        {choisi.meta && <div className="fx-s wrap">{String(choisi.meta).slice(0, 220)}</div>}</div></div>}
      {list === null ? <div className="fx-s">Chargement de la galerie…</div> : !ok ? <div className="fx-err">Galerie illisible : {list.error}</div> : !list.length ? <div className="fx-s">Galerie vide : ajoutez des CT avant de tester.</div> : <>
        <div className="fx-btnrow" style={{ marginTop: 8 }}>
          <input className="fx-in sm" placeholder="Chercher un CT (nom, description, niche)…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: '1 1 220px' }} />
          <select className="fx-in sm" value={f} onChange={(e) => setF(e.target.value)}><option value="">Tous les niveaux</option>{['problem', 'solution', 'product', 'most'].map((k) => <option key={k} value={k}>{V.NIVEAU_LIB[k]}</option>)}</select>
          <span className="fx-s">{vis.length} / {list.length} CT</span>
        </div>
        <div className="fx-ctgrid">{vis.map((r) => { const k = niveauDuCT(r); return (
          <button key={r.id} className={'fx-ctcell' + (r.id === m.ct ? ' on' : '')} onClick={() => set({ ct: r.id, ctRaison: '' })} title={r.meta || r.name}>
            <img src={r.url} alt="" loading="lazy" /><span>{r.name}</span><i>{k ? V.NIVEAU_LIB[k].replace(' Aware', '') : 'sans niveau'}</i></button>) })}</div></>}
    </div>
  )
}

function Output({ text, color }) {
  const cp = () => navigator.clipboard.writeText(text).then(() => toast('Copié'))
  return <div className="fx-out" style={color ? { color } : null}><button className="fx-btn sm copy" onClick={cp}>Copier</button><pre>{text}</pre></div>
}

const RUNS = {}   // slug -> { cancelled, ac } : permet d'annuler la génération en cours de cet agent
function StdTest({ a }) {
  const [m, set] = useAgentMem(a.slug, { brief: null, briefName: '', photo: null, logo: null, rctx: null, synthese: '', nb: 0, angle: 0, pos: 0, ct: null, ctRaison: '', output: '', marche: '', outErr: false, images: [], busy: false, t0: 0, dur: 0, prog: '', err: '' })
  const busy = !!m.busy, secLive = useTick(m.t0, busy), sec = busy ? secLive : (m.dur || 0)
  const isImg = a.kind === 'image', isAn = a.kind === 'analyst', isCopy = a.kind === 'copy'
  useEffect(() => { loadSkills(); loadCTImages() }, [])
  // Page rechargée pendant une génération : elle n'existe plus, on le dit sans rien effacer de ce qui est rempli.
  // syntheses-coffre-v1 : pour l'Analyste, l'analyse continue sur le serveur et y est rangée ; Factory la récupère dès qu'elle sort (20 min au plus).
  useEffect(() => {
    if (!(m.busy && !isLive(a.slug))) return
    if (!isAn) { set({ busy: false, prog: '', err: 'La page a été rechargée pendant la génération : elle a été interrompue. Tout ce que tu avais rempli est conservé, relance simplement.' }); return }
    let fini = false
    const t0 = m.t0 || Date.now()
    set({ prog: 'La page a été rechargée : l’analyse continue sur le serveur. Je la récupère dès qu’elle est prête (vérification toutes les 20 s)…', err: '' })
    const essai = async () => {
      if (fini) return
      try {
        const l = await synthesesServeur([])
        const x = l.find((e) => e.agent === 'analyst' && e.t >= t0 - 5000 && (!(m.cles || []).length || (e.cles || []).some((c) => (m.cles || []).includes(c)) || !(e.cles || []).length))
        if (x) { const d = await syntheseServeur(x.id); fini = true; set({ busy: false, prog: '', dur: Math.round((x.t - t0) / 1000), output: d.texte, synthese: d.texte, outErr: false, rangee: 'Analyse récupérée sur le serveur (' + heureCourte(x.t) + ') : la page avait été rechargée pendant la génération.' }); memoriserSynthese(m.cles, d.texte, m.briefName); return }
      } catch (_) { }
      if (Date.now() - t0 > 20 * 60000) { fini = true; set({ busy: false, prog: '', err: 'Aucune analyse rangée sur le serveur 20 minutes après le lancement : elle a été interrompue (redémarrage du serveur ?). Relance-la.' }) }
    }
    essai(); const iv = setInterval(essai, 20000)
    return () => { fini = true; clearInterval(iv) }
  }, [])
  const angles = useMemo(() => (m.synthese.trim() ? V.prodv2ExtractAngles(m.synthese, 0) : []), [m.synthese])
  const nbProd = m.brief ? Math.max(2, Math.min(12, Math.round((Number(m.brief.quantite) || 6) / 3))) : 2
  const nbAngles = m.nb || nbProd
  const run = async () => {
    if (isLive(a.slug)) return   // v5.74 : une génération de cet agent tourne déjà (double clic, double lancement : ~1 $ chaque fois)
    if (isAn && !m.brief) return alertDlg('Charge un brief.json ou prends une commande.')
    if (isAn && !m.photo) return alertDlg('Ce brief n’a pas de photo produit : l’Analyste en a besoin.')
    if (isCopy && !m.synthese.trim()) return alertDlg('Colle la Synthèse (ou prends une commande déjà analysée).')
    if (isImg) {
      if (!m.photo || !m.brief) return alertDlg('Charge un brief.json ou prends une commande (photo produit nécessaire).')
      if (!m.synthese.trim()) return alertDlg("Colle la Synthèse produite par l'Analyste de Marché.")
    }
    const my = (RUNS[a.slug] = { cancelled: false, ac: new AbortController() }); const S = (x) => { if (!my.cancelled) set(x) }
    const t0 = Date.now(); setLive(a.slug, true)
    set({ busy: true, t0, dur: 0, err: '', rangee: '', prog: isImg ? 'Préparation…' : 'Génération en cours…' })
    try {
      await loadSkills()
      if (isAn) {
        // Entrée IDENTIQUE à celle de la production (date, nombre d'angles, URL, renouvellement, photos, logo, aspects…)
        const raw = await withProd({ brief: m.brief, productB64: m.photo.b64, productMime: m.photo.mime || 'image/png', logoB64: m.logo ? m.logo.b64 : null, logoMime: m.logo ? m.logo.mime : null, renewalContext: m.rctx }, async () => {
          const { analysteSystem, analysteParts } = await V.buildAnalysteInputs(nbAngles, nbAngles * 3)
          return V.apiAnalysteSynthese(analysteSystem, analysteParts, 64000, m.brief, undefined, true, { cles: m.cles || [], titre: (m.briefName || 'Test Analyste').replace(/^Commande · /, '').slice(0, 180) })
        })
        const { synthesisText, marche } = V.prodv2SplitSynthesisAndMarche(raw)
        S({ output: synthesisText, outErr: false, marche: marche ? JSON.stringify(marche, null, 2) : '', synthese: synthesisText, bal: V.dernierBalayage() })
        memoriserSynthese(m.cles, synthesisText, m.briefName)   // v5.74 : reprise automatique par les tests Image / Copywriter / Vidéo (même commande)
        // syntheses-coffre-v1 : le serveur range lui-même l'hypothèse dès qu'elle sort ; sinon Factory la range (jusqu'à 3 essais) — elle a coûté ~1 $.
        let rangee = !!V.derniereSyntheseId()
        for (let i = 0; i < 3 && !rangee; i++) { try { await rangerSyntheseServeur(m.cles, synthesisText, (m.briefName || 'Test Analyste').replace(/^Commande · /, '').slice(0, 180), marche ? JSON.stringify(marche) : ''); rangee = true } catch (_) { await new Promise((ok) => setTimeout(ok, 3000)) } }
        S({ rangee: rangee ? 'Synthèse enregistrée sur le serveur.' : '⚠ Synthèse NON enregistrée sur le serveur : copiez-la maintenant (bouton Copier).' })
      } else if (isImg) {
        const productB64 = await V.compressImg(m.photo.b64, m.photo.mime || 'image/jpeg')
        const nbA = Math.max(angles.length, 2), ai = Math.min(m.angle, nbA - 1)
        // ── Le CT est celui que vous avez choisi ; son niveau de conscience impose celui de la créative ──
        const all = await loadCTImages()
        const ctRec = all.find((r) => r.id === m.ct)
        if (!ctRec) throw new Error('Choisissez un CT dans la galerie ci-dessus.')
        const niv = niveauDuCT(ctRec)
        if (!niv) throw new Error('Le CT « ' + ctRec.name + ' » n\'a pas de niveau de conscience. Balisez-le dans la galerie, puis relancez.')
        const { creativeSystem, angleInstruction, briefTexte, assets } = await withProd({ brief: m.brief, angles: angles.length ? angles : ['Angle 1', 'Angle 2'] }, async () => ({ ...V.buildCreativeInstruction(ai, niv, RANG_NIV[niv]), briefTexte: V.prodv2BriefTextOnly(), assets: V.prodv2AssetsText() }))
        const cleTest = String(m.cles || m.briefName || (m.brief && (m.brief.produit || m.brief.marque)) || '')
        const ds = { id: ctRec.id, raison: 'CT choisi à la main' }
        ctMemoriser(ds.id, niv, cleTest)
        S({ prog: `CT : ${ctRec.name} · ${V.NIVEAU_LIB[niv]}. Gemini 3.1 Pro raisonne et écrit le prompt → Gemini 3 Pro Image rend la créative…` })
        const ctB64 = await V.compressImg(await ctGetBase64(ds.id), CT_IMAGES[ds.id + '_mime'] || 'image/jpeg')
        const res = await fetch(SERVER + '/creative-prod', { signal: my.ac.signal, method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ systemPrompt: creativeSystem, synthese: m.synthese, brief: m.brief, angleInstruction, ctBase64: ctB64, ctMime: 'image/jpeg', productBase64: productB64, productMime: 'image/jpeg', isTest: true }) })
        const d = await res.json(); if (d.error) throw new Error(d.error)
        if (d.imageData) S((p) => ({ outErr: false, output: `✓ Générée — angle ${ai + 1} · ${V.NIVEAU_LIB[niv]} (niveau du CT) · CT : ${ctRec.name} · angle déclaré par l'agent : ${d.chosenAngle || 'n/a'}`, images: [...p.images, { src: `data:${d.imageMime};base64,${d.imageData}`, ct: ctRec.name, ctRaison: ds.raison, angle: d.chosenAngle, prompt: d.prompt, ts: Date.now() }] }))
        else S({ err: 'Aucune image reçue.' })
      } else {
        // Un angle à la fois, comme la production (même consigne, même lecture 5 hooks + description)
        const ai = Math.min(m.angle, Math.max(angles.length, 1) - 1)
        const { hooks, description } = await withProd({ synthesis: m.synthese, angles: angles.length ? angles : ['Angle 1'], brief: m.brief || {} }, () => V.prodv2GenerateOneCopyAttempt(ai))
        S({ outErr: false, output: `ANGLE ${ai + 1} — ${angles[ai] || ''}\n\n` + hooks.map((h, i) => `HOOK ${i + 1} : ${h}`).join('\n\n') + '\n\nDESCRIPTION :\n' + description })
      }
    } catch (err) { S({ err: err.message }) }
    finally { if (!my.cancelled) { setLive(a.slug, false); set({ busy: false, prog: '', dur: Math.round((Date.now() - t0) / 1000) }) } }
  }
  const annuler = async () => {
    if (!(await confirmDlg("Annuler la génération ? Le navigateur arrête d'attendre et ignore le résultat. Si le serveur avait déjà commencé un appel payant, il peut aller à son terme et être facturé.", { ok: 'Annuler la génération', danger: true }))) return
    const r = RUNS[a.slug]; if (r) { r.cancelled = true; try { r.ac.abort() } catch (_) {} }
    setLive(a.slug, false); set({ busy: false, prog: '', err: 'Génération annulée par toi. Tout ce que tu avais rempli est conservé.', dur: 0 })
  }
  const relancer = async () => {
    if (!(await confirmDlg('Relancer la génération avec les mêmes entrées ? Cela refait un appel complet (coût comme la première fois).', { ok: 'Régénérer' }))) return
    run()
  }
  const dl = (img) => { const x = document.createElement('a'); x.href = img.src; x.download = 'adstack_' + img.ct + '_' + img.ts + '.png'; x.click() }
  const AngleSeg = () => angles.length ? <Seg value={m.angle} onChange={(v) => set({ angle: v })} options={angles.map((t, i) => [i, 'Angle ' + (i + 1)])} /> : <div className="fx-s">Colle une synthèse : les angles seront détectés automatiquement.</div>
  return (
    <div className="fx-test">
      {(isAn || isImg || isCopy) && <BriefSource m={m} set={set} />}
      {isAn && <div className="fx-fld"><Lab>NOMBRE D'ANGLES (comme la commande : 3 créatives par angle)</Lab>
        <Seg value={m.nb} onChange={(v) => set({ nb: v })} options={[[0, 'Selon le brief (' + nbProd + ')'], [2, '2'], [4, '4'], [6, '6'], [8, '8']]} />
        <div className="fx-s">{m.rctx && m.rctx.estRenouvellement ? 'Renouvellement détecté : le contexte (angle gagnant, cible actuelle, synthèse existante) est transmis comme en production.' : 'Entrée construite comme en production : date du jour, nombre d’angles, lien page produit, photos et aspects, logo.'}</div></div>}
      {(isImg || isCopy) && <div className="fx-fld"><Lab>SYNTHÈSE (de l'Analyste de Marché)</Lab><textarea className="fx-ta" rows={7} value={m.synthese} onChange={(e) => set({ synthese: e.target.value, angle: 0 })} placeholder="Colle ici la synthèse complète, ou prends une commande déjà livrée, ou teste l'Analyste d'abord…" /></div>}
      {(isImg || isCopy) && <div className="fx-fld"><Lab>ANGLE À PRODUIRE</Lab><AngleSeg />{angles[m.angle] && <div className="fx-s">{angles[m.angle]}</div>}</div>}
      {isImg && <CTPicker m={m} set={set} />}
      <div className="fx-launch">{busy ? <button className="fx-btn danger big" onClick={annuler}>Annuler la génération</button> : <button className="fx-btn primary big" onClick={(m.output || (m.images && m.images.length)) ? relancer : run}>{(m.output || (m.images && m.images.length)) ? 'Régénérer' : 'Tester cet agent'}</button>}<span className="fx-s">{busy || sec ? sec + 's' : ''}{!busy && m.dur ? ' · dernière génération' : ''}</span></div>
      {isAn && m.bal && m.bal.scrapecreators && <div className="fx-hint" style={{ marginBottom: 8 }}>Balayage : {m.bal.scrapecreators.requetes} requêtes ScrapeCreators ({m.bal.scrapecreators.credits} crédits) · Reddit {m.bal.scrapecreators.reddit} · TikTok {m.bal.scrapecreators.tiktok_videos} vidéos / {m.bal.scrapecreators.tiktok_commentaires} commentaires · pubs Meta {m.bal.scrapecreators.pubs}{m.bal.scrapecreators.erreurs ? ' · ' + m.bal.scrapecreators.erreurs + ' erreur(s) (voir les logs Render)' : ''}{m.bal.monde ? ' · créatives du monde (3 derniers mois) : ' + m.bal.monde.pubs + ' pubs, ' + m.bal.monde.tiktok + ' TikTok' : ''}{m.bal.usage ? ' · USAGE DANS L’HYPOTHÈSE : ' + ['familles', 'annonceurs', 'douleurs', 'desirs', 'peurs'].filter((k) => m.bal.usage[k]).map((k) => ({ familles: 'familles d’angle', annonceurs: 'annonceurs', douleurs: 'douleurs des pubs', desirs: 'désirs des pubs', peurs: 'peurs des pubs' })[k] + ' ' + m.bal.usage[k].cites + '/' + m.bal.usage[k].total).join(', ') + ', ' + m.bal.usage.etiquettes_source + ' étiquette(s) [SOURCÉ]' : ''}</div>}
      {isAn && m.bal && !m.bal.scrapecreators && <div className="fx-hint" style={{ marginBottom: 8 }}>{m.bal.reutilise ? 'Hypothèse stockée réutilisée' : 'Balayage lancé'} — {m.bal.raison}. Aucune donnée ScrapeCreators reçue : voir les logs Render.</div>}
      {busy && m.prog && <div className="fx-hint" style={{ marginBottom: 8 }}>{m.prog}</div>}
      {m.err && <div className="fx-err" style={{ marginBottom: 8 }}>ERREUR : {m.err} <button className="fx-btn sm" onClick={() => set({ err: '' })}>Fermer</button></div>}
      {isAn && m.rangee && <div className={m.rangee.startsWith('⚠') ? 'fx-err' : 'fx-hint'} style={{ marginBottom: 8 }}>{m.rangee}</div>}
      {m.output && <Output text={m.output} color={m.outErr ? 'var(--er)' : null} />}
      {(isAn || isImg || isCopy) && <SynthesesEnregistrees cles={m.cles} onPick={(x) => set(isAn ? { output: x.texte, synthese: x.texte, marche: x.marche_json ? (() => { try { return JSON.stringify(JSON.parse(x.marche_json), null, 2) } catch (_) { return x.marche_json } })() : '', outErr: false, rangee: 'Synthèse reprise depuis le serveur (' + heureCourte(x.t) + ').' } : { synthese: x.texte, angle: 0 })} />}
      {isAn && m.marche && <div className="fx-fld"><Lab>DONNÉES MARCHÉ (JSON livré au client)</Lab><Output text={m.marche} /></div>}
      {m.images.length > 0 && <div className="fx-imgs">{m.images.map((img, i) => (
        <div className="fx-imgc" key={img.ts}><img src={img.src} alt="" />
          <div className="fx-imgc-a"><button className="fx-btn sm" onClick={() => dl(img)}>Télécharger</button><button className="fx-btn sm danger-o" onClick={() => set((p) => ({ images: p.images.filter((_, j) => j !== i) }))}>✕</button></div>
          <div className="fx-s">{img.ct} · {new Date(img.ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div></div>))}</div>}
    </div>
  )
}

export default function AgentTest() {
  const { slug } = useParams()
  const nav = useNavigate()
  const a = AGENTS.find((x) => x.slug === slug)
  const [tab, setTab] = usePersist('agenttab.' + slug, 'test')
  if (!a) return <Navigate to="/agents" replace />
  return (
    <div className="fx-wrap">
      <div className="fx-agh" style={{ '--c': a.color }}>
        <AgentArt slug={a.slug} color={a.color} />
        <div className="fx-agh-b">
          <button className="fx-back" onClick={() => nav('/agents')}>← Agents</button>
          <div className="fx-kicker" style={{ color: a.color }}>Agent {String(a.n).padStart(2, '0')}</div>
          <h1>{a.name}</h1><p>{a.role}</p>
          <div className="fx-agh-m"><div className="fx-flow"><span>{a.entree}</span><i>→</i><span className="o">{a.sortie}</span></div><span className="fx-model">{a.model}</span></div>
        </div>
      </div>
      <div className="fx-tabs"><button className={'fx-tab' + (tab === 'test' ? ' on' : '')} onClick={() => setTab('test')}>Tester</button>
        <button className={'fx-tab' + (tab === 'comp' ? ' on' : '')} onClick={() => setTab('comp')}>Compétence</button></div>
      <div className="fx-card">
        {tab === 'comp' ? (a.kind === 'video' ? <VideoPanel key="comp" competenceOnly /> : <Competence a={a} />) : a.kind === 'video' ? <VideoPanel key="test" /> : <StdTest a={a} key={a.slug} />}
      </div>
    </div>
  )
}
