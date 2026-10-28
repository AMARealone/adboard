import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useData } from '../data'
import { etat, SERVER, prio, estPrioritaire, delaiClientH } from '../api'
import { openCommande, marquerLivre, supprimerTicket } from '../prod/engine'
import { alertDlg } from '../ui'

function useNow(ms = 1000) { const [n, setN] = useState(Date.now()); useEffect(() => { const t = setInterval(() => setN(Date.now()), ms); return () => clearInterval(t) }, [ms]); return n }
const pad = (n) => String(n).padStart(2, '0')

// Compte à rebours : 12 h pour lancer une commande en attente ; échéance interne en production = délai client moins 6 h (18 h, ou 42 h pour PERF+)
function Timer({ b, now }) {
  if (b.status === 'pending') {
    const r = 12 * 3600e3 - (now - new Date(b.created_at).getTime())
    if (r <= 0) return <span className="fx-time off">Attente expirée</span>
    return <span className="fx-time">{Math.floor(r / 3600e3)}h{pad(Math.floor((r % 3600e3) / 60e3))}m{pad(Math.floor((r % 60e3) / 1e3))}s restantes</span>
  }
  if (b.status === 'in_production' && b.started_at) {
    const r = (delaiClientH(b) - 6) * 3600e3 - (now - new Date(b.started_at).getTime())
    if (r <= 0) return <span className="fx-time urgent">Urgent — envoie les livrables</span>
    return <span className="fx-time">{Math.floor(r / 3600e3)}h{pad(Math.floor((r % 3600e3) / 60e3))}m avant l’échéance interne</span>
  }
  return null
}

export function OrderRow({ b, compact, now, onBrief }) {
  const nav = useNavigate()
  const { reload } = useData()
  const [busy, setBusy] = useState(false)
  const e = etat(b)
  const photo = b.photo_nobg || b.product?.photo_base64 || b.product?.photo_url
  const open = async () => {
    setBusy(true)
    try { if (await openCommande(b.id)) nav('/production') } finally { setBusy(false) }
  }
  const label = b.status === 'pending' ? 'Lancer' : b.status === 'done' ? 'Nouveau lot' : 'Reprendre'
  return (
    <div className={'fx-row' + (e.key === 'ready' ? ' ready' : '')}>
      {photo ? <img className="fx-thumb" src={photo} alt="" onError={(x) => (x.currentTarget.style.visibility = 'hidden')} /> : <div className="fx-thumb">—</div>}
      <div className="fx-grow">
        <div className="fx-t">{b.product?.nom || 'Produit'} <span className={'fx-tag ' + e.key}>{e.label}</span>{estPrioritaire(b) && <span className="fx-tag ready" title="Offre SCALE : file prioritaire"> ★ Prioritaire</span>}</div>
        <div className="fx-s">{b.client?.email || (b.client?.user_id || '').slice(0, 8)} · {(b.client?.plan || '').toUpperCase()} · {b.quantity} images {now && <> · <Timer b={b} now={now} /></>}</div>
      </div>
      {e.key !== 'off' && <button className={'fx-btn' + (e.key === 'wait' || e.key === 'ready' ? ' primary' : '')} disabled={busy} onClick={open}>{busy ? '…' : '▶ ' + label}</button>}
      {!compact && b.status === 'in_production' && <button className={'fx-btn' + (e.key === 'ready' ? ' purple' : ' primary')} onClick={() => marquerLivre(b.id, reload)}>Envoyer au client</button>}
      {!compact && b.status === 'done' && <button className="fx-btn" title="Renvoyer si le client signale un manque" onClick={() => marquerLivre(b.id, reload)}>↻ Renvoyer</button>}
      {!compact && <button className="fx-btn icon" title="Voir le brief" onClick={() => onBrief(b.id)}>Brief</button>}
      {!compact && <button className="fx-btn icon danger-o" title="Supprimer" onClick={() => supprimerTicket(b.id, reload)}>✕</button>}
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
  const gal = (p.galerie_images || []).filter(Boolean), caps = (p.avis_captures || []).filter(Boolean), asp = p.galerie_aspects || {}
  return (
    <div className="fx-modal-back right" onClick={onClose}>
      <aside className="fx-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="fx-drawer-h"><h3>Brief client</h3><button className="fx-btn" onClick={onClose}>Fermer</button></div>
        {!b && !err && <div className="fx-empty">Chargement du brief…</div>}
        {err && <div className="fx-err">{err}</div>}
        {b && <div className="fx-bfs">
          {photo && <div className="fx-bphoto"><img src={photo} alt="" /></div>}
          <R l="Produit"><b>{p.nom}</b></R>
          <R l="Quantité commandée"><b style={{ color: 'var(--ac)' }}>{b.quantity} visuels</b></R>
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
          <R l="Client">{b.client?.email || b.client?.user_id} · {(b.client?.plan || '').toUpperCase()}</R>
          <R l="Commandé le">{new Date(b.created_at).toLocaleString('fr-FR')}</R>
          {b.history?.batches_count > 0 ? <R l="Historique">{b.history.batches_count} batch(es) précédent(s) · {b.history.total_creatives_done} créatives déjà livrées</R> : <div className="fx-note">Premier batch pour ce produit — pas d'historique à considérer.</div>}
        </div>}
      </aside>
    </div>
  )
}

const F = [['all', 'Toutes'], ['ready', 'Prêtes'], ['prod', 'En cours'], ['wait', 'En attente'], ['done', 'Livrées']]
export default function Commandes() {
  const { cmd, reload } = useData()
  const [sp, setSp] = useSearchParams()
  const f = sp.get('f') || 'all'
  const [q, setQ] = useState('')
  const [brief, setBrief] = useState(null)
  const now = useNow()
  const list = useMemo(() => cmd.list
    .filter((b) => f === 'all' || etat(b).key === f)
    .filter((b) => !q || JSON.stringify([b.product?.nom, b.client?.email]).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => etat(a).rang - etat(b).rang || prio(a) - prio(b) || new Date(b.created_at) - new Date(a.created_at)), [cmd.list, f, q])
  return (
    <div className="fx-wrap">
      <div className="fx-h"><div><h1>Commandes</h1><p>{cmd.list.length} au total · les plus urgentes en premier</p></div><button className="fx-btn" onClick={reload}>Actualiser</button></div>
      <div className="fx-tools">
        <input className="fx-in" placeholder="Rechercher un produit ou un client" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="fx-pills">{F.map(([k, l]) => <button key={k} className={'fx-pill' + (f === k ? ' on' : '')} onClick={() => setSp(k === 'all' ? {} : { f: k })}>{l}</button>)}</div>
      </div>
      {cmd.error && <div className="fx-err" style={{ marginBottom: 12 }}>{cmd.error}</div>}
      {cmd.loading ? <><div className="fx-skel" /><div className="fx-skel" /><div className="fx-skel" /></> : list.length ? list.map((b) => <OrderRow key={b.id} b={b} now={now} onBrief={setBrief} />) : <div className="fx-empty">Aucune commande dans cette vue.</div>}
      {brief && <BriefPanel id={brief} onClose={() => setBrief(null)} />}
    </div>
  )
}
