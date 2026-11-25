import React, { useEffect, useMemo, useState } from 'react'
import { usePersist } from '../agentStore'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useData } from '../data'
import { etat, SERVER, prio, estPrioritaire, nomOffre, calendrierCommande, etatAuto, rectifOuvertes } from '../api'
import Icon from '../Icon'
import { openCommande, supprimerTicket, commandeToBrief } from '../prod/engine'
import * as E from '../prod/engine'
import { ManualSend } from './Production'
import { alertDlg } from '../ui'

function useNow(ms = 1000) { const [n, setN] = useState(Date.now()); useEffect(() => { const t = setInterval(() => setN(Date.now()), ms); return () => clearInterval(t) }, [ms]); return n }
const pad = (n) => String(n).padStart(2, '0')

// Compte à rebours, calé sur la production automatique (même calendrier que le serveur) :
// offre 48 h → démarrage à 12 h, envoi à 36 h ; offre 24 h → démarrage à 6 h, envoi à 18 h (comptés depuis la demande)
const duree = (r) => Math.floor(r / 3600e3) + 'h' + pad(Math.floor((r % 3600e3) / 60e3))
function Timer({ b, now }) {
  const c = calendrierCommande(b)
  if (b.status === 'pending') {
    const r = c.finAttente - now
    return r > 0 ? <span className="fx-time"><Icon n="clock" s={12} /> démarrage dans {duree(r)}</span> : <span className="fx-time off">Attente terminée</span>
  }
  if (b.status === 'in_production') {
    const r = c.envoi - now, e = c.echeance - now
    if (r > 0) return <span className="fx-time"><Icon n="clock" s={12} /> envoi dans {duree(r)}</span>
    return e > 0 ? <span className="fx-time urgent">À envoyer · échéance dans {duree(e)}</span> : <span className="fx-time urgent">Échéance dépassée — envoie le lot</span>
  }
  return null
}

export function OrderRow({ b, compact, now, onBrief, onLivrables }) {
  const nav = useNavigate()
  const { reload } = useData()
  const [busy, setBusy] = useState(false)
  const e = etat(b), au = etatAuto(b)
  const photo = b.photo_nobg || b.product?.photo_base64 || b.product?.photo_url
  const open = async () => {
    setBusy(true)
    try { if (await openCommande(b.id)) nav('/production') } finally { setBusy(false) }
  }
  const label = b.status === 'pending' ? 'Lancer' : b.status === 'done' ? 'Nouveau lot' : 'Reprendre'
  const rl = E.resumeLivrables(b)
  const [envoi, setEnvoi] = useState(false)
  const envoyer = async () => { setEnvoi(true); try { await E.envoyerCommande(b, reload) } finally { setEnvoi(false) } }
  return (
    <div className={'fx-row' + (e.key === 'ready' ? ' ready' : '')}>
      {photo ? <img className="fx-thumb" src={photo} alt="" onError={(x) => (x.currentTarget.style.visibility = 'hidden')} /> : <div className="fx-thumb">—</div>}
      <div className="fx-grow">
        <div className="fx-t"><span className="fx-nom">{b.product?.nom || 'Produit'}</span> <span className={'fx-tag ' + e.key}>{e.label}</span>{estPrioritaire(b) && <span className="fx-tag star" title="Offre SCALE : file prioritaire">★ Prioritaire</span>}{au && <span className={'fx-tag auto ' + au.k} title="Production automatique">{au.t}</span>}</div>
        <div className="fx-s"><span className="fx-offre">{nomOffre(b.client?.plan)}</span> {b.quantity || 6} créatives · {b.client?.email || (b.client?.user_id || '').slice(0, 8)}</div>
        {now && (b.status === 'pending' || b.status === 'in_production') && <div className="fx-s2"><Timer b={b} now={now} /></div>}
      </div>
      <div className="fx-row-act">
        {e.key !== 'off' && <button className={'fx-btn' + (e.key === 'wait' || e.key === 'ready' ? ' primary' : '')} disabled={busy} onClick={open}>{busy ? '…' : '▶ ' + label}</button>}
        {!compact && !rl.rien && onLivrables && <button className="fx-btn" title="Voir, régénérer, envoyer sur ton compte, dossier complet" onClick={() => onLivrables(b.id)}>Livrables ({rl.creatives}/{rl.attendu})</button>}
        {!compact && b.status === 'in_production' && <button className={'fx-btn' + (e.key === 'ready' ? ' purple' : ' primary')} disabled={envoi} onClick={envoyer}>{envoi ? 'Envoi…' : 'Envoyer au client'}</button>}
        {!compact && b.status === 'done' && <button className="fx-btn" disabled={envoi} title="Renvoyer si le client signale un manque" onClick={envoyer}>{envoi ? 'Envoi…' : '↻ Renvoyer'}</button>}
        {!compact && <button className="fx-btn icon" title="Voir le brief" onClick={() => onBrief(b.id)}>Brief</button>}
        {!compact && <button className="fx-btn icon danger-o" title="Supprimer" onClick={() => supprimerTicket(b.id, reload)}>✕</button>}
      </div>
    </div>
  )
}

