// budget-client-v1 + rectifications-v1 (24 nov. 2026) — décisions du fondateur :
// 1. Budget de production du client pour le mois (117 $ PERF+, proportionnel aux crédits), visible dans la commande : dépensé, reste,
//    vidéos faites, budget donné à la prochaine vidéo, alerte à 80 % et à 100 %.
// 2. Rectifications demandées par le client depuis AdBoard (vidéos seulement, une par vidéo, livrées en 24 h) :
//    Préparer (traduction en plans à refaire + avis de faisabilité) → Copier pour Claude (vérification) → Lancer la correction (plafond 3 $) → Livrer au client.
import React, { useEffect, useState } from 'react'
import { SERVER, emit } from '../prod/state'
import * as E from '../prod/engine'
import { toast } from '../ui'

const tok = () => { try { return (JSON.parse(localStorage.getItem('factory_admin_sb_session') || 'null') || {}).access_token || '' } catch (_) { return '' } }
const H = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok(), 'ngrok-skip-browser-warning': '1' })
const usd = (n) => (Number(n) || 0).toFixed(2) + ' $'
const quand = (ms) => { try { return new Date(ms).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) } catch (_) { return '' } }
const restant = (ms) => { const m = Math.round((ms - Date.now()) / 60000); if (m <= 0) return 'en retard de ' + Math.floor(-m / 60) + ' h ' + String(-m % 60).padStart(2, '0'); return Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') + ' restantes' }
const COUL = { ok: '#22C55E', attention: '#F59E0B', depasse: '#EF4444' }

export function BudgetClient({ S }) {
  const [d, setD] = useState(null)
  const cmd = S.commandeId
  const charger = () => { if (!cmd) return; fetch(SERVER + '/budget/client?commande_id=' + encodeURIComponent(cmd), { headers: H() }).then((r) => r.json()).then(setD).catch(() => setD({ erreur: true })) }
  useEffect(() => { charger(); const t = setInterval(charger, 60000); return () => clearInterval(t) }, [cmd])
  if (!cmd || !d || d.erreur || d.error) return null
  if (d.sans_client || d.sans_abonnement) return <div className="fx2-card slim" data-testid="budget-client" style={{ fontSize: 12.5, color: 'var(--sec)' }}>Budget de production : {d.sans_client ? 'commande sans client (test)' : 'client sans abonnement actif'} — chaque vidéo part à 8 $ tout compris.</div>
  const coul = COUL[d.alerte || 'ok'], pct = Math.min(100, d.pct)
  return (
    <div className="fx2-card slim" data-testid="budget-client">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 13.5 }}>Budget de production du client</b>
        <span style={{ fontSize: 12, color: 'var(--sec)' }}>offre {d.plan} · mois du {quand(d.periode.debut)} au {quand(d.periode.fin)}</span>
        <span style={{ flex: 1 }} />
        <b style={{ fontSize: 13.5, color: coul }}>{usd(d.depense_usd)} / {usd(d.plafond_usd)}</b>
      </div>
      <div style={{ height: 8, borderRadius: 6, background: 'rgba(255,255,255,.08)', margin: '10px 0 8px', overflow: 'hidden' }}><div style={{ width: pct + '%', height: '100%', background: coul, transition: 'width .4s' }} /></div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--sec)' }}>
        <span>Reste : <b style={{ color: 'var(--fg, #fff)' }}>{usd(d.reste_usd)}</b></span>
        <span>Vidéos : {d.videos_faites} faites sur {d.videos_prevues}</span>
        <span>Prochaine vidéo : <b style={{ color: 'var(--fg, #fff)' }}>{usd(d.budget_video.total_usd)}</b> tout compris</span>
        <span>Cette commande : {usd(d.commande.total)} (vidéos {usd(d.commande.videos)} · reste {usd(d.commande.hors_video)})</span>
        {d.rectifications_en_attente > 0 && <span>{d.rectifications_en_attente} rectification(s) en attente</span>}
      </div>
      {d.alerte && <div className="fx-banner" style={{ marginTop: 10, borderColor: coul, color: coul }}>{d.alerte === 'depasse' ? 'Budget du mois dépassé : chaque vidéo restante garde ses 8 $ (la qualité passe avant). Regardez ce qui a coûté le plus : vidéos refaites, reprises, textes réécrits.' : 'Budget du mois à ' + d.pct + ' % : évitez les vidéos refaites en entier, préférez le texte d\'abord et les corrections de plans.'}</div>}
    </div>
  )
}

