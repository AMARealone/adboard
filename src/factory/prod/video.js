// Vidéos de la production automatique (v10) : plan des niveaux de conscience + choix des CT vidéo par l'agent,
// lancement sur le moteur Cloud Run, suivi en direct, arrêt réel, historique conservé.
// 1 angle = 1 vidéo. Chaque vidéo est un job indépendant (une machine par vidéo) : elles se tournent en parallèle.
import { prodv2State as S, SERVER, emit } from './state'
import { vctGetAll } from '../vctApi'
import { toast } from '../ui'
import * as PL from './plan'
import * as APP from './apprentissage' // appr-client-v1
import * as CDC from './cdc' // cdc-franchise-v1
import * as VER from './verite' // verite-v1
import * as MAN from './ctmanuel' // ct-fidelite-v1
import * as SEN from './sensible' // meta-sensible-v1

const JH = { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' }
const U = S.ui
const DELAI_MAX_MS = 3 * 3600 * 1000 + 600000          // la machine s'arrête d'elle-même à 3 h
const PAS_SUIVI_MS = 10000
let _save = () => {}
export const brancherSauvegarde = (f) => { _save = f }   // branchée par le moteur (évite un import circulaire)
const pollers = new Map()                               // index de la créative vidéo → promesse de suivi

export const estSlotVideo = (c) => !!c && c.kind === 'video'
export const videoSlots = () => S.creatives.map((c, i) => ({ c, i })).filter((x) => estSlotVideo(x.c))
const FINIS = ['echec', 'annule', 'termine', 'plan_pret']   // plan_pret (texte-dabord-v1) : le texte attend la validation du fondateur
export const jobEnCours = (c) => !!(c && c.job && c.job.execution && !c.videoUrl && !FINIS.includes(c.job.etat))
export const peutVideoCloud = () => S.briefSource === 'commande' && !!S.commandeId

// ── galerie CT vidéo (préchargée pendant que l'analyste travaille) ──
let galerie = null
export function prechargerCTVideo() {
  galerie = vctGetAll().then((l) => l.filter((c) => c.videoUrl)).catch((e) => { console.warn('[Vidéo] galerie CT vidéo illisible :', e.message); return [] })
  return galerie
}
const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
const titreCourt = (a) => String(a || '').split('*')[0].replace(/^\s*angle\s*\d+\s*[:—–-]?\s*/i, '').trim()
const balises = (c) => (Array.isArray(c.awareness) ? c.awareness : String(c.awareness || '').split(',')).map(PL.cle).filter(Boolean)

// zero-redondance-video-v1 — ZÉRO REDONDANCE DES CT VIDÉO. Un CT vidéo utilisé au dernier lot de ce produit n'est JAMAIS reproposé tant qu'il en reste assez d'autres.
// Paliers (le premier qui laisse au moins n CT est retenu) : 1) ni le dernier lot, ni les lots plus anciens, ni les CT saturés / mal reçus du client ;
// 2) ni le dernier lot, ni les CT saturés / mal reçus ; 3) pas le dernier lot. Si même le palier 3 est trop court, on garde tous les CT hors dernier lot
// et on complète avec le strict minimum du dernier lot (insuffisant > 0 : la galerie CT vidéo manque de CT, il faut en ajouter).
export function ctVideoDispo(liste, n, ctx, ecartesEnPlus) {
  const rc = ctx || {}
  const dernier = new Set(rc.ctsUtilisesDernierLot || [])
  const anciens = new Set((rc.historiqueCreatives || []).map((x) => x && x.ctId).filter(Boolean))
  const mal = new Set(ecartesEnPlus || [])
  const besoin = Math.max(1, n || 1)
  const paliers = [new Set([...dernier, ...anciens, ...mal]), new Set([...dernier, ...mal]), dernier]
  for (const ex of paliers) {
    const l = liste.filter((c) => !ex.has(c.id))
    if (l.length >= besoin) return { liste: l, ecartes: liste.length - l.length, insuffisant: 0 }
  }
  const hors = liste.filter((c) => !dernier.has(c.id)), reste = liste.filter((c) => dernier.has(c.id))
  const l = hors.concat(reste.slice(0, Math.max(0, besoin - hors.length)))
  return { liste: l.length ? l : liste, ecartes: liste.length - (l.length ? l.length : liste.length), insuffisant: Math.max(0, besoin - hors.length) }
}

// secours sans IA : CT balisé au bon niveau, durée raisonnable, style différent des autres vidéos
function secours(dispo, besoins, deja = []) {
  const styles = new Set(), niches = new Set(), pris = new Set(deja.map((c) => c.id))
  deja.forEach((c) => { (c.styleTags || []).forEach((x) => styles.add(x)); if (c.niche) niches.add(c.niche) })
  return besoins.map((niv) => {
    const score = (c) => {
      let s = 0; const d = Number(c.duree_s) || 40
      s -= Math.abs(d - 40) / 4; if (d > 55) s -= 8
      if (niv && balises(c).includes(niv)) s += 10
      ;(c.styleTags || []).forEach((x) => { if (styles.has(x)) s -= 3 }); if (c.niche && niches.has(c.niche)) s -= 2
      if (c.hook) s += 1; if (c.chute) s += 1
      return s
    }
    const r = dispo.filter((c) => !pris.has(c.id)).sort((a, b) => score(b) - score(a))[0]
    if (!r) return null
    pris.add(r.id); (r.styleTags || []).forEach((x) => styles.add(x)); if (r.niche) niches.add(r.niche)
    return { id: r.id, raison: 'CT de secours (agent de sélection indisponible) : balisé ' + (PL.LIB[niv] || '') + ', durée adaptée, style différent des autres vidéos.' }
  }).filter(Boolean)
}
const resume = (c) => ({ id: c.id, name: c.name, meta: c.meta, awareness: c.awareness, styleTags: c.styleTags, niche: c.niche, duree_s: c.duree_s, blocs: c.blocs, produit_compatible: c.produit_compatible, angles_fit: c.angles_fit, hook: c.hook, chute: c.chute, lieux_interdits: c.lieux_interdits, epic: c.epic })
const briefCourt = () => { const b = S.brief || {}; return ['Marque : ' + (b.marque || ''), 'Produit : ' + (b.produit || ''), 'Pays : ' + (b.pays || ''), 'Prix : ' + (b.pricing || '') + (b.promo ? ' · offre : ' + b.promo : ''), 'Cible : ' + (b.cible || b.cible_suggeree || ''), 'Utilité : ' + (b.utilite || ''), b.notes ? 'Notes du client : ' + b.notes : ''].filter(Boolean).join('\n') }

// PLAN DE LA PRODUCTION : pour chaque angle, le parcours de conscience, le niveau porté par la vidéo et son CT.
// Retourne { plan: [{parcours, niveaux, video}], choix: [{ id, nom, poster, angleIdx, raison }] }
async function planifierBrut(nbAngles, { avecVideo = true } = {}) {
  const angleIdxs = Array.from({ length: nbAngles }, (_, a) => a)
  if (!avecVideo) return { plan: PL.planParDefaut(nbAngles), choix: [] }
  const toute = await (galerie || prechargerCTVideo())
  if (!toute.length) throw new Error('Aucun CT vidéo avec sa vidéo source dans la galerie (Galerie CT vidéo)')
  const sel = ctVideoDispo(toute, nbAngles, S.renewalContext, APP.ctSatures())   // zero-redondance-video-v1
  const liste = sel.liste
  if (sel.ecartes) console.log('[Vidéo] zéro redondance : ' + sel.ecartes + ' CT vidéo écartés (déjà utilisés au dernier lot ou mal reçus), ' + liste.length + ' proposés')
  if (sel.insuffisant) toast('Galerie CT vidéo trop courte : ' + sel.insuffisant + ' CT du dernier lot sont repris faute de choix. Ajoutez des CT vidéo.')
  const parId = new Map(liste.map((c) => [c.id, c]))
  let props = [], choix = []
  S.forceOffre = null; S.forceOffreRaison = ''   // offre-forte-v1 : jamais le jugement d'une production précédente
  try {
    const r = await fetch(SERVER + '/video/select-cts', { method: 'POST', headers: JH, body: JSON.stringify({ mode: 'plan', cts: liste.map(resume), synthese: S.synthesis || '', brief: briefCourt(), angles: angleIdxs.map((i) => S.angles[i] || 'Angle ' + (i + 1)), n: nbAngles }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || j.error) throw new Error(j.error || 'HTTP ' + r.status)
    choix = (j.choix || []).filter((c) => parId.has(c.id))
    S.forceOffre = j.force_offre || null; S.forceOffreRaison = j.force_offre_raison || ''   // offre-forte-v1
    if (j.diversite && j.diversite.doublon) { console.warn('[Vidéo] dispositifs en double dans le lot :', j.diversite); toast('Diversité : les vidéos choisies ont le même dispositif (' + (j.diversite.familles || []).join(', ') + ').' + (j.diversite.autres_dispositifs_mesures ? ' Cliquez sur « Autre CT » pour l\'une d\'elles.' : ' La galerie CT vidéo manque de CT d\'un autre dispositif (voix off, dialogue, animation) : ajoutez-en.')) }   // zero-redondance-v2
    if (j.diversite && j.diversite.remplaces && j.diversite.remplaces.length) { console.log('[Vidéo] zéro redondance : doublon(s) de dispositif remplacé(s) par le serveur', j.diversite.remplaces); toast('Diversité : ' + j.diversite.remplaces.length + ' CT vidéo au même dispositif qu\'une autre vidéo du lot remplacé(s) automatiquement.') }   // zero-redondance-v3
    if (j.force_offre) console.log('[Vidéo] force de l\'offre : ' + j.force_offre + (j.force_offre_raison ? ' — ' + j.force_offre_raison : '') + (j.force_offre === 'irresistible' ? ' → une vidéo peut porter Most Aware' : ' → aucune vidéo Most Aware'))
  } catch (e) { console.warn('[Vidéo] plan par l\'agent impossible, plan par défaut :', e.message) }
  // un CT par angle : d'abord par titre d'angle cité, puis dans l'ordre
  const libres = new Set(angleIdxs), parAngle = new Map()
  choix.forEach((c) => {
    let a = null; const t = norm(titreCourt(c.angle))
    if (t) { for (const i of libres) { const ti = norm(titreCourt(S.angles[i] || '')); if (ti && (ti.includes(t) || t.includes(ti))) { a = i; break } } }
    if (a === null) a = [...libres][0]
    if (a === undefined) return
    libres.delete(a); parAngle.set(a, c)
  })
  props = angleIdxs.map((a) => { const c = parAngle.get(a) || {}; return { parcours: c.parcours, niveau_video: c.niveau_video } })
  const plan = PL.reparerPlan(nbAngles, props, { offreForte: S.forceOffre === 'irresistible' })   // offre-forte-v1
  // angles sans CT valide : secours au niveau de la vidéo, jamais un CT déjà pris
  const manquants = angleIdxs.filter((a) => !parAngle.has(a))
  if (manquants.length) {
    const sec = secours(liste, manquants.map((a) => plan[a].video), [...parAngle.values()].map((c) => parId.get(c.id)).filter(Boolean))
    manquants.forEach((a, k) => { if (sec[k]) parAngle.set(a, sec[k]) })
  }
  const sortie = angleIdxs.filter((a) => parAngle.has(a)).map((a) => {
    const c = parAngle.get(a), g = parId.get(c.id) || {}
    return { id: c.id, nom: g.name || c.id, poster: g.posterUrl || '', duree_s: g.duree_s || 0, angleIdx: a, raison: c.raison || '', direction: c.direction || null }
  })
  return { plan, choix: APP.forcerCTVideo(toute, plan, sortie, balises) }   // un CT gagnant (indice ≥ 120) reste rejouable exprès, sur un nouvel angle
}

// Un seul CT vidéo pour un angle (relance « Autre CT »), au niveau imposé par le plan.
async function unCT(angleIdx, niveau, exclure) {
  const liste = await (galerie || prechargerCTVideo())
  const libres = liste.filter((c) => !exclure.has(c.id))
  const dispo = libres.length ? ctVideoDispo(libres, 1, S.renewalContext, APP.ctSatures()).liste : libres   // zero-redondance-video-v1
  if (!dispo.length) throw new Error('Plus aucun CT vidéo disponible dans la galerie')
  const parId = new Map(dispo.map((c) => [c.id, c]))
  try {
    const r = await fetch(SERVER + '/video/select-cts', { method: 'POST', headers: JH, body: JSON.stringify({ cts: dispo.map(resume), synthese: S.synthesis || '', brief: briefCourt(), angles: [S.angles[angleIdx] || 'Angle ' + (angleIdx + 1)], niveaux: 'Angle 1 : la vidéo DOIT porter le niveau ' + PL.LIB[niveau], n: 1 }) })
    const j = await r.json().catch(() => ({}))
    const c = (j.choix || []).find((x) => parId.has(x.id))
    if (c) { const g = parId.get(c.id); return { id: c.id, nom: g.name || c.id, poster: g.posterUrl || '', raison: c.raison || '' } }
  } catch (_) { }
  const [s] = secours(dispo, [niveau]); const g = parId.get(s.id)
  return { id: s.id, nom: g.name || s.id, poster: g.posterUrl || '', raison: s.raison }
}

// ── lancement d'une vidéo sur le moteur Cloud Run ──
// Consignes de diversité : la direction de CETTE vidéo + ce que les autres vidéos du lot ont déjà pris (interdit ici).
let choixLot = []
// cible-fait-v1 (23 nov. 2026) — Production c47b3ef6 : cible = une femme ; pour « diversifier » le lot, l'agent a fixé « Homme, 30 ans, torse nu » à la vidéo 2.
// La diversité d'un lot ne change jamais à qui l'on parle. L'avatar est un fait de l'étude : la personne qui porte une vidéo a son genre.
const genreDe = (t) => { const x = ' ' + norm(t) + ' '; const f = /[^a-z](femme|woman|female|fille|madame)[^a-z]/.test(x), m = /[^a-z](homme|man|male|garcon|monsieur)[^a-z]/.test(x); return f && !m ? 'f' : m && !f ? 'm' : '' }
export function avatarLu() {
  const s = String(S.synthesis || ''), g = (re) => { const m = s.match(re); return m ? String(m[1]).replace(/\*+/g, '').replace(/\s+/g, ' ').trim().slice(0, 240) : '' }
  // L'avatar montré au client (données marché : prénom, sexe, âge, ville, rôle) et la cible écrite par le client dans le brief font foi ; puis les lignes de la synthèse.
  const pe = (S.marche && S.marche.persona) || null, bc = String((S.brief && S.brief.cible) || '').trim()
  const fiche = pe && pe.nom ? [pe.nom, pe.sexe, pe.age, pe.ville, pe.role].filter(Boolean).join(', ') : ''
  const identite = fiche || g(/AVATAR\s*\**\s*[:：]\s*\**\s*([^\n]{6,})/) || g(/→\s*Identit[ée]\s*[:：]\s*([^\n]{6,})/i)
  return { identite, genre: genreDe(bc) || genreDe(pe && pe.sexe) || genreDe(g(/GENRE DE L['’]AVATAR\s*\**\s*[:：]\s*\**\s*([^\n]{3,})/i)) || genreDe(identite) }
}
function directionJuste(d) {
  if (!d) return d
  const av = avatarLu(), gd = genreDe(d.casting)
  if (av.genre && gd && gd !== av.genre) {
    console.warn('[Vidéo] casting corrigé : « ' + d.casting + ' » ne correspond pas à l\'avatar de l\'étude (' + av.identite + ')')
    return { ...d, casting: (av.identite || (av.genre === 'f' ? 'Femme' : 'Homme')) + ' — la cible de l\'étude ; une allure, une coiffure et un style différents des autres vidéos du lot.', tenue: /torse nu|shirtless|bare/i.test(String(d.tenue || '')) ? 'La tenue que cette personne porte vraiment dans ce lieu à ce moment, pudique.' : d.tenue, _casting_corrige: true }
  }
  return d
}
const txtDir = (d) => d ? ['casting : ' + (d.casting || '?'), 'lieux : ' + (d.lieux || '?'), 'tenue : ' + (d.tenue || '?'), 'lumière : ' + (d.lumiere || '?'), 'cadrage dominant : ' + (d.cadrage || '?')].join(' ; ') : ''
function consignesDiversite(idx, direction) {
  const ang = S.creatives[idx] ? S.creatives[idx].angleIdx : -1
  const vus = new Map()
  choixLot.forEach((c) => { if (c.angleIdx !== ang && c.direction) vus.set(c.angleIdx, c.direction) })
  videoSlots().forEach((x) => { if (x.i !== idx && x.c.job && x.c.job.direction) vus.set(x.c.angleIdx, x.c.job.direction) })
  const autres = [...vus.entries()].map(([a, d]) => 'angle ' + (a + 1) + ' — ' + txtDir(directionJuste(d)))
  const L = []
  { const m = SEN.blocVideo(); if (m) L.push(m) }   // meta-sensible-v1 : en tête (les consignes sont coupées à 7000 caractères)
  direction = directionJuste(direction)
  { const av = avatarLu(); if (av.identite) L.push('AVATAR : ' + av.identite + (av.genre ? ' (' + (av.genre === 'f' ? 'femme' : 'homme') + ')' : '') + ' — c\'est à cette personne que la vidéo parle.') }   // cible-fait-v1 : lu par le moteur
  if (direction) L.push('DIRECTION IMPOSÉE POUR CETTE VIDÉO (diversité du lot, règle 17) : ' + txtDir(direction) + '.')
  if (autres.length) L.push('DÉJÀ PRIS PAR LES AUTRES VIDÉOS DU LOT — INTERDIT ICI (allure, tenue, lieu principal et lumière différents ; le genre et l\'âge restent ceux de la cible) : ' + autres.join(' | ') + '.')
  if (S.forceOffre) L.push('FORCE DE L\'OFFRE (jugée au choix des CT, offre-forte-v1) : ' + S.forceOffre.toUpperCase() + (S.forceOffreRaison ? ' — ' + S.forceOffreRaison : '') + '.')
  { const q = APP.bloc('video'); if (q) L.push(q) }   // retours qualité de ce client
  L.push(CDC.regleVideo())   // cdc-franchise-v1 : franchise du sujet, toujours
  { const c = CDC.bloc('video').trim(); if (c) L.push(c) }   // cahier des charges de la marque
  { const v = ang >= 0 ? VER.bloc(ang, 'video').trim() : ''; if (v) L.push(v) }   // verite-v1 : les mêmes faits que l'image et l'ad copy de cet angle
  return L.join('\n')
}
export async function lancerVideo(idx, ct, { forcer = false, arret = '', neuf = false } = {}) {
  const c = S.creatives[idx]
  if (!estSlotVideo(c)) return
  if (!peutVideoCloud()) throw new Error('La vidéo automatique demande une commande AdBoard (pas un brief importé à la main).')
  const slot = c.angleIdx + 1
  let ctVideoUrl = ''
  try { const g = await (galerie || prechargerCTVideo()); const f = g.find((x) => x.id === ct.id); ctVideoUrl = (f && f.videoUrl) || '' } catch (_) { }
  const r = await fetch(SERVER + '/video-jobs/start', { method: 'POST', headers: JH, body: JSON.stringify({ commande_id: S.commandeId, ct_id: ct.id, angle: String(slot), slot, niveau: PL.LIB[c.niveau] || '', consignes: consignesDiversite(idx, ct.direction), forcer, arret: arret || undefined, neuf: neuf || undefined }) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j.error) throw new Error(j.error || 'HTTP ' + r.status)
  S.creatives[idx] = { ...c, ct: ct.id, ctRaison: ct.raison || '', videoUrl: null, status: 'pending',
    job: { execution: j.execution, slot, ct: ct.id, ctNom: ct.nom || ct.id, raison: ct.raison || '', poster: ct.poster || '', direction: ct.direction || null, ctVideoUrl, debut: Date.now(), etat: 'demarrage', pct: 1, etape: 'La machine démarre' } }
  U.vjournal = U.vjournal || {}; U.vjournal[idx] = []
  U.crea[idx] = { state: 'running', text: 'La machine démarre', pct: 1 }; emit()
  _save(true)   // la commande garde l'identifiant de la machine : on peut fermer l'onglet et reprendre plus tard
  return suivre(idx)
}

// ── suivi : interroge l'état toutes les 10 s jusqu'à la fin ──
export function suivre(idx) {
  if (pollers.has(idx)) return pollers.get(idx)
  const p = (async () => {
    try {
      let erreursReseau = 0
      while (true) {
        const c = S.creatives[idx]
        if (!c || !c.job || c.videoUrl || FINIS.includes(c.job.etat)) return
        if (Date.now() - (c.job.debut || Date.now()) > DELAI_MAX_MS) { finEchec(idx, 'Délai dépassé (plus de 3 h) : la machine vidéo s\'est arrêtée.'); return }
        let e = null
        try {
          const q = new URLSearchParams({ commande_id: S.commandeId, slot: String(c.job.slot), execution: c.job.execution || '' })
          const r = await fetch(SERVER + '/video-jobs/status?' + q, { headers: { 'ngrok-skip-browser-warning': '1' } })
          if (r.ok) { e = await r.json(); erreursReseau = 0 } else erreursReseau++
        } catch (_) { erreursReseau++ }
        const c2 = S.creatives[idx]
        if (!c2 || c2 !== c || !c2.job || FINIS.includes(c2.job.etat)) return      // relancée ou arrêtée entre-temps
        if (e) {
          Object.assign(c.job, { etat: e.etat, etape: e.etape, pct: e.pct, run: e.run || c.job.run, cout_usd: e.cout_usd, secondes: e.secondes, monteur: e.monteur, historiqueUrl: e.historique_url || c.job.historiqueUrl, dossierUrl: e.dossier_url || c.job.dossierUrl, machine: e.machine || null })
          U.vjournal = U.vjournal || {}; U.vjournal[idx] = e.journal || []
          if (e.etat === 'termine' && e.plan_seul) { finPlan(idx, e); return }   // texte-dabord-v1
          if (e.etat === 'termine' && e.video_url) { finOk(idx, e); return }
          if (e.etat === 'echec') { finEchec(idx, e.erreur || 'Échec de la production vidéo.'); return }
          U.crea[idx] = { state: 'running', text: (e.etape || 'En cours') + ' · ' + (e.pct || 0) + ' %', pct: e.pct || 0 }
          emit()
        } else if (erreursReseau > 30) { finEchec(idx, 'Suivi impossible (serveur injoignable). La vidéo continue peut-être sur la machine : rouvre cette commande dans quelques minutes.'); return }
        await new Promise((ok) => setTimeout(ok, PAS_SUIVI_MS))
      }
    } finally { pollers.delete(idx) }
  })()
  pollers.set(idx, p)
  return p
}
function finOk(idx, e) {
  const c = S.creatives[idx]
  const duree = e.duree_video_s || c.duree || 0
  S.creatives[idx] = { ...c, type: 'video', videoUrl: e.video_url, thumbUrl: e.affiche_url || c.thumbUrl || null, url: null, imgB64: null, status: 'done', duree,
    desc: 'Vidéo · ' + (c.job.ctNom || c.ct) + (duree ? ' · ' + duree + ' s' : '') + (e.qualite && (e.qualite.plans_fixes > 0 || e.qualite.livrable === false) ? ' · ⚠ à revoir' + (e.qualite.plans_fixes ? ' (' + e.qualite.plans_fixes + ' plan(s) fixe(s))' : '') : '') + (e.qualite && e.qualite.note_juge != null ? ' · juge ' + e.qualite.note_juge + '/10' : ''),
    aRevoir: !!(e.qualite && (e.qualite.plans_fixes > 0 || e.qualite.livrable === false)), videoAvant: undefined,
    job: { ...c.job, etat: 'termine', pct: 100, etape: 'Vidéo prête', qualite: e.qualite || null, plans: Array.isArray(e.plans) ? e.plans : (c.job.plans || null),   // correcteur-cible-v1
      corrections: e.correction ? (c.job.corrections || []).concat([{ plans: e.correction.plans || [], faite: e.correction.faite || [], cout_neuf_usd: e.correction.cout_neuf_usd, t: Date.now() }]).slice(-10) : (c.job.corrections || null), correction: null, cout_usd: e.cout_usd, monteur: e.monteur, historiqueUrl: e.historique_url, dossierUrl: e.dossier_url, journal: ((U.vjournal || {})[idx] || []).slice(-400), fin: Date.now() } }
  U.crea[idx] = { state: 'done', text: 'Vidéo prête', pct: 100 }; emit(); _save(true)
  majAgentVideo()
  const q = e.qualite
  if (q && (q.plans_fixes > 0 || q.livrable === false)) toast('⚠ Vidéo de l\'angle ' + (c.angleIdx + 1) + ' à revoir avant envoi' + (q.plans_fixes ? ' : ' + q.plans_fixes + ' plan(s) non animé(s)' : '') + (q.note_juge != null ? ' · juge ' + q.note_juge + '/10' : '') + '.', 12000)
  else toast('Vidéo de l\'angle ' + (c.angleIdx + 1) + ' prête.' + (q && q.note_juge != null ? ' Juge ' + q.note_juge + '/10.' : ''))
  if (e.correction) toast('Correction de la vidéo de l\'angle ' + (c.angleIdx + 1) + ' terminée' + (e.correction.cout_neuf_usd != null ? ' : ' + Number(e.correction.cout_neuf_usd).toFixed(2) + ' $ dépensés pour les plans corrigés.' : '.'), 12000)
}
// texte-dabord-v1 (23 nov. 2026) — la machine s'est arrêtée après le texte et le plan : rien n'est tourné. Le fondateur lit, puis « Tourner » (reprend sans repayer) ou « Réécrire ».
function finPlan(idx, e) {
  const c = S.creatives[idx]
  S.creatives[idx] = { ...c, status: 'pending', job: { ...c.job, etat: 'plan_pret', pct: 100, etape: 'Texte prêt à valider', planTexte: Array.isArray(e.texte) ? e.texte : [], planInserts: Array.isArray(e.inserts_prevus) ? e.inserts_prevus : [], planFaits: Array.isArray(e.faits) ? e.faits : [], planRecit: e.recit || null, cout_usd: e.cout_usd, fin: Date.now() } }
  U.crea[idx] = { state: 'pending', text: 'Texte prêt à valider' }; emit(); _save(true); majAgentVideo()
  toast('Vidéo de l\'angle ' + (c.angleIdx + 1) + ' : le texte est prêt à valider. Rien n\'est encore tourné.', 12000)
}
function finEchec(idx, msg, etat = 'echec') {
  const c = S.creatives[idx]
  if (c && c.videoAvant && c.videoAvant.videoUrl) {   // correcteur-cible-v1 : une correction qui échoue ou qu'on arrête rend la vidéo d'avant, intacte
    const a = c.videoAvant
    S.creatives[idx] = { ...c, videoUrl: a.videoUrl, thumbUrl: a.thumbUrl || null, desc: a.desc || c.desc, aRevoir: !!a.aRevoir, status: 'done', videoAvant: undefined, job: { ...(a.job || {}), etat: 'termine', correction: null, correction_echec: String(msg).slice(0, 400) } }
    U.crea[idx] = { state: 'done', text: 'Vidéo prête', pct: 100 }; emit(); _save(true); majAgentVideo()
    toast((etat === 'annule' ? 'Correction arrêtée' : 'Correction non faite') + ' : ' + String(msg).slice(0, 220) + ' La vidéo d\'avant est gardée.', 14000)
    return
  }
  S.creatives[idx] = { ...c, job: { ...(c.job || {}), etat, erreur: String(msg).slice(0, 500) } }
  U.crea[idx] = { state: 'err', text: etat === 'annule' ? 'Vidéo arrêtée' : 'Échec de la vidéo', err: String(msg).slice(0, 300) }; emit(); _save(true)
  majAgentVideo()
}

// Reprise : après réouverture de la commande, on reprend le suivi des vidéos encore en cours sur le cloud.
export function reprendreVideos() {
  videoSlots().forEach(({ c, i }) => {
    if (c.videoUrl) return
    if (jobEnCours(c)) { U.crea[i] = { state: 'running', text: (c.job.etape || 'Reprise du suivi') + ' · ' + (c.job.pct || 0) + ' %', pct: c.job.pct || 0 }; suivre(i) }
    else if (c.job && c.job.etat === 'plan_pret') U.crea[i] = { state: 'pending', text: 'Texte prêt à valider' }
    else if (c.job && FINIS.includes(c.job.etat)) U.crea[i] = { state: 'err', text: c.job.etat === 'annule' ? 'Vidéo arrêtée' : 'Échec de la vidéo', err: c.job.erreur || '' }
  })
}

// Lance les vidéos du plan (les CT sont déjà choisis par planifier). Retourne quand toutes sont finies.
export async function produireVideos(choix, garde = () => true, { arret = '' } = {}) {
  choixLot = choix || []
  const slots = videoSlots().filter((x) => !x.c.videoUrl && !jobEnCours(x.c))
  if (!slots.length) { await Promise.all(videoSlots().map((x) => pollers.get(x.i)).filter(Boolean)); return }
  U.agents[4] = { state: 'active', text: (arret === 'plan' ? 'Texte d\'abord : écriture du texte de ' + slots.length + ' vidéo(s), rien ne sera tourné avant votre validation' : 'Tournage de ' + slots.length + ' vidéo(s) en parallèle sur le cloud'), pct: 8 }; emit()
  const jobs = slots.map(({ c, i }) => {
    const ct = (choix || []).find((x) => x.angleIdx === c.angleIdx)
    if (!ct) { finEchec(i, 'Aucun CT vidéo choisi pour cet angle.'); return Promise.resolve() }
    if (!garde()) return Promise.resolve()
    return lancerVideo(i, ct, arret === 'plan' ? { arret: 'plan' } : {}).catch((e) => finEchec(i, e.message))
  })
  await Promise.all(jobs)
  majAgentVideo(true)
}
// Attend la fin de toutes les vidéos en cours (sans en lancer).
export const attendreVideos = () => Promise.all(videoSlots().map((x) => pollers.get(x.i)).filter(Boolean))

export function majAgentVideo(fin = false) {
  const v = videoSlots(); if (!v.length) return
  const pret = v.filter((x) => x.c.videoUrl).length, ko = v.filter((x) => !x.c.videoUrl && x.c.job && FINIS.includes(x.c.job.etat) && x.c.job.etat !== 'plan_pret').length
  const pct = Math.round(v.reduce((s, x) => s + (x.c.videoUrl ? 100 : ((x.c.job && x.c.job.pct) || 0)), 0) / v.length)
  if (fin || pret + ko === v.length) U.agents[4] = { state: pret === 0 && ko === v.length ? 'error' : (pret === v.length ? 'done' : 'active'), text: pret + ' / ' + v.length + ' vidéos prêtes' + (ko ? ' · ' + ko + ' en échec ou arrêtée(s) (relançable)' : ''), pct: Math.round(pret / v.length * 100) }
  else U.agents[4] = { state: 'active', text: pret + ' / ' + v.length + ' vidéos prêtes · en cours : ' + pct + ' %', pct }
  emit()
}

// « Refaire cette vidéo » (même CT) ou « Autre CT » (un autre concept, jamais un CT déjà pris dans la commande)
async function relancerVideoBrut(idx, { autreCT = false } = {}) {
  const c = S.creatives[idx]; if (!estSlotVideo(c)) return
  if (jobEnCours(c)) { toast('Cette vidéo est déjà en cours.'); return }
  U.crea[idx] = { state: 'running', text: autreCT ? 'Choix d\'un autre CT vidéo…' : 'Relance de la vidéo…', pct: 0 }; emit()
  try {
    let ct = { id: (c.job && c.job.ct) || c.ct, nom: c.job && c.job.ctNom, raison: c.ctRaison, poster: c.job && c.job.poster, direction: c.job && c.job.direction }
    if (autreCT || !ct.id) {
      const pris = new Set(S.creatives.map((x) => x.job && x.job.ct).filter(Boolean))
      ct = { ...(await unCT(c.angleIdx, c.niveau || 'solution', pris)), direction: ct.direction }
    }
    S.creatives[idx] = { ...c, videoUrl: null, thumbUrl: null, job: null }
    await lancerVideo(idx, ct, { forcer: true })
  } catch (e) { finEchec(idx, e.message) }
  majAgentVideo()
}

// Arrêt réel des machines vidéo en cours (bouton Annuler, si le fondateur le choisit).
export async function arreterVideos() {
  const en = videoSlots().filter((x) => jobEnCours(x.c))
  await Promise.all(en.map(async ({ c, i }) => {
    try { await fetch(SERVER + '/video-jobs/cancel', { method: 'POST', headers: JH, body: JSON.stringify({ execution: c.job.execution }) }) } catch (_) { }
    finEchec(i, 'Arrêtée à ta demande (bouton Annuler).', 'annule')
  }))
  return en.length
}

// Annuler UNE vidéo (carte) : arrête sa machine cloud et la marque arrêtée, prête pour « Relancer ».
export async function annulerVideo(idx) {
  const c = S.creatives[idx]; if (!estSlotVideo(c)) return
  if (c.job && c.job.execution) { try { await fetch(SERVER + '/video-jobs/cancel', { method: 'POST', headers: JH, body: JSON.stringify({ execution: c.job.execution }) }) } catch (_) { } }
  finEchec(idx, 'Arrêtée à ta demande (bouton Annuler de la carte).', 'annule')
}

// Rattacher une vidéo déjà produite (lien R2 ou autre adresse publique .mp4).
export function attacherLien(idx, url) {
  const c = S.creatives[idx]; if (!estSlotVideo(c)) return false
  const u = String(url || '').trim()
  if (!/^https:\/\/\S+\.(mp4|mov|webm)(\?\S*)?$/i.test(u)) return false
  S.creatives[idx] = { ...c, type: 'video', videoUrl: u, url: null, imgB64: null, status: 'done', desc: 'Vidéo · ' + ((c.job && c.job.ctNom) || 'importée par lien'), job: c.job ? { ...c.job, etat: 'termine' } : null }
  U.crea[idx] = { state: 'done', text: 'Vidéo prête', pct: 100 }; emit(); _save(true); majAgentVideo()
  return true
}

// ───────── ct-fidelite-v1 : CT choisi à la main ─────────
// planifier : le CT choisi à la main (panneau « CT des vidéos ») prime sur celui de l'agent, une seule fois.
export async function planifier(...args) {
  const r = await planifierBrut(...args)
  const o = args[1] || {}
  if (o.avecVideo === false || !MAN.nbChoisis()) return r
  if (!r || !Array.isArray(r.choix)) { toast('Le CT choisi à la main n\'a pas pu être appliqué (format du plan inattendu) : l\'agent choisit.'); return r }
  const liste = await MAN.chargerListe()
  return { ...r, choix: MAN.appliquer(r.choix, liste, args[0]) }
}
// relancerVideo : un CT posé sur la carte (liste « CT : automatique ») sert au « Lancer / Refaire » de cette carte, puis s'efface.
// « Autre CT » garde son sens (l'agent choisit) et efface le choix posé.
export async function relancerVideo(idx, opts = {}) {
  const o = { ...(opts || {}) }
  if (o.autreCT) MAN.consommerCarte(idx)
  else if (!o.ctId) { const v = MAN.consommerCarte(idx); if (v) o.ctId = v }
  if (!o.ctId) return relancerVideoBrut(idx, o)
  const c = S.creatives[idx]; if (!estSlotVideo(c)) return
  if (jobEnCours(c)) { toast('Cette vidéo est déjà en cours.'); return }
  U.crea[idx] = { state: 'running', text: 'Relance de la vidéo avec le CT choisi…', pct: 0 }; emit()
  try {
    const g = (await MAN.chargerListe()).find((x) => x.id === o.ctId)
    const ct = { id: o.ctId, nom: g ? g.nom : o.ctId, raison: 'CT choisi à la main.', poster: g ? g.poster : '', direction: (c.job && c.job.direction) || null }
    S.creatives[idx] = { ...c, videoUrl: null, thumbUrl: null, job: null }
    await lancerVideo(idx, ct, { forcer: true })
  } catch (e) { finEchec(idx, e.message) }
  majAgentVideo()
}

// ───────── correcteur-cible-v1 (23 nov. 2026) : corriger des plans d'une vidéo livrée ─────────
// Demande du fondateur : « corriger là où on veut » pour quelques dollars au lieu de 15 $. La machine rejoue la vidéo depuis son dossier de reprise
// (rien n'est repayé) et ne refait que les plans choisis, avec la consigne écrite pour chacun. La vidéo d'avant reste visible et revient si la correction échoue.
export async function corrigerVideo(idx, plans, { maxUsd } = {}) {   // rectifications-v1 : maxUsd = plafond de dépense neuve (rectification client : 3 $)
  const c = S.creatives[idx]; if (!estSlotVideo(c) || !c.videoUrl || !c.job) return false
  if (jobEnCours(c)) { toast('Cette vidéo est déjà en cours.'); return false }
  const liste = (plans || []).map((x) => ({ bloc: Number(x.bloc), consigne: String(x.consigne || '').trim() })).filter((x) => x.bloc > 0 && x.consigne.length >= 4)
  if (!liste.length) { toast('Choisissez au moins un plan et écrivez ce qu\'il doit montrer.'); return false }
  const r = await fetch(SERVER + '/video-jobs/corriger', { method: 'POST', headers: JH, body: JSON.stringify({ commande_id: S.commandeId, slot: c.job.slot || (c.angleIdx + 1), plans: liste, max_usd: maxUsd || undefined }) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j.error) { toast(j.error || 'Correction impossible (HTTP ' + r.status + ').', 12000); return false }
  S.creatives[idx] = { ...c, videoAvant: { videoUrl: c.videoUrl, thumbUrl: c.thumbUrl || null, desc: c.desc, aRevoir: !!c.aRevoir, job: c.job }, videoUrl: null, status: 'pending',
    job: { ...c.job, execution: j.execution, correction: j.plans || liste, correction_echec: null, debut: Date.now(), etat: 'demarrage', pct: 1, etape: 'Correction : la machine démarre' } }
  U.vjournal = U.vjournal || {}; U.vjournal[idx] = []
  U.crea[idx] = { state: 'running', text: 'Correction de ' + (j.plans || liste).length + ' plan(s)', pct: 1 }; emit(); _save(true)
  suivre(idx)
  return j.execution || true
}

// ───────── texte-dabord-v1 (23 nov. 2026) : valider le texte avant de payer les images et les clips ─────────
// Décision du fondateur après la production c247887c (CT non respecté, 14,54 $ dépensés) : « pas le droit à l'erreur ». La machine écrit le texte et le plan
// (environ 3 $, ceux que la vidéo aurait dépensés de toute façon) et s'arrête. « Tourner » relance la même vidéo : cette passe est relue, rien n'est repayé.
export async function texteDabord(idx, { neuf = false } = {}) {
  const c = S.creatives[idx]; if (!estSlotVideo(c)) return
  if (jobEnCours(c)) { toast('Cette vidéo est déjà en cours.'); return }
  U.crea[idx] = { state: 'running', text: neuf ? 'Réécriture du texte…' : 'Écriture du texte…', pct: 0 }; emit()
  try {
    let ct = { id: (c.job && c.job.ct) || c.ct, nom: c.job && c.job.ctNom, raison: c.ctRaison, poster: c.job && c.job.poster, direction: c.job && c.job.direction }
    const pose = MAN.consommerCarte(idx)
    if (pose) { const g = (await MAN.chargerListe()).find((x) => x.id === pose); ct = { id: pose, nom: g ? g.nom : pose, raison: 'CT choisi à la main.', poster: g ? g.poster : '', direction: ct.direction || null } }
    if (!ct.id) { const pris = new Set(S.creatives.map((x) => x.job && x.job.ct).filter(Boolean)); ct = { ...(await unCT(c.angleIdx, c.niveau || 'solution', pris)), direction: ct.direction } }
    S.creatives[idx] = { ...c, videoUrl: null, thumbUrl: null, job: null }
    await lancerVideo(idx, ct, { forcer: true, arret: 'plan', neuf })
  } catch (e) { finEchec(idx, e.message) }
  majAgentVideo()
}
