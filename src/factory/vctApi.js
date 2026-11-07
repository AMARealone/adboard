// CT vidéo : stockage Supabase (bucket ct-gallery, dossier video/) — repris de l'ancien Factory.
import { SB, SB_KEY, SERVER } from './api'
import { BUCKET } from './ctApi'
import { r2Put, r2Delete, videoInfos } from './r2'
import { _vctExtra, _vctNomDuTexte, _vctAwDuTexte, _vctFicheDuTexte, _vctAppliquerFiche, _vctNiveau } from './prod/verbatim'
export { _vctFicheDuTexte, _vctAppliquerFiche, _vctNiveau }
const PREFIX = 'video'
const H = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' }
const base = () => `${SB}/storage/v1/object/${BUCKET}/${PREFIX}/`
const pub = (n) => `${SB}/storage/v1/object/public/${BUCKET}/${PREFIX}/${n}`

export async function vctGetAll() {
  const resp = await fetch(`${SB}/storage/v1/object/list/${BUCKET}`, { method: 'POST', headers: H, body: JSON.stringify({ prefix: PREFIX, limit: 2000, sortBy: { column: 'name', order: 'desc' } }) })
  if (!resp.ok) throw new Error('Liste CT vidéo échouée : HTTP ' + resp.status)
  const files = await resp.json()
  const ids = files.map((f) => (f.name.match(/^(vct_\d+_[a-z0-9]+)\.json$/i) || [])[1]).filter(Boolean)
  const recs = await Promise.all(ids.map(async (id) => {
    try {
      const r = await fetch(pub(id + '.json') + '?t=' + Date.now()); if (!r.ok) return null
      const m = await r.json()
      return Object.assign({ id, name: m.name || id, addedAt: m.addedAt || 0, meta: m.meta || '', awareness: m.awareness || [], styleTags: m.styleTags || [], niche: m.niche || '', source: m.source || '', taille: m.taille || 0, lot: m.lot || null }, _vctExtra(m))
    } catch (_) { return null }
  }))
  return recs.filter(Boolean).sort((a, b) => b.addedAt - a.addedAt)
}
async function upload(name, obj) {
  const r = await fetch(base() + name, { method: 'POST', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', 'x-upsert': 'true' }, body: JSON.stringify(obj) })
  if (!r.ok) throw new Error('Enregistrement CT vidéo échoué : HTTP ' + r.status)
}
export const vctPutMeta = (rec) => upload(rec.id + '.json', Object.assign({ name: rec.name, addedAt: rec.addedAt || Date.now(), meta: rec.meta || '', awareness: rec.awareness || [], styleTags: rec.styleTags || [], niche: rec.niche || '', source: rec.source || '', taille: rec.taille || 0, ...(rec.lot ? { lot: rec.lot } : {}) }, _vctExtra(rec)))
export const vctPutTexte = (id, texte) => upload(id + '.texte.json', { texte })
export async function vctGetTexte(id) {
  const r = await fetch(pub(id + '.texte.json') + '?t=' + Date.now())
  if (!r.ok) throw new Error('Texte du CT introuvable (HTTP ' + r.status + ')')
  return (await r.json()).texte || ''
}
export async function vctDel(id) {
  await fetch(`${SB}/storage/v1/object/${BUCKET}`, { method: 'DELETE', headers: H, body: JSON.stringify({ prefixes: [PREFIX + '/' + id + '.json', PREFIX + '/' + id + '.texte.json'] }) })
}
export async function vctEnrichOne(texte) {
  const r = await fetch(SERVER + '/name-ct-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texte }) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j.error) throw new Error(j.error || 'HTTP ' + r.status)
  return j
}
function applyEnrich(rec, e) {
  if (e.name) rec.name = e.name
  rec.meta = e.meta || ''
  if (e.awareness && e.awareness.length) rec.awareness = e.awareness.map((a) => _vctNiveau(a) || a)
  rec.styleTags = e.styleTags || []; rec.niche = e.niche || ''
}
export async function vctAjouter(fichier, texte, source) {
  const id = 'vct_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
  const rec = { id, name: _vctNomDuTexte(texte, fichier), addedAt: Date.now(), meta: '', awareness: _vctAwDuTexte(texte), styleTags: [], niche: '', source: source || fichier, taille: texte.length }
  const fiche = _vctFicheDuTexte(texte)
  if (fiche) _vctAppliquerFiche(rec, fiche, true)
  await vctPutTexte(id, texte); await vctPutMeta(rec)
  if (!rec.meta) {
    try { applyEnrich(rec, await vctEnrichOne(texte)); await vctPutMeta(rec) }
    catch (err) { console.warn('[CT vidéo] enrichissement impossible pour', fichier, err.message); rec._enrichKo = err.message }
  }
  return rec
}
// Complète les CT : 1) relit la fiche « métadonnées de sélection » (gratuit), 2) Gemini pour ceux sans méta-description
export async function vctEnrichAll(list, onStatus) {
  let relus = 0
  for (let i = 0; i < list.length; i++) {
    const r = list[i]
    const manque = !r.meta || !r.awareness.length || !r.duree_s || !(r.niches && r.niches.length) || !r.produit_compatible
    if (!manque) continue
    onStatus('Relecture des fiches ' + (i + 1) + '/' + list.length + '…')
    try { const f = _vctFicheDuTexte(await vctGetTexte(r.id)); if (_vctAppliquerFiche(r, f, false)) { await vctPutMeta(r); relus++ } } catch (_) {}
  }
  const cibles = list.filter((x) => !x.meta)
  let ok = 0, ko = 0
  for (let i = 0; i < cibles.length; i++) {
    onStatus('Enrichissement par Gemini ' + (i + 1) + '/' + cibles.length + '…')
    try { const rec = cibles[i]; applyEnrich(rec, await vctEnrichOne(await vctGetTexte(rec.id))); await vctPutMeta(rec); ok++ } catch (e) { ko++; console.error('[CT vidéo] enrich', e) }
  }
  return { relus, ok, ko, cibles: cibles.length }
}

// ── Vidéo source du CT (stockée sur Cloudflare R2) ──
const extDe = (f) => ((f.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4')
const idNeuf = () => 'vct_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
// Met (ou remplace) la vidéo d'un CT : envoi sur R2, durée lue dans le fichier, miniature prise au tiers de la vidéo.
export async function vctMettreVideo(rec, file, onStatus = () => {}) {
  onStatus('Lecture de la vidéo…')
  const info = await videoInfos(file)
  const ts = Date.now(), vkey = `ct-video/${rec.id}/video-${ts}.${extDe(file)}`
  onStatus('Envoi de la vidéo… 0 %')
  const videoUrl = await r2Put(file, vkey, (p) => onStatus('Envoi de la vidéo… ' + Math.round(p * 100) + ' %'))
  let posterUrl = '', posterKey = ''
  if (info.poster) { posterKey = `ct-video/${rec.id}/poster-${ts}.jpg`; posterUrl = await r2Put(info.poster, posterKey) }
  const ancien = { v: rec.videoKey, p: rec.posterKey }
  Object.assign(rec, { videoUrl, videoKey: vkey, posterUrl, posterKey, video_octets: file.size })
  if (info.duree && !rec.duree_s) rec.duree_s = info.duree
  await vctPutMeta(rec)
  if (ancien.v) r2Delete(ancien.v)
  if (ancien.p) r2Delete(ancien.p)
  return rec
}
// Nouveau CT à partir d'une vidéo seule : le nom vient du fichier, les balises se complètent ensuite.
export async function vctNouveauVideo(file, onStatus) {
  const rec = { id: idNeuf(), name: file.name.replace(/\.[^.]+$/, ''), addedAt: Date.now(), meta: '', awareness: [], styleTags: [], niche: '', source: file.name, taille: 0 }
  await vctMettreVideo(rec, file, onStatus)
  return rec
}
// Remplace la miniature (image choisie dans le lecteur : le moment le plus fort du CT).
export async function vctChangerMiniature(rec, blob) {
  const key = `ct-video/${rec.id}/poster-${Date.now()}.jpg`
  const url = await r2Put(blob, key)
  const ancien = rec.posterKey
  Object.assign(rec, { posterUrl: url, posterKey: key })
  await vctPutMeta(rec)
  if (ancien) r2Delete(ancien)
  return rec
}
export async function vctSupprimerVideo(rec) { if (rec.videoKey) await r2Delete(rec.videoKey); if (rec.posterKey) await r2Delete(rec.posterKey) }
