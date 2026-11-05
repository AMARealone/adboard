// Accès données du CRM (Supabase REST). Même base que l'ancien CRM ; la session admin (partagée avec Factory)
// est utilisée dès qu'elle existe : quand les règles de sécurité seront resserrées, seule cette session aura accès.
import { toast } from './ui'
export const SB = 'https://mifljhsusidgzelnswma.supabase.co'
export const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZmxqaHN1c2lkZ3plbG5zd21hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MjI2MzQsImV4cCI6MjA5MzQ5ODYzNH0.AX4Xu0sP2tgjLhZSbCKhtw4Q3sd7GRMJ2aMKK3GfzUc'
export const ADMIN_EMAIL = 'thefirstquality01@gmail.com'
export const SERVER = 'https://adstack-server.onrender.com'
const KS = 'factory_admin_sb_session'
export function accessToken() { try { const s = JSON.parse(localStorage.getItem(KS) || 'null'); return (s && s.access_token) || SB_KEY } catch (_) { return SB_KEY } }
const hdr = (x) => ({ apikey: SB_KEY, Authorization: 'Bearer ' + accessToken(), 'Content-Type': 'application/json', ...(x || {}) })
const REST = SB + '/rest/v1'

// Session toujours fraîche : le jeton Supabase dure ~1 h. Avant chaque requête on le renouvelle s'il expire bientôt,
// et sur une réponse 401 on le renouvelle une fois puis on réessaie (sinon « Lecture : HTTP 401 » après une heure d'ouverture).
const lireSession = () => { try { return JSON.parse(localStorage.getItem(KS) || 'null') } catch (_) { return null } }
let renouvellement = null
async function renouveler(force) {
  const s = lireSession(); if (!s || !s.refresh_token) return
  if (!force && s.expires_at && Date.now() < s.expires_at - 60000) return
  if (!renouvellement) {
    renouvellement = (async () => {
      try {
        const r = await fetch(SB + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_KEY }, body: JSON.stringify({ refresh_token: s.refresh_token }) })
        const d = await r.json()
        if (r.ok && d.access_token) localStorage.setItem(KS, JSON.stringify({ access_token: d.access_token, refresh_token: d.refresh_token || s.refresh_token, expires_at: Date.now() + (d.expires_in || 3600) * 1000 }))
      } catch (_) {} finally { renouvellement = null }
    })()
  }
  await renouvellement
}
export async function sfetch(url, opts = {}) {
  await renouveler(false)
  const avec = () => ({ ...opts, headers: { ...(opts.headers || {}), Authorization: 'Bearer ' + accessToken() } })
  let r = await fetch(url, avec())
  if (r.status === 401) { await renouveler(true); r = await fetch(url, avec()) }
  return r
}

