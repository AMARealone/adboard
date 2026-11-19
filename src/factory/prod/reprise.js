// reprise-angle-v1 — « REFAIRE DANS CE STYLE » : le client a choisi, dans AdBoard, une créative livrée qu'il veut voir refaite.
// Décision du 19 nov. 2026 : on garde LE MÊME ANGLE et LE MÊME CT (vidéo ou image), avec des textes, des scènes et des preuves nouveaux,
// pour que la nouvelle créative ne soit pas une copie. Les autres angles de la demande restent nouveaux.
// Le code applique la demande lui-même (angle placé en angle 1, CT imposé) : elle n'est pas laissée au bon vouloir d'un modèle.
import { prodv2State as S, CT_IMAGES } from './state'

const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
const titre = (a) => String(a || '').split('*')[0].replace(/^\s*angle\s*\d+\s*[:—–-]?\s*/i, '').trim()
const meme = (a, b) => {
  const x = norm(titre(a)), y = norm(titre(b)); if (!x || !y) return false
  if (x === y) return true
  const [c, l] = x.length <= y.length ? [x, y] : [y, x]
  return c.length >= 10 && l.includes(c)
}

export const active = () => (S.reprise && S.reprise.creative_id && (S.reprise.angle || S.reprise.angle_brut)) ? S.reprise : null

// Consigne pour l'analyste : l'angle est repris tel quel en ANGLE 1 ; elle passe avant la rotation des angles déjà exploités.
export function blocAnalyste() {
  const r = active(); if (!r) return ''
  return '⚠️ DEMANDE DU CLIENT — ANGLE À REPRENDRE (PRIME SUR LA ROTATION DES ANGLES DÉJÀ EXPLOITÉS) :\n'
    + 'Le client a aimé une créative de son dernier lot et demande de la refaire. Son angle est l\'ANGLE 1 de ta S2, repris tel quel : même motif d\'achat, même promesse, même nom d\'angle.\n'
    + 'Nom : ' + titre(r.angle || r.angle_brut) + '\n'
    + (r.angle_brut ? 'Fiche d\'origine : ' + String(r.angle_brut).slice(0, 1500) + '\n' : '')
    + 'Pour cet angle, renouvelle la matière (nouvelles scènes de vie, nouveaux verbatims, nouvelles preuves) pour que la nouvelle créative ne soit pas une copie. Tous tes autres angles restent NOUVEAUX et distincts, selon le processus habituel.\n\n'
}

// Après la synthèse : l'angle repris devient l'angle 1. Si l'analyste ne l'a pas écrit (hypothèse stockée réutilisée), il est remis tel quel.
export function placerAngle() {
  const r = active(); if (!r || !Array.isArray(S.angles) || !S.angles.length) return null
  const cible = r.angle_brut || r.angle
  const i = S.angles.findIndex((a) => meme(a, cible))
  if (i === 0) return { trouve: true }
  if (i > 0) { const a = S.angles.splice(i, 1)[0]; S.angles.unshift(a); return { trouve: true, deplace: i } }
  S.angles[0] = cible
  return { trouve: false }
}

// Vidéo : si la créative à refaire est une vidéo, l'angle 1 garde SON CT vidéo (même s'il a servi au dernier lot : c'est la demande).
export function forcerVideo(choix, galerieComplete) {
  const r = active(); if (!r || r.format !== 'video' || !r.ct || !Array.isArray(choix)) return choix
  const ct = (galerieComplete || []).find((c) => c.id === r.ct)
  if (!ct) return choix
  const avant = choix.find((x) => x.angleIdx === 0) || {}
  // si un autre angle avait reçu ce CT, il prend celui que l'agent avait prévu pour l'angle 1 (aucun angle ne reste sans CT)
  const autres = choix.filter((x) => x.angleIdx !== 0).map((x) => x.id === ct.id ? (avant.id ? { ...avant, angleIdx: x.angleIdx } : null) : x).filter(Boolean)
  return [{ ...avant, id: ct.id, nom: ct.name || ct.id, poster: ct.posterUrl || '', duree_s: ct.duree_s || 0, angleIdx: 0, raison: 'Demande du client : refaire sa créative (même angle, même CT), avec des textes et des scènes nouveaux.', direction: avant.direction || null }, ...autres]
}

// Image : si la créative à refaire est une image, la première image de l'angle 1 garde SON CT image.
export function forcerImage(slots) {
  const r = active(); if (!r || r.format !== 'image' || !r.ct || !CT_IMAGES[r.ct]) return null
  const i = slots.findIndex((c) => c.kind !== 'video' && c.angleIdx === 0)
  if (i < 0) return null
  slots[i] = { ...slots[i], ctForce: r.ct, ctForceRaison: 'Demande du client : refaire sa créative (même angle, même CT), avec des textes et des scènes nouveaux.' }
  return i
}

export function message() {
  const r = active(); if (!r) return null
  return 'Demande du client : refaire sa créative « ' + titre(r.angle || r.angle_brut).slice(0, 70) + ' » (' + (r.format === 'video' ? 'vidéo' : 'image') + ') — même angle et même CT en angle 1, textes et scènes nouveaux.'
}
