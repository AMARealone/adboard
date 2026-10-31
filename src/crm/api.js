// Accès données du CRM (Supabase REST). Même base que l'ancien CRM ; la session admin (partagée avec Factory)
// est utilisée dès qu'elle existe : quand les règles de sécurité seront resserrées, seule cette session aura accès.
export const SB = 'https://mifljhsusidgzelnswma.supabase.co'
export const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZmxqaHN1c2lkZ3plbG5zd21hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MjI2MzQsImV4cCI6MjA5MzQ5ODYzNH0.AX4Xu0sP2tgjLhZSbCKhtw4Q3sd7GRMJ2aMKK3GfzUc'
export const ADMIN_EMAIL = 'thefirstquality01@gmail.com'
export const SERVER = 'https://adstack-server.onrender.com'
const KS = 'factory_admin_sb_session'
export function accessToken() { try { const s = JSON.parse(localStorage.getItem(KS) || 'null'); return (s && s.access_token) || SB_KEY } catch (_) { return SB_KEY } }
const hdr = (x) => ({ apikey: SB_KEY, Authorization: 'Bearer ' + accessToken(), 'Content-Type': 'application/json', ...(x || {}) })
const REST = SB + '/rest/v1'

// Lecture paginée (1000 par page) : ne dépend plus d'un plafond serveur silencieux.
export async function fetchProspects(onProgress) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${REST}/prospects?select=*&nom_marque=neq.__config__&order=created_at.asc,id.asc`, { headers: hdr({ Range: `${from}-${from + 999}`, 'Range-Unit': 'items' }) })
    if (!r.ok && r.status !== 206) throw new Error('Prospects : HTTP ' + r.status)
    const part = await r.json()
    rows.push(...part)
    if (onProgress) onProgress(rows.length)
    if (part.length < 1000) break
  }
  return rows
}
export async function fetchConfig() {
  const r = await fetch(`${REST}/prospects?nom_marque=eq.__config__&select=id,notes`, { headers: hdr() })
  if (!r.ok) throw new Error('Config : HTTP ' + r.status)
  const rows = await r.json()
  let cfg = {}
  try { cfg = JSON.parse((rows[0] && rows[0].notes) || '{}') || {} } catch (_) {}
  return { id: rows[0] ? rows[0].id : null, cfg }
}
// Écriture « sans écrasement » : on relit la fiche, on fusionne seulement les clés modifiées, puis on écrit.
export async function mergeNotes(id, changes, body) {
  const r = await fetch(`${REST}/prospects?id=eq.${id}&select=notes`, { headers: hdr() })
  if (!r.ok) throw new Error('Lecture : HTTP ' + r.status)
  const rows = await r.json()
  let cur = {}
  try { cur = JSON.parse((rows[0] && rows[0].notes) || '{}') || {} } catch (_) {}
  const next = { ...cur }
  Object.keys(changes || {}).forEach((k) => { if (changes[k] === undefined) delete next[k]; else next[k] = changes[k] })
  const notes = JSON.stringify(next)
  const w = await fetch(`${REST}/prospects?id=eq.${id}`, { method: 'PATCH', headers: hdr({ Prefer: 'return=minimal' }), body: JSON.stringify({ ...(body || {}), notes }) })
  if (!w.ok) throw new Error('Écriture : HTTP ' + w.status)
  return notes
}
export async function mergeConfig(id, changes) {
  const r = await fetch(`${REST}/prospects?id=eq.${id}&select=notes`, { headers: hdr() })
  const rows = r.ok ? await r.json() : []
  let cur = {}
  try { cur = JSON.parse((rows[0] && rows[0].notes) || '{}') || {} } catch (_) {}
  const next = { ...cur, ...changes }
  const w = await fetch(`${REST}/prospects?id=eq.${id}`, { method: 'PATCH', headers: hdr({ Prefer: 'return=minimal' }), body: JSON.stringify({ notes: JSON.stringify(next) }) })
  if (!w.ok) throw new Error('Config : HTTP ' + w.status)
  return next
}
// Lien court (compte les clics). Sans miniature imposée : la redirection laisse WhatsApp lire l'aperçu de la page elle-même.
export async function shorten(url, campagne) {
  try {
    const r = await fetch(SERVER + '/shorten', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, campagne }) })
    const d = await r.json()
    return d.short_url || url
  } catch (_) { return url }
}

// Lectures du Dashboard : liens courts (clics), événements du tunnel, transactions.
async function lirePages(chemin) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const r = await fetch(REST + chemin, { headers: hdr({ Range: `${from}-${from + 999}`, 'Range-Unit': 'items' }) })
    if (!r.ok && r.status !== 206) throw new Error('HTTP ' + r.status)
    const part = await r.json()
    if (!Array.isArray(part)) throw new Error((part && part.message) || 'réponse inattendue')
    rows.push(...part)
    if (part.length < 1000) break
  }
  return rows
}
const depuis = (iso) => (iso ? '&created_at=gte.' + encodeURIComponent(iso) : '')
export const fetchLiensCourts = (iso) => lirePages('/short_links?campagne=not.is.null&select=campagne,clicks,created_at' + depuis(iso) + '&order=created_at.asc')
export const fetchFunnel = (iso) => lirePages('/funnel_events?select=type,campagne,source,prospect_id,created_at' + depuis(iso) + '&order=created_at.asc')
export const fetchTransactions = () => lirePages('/transactions?select=user_id,plan,created_at&order=created_at.asc')
export const fetchTransactionsCompletes = () => lirePages('/transactions?select=*&order=created_at.desc')
// Taux XOF → USD (repli 1 $ ≈ 600 FCFA si la source ne répond pas).
export async function tauxUsd() {
  try { const r = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/xof.json'); const d = await r.json(); return (d && d.xof && d.xof.usd) || 1 / 600 } catch (_) { return 1 / 600 }
}