export function BriefPanel({ id, onClose }) {
  const [b, setB] = useState(null), [err, setErr] = useState('')
  useEffect(() => { fetch(`${SERVER}/commandes`, { headers: { 'ngrok-skip-browser-warning': '1' } }).then((r) => r.json()).then((l) => { const x = l.find((y) => y.id === id); x ? setB(x) : setErr('Brief introuvable.') }).catch((e) => setErr(e.message)) }, [id])
  const p = b?.product || {}
  const ASP = { face: 'Face', cote: 'Côté', dos: 'Dos', forme: 'Produit lui-même', prepare: 'Préparé / en usage', en_main: 'En main', kit: 'Kit / cadeau', detail: 'Détail', autre: 'Autre' }
  const R = ({ l, children }) => (children ? <div className="fx-bf"><label>{l}</label><div>{children}</div></div> : null)
  const Thumbs = ({ urls, lib }) => <div className="fx-thumbs">{urls.map((u, i) => <a key={i} href={u} target="_blank" rel="noopener noreferrer"><img src={u} alt="" loading="lazy" /><span>{lib(u, i)}</span></a>)}</div>
  const photo = b && (b.photo_nobg || p.photo_base64 || p.photo_url)
  const telechargerBrief = () => {
    const blob = new Blob([JSON.stringify(commandeToBrief(b), null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = 'brief_' + String(p.nom || 'client').replace(/[^a-z0-9]+/gi, '_').slice(0, 40) + '.json'
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }
  const gal = (p.galerie_images || []).filter(Boolean), caps = (p.avis_captures || []).filter(Boolean), asp = p.galerie_aspects || {}
  return (
    <div className="fx-modal-back right" onClick={onClose}>
      <aside className="fx-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="fx-drawer-h"><h3>Brief client</h3><span>{b && <button className="fx-btn" style={{ marginRight: 8 }} onClick={telechargerBrief}>Télécharger brief.json</button>}<button className="fx-btn" onClick={onClose}>Fermer</button></span></div>
        {!b && !err && <div className="fx-empty">Chargement du brief…</div>}
        {err && <div className="fx-err">{err}</div>}
        {b && <div className="fx-bfs">
          {photo && <div className="fx-bphoto"><img src={photo} alt="" /></div>}
          <R l="Produit"><b>{p.nom}</b></R>
          <R l="Quantité commandée"><b style={{ color: 'var(--ac)' }}>{b.quantity} créatives</b></R>
          <R l="Prix · Pays">{p.pricing || '—'} · {p.pays || '—'}</R>
          {(p.marches || []).length > 1 && <R l="Mode multi-marché">{p.marches.join(', ')} — {p.prix_affichable === false ? 'prix NON affiché sur les visuels (il diffère selon les pays)' : 'prix affichable (identique partout)'}</R>}
          {Object.keys(p.prix_par_pays || {}).length > 0 && <R l="Prix par pays">{Object.entries(p.prix_par_pays).map(([k, v]) => <div key={k}>{String(k)} : {String(v)}</div>)}</R>}
          {(p.marches_ecartes || []).length > 0 && <R l="Marchés écartés (à demander séparément)">{p.marches_ecartes.map((e, i) => <div key={i}>{String(e.nom)} — {String(e.raison)}</div>)}</R>}
          {gal.length > 0 && <R l={`Photos du produit (${gal.length})`}><Thumbs urls={gal} lib={(u) => ASP[asp[u]] || 'Photo'} /></R>}
          {p.logo_url && <R l="Logo"><Thumbs urls={[p.logo_url]} lib={() => 'Logo'} /></R>}
          {caps.length > 0 && <R l={`Captures d'avis (${caps.length})`}><Thumbs urls={caps} lib={(u, i) => 'Avis ' + (i + 1)} /></R>}
          <R l="Offre promo en cours">{p.promo}</R>
          <R l={p.cible_auto ? 'Cible (suggérée auto)' : 'Cible'}>{p.cible}</R>
          <R l="Garantie">{p.garantie}</R>
          <R l="Livraison · Paiement">{p.livraison_paiement}</R>
          <R l="Avis clients (texte)">{(p.avis_textes || []).length ? (p.avis_textes || []).map((x, i) => <div key={i}>« {String(x)} »</div>) : null}</R>
          <R l="Notes du client">{p.notes ? String(p.notes) : ''}</R>
          <R l="Utilité">{p.utilite}</R>
          {(p.couleurs || []).filter(Boolean).length > 0 && <R l="Couleurs"><div className="fx-sw">{p.couleurs.filter(Boolean).map((c, i) => <i key={i} style={{ background: c }} title={c} />)}</div></R>}
          <R l="Client">{b.client?.email || b.client?.user_id} · {nomOffre(b.client?.plan)}</R>
          <R l="Commandé le">{new Date(b.created_at).toLocaleString('fr-FR')}</R>
          {b.history?.batches_count > 0 ? <R l="Historique">{b.history.batches_count} lot(s) précédent(s) · {b.history.total_creatives_done} créatives déjà livrées</R> : <div className="fx-note">Premier lot pour ce produit — pas d'historique à considérer.</div>}
        </div>}
      </aside>
    </div>
  )
}

// livrables-v1 — tout ce qui a été produit pour cette commande, rangé dans sa carte (stockage AdStack, rien n'expire)
const coupeTitre = (t) => String(t || '').split(/\s+\d{1,2}\s*[.)]\s+(?:Porte|Facette|Triplet|Moment|Preuve)\b/)[0].trim()   // titre-angle-v2 : les anciennes commandes ont la « porte vers le noyau » collée au titre
const nomAngle = (a, i) => { if (!a) return 'Angle ' + (i + 1); if (typeof a === 'string') return coupeTitre(a.split('\n')[0]).slice(0, 90); return String(a.nom || a.titre || a.title || a.angle || a.name || ('Angle ' + (i + 1))).slice(0, 90) }
const estVid = (c) => !!c && (c.type === 'video' || c.kind === 'video' || c.ctIdx === 'video' || !!c.videoUrl)
export function LivrablesPanel({ id, onClose }) {
  const nav = useNavigate()
  const { reload } = useData()
  const [b, setB] = useState(null), [err, setErr] = useState(''), [pick, setPick] = useState(false), [busy, setBusy] = useState('')
  const charger = () => fetch(`${SERVER}/commandes`, { headers: { 'ngrok-skip-browser-warning': '1' } }).then((r) => r.json()).then((l) => { const x = l.find((y) => y.id === id); x ? setB(x) : setErr('Commande introuvable.') }).catch((e) => setErr(e.message))
  useEffect(() => { charger() }, [id])
  const d = (b && b.deliverables) || {}, r = b ? E.resumeLivrables(b) : null
  const crea = (d.creatives || []).map((c, i) => ({ c, i })).filter((x) => x.c)
  const nbA = r ? r.copiesAttendues : 0
  const revs = (b && Array.isArray(b.revisions) ? b.revisions : []).filter((x) => x && !['livree', 'refusee'].includes(x.etat))   // rectifications-v3
  const dossiers = (b && Array.isArray(b.dossiers) ? b.dossiers : []).slice().reverse()
  const tache = async (cle, fn) => { setBusy(cle); try { await fn() } finally { setBusy(''); charger() } }
  // Ouvre la commande dans la production (sans la repasser « en cours ») puis lance l'action : on la suit en direct là-bas.
  const dansProd = (action) => tache('prod', async () => { if (await E.chargerCommande(id)) { nav('/production'); if (action) setTimeout(action, 400) } })
  const surMonCompte = () => { if (!E.monCompte()) { setPick(true); return } tache('moi', async () => { if (await E.chargerCommande(id)) await E.envoyerSurMonCompte() }) }
  return (
    <div className="fx-modal-back right" onClick={onClose}>
      <aside className="fx-drawer fx-liv" onClick={(e) => e.stopPropagation()}>
        <div className="fx-drawer-h"><h3>Livrables{b ? ' · ' + (b.product?.nom || 'Produit') : ''}</h3><button className="fx-btn" onClick={onClose}>Fermer</button></div>
        {!b && !err && <div className="fx-empty">Chargement des livrables…</div>}
        {err && <div className="fx-err">{err}</div>}
        {b && <>
          <div className="fx-liv-sum">
            <span>{b.client?.email || '—'} · {nomOffre(b.client?.plan)}</span>
            <span className={'fx-tag ' + etat(b).key}>{etat(b).label}</span>
            <b>{r.creatives}/{r.attendu} créatives</b><b>{r.videos} vidéo{r.videos > 1 ? 's' : ''}</b><b>{r.copies}/{r.copiesAttendues} ad copies</b><b>Marché {r.marche ? '✓' : '✗'}</b>
          </div>
          <div className="fx-liv-act">
            <button className="fx-btn purple" disabled={!!busy || r.rien} onClick={() => tache('client', () => E.envoyerCommande(b, reload))}>{busy === 'client' ? 'Envoi…' : b.status === 'done' ? '↻ Renvoyer au client' : 'Envoyer au client'}</button>
            <button className="fx-btn primary" disabled={!!busy || r.rien} onClick={surMonCompte}>{busy === 'moi' ? 'Envoi…' : E.monCompte() ? 'Envoyer sur mon compte' : 'Envoyer sur mon compte (choisir)'}</button>
            {dossiers[0] && <a className="fx-btn" href={dossiers[0].url} target="_blank" rel="noopener noreferrer">Télécharger le dossier complet</a>}
            <button className="fx-btn" disabled={!!busy || r.rien} onClick={() => tache('dossier', async () => { if (await E.chargerCommande(id)) await E.genererDossier() })}>{busy === 'dossier' ? 'Dossier en cours…' : dossiers[0] ? 'Refaire le dossier' : 'Faire le dossier complet'}</button>
            <button className="fx-btn" disabled={!!busy} onClick={() => dansProd(null)}>Ouvrir dans la production</button>
          </div>
          <div className="fx-note">Tout est rangé dans la carte de cette commande (stockage AdStack) : rien n'expire. Régénérer ou changer de CT ouvre la production pour suivre la génération en direct.</div>
          {r.rien && <div className="fx-empty">Aucun livrable rangé pour l'instant.</div>}
          {Array.from({ length: nbA }, (_, a) => {
            const items = crea.filter((x) => (x.c.angleIdx || 0) === a), cp = (d.copies || [])[a]
            if (!items.length && !cp) return null
            return (
              <section key={a} className="fx-liv-ang">
                <h4><span>Angle {a + 1}</span>{nomAngle((d.angles || [])[a], a)}</h4>
                <div className="fx-liv-grid">
                  {items.map(({ c, i }) => {
                    const v = estVid(c), pret = c.status === 'done' && (c.url || c.videoUrl || c.imgB64)
                    const src = c.url || (c.imgB64 ? 'data:image/png;base64,' + c.imgB64 : '')
                    return (
                      <div key={i} className="fx-liv-t" style={revs.some((x) => x.index === i) ? { outline: '2px solid #F59E0B', borderRadius: 10 } : undefined}>
                        <div className={'fx-liv-m' + (v ? ' v' : '')}>
                          {pret ? (v ? <video src={c.videoUrl} poster={c.thumbUrl || undefined} controls playsInline preload="none" /> : <img src={src} alt="" loading="lazy" />) : <div className="fx-liv-vide">{v ? 'Vidéo pas prête' : 'Image pas prête'}</div>}
                        </div>
                        <div className="fx-liv-c"><b>{v ? 'Vidéo' : 'Image'}</b><span>{c.ct ? 'CT ' + c.ct : ''}{c.aRevoir ? ' · à revoir' : ''}</span></div>
                        {revs.filter((x) => x.index === i).map((x) => <div key={x.id} style={{ fontSize: 12, color: '#F59E0B', margin: '4px 0', whiteSpace: 'pre-wrap' }}><b>🩹 Rectification demandée</b> : « {String(x.texte || '').slice(0, 220)} »<br /><button className="fx-btn sm primary" style={{ marginTop: 6 }} disabled={!!busy} onClick={() => dansProd()}>Traiter la rectification</button></div>)}
                        <div className="fx-liv-b">
                          {v ? <button className="fx-btn sm" disabled={!!busy} onClick={() => dansProd(() => E.relancerVideo(i))}>↻ Refaire la vidéo</button>
                             : <><button className="fx-btn sm" disabled={!!busy} onClick={() => dansProd(() => E.regenerateCrea(i))}>↻ Régénérer</button><button className="fx-btn sm" disabled={!!busy} onClick={() => dansProd(() => E.regenerateCreaAutreCT(i))}>Autre CT</button></>}
                          {pret && <a className="fx-btn sm" href={v ? c.videoUrl : src} target="_blank" rel="noopener noreferrer" download>Télécharger</a>}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {cp && <details className="fx-liv-cp"><summary>Ad copy · {(cp.hooks || []).filter(Boolean).length} titres <button className="fx-btn sm" disabled={!!busy} onClick={(e) => { e.preventDefault(); dansProd(() => E.regenerateCopy(a)) }}>↻ Réécrire</button></summary>
                  <ol>{(cp.hooks || []).filter(Boolean).map((h, k) => <li key={k}>{String(h)}</li>)}</ol>
                  <p>{String(cp.description || '')}</p>
                </details>}
              </section>
            )
          })}
          {dossiers.length > 1 && <div className="fx-liv-dos"><label>Dossiers précédents</label>{dossiers.slice(1).map((x, k) => <a key={k} href={x.url} target="_blank" rel="noopener noreferrer">{new Date(x.date).toLocaleString('fr-FR')}{x.fichiers ? ' · ' + x.fichiers + ' fichiers' : ''}</a>)}</div>}
        </>}
        {pick && <ManualSend scope={null} onClose={() => setPick(false)} onPicked={(m) => { E.setMonCompte(m); setPick(false); setTimeout(() => surMonCompte(), 50) }} />}
      </aside>
    </div>
  )
}

const F = [['all', 'Toutes'], ['rectif', '🩹 Rectifications'], ['ready', 'Prêtes'], ['prod', 'En cours'], ['wait', 'En attente'], ['done', 'Livrées']]
export default function Commandes() {
  const { cmd, reload } = useData()
  const [sp, setSp] = useSearchParams()
  const f = sp.get('f') || 'all'
  const [q, setQ] = usePersist('commandes.q', '')
  const [brief, setBrief] = usePersist('commandes.brief', null)
  const [liv, setLiv] = useState(null)
  const now = useNow()
  const list = useMemo(() => cmd.list
    .filter((b) => f === 'all' || (f === 'rectif' ? rectifOuvertes(b).length > 0 : etat(b).key === f))
    .filter((b) => !q || JSON.stringify([b.product?.nom, b.client?.email]).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (rectifOuvertes(b).length > 0) - (rectifOuvertes(a).length > 0) || etat(a).rang - etat(b).rang || prio(a) - prio(b) || new Date(b.created_at) - new Date(a.created_at)), [cmd.list, f, q])
  return (
    <div className="fx-wrap">
      <div className="fx-h"><div><h1>Commandes</h1><p>{cmd.list.length} au total · les plus urgentes en premier</p></div><button className="fx-btn" onClick={reload}>Actualiser</button></div>
      <div className="fx-tools">
        <input className="fx-in" placeholder="Rechercher un produit ou un client" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="fx-pills">{F.map(([k, l]) => <button key={k} className={'fx-pill' + (f === k ? ' on' : '')} onClick={() => setSp(k === 'all' ? {} : { f: k })}>{l}{k === 'rectif' ? ' (' + cmd.list.filter((b) => rectifOuvertes(b).length).length + ')' : ''}</button>)}</div>
      </div>
      {cmd.error && <div className="fx-err" style={{ marginBottom: 12 }}>{cmd.error}</div>}
      {cmd.loading ? <><div className="fx-skel" /><div className="fx-skel" /><div className="fx-skel" /></> : list.length ? list.map((b) => <OrderRow key={b.id} b={b} now={now} onBrief={setBrief} onLivrables={setLiv} />) : <div className="fx-empty">Aucune commande dans cette vue.</div>}
      {brief && <BriefPanel id={brief} onClose={() => setBrief(null)} />}
      {liv && <LivrablesPanel id={liv} onClose={() => setLiv(null)} />}
    </div>
  )
}
