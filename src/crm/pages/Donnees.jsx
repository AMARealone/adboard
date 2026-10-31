import React, { useEffect, useMemo, useState } from 'react'
import { fetchChatMessages, fetchInsights } from '../api'
import { SOURCES, groupesChat, groupesForm, markdown, motsCles, tally, statsGlobales, filtrer } from '../domain/donnees'
import { toast } from '../ui'

function telecharger(nom, contenu) {
  const u = URL.createObjectURL(new Blob([contenu], { type: 'text/markdown;charset=utf-8' })), a = document.createElement('a')
  a.href = u; a.download = nom; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(u)
}
export default function Donnees() {
  const [d, setD] = useState(null), [err, setErr] = useState([]), [ouvert, setOuvert] = useState(null), [q, setQ] = useState(''), [tri, setTri] = useState('recent')
  useEffect(() => {
    const e = [], g = async (s) => { try { return groupesNom(s, s.type === 'chat' ? await fetchChatMessages() : await fetchInsights(s.id)) } catch (x) { e.push(s.titre + ' : ' + x.message); return [] } }
    const groupesNom = (s, rows) => (s.type === 'chat' ? groupesChat(rows) : groupesForm(rows))
    Promise.all(SOURCES.map(g)).then((r) => { setErr(e); setD(Object.fromEntries(SOURCES.map((s, i) => [s.id, r[i]]))) })
  }, [])
  const src = SOURCES.find((s) => s.id === ouvert), groupes = (d && ouvert && d[ouvert]) || []
  const liste = useMemo(() => filtrer(groupes, q, tri), [groupes, q, tri])
  const mots = useMemo(() => motsCles(groupes), [groupes]), ta = useMemo(() => tally(groupes), [groupes]), st = useMemo(() => statsGlobales(groupes), [groupes])
  if (!d) return <p className="cx-sub">Chargement…</p>
  if (!src) return (<>
    {err.map((x) => <div key={x} className="cx-banner">⚠ Non chargé — {x}</div>)}
    {SOURCES.map((s) => <div key={s.id} className="cx-card" style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
      <div><b>{s.titre}</b><div className="cx-sub">{d[s.id].length} {s.type === 'chat' ? 'conversation(s)' : 'répondant(s)'}</div></div>
      <div className="cx-acts"><button className="cx-btn ghost sm" onClick={() => { telecharger(s.fichier, markdown(s.titre.replace(/^\S+\s/, ''), d[s.id], s.type === 'chat')); toast('Fichier téléchargé') }}>⬇ .md</button><button className="cx-btn primary sm" onClick={() => { setQ(''); setOuvert(s.id) }}>Voir →</button></div>
    </div>)}
  </>)
  return (<>
    <div className="cx-acts" style={{ marginBottom: 12 }}><button className="cx-btn ghost sm" onClick={() => setOuvert(null)}>← Retour</button><b style={{ flex: 1 }}>{src.titre}</b><button className="cx-btn ghost sm" onClick={() => telecharger(src.fichier, markdown(src.titre.replace(/^\S+\s/, ''), groupes, src.type === 'chat'))}>⬇ .md</button></div>
    {st && <section className="cx-bloc"><header><b>📈 Vue d'ensemble (quiz)</b></header><div className="cx-pad">
      <div className="cx-minis"><div className="cx-mini"><b>{st.n}</b><span>quiz complétés</span></div><div className="cx-mini"><b>{st.moyenne.toFixed(1)}</b><span>score moyen</span></div></div>
      {st.offres.map(([o, n]) => <div key={o} className="cx-bar"><span>{o}</span><div><i style={{ width: Math.round((n / st.n) * 100) + '%' }} /></div><b>{n} ({Math.round((n / st.n) * 100)} %)</b></div>)}
    </div></section>}
    {ta.length > 0 && <section className="cx-bloc"><header><b>Réponses les plus données</b><span className="cx-note">questions posées à ≥ 2 personnes</span></header><div className="cx-pad">
      {ta.map((x) => <div key={x.question} style={{ marginBottom: 12 }}><b style={{ fontSize: 13 }}>{x.question}</b>{x.reponses.map(([r, n]) => <div key={r} className="cx-bar"><span>{r}</span><div><i style={{ width: Math.round((n / x.total) * 100) + '%' }} /></div><b>{n} ({Math.round((n / x.total) * 100)} %)</b></div>)}</div>)}
    </div></section>}
    <div className="cx-tools"><input className="cx-search" type="search" placeholder="Rechercher un mot-clé…" value={q} onChange={(e) => setQ(e.target.value)} /><select value={tri} onChange={(e) => setTri(e.target.value)}><option value="recent">Plus récent d'abord</option><option value="ancien">Plus ancien d'abord</option></select></div>
    {mots.length > 0 && <div className="cx-acts" style={{ flexWrap: 'wrap', marginBottom: 10 }}>{mots.map(([m, n]) => <button key={m} className="cx-tab" onClick={() => setQ(m)}>{m} · {n}</button>)}</div>}
    {!liste.length ? <div className="cx-empty"><b>Aucun résultat</b></div> : liste.map((g) => <div key={g.id} className="cx-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}><b>{g.label}{g.format === 'quiz' && <span className="cx-chip bl" style={{ marginLeft: 8 }}>Quiz</span>}</b><span className="cx-note">{g.dateAff}</span></div>
      {g.entries.map((e, i) => <div key={i} style={{ fontSize: 13, lineHeight: 1.55, marginBottom: 5, whiteSpace: 'pre-wrap' }}><b style={{ color: e.visiteur ? 'var(--accent, #1fb6ff)' : 'inherit' }}>{e.qui} :</b> {e.texte}</div>)}
    </div>)}
  </>)
}
