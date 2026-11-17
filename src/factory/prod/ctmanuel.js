// Choix manuel du CT vidéo + lecture à blanc d'un CT — ct-fidelite-v1.
// 1. Choix à la main : « Automatique » (l'agent choisit) ou un CT précis par angle, avant le lancement, ou depuis la carte vidéo.
//    Le choix manuel ne sert qu'une fois : après le lancement tout revient en automatique (jamais de CT oublié d'une production à l'autre).
// 2. Lecture à blanc : la machine vidéo lit le CT (forme, voix, image, fin, intention de chaque battement), publie ce qu'elle a compris
//    et s'arrête. Aucun clip Veo, aucune voix ElevenLabs, aucune image n'est payée : le fondateur valide AVANT de dépenser.
//    Sécurité : l'identifiant envoyé est « <id>--lecture ». Un ancien moteur (avant v9.8) ne trouve pas ce CT et s'arrête sans dépenser.
import { prodv2State as S, SERVER, emit } from './state'
import { vctGetAll } from '../vctApi'
import { toast } from '../ui'
import * as PL from './plan'

const JH = { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' }
const U = S.ui
export const SLOT_LECTURE = 90          // fichier d'état à part (…_s90.json) : jamais en collision avec les vidéos du lot (slots 1 à N)
const PAS_MS = 8000, DELAI_MS = 25 * 60 * 1000

// ── liste des CT disponibles (ceux dont la vidéo source est dans la galerie) ──
let _liste = null
export function chargerListe(force = false) {
  if (!_liste || force) {
    _liste = vctGetAll()
      .then((l) => (l || []).filter((c) => c && c.id && c.videoUrl)
        .map((c) => ({ id: c.id, nom: String(c.name || c.id), duree_s: Number(c.duree_s) || 0, poster: c.posterUrl || '' }))
        .sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { numeric: true, sensitivity: 'base' })))
      .catch((e) => { console.warn('[CT manuel] galerie illisible :', e && e.message); _liste = null; return [] })
  }
  return _liste
}

// ── choix à la main, angle par angle (mémoire de la page, par commande) ──
let _choix = { commandeId: null, map: {} }
const cmd = () => String(S.commandeId || '')
export function choix() { if (_choix.commandeId !== cmd()) _choix = { commandeId: cmd(), map: {} }; return _choix.map }
export const choisi = (angleIdx) => choix()[String(angleIdx)] || ''
export const nbChoisis = () => Object.keys(choix()).length
export function poser(angleIdx, ctId) { const m = choix(); if (ctId) m[String(angleIdx)] = ctId; else delete m[String(angleIdx)]; emit() }
export function effacer() { _choix = { commandeId: cmd(), map: {} }; emit() }

// Appliqué par planifier() : remplace le CT de l'angle par celui que le fondateur a choisi (la direction de diversité du lot est gardée).
// `liste` = la liste normalisée de chargerListe() ({ id, nom, duree_s, poster }).
export function appliquer(sortie, liste, nbAngles) {
  const m = choix(), cles = Object.keys(m)
  if (!cles.length) return sortie
  const parId = new Map((liste || []).map((c) => [c.id, c]))
  const res = (sortie || []).map((x) => ({ ...x }))
  cles.forEach((k) => {
    const a = Number(k), g = parId.get(m[k])
    if (!g || !(a >= 0 && a < nbAngles)) return
    const i = res.findIndex((x) => x.angleIdx === a)
    const e = { id: g.id, nom: g.nom || g.id, poster: g.poster || '', duree_s: g.duree_s || 0, angleIdx: a, raison: 'CT choisi à la main.', direction: i >= 0 ? (res[i].direction || null) : null }
    if (i >= 0) res[i] = e; else res.push(e)
  })
  effacer()
  return res
}

// ── choix posé sur une carte vidéo : sert au prochain « Lancer » / « Refaire » de CETTE carte, puis s'efface ──
let _carte = {}
const cleCarte = (idx) => cmd() + '|' + idx
export const carte = (idx) => _carte[cleCarte(idx)] || ''
export function poserCarte(idx, ctId) { if (ctId) _carte[cleCarte(idx)] = ctId; else delete _carte[cleCarte(idx)]; emit() }
export function consommerCarte(idx) { const v = carte(idx); delete _carte[cleCarte(idx)]; return v }

