import React, { useEffect, useMemo, useState } from 'react'
import { serveurAdmin, tauxUsd } from '../api'
import { nomPlan } from './Transactions'
import { Modal } from '../ui'
import { norm } from '../filtre'

const ADBOARD = 'https://www.adstackofficial.com/adboard'
const wa = (t) => String(t || '').replace(/\D/g, '')
export default function Clients() {
  const [c, setC] = useState(null), [err, setErr] = useState(''), [q, setQ] = useState(''), [taux, setTaux] = useState(1 / 600), [det, setDet] = useState(null)
  useEffect(() => { serveurAdmin('/crm/clients').then((d) => setC(Array.isArray(d) ? d : d.clients || [])).catch((e) => { setErr(e.message); setC([]) }); tauxUsd().then(setTaux) }, [])
  const usd = (f) => '$' + ((f || 0) * taux).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const date = (d) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
  const liste = useMemo(() => (c || []).filter((x) => !q.trim() || norm(q).split(/\s+/).every((m) => norm((x.nom || '') + ' ' + (x.email || '') + ' ' + (x.telephone_whatsapp || '') + ' ' + nomPlan(x.plan)).includes(m))), [c, q])
  if (!c) return <p className="cx-sub">Chargement…</p>
  const actifs = c.filter((x) => x.active), used = c.reduce((s, x) => s + (x.credits_used || 0), 0), cred = c.reduce((s, x) => s + (x.credits_total || 0), 0)
  return (<>
    {err && <div className="cx-banner">⚠ Non chargé — {err}</div>}
    <div className="cx-minis" style={{ marginBottom: 12 }}>
      <div className="cx-mini"><b>{actifs.length}</b><span>Clients actifs</span></div><div className="cx-mini"><b>{usd(c.reduce((s, x) => s + (x.total_depense_fcfa || 0), 0))}</b><span>Total dépensé</span></div><div className="cx-mini"><b>{used} / {cred}</b><span>Crédits utilisés</span></div>
    </div>
    <div className="cx-tools"><input className="cx-search" type="search" placeholder="Rechercher un nom, un email, un plan, un numéro…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
    {!liste.length ? <div className="cx-empty"><b>{c.length ? 'Aucun résultat' : 'Aucun client pour l\'instant'}</b>{!c.length && <div>Ils apparaissent ici dès qu'un abonnement est activé.</div>}</div> : liste.map((x) => { const pct = x.credits_total > 0 ? Math.min(100, Math.round((100 * x.credits_used) / x.credits_total)) : 0; return (
      <div key={x.user_id || x.email} className="cx-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
          <div style={{ minWidth: 0 }}><b>{x.nom || x.email || 'Sans nom'}{!x.active && <span className="cx-chip rd" style={{ marginLeft: 8 }}>Inactif</span>}</b><div className="cx-sub" style={{ wordBreak: 'break-all' }}>{x.email}</div></div>
          <span className="cx-chip bl">{nomPlan(x.plan)}</span>
        </div>
        <div className="cx-minis" style={{ margin: '10px 0' }}>
          <div className="cx-mini"><b>{x.credits_used} / {x.credits_total}</b><span>Crédits</span><div className="cx-bar"><div><i style={{ width: pct + '%' }} /></div></div></div>
          <div className="cx-mini"><b>{usd(x.total_depense_fcfa)}</b><span>Dépensé</span><em>{x.nb_achats} achat{x.nb_achats > 1 ? 's' : ''}</em></div>
          <div className="cx-mini"><b>{date(x.started_at)}</b><span>Client depuis</span></div>
        </div>
        <div className="cx-acts">
          {x.email && <a className="cx-btn ghost sm" href={'mailto:' + x.email}>✉ Contacter</a>}
          {wa(x.telephone_whatsapp) && <a className="cx-btn ghost sm" href={'https://wa.me/' + wa(x.telephone_whatsapp)} target="_blank" rel="noreferrer">WhatsApp</a>}
          <button className="cx-btn ghost sm" onClick={() => setDet(x)}>Détail</button>
          {x.email && <a className="cx-btn ghost sm" href={ADBOARD + '/?impersonate=' + encodeURIComponent(x.email)} target="_blank" rel="noreferrer">👁 Son compte</a>}
        </div>
      </div>) })}
    {det && <Modal title={det.nom || det.email} onClose={() => setDet(null)}><div style={{ fontSize: 13, lineHeight: 1.9 }}>
      <div><b>Email :</b> {det.email || '—'}</div><div><b>WhatsApp :</b> {det.telephone_whatsapp || '—'}</div><div><b>Plan :</b> {nomPlan(det.plan)} {det.cycle ? '(' + det.cycle + ')' : ''}</div>
      <div><b>Statut :</b> {det.active ? '✅ Actif' : '❌ Inactif'}</div><div><b>Client depuis :</b> {det.started_at ? new Date(det.started_at).toLocaleString('fr-FR') : '—'}</div><div><b>Expire le :</b> {det.expires_at ? new Date(det.expires_at).toLocaleString('fr-FR') : '—'}</div>
      <div><b>Crédits :</b> {det.credits_used} / {det.credits_total}</div><div><b>Total dépensé :</b> {usd(det.total_depense_fcfa)} ({det.nb_achats} achat{det.nb_achats > 1 ? 's' : ''})</div><div><b>Premier achat :</b> {date(det.premier_achat)}</div><div><b>ID compte :</b> <code style={{ fontSize: 11 }}>{det.user_id}</code></div></div></Modal>}
  </>)
}