function texteClaude(S, r, plans, prep) {
  const c = S.creatives[r.index] || {}, j = c.job || {}
  return ['RECTIFICATION À VÉRIFIER — ' + ((S.brief && S.brief.product && S.brief.product.nom) || 'produit') + ' · commande ' + S.commandeId + ' · créative n°' + (r.index + 1) + ' (vidéo)',
    'CT : ' + (j.ctNom || c.ct || '?') + (j.dossierUrl ? ' · dossier : ' + j.dossierUrl : '') + (c.videoUrl ? ' · vidéo : ' + c.videoUrl : ''),
    '', 'DEMANDE DU CLIENT :', r.texte, '', 'PLANS DE LA VIDÉO :',
    ...plans.map((p) => 'Plan ' + p.bloc + (p.t0 != null ? ' (' + Number(p.t0).toFixed(1) + '–' + Number(p.t1).toFixed(1) + ' s)' : '') + ' : ' + (p.dit ? '« ' + p.dit + ' »' : 'sans parole')),
    ...(prep ? ['', 'PROPOSITION (' + prep.faisable + ') : ' + prep.explication, ...prep.plans.map((x) => '→ plan ' + x.bloc + ' : ' + x.consigne), ...(prep.hors_correcteur || []).map((x) => '✗ hors correcteur : ' + x)] : []),
  ].join('\n')
}

// rectifications-v2 (25 nov. 2026) — décision du fondateur : l'agent qui prépare la rectification doit COMPRENDRE la vidéo entière avant de toucher
// un plan (corriger « en sniper », sans casser la trame ni la dynamique). Factory lui envoie donc des images de la vidéo livrée (une au milieu de
// chaque plan) et de la vidéo du CT, en plus du texte du client et des répliques. Le fondateur choisit ensuite : correction des plans (≤ 3 $) ou vidéo refaite de zéro (≈ 8 $).
async function imagesDe(url, instants, larg = 320) {
  if (!url || !instants.length) return []
  const v = document.createElement('video'); v.crossOrigin = 'anonymous'; v.muted = true; v.preload = 'auto'; v.src = url
  await new Promise((ok, ko) => { v.onloadeddata = ok; v.onerror = () => ko(new Error('vidéo illisible')); setTimeout(() => ko(new Error('délai')), 20000) })
  const c = document.createElement('canvas'), out = []
  for (const t of instants) {
    try {
      await new Promise((ok, ko) => { v.onseeked = ok; v.onerror = ko; v.currentTime = Math.max(0, Math.min((v.duration || t) - 0.05, t)); setTimeout(ok, 4000) })
      c.width = larg; c.height = Math.round(larg * (v.videoHeight || 16) / (v.videoWidth || 9))
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height)
      out.push({ t: +t.toFixed(1), data: c.toDataURL('image/jpeg', 0.72).split(',')[1] })
    } catch (_) { }
  }
  return out
}