// ── lecture à blanc ──
const ACTIF = (L) => L && (L.etat === 'demarrage' || L.etat === 'en_cours')
export function fermer() { if (U.lecture) { U.lecture.ouvert = false; emit() } }
function fin(L, etat, erreur, lignes) {
  if (U.lecture !== L) return
  L.etat = etat; L.pct = etat === 'termine' ? 100 : L.pct
  if (lignes) L.lignes = lignes.map((x) => String(x))
  if (erreur) {
    L.erreur = String(erreur).slice(0, 400)
    if (/--lecture/.test(L.erreur) || /CT introuvable/i.test(L.erreur)) L.erreur += '\n\nLe moteur vidéo installé ne connaît probablement pas encore la lecture à blanc (version antérieure à v9.8). Rien n\'a été dépensé : installe le moteur v9.8 dans Cloud Shell, puis relance la lecture.'
  }
  emit()
}
async function suivre(L) {
  let erreurs = 0
  while (U.lecture === L && ACTIF(L)) {
    if (Date.now() - L.debut > DELAI_MS) return fin(L, 'echec', 'Délai dépassé (25 min) : la lecture s\'est arrêtée.')
    let e = null
    try {
      const q = new URLSearchParams({ commande_id: L.commandeId, slot: String(SLOT_LECTURE), execution: L.execution || '' })
      const r = await fetch(SERVER + '/video-jobs/status?' + q, { headers: { 'ngrok-skip-browser-warning': '1' } })
      if (r.ok) { e = await r.json(); erreurs = 0 } else erreurs++
    } catch (_) { erreurs++ }
    if (U.lecture !== L) return
    if (e) {
      L.etat = e.etat === 'demarrage' ? 'demarrage' : 'en_cours'
      L.etape = e.etape || L.etape; L.pct = e.pct || L.pct; if (e.cout_usd != null && e.cout_usd !== '') L.cout = e.cout_usd
      if (e.etat === 'termine') {
        if (e.lecture_seule && Array.isArray(e.lecture)) return fin(L, 'termine', '', e.lecture)
        return fin(L, 'echec', 'La machine a rendu une vidéo au lieu de la lecture seule : le moteur installé est antérieur à la v9.8. Vérifie le coût de ce run, puis installe le moteur v9.8 (Cloud Shell).')
      }
      if (e.etat === 'echec') return fin(L, 'echec', e.erreur || 'Échec de la lecture.')
      emit()
    } else if (erreurs > 20) return fin(L, 'echec', 'Suivi impossible (serveur injoignable).')
    await new Promise((ok) => setTimeout(ok, PAS_MS))
  }
}
// idx = la carte vidéo d'où part la lecture (donne l'angle et le niveau de conscience, pour que la fiche du CT soit réutilisée telle quelle par la production payante)
export async function lire(ctId, idx) {
  if (!ctId) { toast('Choisis d\'abord un CT dans la liste de la carte.'); return }
  if (S.briefSource !== 'commande' || !S.commandeId) { toast('La lecture d\'un CT demande une commande AdBoard (la machine lit la synthèse et la photo produit de la commande).'); return }
  if (!S.synthesis) { toast('Attends la fin de l\'analyse de marché : la lecture s\'appuie sur la synthèse.'); return }
  if (String(ctId).length > 48) { toast('Identifiant de CT trop long pour la lecture à blanc.'); return }
  const cur = U.lecture
  if (cur && cur.commandeId === S.commandeId) {
    if (ACTIF(cur)) { cur.ouvert = true; emit(); toast('Une lecture est déjà en cours.'); return }
    if (cur.etat === 'termine' && cur.ctId === ctId) { cur.ouvert = true; emit(); return }   // déjà lue : on la ré-affiche, rien à repayer
  }
  const c = S.creatives[idx] || {}
  const g = (await chargerListe()).find((x) => x.id === ctId)
  const L = U.lecture = { commandeId: S.commandeId, ctId, nom: g ? g.nom : ctId, etat: 'demarrage', etape: 'La machine démarre', pct: 1, lignes: null, erreur: '', cout: null, ouvert: true, execution: '', debut: Date.now() }
  emit()
  try {
    const r = await fetch(SERVER + '/video-jobs/start', { method: 'POST', headers: JH, body: JSON.stringify({ commande_id: S.commandeId, ct_id: ctId + '--lecture', angle: String((c.angleIdx || 0) + 1), slot: SLOT_LECTURE, niveau: PL.LIB[c.niveau] || '', forcer: true }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || j.error) throw new Error(j.error || 'HTTP ' + r.status)
    L.execution = j.execution || ''; emit()
    await suivre(L)
  } catch (e) { fin(L, 'echec', e.message) }
}
