import { useCallback, useState } from 'react'
// Réglages mémorisés (période, filtres, onglets, recherche…) : on quitte une section, on actualise, on revient — tout est resté en place.
const P = 'cx_pref_'
export function lirePref(key, init) { try { const s = localStorage.getItem(P + key); return s === null ? init : JSON.parse(s) } catch (_) { return init } }
export function ecrirePref(key, v) { try { localStorage.setItem(P + key, JSON.stringify(v)) } catch (_) {} }
export function usePref(key, init) {
  const [v, setV] = useState(() => lirePref(key, init))
  const set = useCallback((x) => setV((prev) => { const n = typeof x === 'function' ? x(prev) : x; ecrirePref(key, n); return n }), [key])
  return [v, set]
}
