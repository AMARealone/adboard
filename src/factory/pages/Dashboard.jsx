import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useData } from '../data'
import { etat, getCtImages, getCtVideos } from '../api'
import { OrderRow } from './Commandes'

export default function Dashboard() {
  const { cmd, reload, srv } = useData()
  const nav = useNavigate()
  const [ct, setCt] = useState({ img: null, vid: null })
  useEffect(() => {
    getCtImages().then((l) => setCt((p) => ({ ...p, img: l.length }))).catch(() => setCt((p) => ({ ...p, img: '–' })))
    getCtVideos().then((l) => setCt((p) => ({ ...p, vid: l.length }))).catch(() => setCt((p) => ({ ...p, vid: '–' })))
  }, [])
  const n = (k) => cmd.list.filter((b) => etat(b).key === k).length
  const top = [...cmd.list].sort((a, b) => etat(a).rang - etat(b).rang || new Date(b.created_at) - new Date(a.created_at)).filter((b) => etat(b).rang < 3).slice(0, 6)
  const S = ({ label, v, to, c }) => <button className="fx-stat" onClick={() => nav(to)}><span><i className="fx-dot" style={{ background: c }} />{label}</span><b>{cmd.loading ? '…' : v}</b></button>
  return (
    <div className="fx-wrap">
      <div className="fx-h"><div><h1>Tableau de bord</h1><p>Ce qui demande ton action, en un coup d’œil.</p></div>
        <button className="fx-btn" onClick={reload}>Actualiser</button></div>
      <div className="fx-stats">
        <S label="Prêtes à envoyer" v={n('ready')} to="/commandes?f=ready" c="var(--pu)" />
        <S label="En cours" v={n('prod')} to="/commandes?f=prod" c="var(--ac)" />
        <S label="En attente" v={n('wait')} to="/commandes?f=wait" c="var(--wa)" />
        <S label="Livrées" v={n('done')} to="/commandes?f=done" c="var(--ok)" />
      </div>
      <div className="fx-grid2">
        <div className="fx-card"><h2>À traiter en priorité</h2>
          {cmd.error && <div className="fx-err">{cmd.error}</div>}
          {cmd.loading ? <><div className="fx-skel" /><div className="fx-skel" /></> : top.length ? top.map((b) => <OrderRow key={b.id} b={b} compact />) : <div className="fx-empty">Rien à traiter pour l’instant.</div>}
          <Link to="/commandes" className="fx-btn" style={{ marginTop: 8 }}>Toutes les commandes</Link>
        </div>
        <div className="fx-card"><h2>Bibliothèques & services</h2>
          <Link to="/galerie" className="fx-row"><div className="fx-grow"><div className="fx-t">CT image</div><div className="fx-s">Créatives modèles</div></div><b>{ct.img ?? '…'}</b></Link>
          <Link to="/galerie-video" className="fx-row"><div className="fx-grow"><div className="fx-t">CT vidéo</div><div className="fx-s">Créatives modèles vidéo</div></div><b>{ct.vid ?? '…'}</b></Link>
          <div className="fx-row"><span className={'fx-dot ' + (srv.ok ? 'ok' : srv.ok === false ? 'er' : '')} /><div className="fx-grow"><div className="fx-t">Serveur de production</div><div className="fx-s">{srv.ok === null ? 'Vérification…' : srv.ok ? `En ligne · ${srv.ms} ms` : 'Injoignable (il se réveille parfois en ~30 s)'}</div></div></div>
        </div>
      </div>
    </div>
  )
}
