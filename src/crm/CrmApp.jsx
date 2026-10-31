import React from 'react'
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
import Legacy from './pages/Legacy'
import Dashboard from './pages/Dashboard'
import Templates from './pages/Templates'
import Transactions from './pages/Transactions'
import Comptabilite from './pages/Comptabilite'
import Fiche from './Fiche'

const BASE = '/crm-next'
const OLD = ['Comportement', 'Utilisateurs', 'Suivi', 'Emails & Séquences', 'Prospection auto', 'Contacts', 'Données']
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')

function Shell({ user, onLogout }) {
  const { prospects, cfg, state, reload } = useCrm(), loc = useLocation()
  const t = aFaire(prospects, cfg)
  const NAV = [
    { to: '/', label: 'Aujourd\'hui', n: t.appels.length + t.noshow.length + t.closing.length + t.ecrit.length + t.relances.length, end: true },
    { to: '/prospects', label: 'Prospects', n: prospects.length },
    { g: 'Pipeline' },
    { to: '/leads', label: 'Leads', n: leadsARelancer(prospects).length },
    { to: '/appels', label: 'Appels', n: prospects.filter(appelAffiche).length },
    { to: '/closing', label: 'Closing', n: prospects.filter(closingDansListe).length },
    { to: '/ecrit', label: 'Écrit', n: prospects.filter(ecritActif).length },
    { g: 'Pilotage' },
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/transactions', label: 'Transactions & clients' },
    { to: '/comptabilite', label: 'Comptabilité' },
    { to: '/templates', label: 'Templates' },
    { g: 'Bientôt (ancien CRM)' },
    ...OLD.map((o) => ({ to: '/ancien/' + slug(o), label: o, old: true })),
  ]
  return (
    <div className="cx-app">
      <aside className="cx-side">
        <div className="cx-brand"><div className="cx-logo">C</div><div><b>CRM AdStack</b><small>version React · bêta</small></div></div>
        <nav>{NAV.map((i, k) => i.g ? <div key={k} className="cx-grp">{i.g}</div> : <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => 'cx-link' + (isActive ? ' on' : '') + (i.old ? ' old' : '')}><span>{i.label}</span>{i.n > 0 && <em>{i.n}</em>}</NavLink>)}</nav>
        <div className="cx-foot"><div className="cx-em">{user.email}</div><button className="cx-btn sm" onClick={reload}>{state.loading ? 'Chargement…' : '↻ Actualiser'}</button><button className="cx-btn sm ghost" onClick={() => { signOut(); onLogout() }}>Se déconnecter</button></div>
      </aside>
      <main className="cx-page">
        {state.loading && !prospects.length ? <div className="cx-empty"><b>Chargement…</b><div>{state.n} prospects</div></div>
          : state.error ? <div className="cx-empty"><b>Erreur</b><div>{state.error}</div><button className="cx-btn primary" onClick={reload}>Réessayer</button></div>
          : <Outlet />}
      </main>
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
            <Route path="prospects" element={<Titre t="Prospects"><Prospects /></Titre>} />
            <Route path="leads" element={<Titre t="Leads"><Leads /></Titre>} />
            <Route path="appels" element={<Titre t="Appels"><Appels /></Titre>} />
            <Route path="closing" element={<Titre t="Closing"><Closing /></Titre>} />
            <Route path="ecrit" element={<Titre t="Écrit"><Ecrit /></Titre>} />
            <Route path="dashboard" element={<Titre t="Dashboard"><Dashboard /></Titre>} />
            <Route path="transactions" element={<Titre t="Transactions & clients"><Transactions /></Titre>} />
            <Route path="comptabilite" element={<Titre t="Comptabilité"><Comptabilite /></Titre>} />
            <Route path="templates" element={<Titre t="Templates"><Templates /></Titre>} />
            {OLD.map((o) => <Route key={o} path={'ancien/' + slug(o)} element={<Titre t={o}><Legacy titre={o} /></Titre>} />)}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Host />
    </CrmProvider>
  )
}
