import React, { useEffect, useMemo, useState } from 'react'
import { fetchChatMessages, fetchInsights } from '../api'
import { SOURCES, ORIGINES, groupesChat, groupesForm, markdown, motsCles, expressions, tally, statsGlobales, filtrer } from '../domain/donnees'
import { usePref } from '../prefs'
import { Card, Icon, Seg, Stat, toast } from '../ui'
import { Bars, Donut, HBars } from '../charts'

function telecharger(nom, contenu) {
  const u = URL.createObjectURL(new Blob([contenu], { type: 'text/markdown;charset=utf-8' })), a = document.createElement('a')
  a.href = u; a.download = nom; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(u)
}
const COURT = { chatbot: 'Chatbot Ava', prepurchase_form: 'Pré-achat', postpurchase_form: 'Post-achat', commentaire_libre: 'Commentaires' }
const JOUR = 86400000
const jl = (d) => new Date(d).toLocaleDateString('sv-SE')
const extrait = (g) => { const e = g.entries.find((x) => x.visiteur && x.texte) || g.entries[0]; const t = (e && e.texte) || ''; return t.length > 130 ? t.slice(0, 130) + '…' : t }
const echap = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// Surligne le mot cherché dans une bulle.
const surligne = (texte, q) => {
  const m = (q || '').trim(); if (m.length < 2) return texte
  const parts = String(texte || '').split(new RegExp('(' + echap(m) + ')', 'ig'))
  return parts.map((x, i) => (i % 2 ? <mark key={i}>{x}</mark> : x))
}
const texteGroupe = (g) => g.label + ' — ' + g.dateAff + '\n' + g.entries.map((e) => e.qui + ' : ' + e.texte).join('\n')

// Conversation d'un visiteur (un appareil), façon messagerie : lui à droite, Ava à gauche, avec l'heure de chaque message.
function Fil({ g, q }) {
  return <div className="cx-chat">
    {g.entries.map((e, i) => <React.Fragment key={i}>
      {e.nouvelle && <div className="cx-visite">{i === 0 ? 'Première visite · ' : 'Retour · '}{e.quand}</div>}
      <div className={'cx-msg ' + (e.visiteur ? 'v' : 'a')}>{surligne(e.texte, q)}<time>{e.heure}</time></div>
    </React.Fragment>)}
  </div>
}
// Chat en plein écran : flèches ‹ › (ou touches ← →) pour passer au visiteur précédent / suivant de la liste, Échap pour fermer.
function ChatPlein({ liste, id, q, onClose, onNav }) {
  const i = liste.findIndex((x) => x.id === id), g = liste[i]
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); else if (e.key === 'ArrowLeft' && i > 0) onNav(liste[i - 1].id); else if (e.key === 'ArrowRight' && i < liste.length - 1) onNav(liste[i + 1].id) }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [i, liste, onClose, onNav])
  useEffect(() => { const o = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = o } }, [])
  if (!g) return null
  return (
    <div className="cx-full" role="dialog" aria-label={'Conversation · ' + g.label}>
      <header>
        <button className="cx-btn ghost sm" disabled={i <= 0} onClick={() => onNav(liste[i - 1].id)} aria-label="Visiteur précédent">‹</button>
        <button className="cx-btn ghost sm" disabled={i >= liste.length - 1} onClick={() => onNav(liste[i + 1].id)} aria-label="Visiteur suivant">›</button>
        <div className="t"><b>{g.label}</b><span className="cx-note" style={{ marginLeft: 0 }}>{ORIGINES[g.origine]} · {g.nbVisiteur} message{g.nbVisiteur > 1 ? 's' : ''} · {g.visites} visite{g.visites > 1 ? 's' : ''} · {i + 1}/{liste.length}</span></div>
        <button className="cx-btn ghost sm" onClick={() => { try { navigator.clipboard.writeText(texteGroupe(g)); toast('Copié') } catch (_) { toast('Copie impossible') } }}>Copier</button>
        <button className="cx-btn sm" onClick={onClose} aria-label="Fermer" title="Fermer (Échap)">✕</button>
      </header>
      <div className="cx-fullbody"><Fil g={g} q={q} /></div>
    </div>
  )
}

function ChatVisiteur({ g, ouvert, onToggle, q, onPlein }) {
  return (
    <div className={'cx-acc' + (ouvert ? ' open' : '')} style={ouvert ? { borderColor: 'var(--bd2)' } : null}>
      <button onClick={onToggle} style={{ alignItems: 'flex-start' }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <b style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{g.label}<span className={'cx-chip ' + (g.origine === 'vente' ? 'bl' : 'mu')}>{ORIGINES[g.origine]}</span><span className="cx-note" style={{ marginLeft: 0 }}>{g.nbVisiteur} message{g.nbVisiteur > 1 ? 's' : ''} · {g.dateAff}</span></b>
          {!ouvert && <span className="pv" style={{ display: 'block', whiteSpace: 'normal', marginTop: 3 }}>{extrait(g)}</span>}
        </span>
        <Icon n="chev" s={16} />
      </button>
      {ouvert && <div className="bd">
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}><button className="cx-btn sm" onClick={onPlein}><Icon n="expand" s={14} /> Plein écran</button></div>
        <Fil g={g} q={q} />
        <button className="cx-btn ghost sm" style={{ marginTop: 8 }} onClick={() => { try { navigator.clipboard.writeText(texteGroupe(g)); toast('Copié') } catch (_) { toast('Copie impossible') } }}>Copier la conversation</button>
      </div>}
    </div>
  )
}

