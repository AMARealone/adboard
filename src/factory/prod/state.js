// État de la production (repris de l'ancien Factory : même noms, même forme des données sauvegardées).
import { useEffect, useState } from 'react'
export const SERVER = 'https://adstack-server.onrender.com'
export const COMP_FILES = {}   // compétences (texte des agents), chargées à la demande
export const CT_IMAGES = {}    // galerie CT : id → url, id_mime, id_name, …

export const prodv2State = {
  brief: null, briefRaw: null, briefSource: null, commandeId: null, productId: null,
  productB64: null, productMime: null, logoB64: null, logoMime: null,
  synthesis: null, angles: [], creatives: [], copies: [], marche: null,
  startTime: null, activeAngle: 0, renewalContext: null,
  // ── affichage uniquement (jamais envoyé au serveur) ──
  ui: {
    agents: { 1: { state: 'pending', text: 'En attente', pct: 0 }, 2: { state: 'pending', text: 'En attente — créatives à produire (3 par angle)', pct: 0 }, 3: { state: 'pending', text: 'En attente — 5 hooks + 1 description par angle', pct: 0 } },
    crea: [],        // par créative : { state:'pending'|'running'|'done'|'err', text, err }
    copy: [],        // par angle    : { state:'wait'|'run'|'done'|'err', err }
    nbAngles: 0, running: false, launchLabel: 'Lancer la production', launched: false,
    banner: null,    // { kind:'info'|'warn'|'ok', text }
    renewal: null,   // { kind, text }
    resuming: false, resumeError: '', synOpen: false, sending: {}, sendLabel: null,
  },
}
let version = 0
const subs = new Set()
export function emit() { version++; subs.forEach((f) => f(version)) }
export function useProd() {
  const [, set] = useState(0)
  useEffect(() => { const f = (v) => set(v); subs.add(f); return () => subs.delete(f) }, [])
  return prodv2State
}

const skillFiles = import.meta.glob('./../skills/*.md', { query: '?raw', import: 'default' })
export async function loadSkills() {
  await Promise.all(Object.entries(skillFiles).map(async ([p, load]) => {
    const name = p.split('/').pop()
    if (!COMP_FILES[name]) COMP_FILES[name] = await load()
  }))
  return COMP_FILES
}
