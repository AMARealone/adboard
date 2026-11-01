// Mémoire des vues de Factory : tout ce que tu remplis, choisis ou lances reste là quand tu changes de page,
// quand tu actualises le navigateur ou après une erreur. Les données sont gardées dans IndexedDB (photos et images comprises).
import { useState, useCallback, useEffect } from 'react'

const mem = {}          // une entrée par agent / par vue
const dirty = new Set()
const live = {}         // générations qui tournent vraiment dans cette page (perdues si la page est rechargée)
const DB = 'adstack_factory_mem', STORE = 'kv'

const openDb = () => new Promise((res, rej) => {
  try {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(STORE)
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  } catch (e) { rej(e) }
})
let dbp = null
const db = () => (dbp = dbp || openDb())

// À appeler une fois avant d'afficher Factory : recharge tout ce qui avait été sauvegardé.
let hydrated = null
export function hydrateMem() {
  if (hydrated) return hydrated
  hydrated = (async () => {
    try {
      const d = await db()
      await new Promise((res) => {
        const tx = d.transaction(STORE, 'readonly'), st = tx.objectStore(STORE), c = st.openCursor()
        c.onsuccess = () => { const cur = c.result; if (cur) { if (!(cur.key in mem)) mem[cur.key] = cur.value; cur.continue() } else res() }
        c.onerror = () => res()
      })
    } catch (_) { /* navigateur sans IndexedDB : on garde la mémoire de page seulement */ }
  })()
  return hydrated
}

let timer = null
function flush() {
  clearTimeout(timer); timer = null
  if (!dirty.size) return
  const keys = [...dirty]; dirty.clear()
  db().then((d) => {
    const tx = d.transaction(STORE, 'readwrite'), st = tx.objectStore(STORE)
    keys.forEach((k) => { try { st.put(strip(mem[k]), k) } catch (_) { /* valeur non sauvegardable : ignorée */ } })
  }).catch(() => {})
}
// On ne sauvegarde jamais les réponses d'un état « en cours » comme vivantes : seul `busy` + `t0` sont gardés pour reprendre l'affichage.
const strip = (v) => v
function touch(k) { dirty.add(k); if (!timer) timer = setTimeout(flush, 350) }
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush() })
}

// Mémoire d'un agent (le test d'un agent, le panneau vidéo, …).
export function useAgentMem(slug, init) {
  const [, force] = useState(0)
  // Les champs ajoutés plus tard dans le code reçoivent leur valeur par défaut sans effacer ce qui était sauvegardé.
  if (!mem[slug]) mem[slug] = { ...init }
  else if (init) { for (const k of Object.keys(init)) if (!(k in mem[slug])) mem[slug][k] = init[k] }
  const set = useCallback((patch) => {
    mem[slug] = { ...mem[slug], ...(typeof patch === 'function' ? patch(mem[slug]) : patch) }
    touch(slug); force((n) => n + 1)
  }, [slug])
  return [mem[slug], set]
}

// Une simple valeur de vue (recherche, filtre, onglet…) qui survit au changement de page et à l'actualisation.
export function usePersist(key, init) {
  const k = 'v:' + key
  const [, force] = useState(0)
  if (!(k in mem)) mem[k] = { v: init }
  const set = useCallback((v) => { mem[k] = { v: typeof v === 'function' ? v(mem[k].v) : v }; touch(k); force((n) => n + 1) }, [k])
  return [mem[k].v, set]
}

// Génération « vivante » : vraie tant que la page n'a pas été rechargée.
export const setLive = (slug, on) => { if (on) live[slug] = true; else delete live[slug] }
export const isLive = (slug) => !!live[slug]

// Compteur de secondes calculé depuis l'heure de départ sauvegardée : il reprend là où il en était.
export function useTick(t0, on) {
  const [, f] = useState(0)
  useEffect(() => { if (!on) return; const i = setInterval(() => f((n) => n + 1), 1000); return () => clearInterval(i) }, [on])
  return t0 ? Math.max(0, Math.round((Date.now() - t0) / 1000)) : 0
}