function Rectif({ S, r, plafond, recharger }) {
  const [busy, setBusy] = useState('')
  const [plans, setPlans] = useState(() => ((r.preparation && r.preparation.plans) || []).map((x) => ({ ...x })))
  useEffect(() => { setPlans(((r.preparation && r.preparation.plans) || []).map((x) => ({ ...x }))) }, [r.preparation && r.preparation.t])
  const c0 = S.creatives[r.index], job = (c0 && c0.job) || {}
  // rectifications-v3 : la vidéo visée vient du serveur (celle que le client a vue) quand la production n'est pas chargée dans Factory
  const c = c0 || (r.video_url ? { videoUrl: r.video_url, ct: r.ct_nom } : null)
  const vUrl = (c0 && c0.videoUrl) || r.video_url || null, ctUrl = job.ctVideoUrl || r.ct_video_url || null, ctNom = job.ctNom || (c0 && c0.ct) || r.ct_nom || ''
  const plansVideo = (job.plans || []).map((p) => ({ bloc: p.bloc, t0: p.t0, t1: p.t1, dit: p.dit || '' }))
  const enCours = !!(job.execution && !c.videoUrl && !['echec', 'annule', 'termine', 'plan_pret'].includes(job.etat))
  const fini = ['livree', 'refusee'].includes(r.etat)
  const preparer = async () => {
    setBusy('Préparation')
    let images = [], imagesCT = []
    try {
      const inst = plansVideo.filter((p) => p.t0 != null).map((p) => (Number(p.t0) + Number(p.t1)) / 2)
      images = await imagesDe(vUrl, inst.slice(0, 14))
      if (ctUrl) { const v = document.createElement('video'); v.src = ctUrl; v.preload = 'metadata'; const d = await new Promise((ok) => { v.onloadedmetadata = () => ok(v.duration || 0); v.onerror = () => ok(0); setTimeout(() => ok(0), 10000) }); if (d) imagesCT = await imagesDe(ctUrl, Array.from({ length: 8 }, (_, i) => d * (i + 0.5) / 8), 240) }
    } catch (e) { toast('Images de la vidéo non lues (' + e.message + ') : préparation sur le texte seul.', 7000) }
    setBusy('')
    return post('/revisions/preparer', { plans: plansVideo, images, images_ct: imagesCT }, 'Préparation')
  }
  const refaire = async () => {
    if (busy !== 'confirmer') { setBusy('confirmer'); setTimeout(() => setBusy((b) => (b === 'confirmer' ? '' : b)), 6000); return }
    setBusy('Refaire')
    try { await E.relancerVideo(r.index); await post('/revisions/maj', { etat: 'en_cours', plans: [{ bloc: 0, consigne: 'vidéo refaite de zéro (même CT)' }] }, 'Mise à jour'); toast('Vidéo relancée de zéro avec son CT (≈ 8 $). Livrez au client quand elle est prête.') }
    catch (e) { toast('Relance impossible : ' + e.message, 9000) } finally { setBusy('') }
  }
  const post = async (route, corps, etape) => {
    setBusy(etape)
    try {
      const x = await fetch(SERVER + route, { method: 'POST', headers: H(), body: JSON.stringify({ commande_id: S.commandeId, id: r.id, ...corps }) })
      const j = await x.json().catch(() => ({}))
      if (!x.ok || j.error) throw new Error(j.error || 'HTTP ' + x.status)
      recharger(); return j
    } catch (e) { toast(etape + ' impossible : ' + e.message, 9000); return null } finally { setBusy('') }
  }
  const lancer = async () => {
    const ok = plans.filter((x) => x.bloc > 0 && String(x.consigne || '').trim().length >= 4)
    if (!ok.length) return toast('Aucun plan à refaire : préparez d\'abord ou écrivez une consigne.')
    setBusy('Lancement')
    try {
      const ex = await E.corrigerVideo(r.index, ok, { maxUsd: plafond })
      if (ex) await post('/revisions/maj', { etat: 'en_cours', execution: typeof ex === 'string' ? ex : undefined, plans: ok }, 'Mise à jour')
    } finally { setBusy('') }
  }
  const coul = r.etat === 'livree' ? '#22C55E' : r.etat === 'refusee' ? '#9AA0AB' : r.echeance < Date.now() ? '#EF4444' : '#F59E0B'
  return (
    <div className="fx2-corr" style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <b style={{ fontSize: 13 }}>🎬 Vidéo à rectifier : créative n°{r.index + 1}{r.angle ? ' · angle ' + r.angle + (r.angle_titre ? ' « ' + r.angle_titre + ' »' : '') : ''}{ctNom ? ' · CT « ' + ctNom + ' »' : ''}</b>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: coul }}>{{ nouvelle: 'Nouvelle', preparee: 'Préparée', en_cours: 'Correction en cours', livree: 'Livrée', refusee: 'Refusée' }[r.etat] || r.etat}</span>
        <span style={{ fontSize: 11.5, color: 'var(--sec)' }}>demandée le {quand(r.t)}{fini ? (r.livree_t ? ' · livrée le ' + quand(r.livree_t) : '') : ' · ' + restant(r.echeance)}</span>
      </div>
      <div className="fx2-corr-v" style={{ whiteSpace: 'pre-wrap', color: 'var(--fg, #fff)' }}>« {r.texte} »</div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '8px 0' }}>
        {vUrl ? <div style={{ flex: '0 1 240px', minWidth: 0 }}><div style={{ fontSize: 11.5, color: '#F59E0B', marginBottom: 4, fontWeight: 700 }}>Vidéo que le client veut faire rectifier</div><video src={vUrl} controls playsInline preload="metadata" poster={r.poster || undefined} style={{ width: '100%', borderRadius: 8, background: '#000', outline: '2px solid #F59E0B' }} /><a href={vUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11.5 }}>Ouvrir la vidéo seule</a></div>
          : <div className="fx2-corr-v" style={{ color: '#F59E0B' }}>Vidéo introuvable dans la commande (créative n°{r.index + 1}).</div>}
        {ctUrl && <div style={{ flex: '0 1 240px', minWidth: 0 }}><div style={{ fontSize: 11.5, color: 'var(--sec)', marginBottom: 4 }}>CT d'origine · {ctNom}</div><video src={ctUrl} controls playsInline preload="metadata" style={{ width: '100%', borderRadius: 8, background: '#000' }} /></div>}
      </div>
      {r.preparation && <div className="fx2-corr-v"><b>Faisable : {r.preparation.faisable}</b> — {r.preparation.explication}{(r.preparation.hors_correcteur || []).length > 0 && <> · Hors correcteur : {r.preparation.hors_correcteur.join(' ; ')}</>}{(r.preparation.retouches_montage || []).length > 0 && <> · Montage seul : {r.preparation.retouches_montage.join(' ; ')}</>}{r.preparation.conseil === 'refaire' && <b style={{ color: '#F59E0B' }}> · Conseil : refaire de zéro</b>}{r.preparation.images_vues ? <span style={{ color: 'var(--sec)' }}> · {r.preparation.images_vues} images regardées</span> : <span style={{ color: '#F59E0B' }}> · préparé sur le texte seul</span>}</div>}
      {!fini && plans.map((p, k) => <div key={k} className="fx2-corr-p on">
        <span className="fx2-corr-d"><b>Plan {p.bloc}</b>{(plansVideo.find((v) => v.bloc === p.bloc) || {}).dit ? <span>« {(plansVideo.find((v) => v.bloc === p.bloc) || {}).dit} »</span> : null}</span>
        <textarea className="fx-in" rows={2} value={p.consigne} onChange={(e) => { const v = e.target.value; setPlans((o) => o.map((x, i) => (i === k ? { ...x, consigne: v } : x))) }} />
      </div>)}
      {!fini && <div className="fx2-corr-a" style={{ flexWrap: 'wrap' }}>
        <button className="fx-btn sm" disabled={!!busy || !plansVideo.length} title={plansVideo.length ? 'Traduit la demande en plans à refaire et dit ce qui est faisable' : 'Plans de la vidéo inconnus'} onClick={preparer}>{busy === 'Préparation' ? 'Préparation…' : r.preparation ? '↻ Préparer à nouveau' : '① Préparer'}</button>
        <button className="fx-btn sm" onClick={() => navigator.clipboard.writeText(texteClaude(S, r, plansVideo, r.preparation ? { ...r.preparation, plans } : null)).then(() => toast('Copié : collez-le à Claude pour vérification'), () => toast('Copie refusée par le navigateur'))}>② Copier pour Claude</button>
        <button className="fx-btn sm primary" disabled={!!busy || enCours || !c || !c.videoUrl || !plans.length} title={'Refait seulement ces plans ; plafond ' + plafond + ' $ de dépense neuve'} onClick={lancer}>{busy === 'Lancement' ? 'Lancement…' : enCours ? 'Correction en cours…' : '③ Lancer la correction'}</button>
        <button className="fx-btn sm primary" disabled={!!busy || enCours || !c || !c.videoUrl || r.etat !== 'en_cours'} title="Remplace la vidéo du client dans AdBoard par la version corrigée et le prévient" onClick={() => post('/revisions/livrer', {}, 'Livraison')}>{busy === 'Livraison' ? 'Livraison…' : '④ Livrer au client'}</button>
        <button className="fx-btn sm" disabled={(!!busy && busy !== 'confirmer') || enCours || !c} title="Refait toute la vidéo avec le même CT (≈ 8 $ tout compris) quand l'erreur est trop grosse pour une correction de plans" onClick={refaire}>{busy === 'confirmer' ? 'Cliquez encore pour confirmer (≈ 8 $)' : busy === 'Refaire' ? 'Relance…' : '↻ Refaire de zéro (≈ 8 $)'}</button>
        <button className="fx-btn sm" disabled={!!busy} onClick={() => post('/revisions/maj', { etat: 'refusee' }, 'Refus')}>Refuser</button>
      </div>}
    </div>
  )
}

