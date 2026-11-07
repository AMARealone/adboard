import { usePref } from '../prefs'
import React, { useEffect, useMemo, useState } from 'react'
import { fetchTransactionsCompletes, tauxUsd } from '../api'
import { OFFRES } from '../domain/offres'
import { dans, fenetre } from '../domain/stats'
import { Card, Seg, Stat } from '../ui'
import { Area, Donut } from '../charts'

// Nom commercial d'un plan stocké en base (anciens noms inclus).
export const NOM_PLAN = { test: 'TEST', starter: 'PERF+', pro: 'GROWTH', scale: 'SCALE', discovery: 'Discovery (ancien)' }
export const nomPlan = (p) => NOM_PLAN[p] || p || '—'
const PERIODES = [{ l: '30 jours', j: 30 }, { l: '90 jours', j: 90 }, { l: 'Tout', j: 9999 }]

export default function Transactions() {
  const [rows, setRows] = useState(null), [err, setErr] = useState(''), [taux, setTaux] = useState(1 / 600), [per, setPer] = usePref('tx_per', 9999), [devise, setDevise] = usePref('devise', 'usd'), [q, setQ] = usePref('tx_q', '')
  useEffect(() => { fetchTransactionsCompletes().then(setRows).catch((e) => { setErr(e.message); setRows([]) }); tauxUsd().then(setTaux) }, [])
  const fmt = (f) => (devise === 'usd' ? '$' + ((f || 0) * taux).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(Math.round(f || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA')
  const w = useMemo(() => fenetre({ jours: per }), [per])
  const liste = useMemo(() => (rows || []).filter((t) => dans(t.created_at, w)), [rows, w])
  const k = useMemo(() => ({ brut: liste.reduce((s, t) => s + (t.montant_fcfa || 0), 0), net: liste.reduce((s, t) => s + (t.montant_net_fcfa || 0), 0), comm: liste.reduce((s, t) => s + (t.commission_chariow_fcfa || 0), 0) }), [liste])
  const parOffre = useMemo(() => { const m = {}; liste.forEach((t) => { const n = nomPlan(t.plan); m[n] = m[n] || { n: 0, net: 0 }; m[n].n++; m[n].net += t.montant_net_fcfa || 0 }); return Object.entries(m).sort((a, b) => b[1].net - a[1].net) }, [liste])
  const clients = useMemo(() => {
    const m = {}
    liste.forEach((t) => { const c = t.user_id || t.email || 'inconnu'; (m[c] = m[c] || { nom: t.nom || t.email || 'Client', email: t.email, tx: [] }).tx.push(t) })
    return Object.values(m).filter((c) => !q || (c.nom + ' ' + (c.email || '')).toLowerCase().includes(q.toLowerCase())).sort((a, b) => Date.parse(b.tx[0].created_at) - Date.parse(a.tx[0].created_at))
  }, [liste, q])
  const parJour = useMemo(() => {
    const m = {}; (rows || []).forEach((x) => { const j = (x.created_at || '').slice(0, 10); m[j] = (m[j] || 0) + Math.round((x.montant_net_fcfa || 0) * (devise === 'usd' ? taux : 1)) })
    const out = []; for (let i = 29; i >= 0; i--) { const d = new Date(Date.now() - i * 86400000), j = d.toISOString().slice(0, 10); out.push({ l: d.getDate() + '/' + (d.getMonth() + 1), v: m[j] || 0 }) }
    return out
  }, [rows, devise, taux])
  if (!rows) return <p className="cx-sub">Chargement…</p>
  return (<>
    {err && <div className="cx-banner">⚠ Transactions non chargées : {err}</div>}
    <div className="cx-tools"><div className="cx-bar2">
      <Seg value={per} onChange={setPer} options={PERIODES.map((p) => [p.j, p.l])} />
      <Seg value={devise} onChange={setDevise} options={[['usd', '$'], ['fcfa', 'FCFA']]} />
      <input className="cx-search" style={{ marginLeft: 'auto', maxWidth: 280 }} type="search" placeholder="Chercher un client…" value={q} onChange={(e) => setQ(e.target.value)} />
    </div></div>
    <div className="cx-stats wrap">
      <Stat l="Revenu net" v={fmt(k.net)} t="ok" /><Stat l="Revenu brut" v={fmt(k.brut)} /><Stat l="Commission Chariow" v={fmt(k.comm)} /><Stat l="Transactions" v={liste.length} /><Stat l="Clients" v={clients.length} t="acc" />
    </div>
    <div className="cx-g2">
      <Card t="Revenu net par jour" note="30 derniers jours"><Area data={parJour} color="var(--ok)" h={110} /></Card>
      <Card t="Par offre">{parOffre.length ? <Donut parts={parOffre.map(([n, v]) => ({ l: n + ' · ' + fmt(v.net), v: v.n }))} centre={liste.length} sous="ventes" size={110} /> : <span className="cx-sub">Aucune transaction sur la période.</span>}</Card>
    </div>
    {clients.map((c) => {
      const ltv = c.tx.reduce((s, t) => s + (t.montant_net_fcfa || 0), 0), nb = c.tx.length
      const j = nb > 1 ? Math.max(1, Math.round((Date.parse(c.tx[0].created_at) - Date.parse(c.tx[nb - 1].created_at)) / 86400000)) : null
      return <div className="cx-row" key={c.email || c.nom + c.tx[0].created_at}><div className="cx-main">
        <div className="cx-line"><b>{c.nom}</b></div>
        <div className="cx-when">{c.email || ''} · {nb} achat{nb > 1 ? 's' : ''} · {nb > 1 ? '1 achat tous les ~' + Math.round(j / (nb - 1)) + ' j' : 'achat unique'}</div>
        <div className="cx-tl" style={{ marginTop: 8 }}>{c.tx.map((t, i) => <div key={i} className="cx-tli"><span>{new Date(t.created_at).toLocaleDateString('fr-FR')} — {nomPlan(t.plan)}{t.cycle ? ' (' + t.cycle + ')' : ''}</span><span style={{ marginLeft: 'auto' }}>{fmt(t.montant_net_fcfa)}</span></div>)}</div>
      </div><div style={{ textAlign: 'right' }}><b style={{ color: 'var(--ac)', fontSize: 16 }}>{fmt(ltv)}</b><div className="cx-when">LTV nette</div></div></div>
    })}
  </>)
}
