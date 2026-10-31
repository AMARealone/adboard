// Lecture des notes (JSON dans prospects.notes) avec cache : les fiches ne sont parsées qu'une fois.
const cache = new Map()
export function N(p) {
  if (!p || typeof p.notes !== 'string' || !p.notes) return {}
  const c = cache.get(p.id)
  if (c && c.s === p.notes) return c.o
  let o = {}
  try { o = JSON.parse(p.notes) || {} } catch (_) {}
  cache.set(p.id, { s: p.notes, o })
  return o
}
export const jours = (iso, now = Date.now()) => { const t = Date.parse(iso || ''); return isNaN(t) ? null : Math.max(0, Math.floor((now - t) / 86400000)) }
export const quand = (iso) => { const t = Date.parse(iso || ''); return isNaN(t) ? '' : new Date(t).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) }
export const duree = (ms) => { if (ms < 0) ms = 0; const m = Math.floor(ms / 60000); if (m < 60) return Math.max(m, 1) + ' min'; const h = Math.floor(m / 60); if (h < 24) return h + 'h' + (m % 60 ? String(m % 60).padStart(2, '0') : ''); const j = Math.floor(h / 24); return j + 'j' + (h % 24 ? ' ' + (h % 24) + 'h' : '') }
