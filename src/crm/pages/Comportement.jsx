import React, { useEffect, useMemo, useState } from 'react'
import { fetchClarity } from '../api'
import { comportement } from '../domain/donnees'

const temps = (s) => (s >= 60 ? Math.floor(s / 60) + ' min ' + Math.round(s % 60) + ' s' : Math.round(s) + ' s')
const court = (u) => (u || '').replace(/^https?:\/\/(www\.)?adstackofficial\.com/, '') || '/'
export default function Comportement() {
  const [rows, setRows] = useState(null), [err, setErr] = useState(''), [jours, setJours] = useState(30), [ouv, setOuv] = useState({})
  useEffect(() => { fetchClarity().then(setRows).catch((e) => { setErr(e.message); setRows([]) }) }, [])
  const c = useMemo(() => (rows ? comportement(rows, jours) : null), [rows, jours])
  if (!c) return <p className="cx-sub">Chargement…</p>
  const lib = jours > 0 ? jours + ' derniers jours' : 'toute la période', max = Math.max(1, ...c.jours.map((j) => j[1]))
  const frict = c.pages.filter((p) => p.friction > 0).sort((a, b) => b.friction - a.friction)
  return (<>
    {err && <div className="cx-banner">⚠ Non chargé — {err}</div>}
    <div className="cx-tabs" style={{ marginBottom: 12 }}>{[[7, '7 jours'], [30, '30 jours'], [90, '90 jours'], [0, 'Tout']].map(([v, l]) => <button key={v} className={'cx-tab' + (jours === v ? ' on' : '')} onClick={() => setJours(v)}>{l}</button>)}</div>
    {!c.n ? <div className="cx-empty"><b>{rows.length ? 'Aucune donnée sur cette période' : 'Aucune donnée pour l\'instant'}</b><div>{rows.length ? 'Essayez une période plus large.' : 'Le premier relevé quotidien n\'a peut-être pas encore eu lieu.'}</div></div> : (<>
      <div className="cx-minis" style={{ marginBottom: 8 }}>
        <div className="cx-mini"><b>{c.visiteurs}</b><span>Visiteurs</span><em>{lib}</em></div>
        <div className="cx-mini"><b>{c.sessions}</b><span>Sessions</span><em>{lib}</em></div>
        <div className="cx-mini"><b>{temps(c.engage)}</b><span>Temps moyen</span></div>
        <div className="cx-mini"><b>{c.scroll} %</b><span>Scroll moyen</span></div>
        <div className="cx-mini"><b>{c.friction}</b><span>Points de friction</span></div>
      </div>
      {jours !== 1 && <p className="cx-note" style={{ marginBottom: 14 }}>« Visiteurs » additionne les visiteurs uniques de chaque jour : quelqu'un qui revient plusieurs jours est compté à chaque fois. Le tableau de bord Clarity affichera donc un nombre plus bas sur 7 jours ou plus.</p>}
      <section className="cx-bloc"><header><b>Sessions par jour</b></header><div className="cx-pad">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>{c.jours.map(([j, v]) => <div key={j} title={j + ' : ' + v + ' session(s)'} style={{ flex: 1, maxWidth: 24, height: Math.max(v > 0 ? 4 : 0, Math.round((v / max) * 100)) + '%', background: 'var(--accent, #1fb6ff)', borderRadius: '3px 3px 0 0', opacity: v ? 1 : 0.2 }} />)}</div>
        <div className="cx-note" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}><span>{c.jours[0] && c.jours[0][0]}</span><span>{c.jours.length > 1 && c.jours[c.jours.length - 1][0]}</span></div>
      </div></section>
      <section className="cx-bloc"><header><b>Par page</b><span className="cx-note">touchez pour le détail</span></header><div className="cx-pad">
        {[...c.pages].sort((a, b) => b.sessions - a.sessions).map((p) => { const pct = c.sessions ? Math.round((p.sessions / c.sessions) * 100) : 0; return (
          <div key={p.url} style={{ borderBottom: '1px solid var(--line, #2a2f3a)', padding: '8px 0' }}>
            <button className="cx-lnk" style={{ width: '100%', textAlign: 'left' }} onClick={() => setOuv({ ...ouv, [p.url]: !ouv[p.url] })}>
              <div className="cx-bar"><span title={p.url}>{court(p.url)}</span><div><i style={{ width: Math.max(2, pct) + '%' }} /></div><b>{p.sessions} · {pct} %</b></div>
            </button>
            {ouv[p.url] && <div className="cx-minis" style={{ marginTop: 8 }}>
              <div className="cx-mini"><b>{p.visiteurs}</b><span>Visiteurs</span></div><div className="cx-mini"><b>{temps(p.engageMoyen)}</b><span>Temps moyen</span></div>
              <div className="cx-mini"><b>{p.scrollMoyen} %</b><span>Scroll moyen</span></div><div className="cx-mini"><b>{p.friction}</b><span>Friction</span></div></div>}
          </div>) })}
      </div></section>
      <section className="cx-bloc"><header><b>Friction</b></header><div className="cx-pad">
        {!frict.length ? <span className="cx-sub">Aucun point de friction sur cette période — bon signe.</span> : frict.map((p) => (
          <div key={p.url} style={{ padding: '8px 0', borderBottom: '1px solid var(--line, #2a2f3a)' }}><b>{court(p.url)}</b>
            <div className="cx-meta" style={{ marginTop: 4 }}><span>🔥 {p.rage} clic{p.rage > 1 ? 's' : ''} de rage</span><span>💀 {p.dead} clic{p.dead > 1 ? 's' : ''} mort{p.dead > 1 ? 's' : ''}</span><span>↩️ {p.quickback} retour{p.quickback > 1 ? 's' : ''} rapide{p.quickback > 1 ? 's' : ''}</span><span>📜 {p.scrollExces} scroll excessif{p.scrollExces > 1 ? 's' : ''}</span></div></div>))}
      </div></section>
    </>)}
  </>)
}
