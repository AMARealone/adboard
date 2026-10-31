import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import './crm.css'
import { useAdmin, Login, signOut } from './auth'
import { CrmProvider, useCrm } from './store'
import { Host } from './ui'
import { aFaire, appelAffiche, closingDansListe, ecritActif, leadsARelancer } from './domain/rules'
import Aujourdhui from './pages/Aujourdhui'
import Appels from './pages/Appels'
import Closing from './pages/Closing'
import Ecrit from './pages/Ecrit'
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

const BASE = '/crm-next'

function Shell({ user, onLogout }) {
  const { prospects, cfg, state, reload } = useCrm(), loc = useLocation()
  const t = aFaire(prospects, cfg), [menu, setMenu] = useState(false)
  const [ferme, setFerme] = useState(() => { try { return JSON.parse(localStorage.getItem('cx_nav_ferme') || '[]') } catch (_) { return [] } })
  const basculer = (g) => setFerme((f) => { const n = f.includes(g) ? f.filter((x) => x !== g) : [...f, g]; try { localStorage.setItem('cx_nav_ferme', JSON.stringify(n)) } catch (_) {} return n })
  useEffect(() => setMenu(false), [loc.pathname])
  const NAV = [
    { to: '/', label: 'Aujourd\'hui', n: t.appels.length + t.noshow.length + t.closing.length + t.ecrit.length + t.relances.length, end: true },
    { to: '/prospects', label: 'Contacts', n: prospects.length },
    { g: 'Pipeline' },
    { to: '/a-contacter', label: 'À contacter', n: prospects.filter((p) => p.statut === 'a_contacter').length },
    { to: '/suivi', label: 'Suivi', n: prospects.filter((p) => p.statut === 'en_suivi').length },
    { to: '/leads', label: 'Leads', n: leadsARelancer(prospects).length },
    { to: '/appels', label: 'Appels', n: prospects.filter(appelAffiche).length },
    { to: '/closing', label: 'Closing', n: prospects.filter(closingDansListe).length },
    { to: '/ecrit', label: 'Écrit', n: prospects.filter(ecritActif).length },
    { g: 'Pilotage' },
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/transactions', label: 'Transactions & clients' },
    { to: '/comptabilite', label: 'Comptabilité' },
    { to: '/emails', label: 'Emails & Séquences' },
    { to: '/templates', label: 'Templates' },
    { to: '/comportement', label: 'Comportement' },
    { to: '/donnees', label: 'Données' },
    { g: 'Utilisateurs' },
    { to: '/clients', label: 'Clients abonnés' },
    { to: '/utilisateurs', label: 'Inscrits' },
    { g: 'Outils' },
    { to: '/prospection-auto', label: 'Prospection auto' },
  ]
  let grp = ''
  const visibles = NAV.filter((i) => { if (i.g) { grp = i.g; return true } const actif = i.end ? loc.pathname === '/' : loc.pathname.startsWith(i.to); i.grp = grp; return !grp || !ferme.includes(grp) || actif })
  const rendu = (i, k) => i.g
    ? <button key={k} className={'cx-grp cx-grpbtn' + (ferme.includes(i.g) ? ' closed' : '')} onClick={() => basculer(i.g)} aria-expanded={!ferme.includes(i.g)}><span>{i.g}</span><i>▾</i></button>
    : <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => 'cx-link' + (isActive ? ' on' : '') + (i.old ? ' old' : '')}><span>{i.label}</span>{i.n > 0 && <em>{i.n}</em>}</NavLink>
  return (
    <div className="cx-app">
      <aside className="cx-side">
        <div className="cx-brand"><div className="cx-logo"><IconeAdStats /></div><div><b>AdStats</b><small>AdStack · CRM</small></div></div>
        <nav>{visibles.map(rendu)}</nav>
        <div className="cx-foot"><div className="cx-em">{user.email}</div><button className="cx-btn sm" onClick={reload}>{state.loading ? 'Chargement…' : '↻ Actualiser'}</button><button className="cx-btn sm ghost" onClick={() => { signOut(); onLogout() }}>Se déconnecter</button></div>
      </aside>
      <main className="cx-page">
        {state.loading && !prospects.length ? <div className="cx-empty"><b>Chargement…</b><div>{state.n} prospects</div></div>
          : state.error ? <div className="cx-empty"><b>Erreur</b><div>{state.error}</div><button className="cx-btn primary" onClick={reload}>Réessayer</button></div>
          : <Outlet />}
      </main>
      <div className="cx-top"><b>{(NAV.find((i) => i.to && (i.end ? loc.pathname === '/' : loc.pathname.startsWith(i.to))) || {}).label || 'CRM'}</b><button className="cx-ico" onClick={reload} aria-label="Actualiser">{state.loading ? '…' : '↻'}</button></div>
      <nav className="cx-tabbar" aria-label="Navigation principale">
        {[NAV[0], NAV.find((i) => i.to === '/leads'), NAV.find((i) => i.to === '/appels'), NAV.find((i) => i.to === '/closing')].map((i) => <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => 'cx-tab2' + (isActive ? ' on' : '')}><span>{i.label}</span>{i.n > 0 && <em>{i.n}</em>}</NavLink>)}
        <button className={'cx-tab2' + (menu ? ' on' : '')} onClick={() => setMenu(!menu)}><span>Plus</span></button>
      </nav>
      {menu && <div className="cx-back cx-sheetback" onClick={() => setMenu(false)}><div className="cx-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="cx-grip" />
        {visibles.map(rendu)}
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
            <Route path="prospects" element={<Titre t="Contacts"><Prospects /></Titre>} />
            <Route path="a-contacter" element={<Titre t="À contacter"><AContacter /></Titre>} />
            <Route path="suivi" element={<Titre t="Suivi prospection"><Suivi /></Titre>} />
            <Route path="leads" element={<Titre t="Leads"><Leads /></Titre>} />
            <Route path="appels" element={<Titre t="Appels"><Appels /></Titre>} />
            <Route path="closing" element={<Titre t="Closing"><Closing /></Titre>} />
            <Route path="ecrit" element={<Titre t="Écrit"><Ecrit /></Titre>} />
            <Route path="dashboard" element={<Titre t="Dashboard"><Dashboard /></Titre>} />
            <Route path="transactions" element={<Titre t="Transactions & clients"><Transactions /></Titre>} />
            <Route path="comptabilite" element={<Titre t="Comptabilité"><Comptabilite /></Titre>} />
            <Route path="emails" element={<Titre t="Emails & Séquences"><Emails /></Titre>} />
            <Route path="templates" element={<Titre t="Templates"><Templates /></Titre>} />
            <Route path="comportement" element={<Titre t="Comportement"><Comportement /></Titre>} />
            <Route path="donnees" element={<Titre t="Données"><Donnees /></Titre>} />
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
