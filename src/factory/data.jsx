import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { getCommandes, ping } from './api'
const Ctx = createContext(null)
export const useData = () => useContext(Ctx)
export function DataProvider({ children }) {
  const [cmd, setCmd] = useState({ list: [], loading: true, error: '' })
  const [srv, setSrv] = useState({ ok: null, ms: 0 })
  const load = useCallback(async () => {
    try { const list = await getCommandes(); setCmd({ list, loading: false, error: '' }) }
    catch (e) { setCmd((p) => ({ ...p, loading: false, error: e.message })) }
  }, [])
  useEffect(() => {
    load(); ping().then(setSrv)
    // v: la liste pèse ~20 Mo côté Supabase — rafraîchie seulement si l'onglet est visible, toutes les 3 minutes (avant : chaque minute, onglet caché ou non)
    const t = setInterval(() => { if (!document.hidden) load() }, 180000)
    const onVis = () => { if (!document.hidden) load() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis) }
  }, [load])
  return <Ctx.Provider value={{ cmd, reload: load, srv }}>{children}</Ctx.Provider>
}
