import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import './crm.css'
import { useAdmin, Login, signOut } from './auth'
import { CrmProvider, useCrm } from './store'
import { Host, Icon } from './ui'
import { aFaire, appelAffiche, closingDansListe, ecritActif, leadsARelancer } from './domain/rules'
import Aujourdhui from './pages/Aujourdhui'
import Appels from './pages/Appels'
import Closing from './pages/Closing'
import Ecrit from './pages/Ecrit'
import Acheteurs from './pages/Acheteurs'
import { estAcheteur } from './domain/acheteurs'
import Leads from './pages/Leads'
import Prospects from './pages/Prospects'
import Dashboard from './pages/Dashboard'
import Templates from './pages/Templates'
import Transactions from './pages/Transactions'
import Comptabilite from './pages/Comptabilite'
import Emails from './pages/Emails'
import Suivi from './pages/Suivi'
import AContacter from './pages/AContacter'
import Fiche from './Fiche'
import { IconeAdStats } from './Logo'
import Comportement from './pages/Comportement'
import Donnees from './pages/Donnees'
import Utilisateurs from './pages/Utilisateurs'
import Clients from './pages/Clients'
import ProspectionAuto from './pages/ProspectionAuto'

const BASE = /^\/crm-next(\/|$)/.test(location.pathname) ? '/crm-next' : '/adstats'

