import React, { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useData } from '../data'
import { etat } from '../api'

export function OrderRow({ b, compact }) {
  const nav = useNavigate()
  const e = etat(b)
  const photo = b.photo_nobg || b.product?.photo_base64 || b.product?.photo_url
  const open = () => nav('/production?cmd=' + encodeURIComponent(b.id))
  return (
    <div className={'fx-row' + (e.key === 'ready' ? ' ready' : '')}>
      {photo ? <img className="fx-thumb" src={photo} alt="" onError={(x) => (x.currentTarget.style.visibility = 'hidden')} /> : <div className="fx-thumb">—</div>}
      <div className="fx-grow">
        <div className="fx-t">{b.product?.nom || 'Produit'}</div>
        <div className="fx-s">{b.client?.email || (b.client?.user_id || '').slice(0, 8)} · {(b.client?.plan || '').toUpperCase()} · {b.quantity} images</div>
      </div>
      <span className={'fx-tag ' + e.key}>{e.label}</span>
      {!compact && e.key !== 'off' && <button className={'fx-btn' + (e.key === 'ready' || e.key === 'wait' ? ' primary' : '')} onClick={open}>{e.key === 'wait' ? 'Lancer' : e.key === 'ready' ? 'Envoyer' : 'Ouvrir'}</button>}
      {compact && <button className="fx-btn" onClick={open}>Ouvrir</button>}
    </div>
  )
}

const F = [['all', 'Toutes'], ['ready', 'Prêtes'], ['prod', 'En cours'], ['wait', 'En attente'], ['done', 'Livrées']]
export default function Commandes() {
  const { cmd, reload } = useData()
  const [sp, setSp] = useSearchParams()
  const f = sp.get('f') || 'all'
  const [q, setQ] = useState('')
  const list = useMemo(() => cmd.list
    .filter((b) => f === 'all' || etat(b).key === f)
    .filter((b) => !q || JSON.stringify([b.product?.nom, b.client?.email]).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => etat(a).rang - etat(b).rang || new Date(b.created_at) - new Date(a.created_at)), [cmd.list, f, q])
  return (
    <div className="fx-wrap">
      <div className="fx-h"><div><h1>Commandes</h1><p>{cmd.list.length} au total · les plus urgentes en premier</p></div><button className="fx-btn" onClick={reload}>Actualiser</button></div>
      <div className="fx-tools">
        <input className="fx-in" placeholder="Rechercher un produit ou un client" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="fx-pills">{F.map(([k, l]) => <button key={k} className={'fx-pill' + (f === k ? ' on' : '')} onClick={() => setSp(k === 'all' ? {} : { f: k })}>{l}</button>)}</div>
      </div>
      {cmd.error && <div className="fx-err" style={{ marginBottom: 12 }}>{cmd.error}</div>}
      {cmd.loading ? <><div className="fx-skel" /><div className="fx-skel" /><div className="fx-skel" /></> : list.length ? list.map((b) => <OrderRow key={b.id} b={b} />) : <div className="fx-empty">Aucune commande dans cette vue.</div>}
    </div>
  )
}
