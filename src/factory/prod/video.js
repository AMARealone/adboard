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
const FINIS = ['echec', 'annule', 'termine']
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
  try {
    const r = await fetch(SERVER + '/video/select-cts', { method: 'POST', headers: JH, body: JSON.stringify({ mode: 'plan', cts: liste.map(resume), synthese: S.synthesis || '', brief: briefCourt(), angles: angleIdxs.map((i) => S.angles[i] || 'Angle ' + (i + 1)), n: nbAngles }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || j.error) throw new Error(j.error || 'HTTP ' + r.status)
    choix = (j.choix || []).filter((c) => parId.has(c.id))
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
  const plan = PL.reparerPlan(nbAngles, props)
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
const txtDir = (d) => d ? ['casting : ' + (d.casting || '?'), 'lieux : ' + (d.lieux || '?'), 'tenue : ' + (d.tenue || '?'), 'lumière : ' + (d.lumiere || '?'), 'cadrage dominant : ' + (d.cadrage || '?')].join(' ; ') : ''
function consignesDiversite(idx, direction) {
  const ang = S.creatives[idx] ? S.creatives[idx].angleIdx : -1
  const vus = new Map()
  choixLot.forEach((c) => { if (c.angleIdx !== ang && c.direction) vus.set(c.angleIdx, c.direction) })
  videoSlots().forEach((x) => { if (x.i !== idx && x.c.job && x.c.job.direction) vus.set(x.c.angleIdx, x.c.job.direction) })
  const autres = [...vus.entries()].map(([a, d]) => 'angle ' + (a + 1) + ' — ' + txtDir(d))
  const L = []
  { const m = SEN.blocVideo(); if (m) L.push(m) }   // meta-sensible-v1 : en tête (les consignes sont coupées à 7000 caractères)
  if (direction) L.push('DIRECTION IMPOSÉE POUR CETTE VIDÉO (diversité du lot, règle 17) : ' + txtDir(direction) + '.')
  if (autres.length) L.push('DÉJÀ PRIS PAR LES AUTRES VIDÉOS DU LOT — INTERDIT ICI (casting, tenue, lieu principal et lumière différents) : ' + autres.join(' | ') + '.')
  { const q = APP.bloc('video'); if (q) L.push(q) }   // retours qualité de ce client
  L.push(CDC.regleVideo())   // cdc-franchise-v1 : franchise du sujet, toujours
  { const c = CDC.bloc('video').trim(); if (c) L.push(c) }   // cahier des charges de la marque
  { const v = ang >= 0 ? VER.bloc(ang, 'video').trim() : ''; if (v) L.push(v) }   // verite-v1 : les mêmes faits que l'image et l'ad copy de cet angle
  return L.join('\n')
}
export async function lancerVideo(idx, ct, { forcer = false } = {}) {
  const c = S.creatives[idx]
  if (!estSlotVideo(c)) return
  if (!peutVideoCloud()) throw new Error('La vidéo automatique demande une commande AdBoard (pas un brief importé à la main).')
  const slot = c.angleIdx + 1
  let ctVideoUrl = ''
  try { const g = await (galerie || prechargerCTVideo()); const f = g.find((x) => x.id === ct.id); ctVideoUrl = (f && f.videoUrl) || '' } catch (_) { }
  const r = await fetch(SERVER + '/video-jobs/start', { method: 'POST', headers: JH, body: JSON.stringify({ commande_id: S.commandeId, ct_id: ct.id, angle: String(slot), slot, niveau: PL.LIB[c.niveau] || '', consignes: consignesDiversite(idx, ct.direction), forcer }) })
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
    aRevoir: !!(e.qualite && (e.qualite.plans_fixes > 0 || e.qualite.livrable === false)),
    job: { ...c.job, etat: 'termine', pct: 100, etape: 'Vidéo prête', qualite: e.qualite || null, cout_usd: e.cout_usd, monteur: e.monteur, historiqueUrl: e.historique_url, dossierUrl: e.dossier_url, journal: ((U.vjournal || {})[idx] || []).slice(-400), fin: Date.now() } }
  U.crea[idx] = { state: 'done', text: 'Vidéo prête', pct: 100 }; emit(); _save(true)
  majAgentVideo()
  const q = e.qualite
  if (q && (q.plans_fixes > 0 || q.livrable === false)) toast('⚠ Vidéo de l\'angle ' + (c.angleIdx + 1) + ' à revoir avant envoi' + (q.plans_fixes ? ' : ' + q.plans_fixes + ' plan(s) non animé(s)' : '') + (q.note_juge != null ? ' · juge ' + q.note_juge + '/10' : '') + '.', 12000)
  else toast('Vidéo de l\'angle ' + (c.angleIdx + 1) + ' prête.' + (q && q.note_juge != null ? ' Juge ' + q.note_juge + '/10.' : ''))
}
function finEchec(idx, msg, etat = 'echec') {
  const c = S.creatives[idx]
  S.creatives[idx] = { ...c, job: { ...(c.job || {}), etat, erreur: String(msg).slice(0, 500) } }
  U.crea[idx] = { state: 'err', text: etat === 'annule' ? 'Vidéo arrêtée' : 'Échec de la vidéo', err: String(msg).slice(0, 300) }; emit(); _save(true)
  majAgentVideo()
}

// Reprise : après réouverture de la commande, on reprend le suivi des vidéos encore en cours sur le cloud.
export function reprendreVideos() {
  videoSlots().forEach(({ c, i }) => {
    if (c.videoUrl) return
    if (jobEnCours(c)) { U.crea[i] = { state: 'running', text: (c.job.etape || 'Reprise du suivi') + ' · ' + (c.job.pct || 0) + ' %', pct: c.job.pct || 0 }; suivre(i) }
    else if (c.job && FINIS.includes(c.job.etat)) U.crea[i] = { state: 'err', text: c.job.etat === 'annule' ? 'Vidéo arrêtée' : 'Échec de la vidéo', err: c.job.erreur || '' }
  })
}

// Lance les vidéos du plan (les CT sont déjà choisis par planifier). Retourne quand toutes sont finies.
export async function produireVideos(choix, garde = () => true) {
  choixLot = choix || []
  const slots = videoSlots().filter((x) => !x.c.videoUrl && !jobEnCours(x.c))
  if (!slots.length) { await Promise.all(videoSlots().map((x) => pollers.get(x.i)).filter(Boolean)); return }
  U.agents[4] = { state: 'active', text: 'Tournage de ' + slots.length + ' vidéo(s) en parallèle sur le cloud', pct: 8 }; emit()
  const jobs = slots.map(({ c, i }) => {
    const ct = (choix || []).find((x) => x.angleIdx === c.angleIdx)
    if (!ct) { finEchec(i, 'Aucun CT vidéo choisi pour cet angle.'); return Promise.resolve() }
    if (!garde()) return Promise.resolve()
    return lancerVideo(i, ct).catch((e) => finEchec(i, e.message))
  })
  await Promise.all(jobs)
  majAgentVideo(true)
}
// Attend la fin de toutes les vidéos en cours (sans en lancer).
export const attendreVideos = () => Promise.all(videoSlots().map((x) => pollers.get(x.i)).filter(Boolean))

export function majAgentVideo(fin = false) {
  const v = videoSlots(); if (!v.length) return
  const pret = v.filter((x) => x.c.videoUrl).length, ko = v.filter((x) => !x.c.videoUrl && x.c.job && FINIS.includes(x.c.job.etat)).length
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