function Voix({ g, ouvert, onToggle }) {
  return (
    <div className={'cx-acc' + (ouvert ? ' open' : '')} style={ouvert ? { borderColor: 'var(--bd2)' } : null}>
      <button onClick={onToggle} style={{ alignItems: 'flex-start' }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <b style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{g.label}{g.format === 'quiz' && <span className="cx-chip bl">Quiz</span>}<span className="cx-note" style={{ marginLeft: 0 }}>{g.dateAff}</span></b>
          {!ouvert && <span className="pv" style={{ display: 'block', whiteSpace: 'normal', marginTop: 3 }}>{extrait(g)}</span>}
        </span>
        <Icon n="chev" s={16} />
      </button>
      {ouvert && <div className="bd">
        {g.entries.map((e, i) => <div key={i} className={'qa ' + (e.visiteur ? 'r' : 'q')}>{e.visiteur ? <b>{e.qui} : </b> : <>{e.qui} : </>}{e.texte}</div>)}
        <button className="cx-btn ghost sm" style={{ marginTop: 8 }} onClick={() => { try { navigator.clipboard.writeText(texteGroupe(g)); toast('Copié') } catch (_) { toast('Copie impossible') } }}>Copier</button>
      </div>}
    </div>
  )
}

export default function Donnees() {
  const [d, setD] = useState(null), [err, setErr] = useState([])
  const [ouvert, setOuvert] = usePref('dn_src', 'chatbot'), [q, setQ] = usePref('dn_q', ''), [tri, setTri] = usePref('dn_tri', 'recent'), [orig, setOrig] = usePref('dn_orig', '')
  const [deplies, setDeplies] = useState(() => new Set()), [max, setMax] = useState(25), [plein, setPlein] = useState(null)
  useEffect(() => {
    const e = [], g = async (s) => { try { return s.type === 'chat' ? groupesChat(await fetchChatMessages()) : groupesForm(await fetchInsights(s.id)) } catch (x) { e.push(s.titre + ' : ' + x.message); return [] } }
    Promise.all(SOURCES.map(g)).then((r) => { setErr(e); setD(Object.fromEntries(SOURCES.map((s, i) => [s.id, r[i]]))) })
  }, [])
  const src = SOURCES.find((s) => s.id === ouvert) || SOURCES[0]
  const groupes = (d && d[src.id]) || []
  const chat0 = src.type === 'chat'
  const liste = useMemo(() => filtrer(groupes, q, tri, chat0 ? orig : ''), [groupes, q, tri, orig, chat0])
  const base = useMemo(() => (chat0 && orig ? groupes.filter((g) => g.origine === orig) : groupes), [groupes, orig, chat0])
  const mots = useMemo(() => motsCles(base, 14), [base]), expr = useMemo(() => expressions(base, 8), [base]), ta = useMemo(() => tally(groupes), [groupes]), st = useMemo(() => statsGlobales(groupes), [groupes])
  const serie = useMemo(() => {
    const m = {}; groupes.forEach((g) => { if (g.date) { const k = jl(g.date); m[k] = (m[k] || 0) + 1 } })
    const out = []; for (let k = 29; k >= 0; k--) { const dd = new Date(Date.now() - k * JOUR); out.push({ l: dd.getDate() + '/' + (dd.getMonth() + 1), v: m[jl(dd)] || 0, hl: k === 0 }) }
    return out
  }, [groupes])
  if (!d) return <p className="cx-sub">Chargement…</p>
  const chat = src.type === 'chat'
  const s7 = serie.slice(-7).reduce((t, x) => t + x.v, 0), s30 = serie.reduce((t, x) => t + x.v, 0)
  const nbMsg = chat ? base.reduce((t, g) => t + g.entries.filter((e) => e.visiteur).length, 0) : 0
  const tousOuverts = liste.slice(0, max).every((g) => deplies.has(g.id))
  const bascule = (id) => setDeplies((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  return (<>
    {plein && <ChatPlein liste={liste} id={plein} q={q} onClose={() => setPlein(null)} onNav={setPlein} />}
    {err.map((x) => <div key={x} className="cx-banner">⚠ Non chargé — {x}</div>)}
    <div className="cx-tools">
      <Seg value={src.id} onChange={(v) => { setOuvert(v); setQ(''); setMax(25); setDeplies(new Set()) }} options={SOURCES.map((s) => [s.id, COURT[s.id] || s.titre, d[s.id].length])} />
      {chat && <Seg value={orig} onChange={(v) => { setOrig(v); setMax(25) }} options={[['', 'Tous', groupes.length], ...Object.entries(ORIGINES).map(([k, l]) => [k, l, groupes.filter((g) => g.origine === k).length])]} />}
    </div>
    <div className="cx-stats">
      <Stat l={chat ? 'Visiteurs' : 'Répondants'} v={base.length} t="acc"><em>{chat ? 'un chat par appareil' : ''}</em></Stat>
      <Stat l="7 derniers jours" v={s7} />
      <Stat l="30 derniers jours" v={s30} />
      {chat ? <Stat l="Messages visiteurs" v={nbMsg} /> : st ? <Stat l="Score quiz moyen" v={st.moyenne.toFixed(1)}><em>{st.n} quiz</em></Stat> : null}
    </div>
    {groupes.length > 0 && <div className="cx-g2">
      <Card t="Activité" note="30 derniers jours"><Bars data={serie} h={110} /></Card>
      {chat ? <Card t="Ce que disent vos visiteurs" note="nombre de visiteurs qui en parlent">
          {mots.length ? <div className="cx-pills" style={{ flexWrap: 'wrap' }}>{mots.map(([m, n]) => <button key={m} className={'cx-pill' + (q === m ? ' on' : '')} onClick={() => { setQ(q === m ? '' : m); setMax(25) }}>{m}<i>{n}</i></button>)}</div> : <p className="cx-sub">Pas encore assez de messages.</p>}
          {expr.length > 0 && <><p className="cx-when" style={{ margin: '12px 0 6px' }}>Expressions qui reviennent</p><div className="cx-pills" style={{ flexWrap: 'wrap' }}>{expr.map(([m, n]) => <button key={m} className={'cx-pill' + (q === m ? ' on' : '')} onClick={() => { setQ(q === m ? '' : m); setMax(25) }}>{m}<i>{n}</i></button>)}</div></>}
        </Card>
        : st ? <Card t="Offre recommandée par le quiz"><Donut parts={st.offres.map(([o, n]) => ({ l: o, v: n }))} centre={st.n} sous="quiz" size={110} /></Card>
        : mots.length > 0 ? <Card t="Mots qui reviennent"><div className="cx-pills" style={{ flexWrap: 'wrap' }}>{mots.map(([m, n]) => <button key={m} className={'cx-pill' + (q === m ? ' on' : '')} onClick={() => setQ(q === m ? '' : m)}>{m}<i>{n}</i></button>)}</div></Card> : null}
    </div>}
    {st && mots.length > 0 && <Card t="Mots qui reviennent"><div className="cx-pills" style={{ flexWrap: 'wrap' }}>{mots.map(([m, n]) => <button key={m} className={'cx-pill' + (q === m ? ' on' : '')} onClick={() => setQ(q === m ? '' : m)}>{m}<i>{n}</i></button>)}</div></Card>}
    {!chat && ta.length > 0 && <div className="cx-g2">{ta.slice(0, 4).map((x) => <Card key={x.question} t={x.question} note={x.total + ' réponses'}><HBars rows={x.reponses.slice(0, 5).map(([r, n]) => ({ l: r, v: n, sub: Math.round((n / x.total) * 100) + ' %' }))} /></Card>)}</div>}
    <div className="cx-tools" style={{ marginTop: 6 }}>
      <div className="cx-bar2">
        <input className="cx-search grow" style={{ flex: 1, minWidth: 180 }} type="search" placeholder={chat ? 'Chercher un mot dit par un visiteur…' : 'Chercher un mot dans les verbatims…'} value={q} onChange={(e) => { setQ(e.target.value); setMax(25) }} />
        <select className="cx-sel" value={tri} onChange={(e) => setTri(e.target.value)}><option value="recent">Plus récent d'abord</option><option value="ancien">Plus ancien d'abord</option>{chat && <option value="actif">Dernière activité</option>}</select>
        <button className="cx-btn ghost sm" onClick={() => setDeplies(tousOuverts ? new Set() : new Set(liste.slice(0, max).map((g) => g.id)))}>{tousOuverts ? 'Tout replier' : 'Tout déplier'}</button>
        <button className="cx-btn ghost sm" onClick={() => { telecharger(src.fichier, markdown(src.titre.replace(/^\S+\s/, ''), groupes, chat)); toast('Fichier téléchargé') }}><Icon n="down" s={14} /> .md</button>
      </div>
      {q && <p className="cx-when" style={{ margin: '6px 0 0' }}>{liste.length} résultat{liste.length > 1 ? 's' : ''} pour « {q} »</p>}
    </div>
    {!liste.length ? <div className="cx-empty"><b>{groupes.length ? 'Aucun résultat' : 'Rien pour l\'instant'}</b><div>{groupes.length ? 'Essaie un autre mot.' : 'Les réponses arriveront ici toutes seules.'}</div></div>
      : <>{liste.slice(0, max).map((g) => chat ? <ChatVisiteur key={g.id} g={g} q={q} onPlein={() => setPlein(g.id)} ouvert={deplies.has(g.id)} onToggle={() => bascule(g.id)} /> : <Voix key={g.id} g={g} ouvert={deplies.has(g.id)} onToggle={() => bascule(g.id)} />)}{liste.length > max && <button className="cx-btn" style={{ width: '100%' }} onClick={() => setMax(max + 25)}>Afficher plus ({liste.length - max})</button>}</>}
  </>)
}