export function Rectifications({ S }) {
  const [d, setD] = useState(null)
  const cmd = S.commandeId
  const charger = () => { if (!cmd) return; fetch(SERVER + '/revisions/liste?commande_id=' + encodeURIComponent(cmd), { headers: H() }).then((r) => r.json()).then(setD).catch(() => setD(null)) }
  useEffect(() => { charger(); const t = setInterval(charger, 60000); return () => clearInterval(t) }, [cmd])
  const liste = (d && d.revisions) || []
  // rectifications-v4 : les vidéos visées sont marquées sur leur carte de la production, et l'écran descend sur cette section à l'ouverture
  useEffect(() => { try { const ix = liste.filter((r) => !['livree', 'refusee'].includes(r.etat)).map((r) => r.index); S.ui.rectifIdx = ix; emit() } catch (_) { } }, [d])
  const ref = React.useRef(null), vu = React.useRef(false)
  useEffect(() => { if (liste.length && ref.current && !vu.current) { vu.current = true; setTimeout(() => { try { ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' }) } catch (_) { } }, 300) } }, [liste.length])
  if (!cmd || !liste.length) return null
  const ouvertes = liste.filter((r) => !['livree', 'refusee'].includes(r.etat)).length
  return (
    <section ref={ref} className="fx2-card" data-testid="rectifications" style={{ outline: '2px solid #F59E0B' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 14 }}>🩹 Rectifications demandées par le client</b>
        <span style={{ fontSize: 12, color: 'var(--sec)' }}>{ouvertes} à traiter · une par vidéo · 24 h pour livrer · plafond {d.plafond_usd} $ par correction</span>
      </div>
      {liste.map((r) => <Rectif key={r.id} S={S} r={r} plafond={d.plafond_usd} recharger={charger} />)}
    </section>
  )
}
