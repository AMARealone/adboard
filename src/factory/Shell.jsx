import { IconeFactory } from './Logo'
import React, { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import Icon from './Icon'
import { useData } from './data'
import { signOut } from './auth'

const NAV = [
  { g: 'Pilotage', items: [{ to: '/', icon: 'home', label: 'Tableau de bord', end: true }, { to: '/commandes', icon: 'inbox', label: 'Commandes', badge: true }] },
  { g: 'Production', items: [{ to: '/production', icon: 'bolt', label: 'Production' }, { to: '/agents', icon: 'bot', label: 'Agents' }, { to: '/apprentissage', icon: 'learn', label: 'Apprentissage' }] },
  { g: 'Bibliothèques', items: [{ to: '/galerie', icon: 'image', label: 'Galerie CT image' }, { to: '/galerie-video', icon: 'film', label: 'Galerie CT vidéo' }] },
]
// Barre du bas sur téléphone : les quatre écrans du quotidien, le reste dans « Plus »
const BAS = [{ to: '/', icon: 'home', label: 'Accueil', end: true }, { to: '/commandes', icon: 'inbox', label: 'Commandes', badge: true }, { to: '/production', icon: 'bolt', label: 'Production' }, { to: '/agents', icon: 'bot', label: 'Agents' }]
const TITLES = [['/commandes', 'Commandes'], ['/production', 'Production'], ['/agents', 'Agents'], ['/apprentissage', 'Apprentissage'], ['/galerie-video', 'Galerie CT vidéo'], ['/galerie', 'Galerie CT image']]

export default function Shell({ user, onLogout }) {
  const [open, setOpen] = useState(false)
  const { cmd, srv } = useData()
  const loc = useLocation()
  useEffect(() => setOpen(false), [loc.pathname])
  const todo = cmd.list.filter((b) => b.status === 'pending' || b.status === 'in_production').length
  const title = (TITLES.find(([p]) => loc.pathname.startsWith(p)) || [0, 'Tableau de bord'])[1]
  const srvTxt = srv.ok === null ? 'Serveur…' : srv.ok ? 'Serveur en ligne' : 'Serveur injoignable'
  return (
    <div className="fx-app">
      <div className={'fx-scrim' + (open ? ' show' : '')} onClick={() => setOpen(false)} />
      <aside className={'fx-side' + (open ? ' open' : '')}>
        <div className="fx-brand"><div className="fx-logo"><IconeFactory /></div><div><b>Factory</b><small>L’atelier AdStack</small></div></div>
        <nav className="fx-nav">
          {NAV.map((s) => (
            <div key={s.g}>
              <div className="fx-grp">{s.g}</div>
              {s.items.map((i) => (
                <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => 'fx-link' + (isActive ? ' on' : '')}>
                  <Icon n={i.icon} /><span>{i.label}</span>
                  {i.badge && todo > 0 && <span className="fx-badge">{todo}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="fx-foot col">
          <div className="fx-srv"><span className={'fx-dot ' + (srv.ok === null ? '' : srv.ok ? 'ok live' : 'er')} /><span>{srvTxt}{srv.ok && srv.ms ? ' · ' + srv.ms + ' ms' : ''}</span></div>
          <div className="fx-acct"><div className="fx-av">{(user?.email || '?')[0].toUpperCase()}</div><div className="fx-em" title={user?.email}>{user?.email}</div>
            <button className="fx-logout" title="Se déconnecter" aria-label="Se déconnecter" onClick={() => { signOut(); onLogout() }}><Icon n="out" /></button></div>
        </div>
      </aside>
      <div className="fx-main">
        <header className="fx-top">
          <div className="fx-logo sm"><IconeFactory /></div>
          <b>{title}</b>
          <span className={'fx-dot ' + (srv.ok === null ? '' : srv.ok ? 'ok live' : 'er')} title={srvTxt} />
        </header>
        <div className="fx-page"><Outlet /></div>
        <nav className="fx-tabbar">
          {BAS.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => 'fx-tb' + (isActive ? ' on' : '')}>
              <span className="fx-tb-i"><Icon n={i.icon} />{i.badge && todo > 0 && <em>{todo}</em>}</span><span>{i.label}</span>
            </NavLink>
          ))}
          <button className={'fx-tb' + (open ? ' on' : '')} onClick={() => setOpen(true)}><span className="fx-tb-i"><Icon n="more" /></span><span>Plus</span></button>
        </nav>
      </div>
    </div>
  )
}
