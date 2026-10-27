// Galerie CT image : stockage Supabase (bucket ct-gallery) — repris de l'ancien Factory.
import { SB, SB_KEY, SERVER } from './api'
import { CT_IMAGES } from './prod/state'
export const BUCKET = 'ct-gallery'
const H = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' }
const pub = (n) => `${SB}/storage/v1/object/public/${BUCKET}/${n}`

export async function ctGetAll() {
  const resp = await fetch(`${SB}/storage/v1/object/list/${BUCKET}`, { method: 'POST', headers: H, body: JSON.stringify({ prefix: '', limit: 2000, sortBy: { column: 'name', order: 'desc' } }) })
  if (!resp.ok) throw new Error('Liste Supabase Storage échouée : HTTP ' + resp.status + ' — ' + (await resp.text().catch(() => '')).slice(0, 200))
  const files = await resp.json()
  const by = {}
  files.forEach((f) => {
    const m = f.name.match(/^(ct_\d+_[a-z0-9]+)\.(jpg|jpeg|png|webp|json)$/i)
    if (!m) return
    const e = (by[m[1]] = by[m[1]] || {}); const ext = m[2].toLowerCase()
    if (ext === 'json') e.jsonName = f.name; else { e.imgName = f.name; e.mime = 'image/' + (ext === 'jpg' ? 'jpeg' : ext) }
  })
  const recs = []
  for (const id in by) {
    const e = by[id]; if (!e.imgName) continue
    let meta = { name: id, addedAt: 0 }
    if (e.jsonName) { try { const r = await fetch(pub(e.jsonName) + '?t=' + Date.now()); if (r.ok) meta = await r.json() } catch (_) {} }
    recs.push({ id, name: meta.name || id, addedAt: meta.addedAt || 0, meta: meta.meta || '', awareness: meta.awareness || [], styleTags: meta.styleTags || [], niche: meta.niche || '', mime: e.mime || 'image/jpeg', url: pub(e.imgName) })
  }
  return recs.sort((a, b) => b.addedAt - a.addedAt)
}

export async function loadCTImages() {
  try {
    const all = await ctGetAll()
    all.forEach((r) => {
      CT_IMAGES[r.id] = r.url; CT_IMAGES[r.id + '_mime'] = r.mime; CT_IMAGES[r.id + '_name'] = r.name; CT_IMAGES[r.id + '_addedAt'] = r.addedAt
      CT_IMAGES[r.id + '_meta'] = r.meta || ''; CT_IMAGES[r.id + '_awareness'] = r.awareness || []; CT_IMAGES[r.id + '_styleTags'] = r.styleTags || []; CT_IMAGES[r.id + '_niche'] = r.niche || ''
    })
    return all
  } catch (e) { console.warn('[loadCTImages] échec chargement initial :', e.message); return [] }
}

export async function ctPut(rec) {
  const ext = rec.mime && rec.mime.includes('png') ? 'png' : rec.mime && rec.mime.includes('webp') ? 'webp' : 'jpg'
  if (rec.b64) {
    const bin = atob(rec.b64); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
    const up = await fetch(`${SB}/storage/v1/object/${BUCKET}/${rec.id}.${ext}`, { method: 'POST', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': rec.mime || 'image/jpeg', 'x-upsert': 'true' }, body: new Blob([arr], { type: rec.mime || 'image/jpeg' }) })
    if (!up.ok) throw new Error('Upload image Supabase échoué : HTTP ' + up.status)
  }
  const j = await fetch(`${SB}/storage/v1/object/${BUCKET}/${rec.id}.json`, { method: 'POST', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', 'x-upsert': 'true' }, body: JSON.stringify({ name: rec.name, addedAt: rec.addedAt || Date.now(), meta: rec.meta || '', awareness: rec.awareness || [], styleTags: rec.styleTags || [], niche: rec.niche || '' }) })
  if (!j.ok) throw new Error('Upload métadonnées Supabase échoué : HTTP ' + j.status)
  return rec
}
export async function ctDel(id) {
  await fetch(`${SB}/storage/v1/object/${BUCKET}`, { method: 'DELETE', headers: H, body: JSON.stringify({ prefixes: ['jpg', 'jpeg', 'png', 'webp', 'json'].map((e) => id + '.' + e) }) })
}
export async function ctGetBase64(id) {
  const url = CT_IMAGES[id]
  const blob = await (await fetch(url)).blob()
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob) })
}
export function ctCompress(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        const s = Math.min(1, 1200 / Math.max(img.width, img.height)); const w = Math.round(img.width * s), h = Math.round(img.height * s)
        const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve({ b64: c.toDataURL('image/jpeg', 0.85).split(',')[1], mime: 'image/jpeg' })
      }
      img.onerror = () => reject(new Error('Image illisible')); img.src = ev.target.result
    }
    reader.onerror = () => reject(reader.error); reader.readAsDataURL(file)
  })
}
export const NAMING_PROMPT = `Analyse ce Creative Template Meta Ads avec precision maximale.
Genere UN nom unique (65 caracteres max) decrivant specifiquement cette image.
Couvre : structure visuelle + style/ambiance + elements cles + traitement graphique.
Format : "[Structure] - [Ambiance] [Elements cles] [Traitement]"
Exemples PRECIS :
- "2-produits plein-cadre - fond noir dramatique, thermique rouge/bleu, USP bandeau haut"
- "Split vertical 50/50 - avant sans VS apres avec, fond blanc, transformation corps"
- "Selfie UGC fond flou - femme 30s + produit main, texte overlay blanc gras"
- "Hero produit isole - degrade violet, badge prix bas-gauche, CTA rouge"
- "Podcast 2-col - homme micro gauche + femme droite, sous-titres bas"
- "Comparatif tableau - 3 colonnes X-vs-Y, coches vertes, fond gris clair"
- "Testimonial portrait - photo ronde, 5 etoiles jaunes, citation italic"
Reponds UNIQUEMENT avec le nom, sans guillemets ni explication.`
// Nommage IA d'un CT : renvoie { name, meta, awareness, styleTags, niche }
export async function ctNameAI(b64, mime) {
  const resp = await fetch(SERVER + '/name-ct', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ b64, mime, prompt: NAMING_PROMPT }) })
  if (!resp.ok) throw new Error('HTTP ' + resp.status)
  const d = await resp.json()
  const name = (d.name || '').replace(/^["']|["']$/g, '').substring(0, 60)
  if (!name) throw new Error('Nom vide reçu du serveur')
  return { name, meta: (d.meta || '').replace(/^["']|["']$/g, '').substring(0, 500), awareness: d.awareness || [], styleTags: d.styleTags || [], niche: d.niche || '' }
}
