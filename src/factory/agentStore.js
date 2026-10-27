// Mémoire des tests d'agents (garde les champs remplis quand on change de page).
import { useState, useCallback } from 'react'
const mem = {}
export function useAgentMem(slug, init) {
  const [, force] = useState(0)
  if (!mem[slug]) mem[slug] = { ...init }
  const set = useCallback((patch) => { mem[slug] = { ...mem[slug], ...(typeof patch === 'function' ? patch(mem[slug]) : patch) }; force((n) => n + 1) }, [slug])
  return [mem[slug], set]
}