function Shell({ user, onLogout }) {
  const { prospects, cfg, state, reload } = useCrm(), loc = useLocation()
  const t = aFaire(prospects, cfg), [menu, setMenu] = useState(false)
  const [ferme, setFerme] = useState(() => { try { return JSON.parse(localStorage.getItem('cx_nav_ferme') || '[]') } catch (_) { return [] } })
  const basculer = (g) => setFerme((f) => { const n = f.includes(g) ? f.filter((x) => x !== g) : [...f, g]; try { localStorage.setItem('cx_nav_ferme', JSON.stringify(n)) } catch (_) {} return n })
  useEffect(() => setMenu(false), [loc.pathname])
  const nContacter = prospects.filter((p) => p.statut === 'a_contacter').length
  const NAV = [
    { to: '/', label: 'Aujourd\'hui', ic: 'today', n: t.appels.length + t.noshow.length + t.closing.length + t.ecrit.length + t.relances.length + t.acheteurs.length, end: true },
    { g: 'Vendre' },
    { to: '/a-contacter', label: 'Contacter', ic: 'send', n: nContacter },
    { to: '/suivi', label: 'Suivi', ic: 'eye', n: prospects.filter((p) => p.statut === 'en_suivi').length },
    { to: '/leads', label: 'Leads', ic: 'flame', n: leadsARelancer(prospects).length },
    { to: '/appels', label: 'Appels', ic: 'phone', n: prospects.filter(appelAffiche).length },
    { to: '/closing', label: 'Closing', ic: 'check', n: prospects.filter(closingDansListe).length },
    { to: '/ecrit', label: 'Closing écrit', ic: 'pen', n: prospects.filter(ecritActif).length },
    { to: '/acheteurs', label: 'Acheteurs', ic: 'star', n: prospects.filter(estAcheteur).length },
    { g: 'Piloter' },
    { to: '/dashboard', label: 'Dashboard', ic: 'chart' },
    { to: '/transactions', label: 'Ventes & clients', ic: 'receipt' },
    { to: '/comptabilite', label: 'Comptabilité', ic: 'wallet' },
    { g: 'Messages' },
    { to: '/templates', label: 'Templates', ic: 'doc' },
    { to: '/emails', label: 'Emails', ic: 'mail' },
    { g: 'Comprendre' },
    { to: '/donnees', label: 'Verbatims & quiz', ic: 'db' },
    { to: '/comportement', label: 'Comportement site', ic: 'pulse' },
    { g: 'Base' },
    { to: '/prospects', label: 'Tous les contacts', ic: 'book', n: prospects.length },
    { to: '/clients', label: 'Clients abonnés', ic: 'users' },
    { to: '/utilisateurs', label: 'Inscrits', ic: 'user' },
    { to: '/prospection-auto', label: 'Prospection auto', ic: 'bolt' },
  ]
  let grp = ''
  const visibles = NAV.filter((i) => { if (i.g) { grp = i.g; return true } const actif = i.end ? loc.pathname === '/' : loc.pathname.startsWith(i.to); i.grp = grp; return !grp || !ferme.includes(grp) || actif })
  const rendu = (i, k) => i.g
    ? <button key={k} className={'cx-grp cx-grpbtn' + (ferme.includes(i.g) ? ' closed' : '')} onClick={() => basculer(i.g)} aria-expanded={!ferme.includes(i.g)}><span>{i.g}</span><i>▾</i></button>
    : <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => 'cx-link' + (isActive ? ' on' : '') + (i.old ? ' old' : '')}><Icon n={i.ic} /><span>{i.label}</span>{i.n > 0 && <em>{i.n}</em>}</NavLink>
  return (
    <div className="cx-app">
      <aside className="cx-side">
        <div className="cx-brand"><div className="cx-logo"><IconeAdStats /></div><div><b>AdStats</b><small>AdStack · CRM</small></div></div>
        <nav>{visibles.map(rendu)}</nav>
        <div className="cx-foot"><div className="cx-em">{user.email}</div><button className="cx-btn sm" onClick={reload}><Icon n="refresh" s={14} /> {state.loading ? 'Chargement…' : 'Actualiser'}</button><button className="cx-btn sm ghost" onClick={() => { signOut(); onLogout() }}>Se déconnecter</button></div>
      </aside>
      <main className="cx-page">
        {state.loading && !prospects.length ? <div className="cx-empty"><b>Chargement…</b><div>{state.n} prospects</div></div>
          : state.error ? <div className="cx-empty"><b>Erreur</b><div>{state.error}</div><button className="cx-btn primary" onClick={reload}>Réessayer</button></div>
          : <Outlet />}
      </main>
      <div className="cx-top"><b>{(NAV.find((i) => i.to && (i.end ? loc.pathname === '/' : loc.pathname.startsWith(i.to))) || {}).label || 'CRM'}</b><button className="cx-ico" onClick={reload} aria-label="Actualiser">{state.loading ? '…' : '↻'}</button></div>
      <nav className="cx-tabbar" aria-label="Navigation principale">
        {[NAV[0], NAV.find((i) => i.to === '/a-contacter'), NAV.find((i) => i.to === '/suivi'), NAV.find((i) => i.to === '/appels')].map((i) => <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => 'cx-tab2' + (isActive ? ' on' : '')}><Icon n={i.ic} s={20} /><span>{i.label}</span>{i.n > 0 && <em>{i.n}</em>}</NavLink>)}
        <button className={'cx-tab2' + (menu ? ' on' : '')} onClick={() => setMenu(!menu)}><Icon n="more" s={20} /><span>Plus</span></button>
      </nav>
      {menu && <div className="cx-back cx-sheetback" onClick={() => setMenu(false)}><div className="cx-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="cx-grip" />
        {NAV.map((i, k) => i.g ? <div key={k} className="cx-grp">{i.g}</div> : rendu(i, k))}
        <div className="cx-em" style={{ padding: '10px 4px 0' }}>{user.email}</div>
        <button className="cx-btn ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => { signOut(); onLogout() }}>Se déconnecter</button>
      </div></div>}
      <Fiche />
    </div>
  )
}
const Titre = ({ t, children }) => <><h2 className="cx-h">{t}</h2>{children}</>
export default function CrmApp() {
  const { loading, user, recheck } = useAdmin()
  if (loading) return <div className="cx-login"><div className="cx-empty">Chargement…</div></div>
  if (!user) return <Login onDone={recheck} />
  return (
    <CrmProvider>
      <BrowserRouter basename={BASE}>
        <Routes>
          <Route element={<Shell user={user} onLogout={recheck} />}>
            <Route index element={<Titre t="Aujourd'hui"><Aujourdhui /></Titre>} />
            <Route path="prospects" element={<Titre t="Tous les contacts"><Prospects /></Titre>} />
            <Route path="a-contacter" element={<Titre t="Contacter"><AContacter /></Titre>} />
            <Route path="suivi" element={<Titre t="Suivi"><Suivi /></Titre>} />
            <Route path="leads" element={<Titre t="Leads"><Leads /></Titre>} />
            <Route path="appels" element={<Titre t="Appels"><Appels /></Titre>} />
            <Route path="closing" element={<Titre t="Closing"><Closing /></Titre>} />
            <Route path="ecrit" element={<Titre t="Closing écrit"><Ecrit /></Titre>} />
            <Route path="acheteurs" element={<Titre t="Acheteurs"><Acheteurs /></Titre>} />
            <Route path="dashboard" element={<Titre t="Dashboard"><Dashboard /></Titre>} />
            <Route path="transactions" element={<Titre t="Ventes & clients"><Transactions /></Titre>} />
            <Route path="comptabilite" element={<Titre t="Comptabilité"><Comptabilite /></Titre>} />
            <Route path="emails" element={<Titre t="Emails"><Emails /></Titre>} />
            <Route path="templates" element={<Titre t="Templates"><Templates /></Titre>} />
            <Route path="comportement" element={<Titre t="Comportement site"><Comportement /></Titre>} />
            <Route path="donnees" element={<Titre t="Verbatims & quiz"><Donnees /></Titre>} />
            <Route path="clients" element={<Titre t="Clients abonnés"><Clients /></Titre>} />
            <Route path="utilisateurs" element={<Titre t="Inscrits"><Utilisateurs /></Titre>} />
            <Route path="prospection-auto" element={<Titre t="Prospection auto"><ProspectionAuto /></Titre>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Host />
    </CrmProvider>
  )
}
