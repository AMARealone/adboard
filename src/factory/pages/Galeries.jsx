import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCtImages, getCtVideos } from '../api'

function useLoad(fn) {
  const [s, set] = useState({ list: [], loading: true, error: '' })
  const load = () => { set((p) => ({ ...p, loading: true })); fn().then((list) => set({ list, loading: false, error: '' })).catch((e) => set({ list: [], loading: false, error: e.message })) }
  useEffect(load, [])
  return [s, load]
}
function Filters({ list, q, setQ, aw, setAw }) {
  const all = useMemo(() => [...new Set(list.flatMap((x) => [...(x.awareness || []), ...(x.awareness2 ? [].concat(x.awareness2) : [])]))].sort(), [list])
  return (
    <div className="fx-tools">
      <input className="fx-in" placeholder="Rechercher un CT" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="fx-pills">
        <button className={'fx-pill' + (!aw ? ' on' : '')} onClick={() => setAw('')}>Tous</button>
        {all.map((a) => <button key={a} className={'fx-pill' + (aw === a ? ' on' : '')} onClick={() => setAw(aw === a ? '' : a)}>{a}</button>)}
      </div>
    </div>
  )
}
const match = (x, q, aw) => (!q || JSON.stringify([x.name, x.meta, x.niche, x.styleTags]).toLowerCase().includes(q.toLowerCase())) && (!aw || (x.awareness || []).includes(aw))

export function GalerieImage() {
  const nav = useNavigate(); const [s, load] = useLoad(getCtImages); const [q, setQ] = useState(''); const [aw, setAw] = useState('')
  const l = s.list.filter((x) => match(x, q, aw))
  return (
    <div className="fx-wrap">
      <div className="fx-h"><div><h1>Galerie CT image</h1><p>{s.list.length} créatives modèles</p></div>
        <div style={{ display: 'flex', gap: 8 }}><button className="fx-btn" onClick={load}>Actualiser</button><button className="fx-btn primary" onClick={() => nav('/galerie/gestion')}>Ajouter / modifier</button></div></div>
      <Filters list={s.list} q={q} setQ={setQ} aw={aw} setAw={setAw} />
      {s.error && <div className="fx-err">{s.error}</div>}
      {s.loading ? <div className="fx-gal">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="fx-skel" style={{ height: 300 }} />)}</div>
        : l.length ? <div className="fx-gal">{l.map((x) => (
          <div key={x.id} className="fx-ct"><img src={x.url} alt={x.name} loading="lazy" />
            <div className="b"><div className="fx-t">{x.name}</div>
              <div className="fx-chips">{(x.awareness || []).map((a) => <span key={a} className="fx-chip a">{a}</span>)}{x.niche && <span className="fx-chip">{x.niche}</span>}</div></div></div>))}</div>
          : <div className="fx-empty">Aucun CT.</div>}
    </div>
  )
}

export function GalerieVideo() {
  const nav = useNavigate(); const [s, load] = useLoad(getCtVideos); const [q, setQ] = useState(''); const [aw, setAw] = useState('')
  const l = s.list.filter((x) => match(x, q, aw))
  return (
    <div className="fx-wrap">
      <div className="fx-h"><div><h1>Galerie CT vidéo</h1><p>{s.list.length} créatives modèles vidéo</p></div>
        <div style={{ display: 'flex', gap: 8 }}><button className="fx-btn" onClick={load}>Actualiser</button><button className="fx-btn primary" onClick={() => nav('/galerie-video/gestion')}>Ajouter / modifier</button></div></div>
      <Filters list={s.list} q={q} setQ={setQ} aw={aw} setAw={setAw} />
      {s.error && <div className="fx-err">{s.error}</div>}
      {s.loading ? <div className="fx-gal">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="fx-skel" style={{ height: 180 }} />)}</div>
        : l.length ? <div className="fx-gal">{l.map((x) => (
          <div key={x.id} className="fx-ct fx-vid">
            <div className="fx-t">{x.name}</div>
            <div className="fx-chips">{x.duree_s && <span className="fx-chip">{x.duree_s} s</span>}{x.blocs && <span className="fx-chip">{Array.isArray(x.blocs) ? x.blocs.length : x.blocs} blocs</span>}{(x.awareness || []).map((a) => <span key={a} className="fx-chip a">{a}</span>)}</div>
            {x.meta && <div className="fx-meta">{x.meta}</div>}
            {x.niches && <div className="fx-s" style={{ whiteSpace: 'normal' }}>Niches : {[].concat(x.niches).join(', ')}</div>}
          </div>))}</div>
          : <div className="fx-empty">Aucun CT vidéo.</div>}
    </div>
  )
}
