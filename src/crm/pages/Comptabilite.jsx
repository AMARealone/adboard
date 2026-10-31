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
  const [d, setD] = useState({ tx: [], api: [], err: [], charge: true }), [taux, setTaux] = useState(1 / 600), [per, setPer] = useState(30), [de, setDe] = useState(''), [a, setA] = useState(''), [devise, setDevise] = useState('usd')
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
    <div className="cx-tools"><div className="cx-tabs">
      {PERIODES.map((p) => <button key={p.j} className={'cx-tab' + (!de && !a && per === p.j ? ' on' : '')} onClick={() => { setDe(''); setA(''); setPer(p.j) }}>{p.l}</button>)}
      <button className="cx-tab" onClick={() => setDevise(devise === 'usd' ? 'fcfa' : 'usd')}>Afficher en {devise === 'usd' ? 'FCFA' : 'dollars'}</button>
      <span className="cx-range"><input type="date" value={de} onChange={(e) => setDe(e.target.value)} /><i>→</i><input type="date" value={a} onChange={(e) => setA(e.target.value)} /></span>
    </div></div>
    {d.charge && <p className="cx-sub">Chargement…</p>}
    <div className="cx-minis" style={{ marginBottom: 14 }}>
      <K l="Revenu net" v={fmt(c.net)} /><K l="Dépenses totales" v={fmt(c.depTotal)} /><K l="Profit" v={fmt(c.profit)} bon={c.profit >= 0} /><K l="Marge brute" v={pc(c.margeBrute)} /><K l="Marge nette" v={pc(c.margeNette)} bon={c.margeNette === null ? undefined : c.margeNette >= 0} />
    </div>
    <div className="cx-grid2">
      <section className="cx-bloc"><header><b>Dépenses par catégorie</b><span className="cx-note">jamais mélangées</span></header>
        {c.dep.map((x) => <Ligne key={x.cle} l={x.label} v={x.fcfa} col={x.couleur} />)}{c.autre.usd > 0 && <Ligne l="Autre / non catégorisé" v={c.autre.fcfa} col="#6B7280" />}</section>
      <section className="cx-bloc"><header><b>Revenu net par offre</b><span className="cx-note">{c.nbTx} transaction{c.nbTx > 1 ? 's' : ''}</span></header>
        {c.parPlan.map(([p, v]) => <Ligne key={p} l={nomPlan(p) + ' · ' + v.n} v={v.net} col="#1FB6FF" />)}{!c.parPlan.length && <div className="cx-pad cx-sub">Aucune transaction sur la période.</div>}</section>
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