// Lecture paginée (1000 par page) : ne dépend plus d'un plafond serveur silencieux.
export async function fetchProspects(onProgress) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const r = await sfetch(`${REST}/prospects?select=*&nom_marque=neq.__config__&order=created_at.asc,id.asc`, { headers: hdr({ Range: `${from}-${from + 999}`, 'Range-Unit': 'items' }) })
    if (!r.ok && r.status !== 206) throw new Error('Prospects : HTTP ' + r.status)
    const part = await r.json()
    rows.push(...part)
    if (onProgress) onProgress(rows.length)
    if (part.length < 1000) break
  }
  return rows
}
export async function fetchConfig() {
  const r = await sfetch(`${REST}/prospects?nom_marque=eq.__config__&select=id,notes`, { headers: hdr() })
  if (!r.ok) throw new Error('Config : HTTP ' + r.status)
  const rows = await r.json()
  let cfg = {}
  try { cfg = JSON.parse((rows[0] && rows[0].notes) || '{}') || {} } catch (_) {}
  return { id: rows[0] ? rows[0].id : null, cfg }
}
// Écriture « sans écrasement » : on relit la fiche, on fusionne seulement les clés modifiées, puis on écrit.
export async function mergeNotes(id, changes, body) {
  const r = await sfetch(`${REST}/prospects?id=eq.${id}&select=notes`, { headers: hdr() })
  if (!r.ok) throw new Error('Lecture : HTTP ' + r.status)
  const rows = await r.json()
  let cur = {}
  try { cur = JSON.parse((rows[0] && rows[0].notes) || '{}') || {} } catch (_) {}
  const next = { ...cur }
  Object.keys(changes || {}).forEach((k) => { if (changes[k] === undefined) delete next[k]; else next[k] = changes[k] })
  const notes = JSON.stringify(next)
  const w = await sfetch(`${REST}/prospects?id=eq.${id}`, { method: 'PATCH', headers: hdr({ Prefer: 'return=minimal' }), body: JSON.stringify({ ...(body || {}), notes }) })
  if (!w.ok) throw new Error('Écriture : HTTP ' + w.status)
  return notes
}
export async function mergeConfig(id, changes) {
  const r = await sfetch(`${REST}/prospects?id=eq.${id}&select=notes`, { headers: hdr() })
  const rows = r.ok ? await r.json() : []
  let cur = {}
  try { cur = JSON.parse((rows[0] && rows[0].notes) || '{}') || {} } catch (_) {}
  const next = { ...cur, ...changes }
  const w = await sfetch(`${REST}/prospects?id=eq.${id}`, { method: 'PATCH', headers: hdr({ Prefer: 'return=minimal' }), body: JSON.stringify({ notes: JSON.stringify(next) }) })
  if (!w.ok) throw new Error('Config : HTTP ' + w.status)
  return next
}
// Lien court (compte les clics). Sans miniature imposée : la redirection laisse WhatsApp lire l'aperçu de la page elle-même.
export async function shorten(url, campagne) {
  try {
    const r = await fetch(SERVER + '/shorten', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, campagne }) })
    const d = await r.json()
    if (d.short_url) return d.short_url
    throw new Error(d.error || 'pas de lien court')
  } catch (_) {
    // Lien court indisponible (serveur endormi, base Supabase saturée…) : on envoie le lien direct AVEC « www. »
    // (sans www, la redirection fait perdre la miniature sur WhatsApp) et on prévient : ce clic ne sera pas compté.
    try { toast('⚠ Lien court indisponible : le message part avec le lien direct (clic non compté). Vérifie le serveur / Supabase.', 9000) } catch (e) {}
    return url.replace(/^https:\/\/adstackofficial\.com/i, 'https://www.adstackofficial.com')
  }
}

// Lectures du Dashboard : liens courts (clics), événements du tunnel, transactions.
async function lirePages(chemin) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const r = await sfetch(REST + chemin, { headers: hdr({ Range: `${from}-${from + 999}`, 'Range-Unit': 'items' }) })
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
export const fetchCoutsApi = () => lirePages('/api_usage_log?select=source,cout_usd,type_appel,created_at&order=created_at.desc')
export const fetchEmailsEnvoyes = () => lirePages('/email_sequence_log?select=user_id,email_key,sent_at&order=sent_at.desc')
export const fetchEmailEvents = () => lirePages('/email_events?select=email_key,event_type')
export const fetchFunnelCampagnes = () => lirePages('/funnel_events?select=type,campagne&campagne=not.is.null')

export const fetchClarity = () => lirePages('/clarity_snapshots?select=*&order=captured_at.desc')
export const fetchChatMessages = () => lirePages('/chat_messages?select=session_id,role,content,created_at&order=session_id.asc,created_at.asc')
export const fetchInsights = (source) => lirePages('/data_insights?source=eq.' + source + '&select=email,question,answer,created_at&order=email.asc,created_at.asc')
// Appels réservés à l'administrateur : toujours avec la session (jamais de clé dans le navigateur)
export async function serveurAdmin(path, method = 'GET', ms = 15000) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms)
  try {
    const r = await sfetch(SERVER + path, { method, headers: { Authorization: 'Bearer ' + accessToken() }, cache: 'no-store', signal: c.signal })
    if (r.status === 401) throw new Error('Session expirée ou non autorisée — reconnectez-vous.')
    return await r.json()
  } finally { clearTimeout(t) }
}

// Suppression définitive d'un prospect (réservée à l'administrateur : règle Supabase « admin »)
export async function supprimerProspect(id) {
  const r = await sfetch(SB + '/rest/v1/prospects?id=eq.' + encodeURIComponent(id), { method: 'DELETE', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + accessToken(), Prefer: 'return=minimal' } })
  if (!r.ok) throw new Error('HTTP ' + r.status)
}
