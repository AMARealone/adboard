// Accès données Factory (mêmes sources que l'ancien Factory : serveur Render + Supabase)
export const SERVER = 'https://adstack-server.onrender.com'
export const SB = 'https://mifljhsusidgzelnswma.supabase.co'
export const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZmxqaHN1c2lkZ3plbG5zd21hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MjI2MzQsImV4cCI6MjA5MzQ5ODYzNH0.AX4Xu0sP2tgjLhZSbCKhtw4Q3sd7GRMJ2aMKK3GfzUc'
export const ADMIN_EMAIL = 'thefirstquality01@gmail.com'
const BUCKET = 'ct-gallery'
const H = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' }
const pub = (path) => `${SB}/storage/v1/object/public/${BUCKET}/${path}`

export async function ping() {
  const t = Date.now()
  try { const r = await fetch(SERVER + '/health'); return { ok: r.ok, ms: Date.now() - t } } catch (e) { return { ok: false, ms: 0 } }
}

export async function getCommandes() {
  const r = await fetch(SERVER + '/commandes', { headers: { 'ngrok-skip-browser-warning': '1' } })
  if (!r.ok) throw new Error('Commandes : HTTP ' + r.status)
  const l = await r.json()
  return Array.isArray(l) ? l : []
}

// « Prêt à envoyer » = tout est généré (même règle que l'ancien Factory)
export function pretAEnvoyer(b) {
  if (b.status !== 'in_production') return false
  const d = b.deliverables || {}
  const nb = b.quantity || 9
  const crea = (d.creatives || []).filter((c) => c && (c.imgB64 || c.url)).length
  const copies = (d.copies || []).filter(Boolean).length
  return crea >= nb && copies >= Math.ceil(nb / 3)
}
export function etat(b) {
  if (pretAEnvoyer(b)) return { key: 'ready', label: 'Prêt à envoyer', rang: 0 }
  if (b.status === 'in_production') return { key: 'prod', label: 'En cours', rang: 1 }
  if (b.status === 'pending') return { key: 'wait', label: 'En attente', rang: 2 }
  if (b.status === 'done') return { key: 'done', label: 'Livré', rang: 3 }
  return { key: 'off', label: 'Annulé', rang: 4 }
}

async function list(prefix) {
  const r = await fetch(`${SB}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ prefix, limit: 2000, sortBy: { column: 'name', order: 'desc' } }),
  })
  if (!r.ok) throw new Error('Liste galerie : HTTP ' + r.status)
  return r.json()
}

export async function getCtImages() {
  const files = await list('')
  const by = {}
  files.forEach((f) => {
    const m = f.name.match(/^(ct_\d+_[a-z0-9]+)\.(jpg|jpeg|png|webp|json)$/i)
    if (!m) return
    const e = (by[m[1]] = by[m[1]] || {})
    if (m[2].toLowerCase() === 'json') e.json = f.name
    else e.img = f.name
  })
  const recs = await Promise.all(Object.entries(by).filter(([, e]) => e.img).map(async ([id, e]) => {
    let meta = {}
    if (e.json) { try { const r = await fetch(pub(e.json) + '?t=' + Date.now()); if (r.ok) meta = await r.json() } catch (_) {} }
    return { id, name: meta.name || id, addedAt: meta.addedAt || 0, meta: meta.meta || '', awareness: meta.awareness || [], styleTags: meta.styleTags || [], niche: meta.niche || '', url: pub(e.img) }
  }))
  return recs.sort((a, b) => b.addedAt - a.addedAt)
}

const EXTRA = ['duree_s', 'blocs', 'niches', 'produit_compatible', 'angles_fit', 'hook', 'chute', 'lieux_interdits', 'epic', 'awareness2']
export async function getCtVideos() {
  const files = await list('video')
  const ids = files.map((f) => (f.name.match(/^(vct_\d+_[a-z0-9]+)\.json$/i) || [])[1]).filter(Boolean)
  const recs = await Promise.all(ids.map(async (id) => {
    try {
      const r = await fetch(pub('video/' + id + '.json') + '?t=' + Date.now())
      if (!r.ok) return null
      const m = await r.json()
      const x = { id, name: m.name || id, addedAt: m.addedAt || 0, meta: m.meta || '', awareness: m.awareness || [], styleTags: m.styleTags || [], niche: m.niche || '' }
      EXTRA.forEach((k) => { if (m[k] !== undefined && m[k] !== null && m[k] !== '') x[k] = m[k] })
      return x
    } catch (_) { return null }
  }))
  return recs.filter(Boolean).sort((a, b) => b.addedAt - a.addedAt)
}

// Offres : SCALE passe en file prioritaire ; PERF+ a 48 h de délai de production, les autres 24 h.
export const estPrioritaire = (b) => (b.client?.plan || '') === 'scale'
export const prio = (b) => (estPrioritaire(b) ? 0 : 1)
export const delaiClientH = (b) => (['starter', 'test'].includes(b.client?.plan || '') ? 48 : 24)
