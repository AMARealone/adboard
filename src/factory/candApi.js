// candidats-ct-v1 (19 nov. 2026) — file « À valider » : créatives trouvées pendant le balayage du marché.
import { SERVER } from './api'
import { ctCompress, ctNameAI, ctPut } from './ctApi'
import { vctPutMeta, vctAnalyser } from './vctApi'

const jeton = () => { try { return (JSON.parse(localStorage.getItem('factory_admin_sb_session') || 'null') || {}).access_token || '' } catch (_) { return '' } }
const H = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + jeton() })

export async function candListe(type) {
  const r = await fetch(SERVER + '/ct-candidats?statut=a_valider&type=' + type, { headers: H() })
  const j = await r.json().catch(() => ({}))
  if (r.status === 404) throw new Error('le serveur n\'est pas à jour')
  if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status)
  return j
}
async function decider(id, decision, ct_id) {
  const r = await fetch(SERVER + '/ct-candidats/decision', { method: 'POST', headers: H(), body: JSON.stringify({ id, decision, ct_id }) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status)
}
export const candRefuser = (c) => decider(c.id, 'refuse')

const titre = (c) => (c.plateforme === 'tiktok' ? 'TikTok' : 'Pub Meta') + (c.auteur ? ' · ' + c.auteur : '')

// Image acceptée : copiée dans la galerie CT image, nommée et balisée par l'IA comme un import normal.
export async function candAccepterImage(c, onStatus = () => {}) {
  if (!c.media_url) throw new Error('fichier non récupéré : ouvrez la source et importez-la à la main')
  onStatus('Lecture de l\'image…')
  const blob = await (await fetch(c.media_url)).blob()
  const img = await ctCompress(blob)
  onStatus('Analyse par l\'IA…')
  let ai = { name: titre(c).slice(0, 60), meta: '', awareness: [], styleTags: [], niche: '' }
  try { ai = await ctNameAI(img.b64, img.mime) } catch (e) { console.warn('[candidats] nommage IA indisponible', e.message) }
  const id = 'ct_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
  await ctPut({ id, ...ai, b64: img.b64, mime: img.mime, addedAt: Date.now() })
  await decider(c.id, 'accepte', id)
  return id
}
// Vidéo acceptée : devient un CT vidéo (la vidéo reste à sa place sur Cloudflare) et son analyse complète démarre.
export async function candAccepterVideo(c) {
  if (!c.media_url) throw new Error('fichier non récupéré : ouvrez la source et importez-la à la main')
  const rec = { id: 'vct_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), name: titre(c).slice(0, 80), addedAt: Date.now(), meta: '', awareness: [], styleTags: [], niche: '',
    source: c.lien || c.plateforme, taille: 0, videoUrl: c.media_url, videoKey: c.media_key || '', posterUrl: c.poster_url || '', posterKey: c.poster_key || '' }
  await vctPutMeta(rec)
  await decider(c.id, 'accepte', rec.id)
  try { await vctAnalyser(rec) } catch (e) { console.warn('[candidats] analyse non lancée', e.message) }
  return rec
}
