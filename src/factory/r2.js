// Cloudflare R2 (bucket adstack-images) : envoi direct des vidéos depuis le navigateur.
// Le serveur ne signe qu'une adresse d'envoi temporaire (/r2/presign) ; les clés R2 restent sur Render.
import { SERVER } from './api'

export async function r2Presign(key, contentType, method = 'PUT') {
  const r = await fetch(SERVER + '/r2/presign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, contentType, method }) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j.error) throw new Error(j.error || 'Serveur : HTTP ' + r.status + (r.status === 404 ? ' (le module Cloudflare n\'est pas encore installé sur le serveur)' : ''))
  return j // { url, publicUrl }
}

// Envoie un fichier (Blob/File) vers R2 avec suivi de progression. Retourne l'adresse publique.
export async function r2Put(blob, key, onProgress) {
  const type = blob.type || 'application/octet-stream'
  const { url, publicUrl } = await r2Presign(key, type, 'PUT')
  await new Promise((resolve, reject) => {
    const x = new XMLHttpRequest()
    x.open('PUT', url)
    x.setRequestHeader('Content-Type', type)
    x.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total) }
    x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : reject(new Error('Cloudflare a refusé l\'envoi (HTTP ' + x.status + ')')))
    x.onerror = () => reject(new Error('Envoi vers Cloudflare bloqué : la règle CORS du bucket adstack-images est-elle enregistrée ?'))
    x.send(blob)
  })
  return publicUrl
}

export async function r2Delete(key) {
  try { const { url } = await r2Presign(key, '', 'DELETE'); await fetch(url, { method: 'DELETE' }) } catch (_) { /* nettoyage au mieux */ }
}

// Lit la durée et capture une image de la vidéo (par défaut au tiers) depuis un fichier local.
export function videoInfos(file, tPct = 0.33) {
  return new Promise((resolve) => {
    const u = URL.createObjectURL(file), v = document.createElement('video')
    v.muted = true; v.playsInline = true; v.preload = 'metadata'; v.src = u
    const fin = (o) => { URL.revokeObjectURL(u); resolve(o) }
    v.onerror = () => fin({ duree: 0, poster: null })
    v.onloadedmetadata = () => { const d = v.duration || 0; v.currentTime = Math.max(0.1, d * tPct) }
    v.onseeked = async () => { let poster = null; try { poster = await captureFrame(v) } catch (_) {} fin({ duree: Math.round(v.duration || 0), poster }) }
  })
}
// Capture l'image affichée par un <video> déjà chargé (lecteur de la galerie).
export function captureFrame(videoEl) {
  const h = 640, w = Math.round((videoEl.videoWidth / videoEl.videoHeight) * h) || 360
  const c = document.createElement('canvas'); c.width = w; c.height = h
  c.getContext('2d').drawImage(videoEl, 0, 0, w, h) // lève une erreur si la vidéo n'autorise pas la lecture de ses pixels (CORS)
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('capture vide'))), 'image/jpeg', 0.85))
}
