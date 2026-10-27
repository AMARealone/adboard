import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './factory.css'
import { useAdmin, Login } from './auth'
import { DataProvider } from './data'
import Shell from './Shell'
import Dashboard from './pages/Dashboard'
import Commandes from './pages/Commandes'
import Agents from './pages/Agents'
import AgentTest from './pages/AgentTest'
import Production from './pages/Production'
import { GalerieImage, GalerieVideo } from './pages/ManageGalleries'
import { DialogHost } from './ui'

export default function FactoryApp() {
  const { loading, user, recheck } = useAdmin()
  if (loading) return <div className="fx-login"><div className="fx-empty">Chargement…</div></div>
  if (!user) return <Login onDone={recheck} />
  return (
    <DataProvider>
      <BrowserRouter basename="/factory-next">
        <Routes>
          <Route element={<Shell user={user} onLogout={recheck} />}>
            <Route index element={<Dashboard />} />
            <Route path="commandes" element={<Commandes />} />
            <Route path="production" element={<Production />} />
            <Route path="agents" element={<Agents />} />
            <Route path="agents/:slug" element={<AgentTest />} />
            <Route path="galerie" element={<GalerieImage />} />
            <Route path="galerie-video" element={<GalerieVideo />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <DialogHost />
    </DataProvider>
  )
}
