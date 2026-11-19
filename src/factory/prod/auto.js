// auto-prod-v1 (19 nov. 2026) — FACTORY PILOTÉ PAR L'OUVRIER DU CLOUD.
// L'ouvrier ouvre /factory/production?cmd=<commande>&auto=1&jeton=<jeton> avec une session administrateur. Ce module ouvre la commande,
// lance (ou reprend) exactement la même production que le bouton, attend la fin (vidéos comprises), fait le dossier complet et prévient
// le serveur. RIEN n'est envoyé au client : tout reste dans la carte de la commande. Les fenêtres de confirmation se valident seules
// (voir ui.jsx) et leurs messages sont gardés dans window.__AUTO.messages pour le rapport.
import { prodv2State as S, SERVER } from './state'
import * as E from './engine'

const tok = () => { try { return (JSON.parse(localStorage.getItem('factory_admin_sb_session') || 'null') || {}).access_token || '' } catch (_) { return '' } }
const estVideo = (c) => !!c && (c.kind === 'video' || c.ctIdx === 'video')

export function resume() {
  const cr = (S.creatives || []).filter(Boolean)
  const imgs = cr.filter((c) => !estVideo(c)), vids = cr.filter(estVideo)
  const nbAngles = (S.angles || []).length || (S.ui && S.ui.nbAngles) || 0
  const r = { images: imgs.filter((c) => c.status === 'done' && (c.url || c.imgB64)).length, images_attendues: imgs.length,
    videos: vids.filter((c) => c.videoUrl).length, videos_attendues: vids.length,
    copies: (S.copies || []).filter(Boolean).length, copies_attendues: nbAngles }
  r.contenu = r.images + r.videos + r.copies > 0
  r.complet = cr.length > 0 && r.images === r.images_attendues && r.videos === r.videos_attendues && r.copies >= r.copies_attendues && r.copies_attendues > 0
  return r
}
export async function rapporter(payload) {
  try {
    const a = window.__AUTO || {}
    await fetch(SERVER + '/auto/etat', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok() ? { Authorization: 'Bearer ' + tok() } : {}) },
      body: JSON.stringify({ commande_id: payload.commande_id || S.commandeId, jeton: a.jeton || undefined, ...payload }), signal: AbortSignal.timeout(30000) })
  } catch (e) { console.warn('[Auto] rapport non transmis :', e.message) }
}

let enCours = false
export async function demarrer(id, jeton) {
  if (enCours || !id) return
  enCours = true
  window.__AUTO = { commande: id, jeton, etat: 'ouverture', messages: [], debut: Date.now() }
  const maj = (o) => Object.assign(window.__AUTO, o)
  const battement = setInterval(() => { const U = S.ui || {}; rapporter({ commande_id: id, etape: String(U.launchLabel || window.__AUTO.etat).slice(0, 80) }) }, 5 * 60000)
  try {
    if (!(await E.openCommande(id))) throw new Error('commande impossible à ouvrir' + (window.__AUTO.messages.length ? ' : ' + window.__AUTO.messages.slice(-1)[0] : ''))
    await rapporter({ commande_id: id, etape: 'Commande ouverte par l\'ouvrier' })
    const r0 = resume()
    if (!r0.complet) { maj({ etat: 'production' }); if (r0.contenu) await E.reprendre(); else await E.launch() }
    const r = resume()
    if (!r.contenu) throw new Error('la production n\'a rien produit' + (window.__AUTO.messages.length ? ' : ' + window.__AUTO.messages.slice(-1)[0] : ''))
    maj({ etat: 'dossier' })
    const d = await E.attendreDossier()
    await rapporter({ commande_id: id, etat: r.complet ? 'prete' : 'incomplete', resume: r, dossier_url: d && d.url, dossier_fichiers: d && d.fichiers, dossier_mo: d && d.mo })
    maj({ etat: r.complet ? 'prete' : 'incomplete', resume: r, fini: true })
  } catch (e) {
    await rapporter({ commande_id: id, etat: 'echec', erreur: String(e.message || e).slice(0, 280) })
    maj({ etat: 'echec', erreur: String(e.message || e), fini: true })
  } finally { clearInterval(battement) }
}
