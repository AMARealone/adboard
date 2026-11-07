import { usePref } from '../prefs'
import { Card, Seg, Stat } from '../ui'
import { Donut } from '../charts'
import React, { useEffect, useMemo, useState } from 'react'
import { useCrm } from '../store'
import { fetchCoutsApi, fetchTransactionsCompletes, tauxUsd } from '../api'
import { fenetre } from '../domain/stats'
import { calculerCompta } from '../domain/compta'
import { nomPlan } from './Transactions'

const PERIODES = [{ l: "Aujourd'hui", j: 0 }, { l: '7 jours', j: 7 }, { l: '30 jours', j: 30 }, { l: 'Cette année', j: 365 }, { l: 'Tout', j: 9999 }]
const pc = (v) => (v === null ? '—' : v.toFixed(1).replace('.', ',') + ' %')

export default function Comptabilite() {
  const { prospects } = useCrm()
  const [d, setD] = useState({ tx: [], api: [], err: [], charge: true }), [taux, setTaux] = useState(1 / 600), [per, setPer] = usePref('cp_per', 30), [de, setDe] = usePref('cp_de', ''), [a, setA] = usePref('cp_a', ''), [devise, setDevise] = usePref('devise', 'usd')
  useEffect(() => {
    const err = [], g = async (n, f) => { try { return await f() } catch (e) { err.push(n + ' : ' + e.message); return [] } }
    Promise.all([g('Transactions', fetchTransactionsCompletes), g("Coûts d'API", fetchCoutsApi), tauxUsd()]).then(([tx, api, t]) => { setTaux(t); setD({ tx, api, err, charge: false }) })
  }, [])
  const fmt = (f) => (devise === 'usd' ? '$' + ((f || 0) * taux).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(Math.round(f || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA')
  const w = useMemo(() => fenetre(de || a ? { de, a } : { jours: per }), [per, de, a])
  const c = useMemo(() => calculerCompta({ tx: d.tx, api: d.api, prospects, w, tauxXofUsd: taux }), [d, prospects, w, taux])
  const K = ({ l, v, bon }) => <div className="cx-mini"><b style={bon === undefined ? null : { color: bon ? '#22C55E' : '#EF4444' }}>{v}</b><span>{l}</span></div>
  const Ligne = ({ l, v, col }) => <div className="cx-li"><span><i className="cx-dot" style={{ background: col }} />{l}</span><b style={{ marginLeft: 'auto' }}>{fmt(v)}</b></div>
  return (<>
    {d.err.map((e) => <div key={e} className="cx-banner">⚠ Non chargé — {e}</div>)}
    <div className="cx-tools"><div className="cx-bar2">
      <Seg value={de || a ? 'perso' : per} onChange={(v) => { setDe(''); setA(''); setPer(v) }} options={PERIODES.map((p) => [p.j, p.l])} />
      <Seg value={devise} onChange={setDevise} options={[['usd', '$'], ['fcfa', 'FCFA']]} />
      <span className="cx-range" style={{ marginLeft: 0 }}><input type="date" value={de} onChange={(e) => setDe(e.target.value)} /><i>→</i><input type="date" value={a} onChange={(e) => setA(e.target.value)} /></span>
    </div></div>
    {d.charge && <p className="cx-sub">Chargement…</p>}
    <div className="cx-stats wrap">
      <Stat l="Revenu net" v={fmt(c.net)} t="acc" /><Stat l="Dépenses totales" v={fmt(c.depTotal)} /><Stat l="Profit" v={fmt(c.profit)} t={c.profit >= 0 ? 'ok' : 'hot'} /><Stat l="Marge brute" v={pc(c.margeBrute)} /><Stat l="Marge nette" v={pc(c.margeNette)} />
    </div>
    <div className="cx-g2">
      <Card t="Dépenses par catégorie" note="jamais mélangées">
        {c.depTotal > 0 && <Donut parts={[...c.dep.map((x) => ({ l: x.label, v: Math.round(x.fcfa), t: fmt(x.fcfa), c: x.couleur })), ...(c.autre.usd > 0 ? [{ l: 'Autre', v: Math.round(c.autre.fcfa), t: fmt(c.autre.fcfa), c: '#6B7280' }] : [])].filter((x) => x.v > 0)} centre={fmt(c.depTotal)} size={110} />}
        {!(c.depTotal > 0) && <div style={{ margin: '-14px' }}>{c.dep.map((x) => <Ligne key={x.cle} l={x.label} v={x.fcfa} col={x.couleur} />)}</div>}</Card>
      <Card t="Revenu net par offre" note={c.nbTx + ' transaction' + (c.nbTx > 1 ? 's' : '')}>
        {c.parPlan.length > 0 && <Donut parts={c.parPlan.map(([p, v]) => ({ l: nomPlan(p) + ' · ' + v.n, v: Math.round(v.net), t: fmt(v.net) }))} centre={c.nbTx} sous="ventes" size={110} />}
        {!c.parPlan.length && <span className="cx-sub">Aucune transaction sur la période.</span>}</Card>
    </div>
    <section className="cx-bloc"><header><b>Revenu potentiel</b><span className="cx-note">cumul depuis toujours, pas la période</span></header><div className="cx-pad">
      <div className="cx-minis"><K l={'Contacté → lead (' + c.proj.leads + '/' + c.proj.contactes + ')'} v={pc(c.proj.tauxLead)} /><K l="Panier moyen" v={fmt(c.proj.panier)} /><K l="Si +10 points sur ce taux" v={'+' + fmt(c.proj.plus10)} /></div>
      <p className="cx-foot-note">Estimation indicative : elle suppose que le taux lead → achat reste stable.</p></div></section>
    <section className="cx-bloc"><header><b>Transactions</b></header><div className="cx-scroll"><table className="cx-tbl"><thead><tr><th>Date</th><th>Client</th><th>Offre</th><th>Net perçu</th></tr></thead><tbody>
      {c.txp.map((t, i) => <tr key={i}><td>{new Date(t.created_at).toLocaleString('fr-FR')}</td><td>{t.email || (t.user_id || '').slice(0, 8) + '…'}</td><td>{nomPlan(t.plan)}</td><td>{fmt(t.montant_net_fcfa)}</td></tr>)}</tbody></table></div></section>
    <section className="cx-bloc"><header><b>Coûts d'API</b><span className="cx-note">{c.ap.length > 200 ? '200 plus récents sur ' + c.ap.length : c.ap.length + ' appels'}</span></header><div className="cx-scroll"><table className="cx-tbl"><thead><tr><th>Date</th><th>Catégorie</th><th>Type d'appel</th><th>Coût</th></tr></thead><tbody>
      {c.ap.slice(0, 200).map((r, i) => <tr key={i}><td>{new Date(r.created_at).toLocaleString('fr-FR')}</td><td>{r.source || '—'}</td><td>{r.type_appel || '—'}</td><td>${(r.cout_usd || 0).toFixed(4)}</td></tr>)}</tbody></table></div></section>
  </>)
}
