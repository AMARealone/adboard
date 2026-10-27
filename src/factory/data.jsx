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
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [load])
  return <Ctx.Provider value={{ cmd, reload: load, srv }}>{children}</Ctx.Provider>
}
