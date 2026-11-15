// Vidéos de la production automatique : choix intelligent des CT vidéo, lancement sur le moteur Cloud Run,
// suivi en direct, historique conservé pour améliorer l'agent Créative Vidéo.
// 1 angle = 1 vidéo. Chaque vidéo est un job indépendant (une machine par vidéo) : elles se tournent en parallèle.
import { prodv2State as S, SERVER, emit } from './state'
import { vctGetAll } from '../vctApi'
import { toast } from '../ui'

const JH = { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' }
const U = S.ui
const DELAI_MAX_MS = 3 * 3600 * 1000 + 600000          // la machine s'arrête d'elle-même à 3 h
const PAS_SUIVI_MS = 10000
let _save = () => {}
export const brancherSauvegarde = (f) => { _save = f }   // branchée par le moteur (évite un import circulaire)
const pollers = new Map()                               // index de la créative vidéo → promesse de suivi

export const estSlotVideo = (c) => !!c && c.kind === 'video'
export const videoSlots = () => S.creatives.map((c, i) => ({ c, i })).filter((x) => estSlotVideo(x.c))
export const jobEnCours = (c) => !!(c && c.job && c.job.execution && !c.videoUrl && c.job.etat !== 'echec')
export const peutVideoCloud = () => S.briefSource === 'commande' && !!S.commandeId

// ── galerie CT vidéo (préchargée pendant que l'analyste travaille) ──
let galerie = null
export function prechargerCTVideo() {
  galerie = vctGetAll().then((l) => l.filter((c) => c.videoUrl)).catch((e) => { console.warn('[Vidéo] galerie CT vidéo illisible :', e.message); return [] })
  return galerie
}
const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
const titreCourt = (a) => String(a || '').split('*')[0].replace(/^\s*angle\s*\d+\s*[:—–-]?\s*/i, '').trim()

// secours sans IA : durée raisonnable, diversité de style et de niche
function secours(dispo, n, deja = []) {
  const prises = [], styles = new Set(), niches = new Set()
  deja.forEach((c) => { (c.styleTags || []).forEach((x) => styles.add(x)); if (c.niche) niches.add(c.niche) })
  const score = (c) => {
    let s = 0; const d = Number(c.duree_s) || 40
    s -= Math.abs(d - 40) / 4; if (d > 55) s -= 8
    ;(c.styleTags || []).forEach((x) => { if (styles.has(x)) s -= 3 }); if (c.niche && niches.has(c.niche)) s -= 2
    if (c.hook) s += 1; if (c.chute) s += 1; if ((c.produit_compatible || '').length) s += 1
    return s
  }
  const restants = dispo.slice()
  while (prises.length < n && restants.length) {
    restants.sort((a, b) => score(b) - score(a))
    const c = restants.shift(); prises.push({ id: c.id, raison: 'CT de secours (agent de sélection indisponible) : durée adaptée et style différent des autres vidéos.' })
    ;(c.styleTags || []).forEach((x) => styles.add(x)); if (c.niche) niches.add(c.niche)
  }
  return prises
}

// Choisit n CT vidéo différents pour n angles. Retourne [{ id, nom, angleIdx, raison }]
export async function choisirCTVideo(angleIdxs, exclure = new Set(), pourAutre = false) {
  const liste = await (galerie || prechargerCTVideo())
  const dispo = liste.filter((c) => !exclure.has(c.id))
  if (!dispo.length) throw new Error('Aucun CT vidéo avec sa vidéo source dans la galerie (Galerie CT vidéo)')
  const n = angleIdxs.length
  const parId = new Map(dispo.map((c) => [c.id, c]))
  let choix = []
  try {
    const slim = dispo.map((c) => ({ id: c.id, name: c.name, meta: c.meta, awareness: c.awareness, styleTags: c.styleTags, niche: c.niche, duree_s: c.duree_s, blocs: c.blocs, produit_compatible: c.produit_compatible, angles_fit: c.angles_fit, hook: c.hook, chute: c.chute, lieux_interdits: c.lieux_interdits, epic: c.epic }))
    const b = S.brief || {}
    const brief = ['Marque : ' + (b.marque || ''), 'Produit : ' + (b.produit || ''), 'Pays : ' + (b.pays || ''), 'Prix : ' + (b.pricing || ''), 'Cible : ' + (b.cible || b.cible_suggeree || ''), 'Utilité : ' + (b.utilite || '')].join('\n')
    const r = await fetch(SERVER + '/video/select-cts', { method: 'POST', headers: JH, body: JSON.stringify({ cts: slim, synthese: S.synthesis || '', brief, angles: angleIdxs.map((i) => S.angles[i] || 'Angle ' + (i + 1)), n, exclure: [...exclure] }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || j.error) throw new Error(j.error || 'HTTP ' + r.status)
    choix = (j.choix || []).filter((c) => parId.has(c.id))
  } catch (e) { console.warn('[Vidéo] sélection par l\'agent impossible, secours :', e.message) }
  // complète si l'agent en a renvoyé moins que demandé
  if (choix.length < n) {
    const pris = new Set(choix.map((c) => c.id))
    const sec = secours(dispo.filter((c) => !pris.has(c.id)), n - choix.length, choix.map((c) => parId.get(c.id)))
    choix = choix.concat(sec)
  }
  // un CT par angle : d'abord par titre d'angle cité, puis dans l'ordre
  const libres = new Set(angleIdxs), sortie = []
  choix.slice(0, n).forEach((c) => {
    let a = null
    const t = norm(titreCourt(c.angle))
    if (t) { for (const i of libres) { const ti = norm(titreCourt(S.angles[i] || '')); if (ti && (ti.includes(t) || t.includes(ti))) { a = i; break } } }
    if (a === null) a = [...libres][0]
    libres.delete(a)
    sortie.push({ id: c.id, nom: (parId.get(c.id) || {}).name || c.id, poster: (parId.get(c.id) || {}).posterUrl || '', duree_s: (parId.get(c.id) || {}).duree_s || 0, angleIdx: a, raison: c.raison || '' })
  })
  return sortie.sort((x, y) => x.angleIdx - y.angleIdx)
}

// ── lancement d'une vidéo sur le moteur Cloud Run ──
export async function lancerVideo(idx, ct, { forcer = false } = {}) {
  const c = S.creatives[idx]
  if (!estSlotVideo(c)) return
  if (!peutVideoCloud()) throw new Error('La vidéo automatique demande une commande AdBoard (pas un brief importé à la main).')
  const slot = c.angleIdx + 1
  const r = await fetch(SERVER + '/video-jobs/start', { method: 'POST', headers: JH, body: JSON.stringify({ commande_id: S.commandeId, ct_id: ct.id, angle: String(slot), slot, forcer }) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j.error) throw new Error(j.error || 'HTTP ' + r.status)
  S.creatives[idx] = { ...c, ct: ct.id, ctRaison: ct.raison || '', videoUrl: null, thumbUrl: c.thumbUrl || null, status: 'pending',
    job: { execution: j.execution, slot, ct: ct.id, ctNom: ct.nom || ct.id, raison: ct.raison || '', poster: ct.poster || '', debut: Date.now(), etat: 'demarrage', pct: 1, etape: 'La machine démarre' } }
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
        if (!c || !c.job || c.videoUrl) return
        if (Date.now() - (c.job.debut || Date.now()) > DELAI_MAX_MS) { finEchec(idx, 'Délai dépassé (plus de 3 h) : la machine vidéo s\'est arrêtée.'); return }
        let e = null
        try {
          const q = new URLSearchParams({ commande_id: S.commandeId, slot: String(c.job.slot), execution: c.job.execution || '' })
          const r = await fetch(SERVER + '/video-jobs/status?' + q, { headers: { 'ngrok-skip-browser-warning': '1' } })
          if (r.ok) { e = await r.json(); erreursReseau = 0 } else erreursReseau++
        } catch (_) { erreursReseau++ }
        if (e) {
          const job = Object.assign(c.job, { etat: e.etat, etape: e.etape, pct: e.pct, run: e.run || c.job.run, cout_usd: e.cout_usd, secondes: e.secondes, monteur: e.monteur, historiqueUrl: e.historique_url || c.job.historiqueUrl, dossierUrl: e.dossier_url || c.job.dossierUrl })
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
    desc: 'Vidéo · ' + (c.job.ctNom || c.ct) + (duree ? ' · ' + duree + ' s' : ''),
    job: { ...c.job, etat: 'termine', pct: 100, etape: 'Vidéo prête', cout_usd: e.cout_usd, monteur: e.monteur, historiqueUrl: e.historique_url, dossierUrl: e.dossier_url, fin: Date.now() } }
  U.crea[idx] = { state: 'done', text: 'Vidéo prête', pct: 100 }; emit(); _save(true)
  toast('Vidéo de l\'angle ' + (c.angleIdx + 1) + ' prête.')
}
function finEchec(idx, msg) {
  const c = S.creatives[idx]
  S.creatives[idx] = { ...c, job: { ...(c.job || {}), etat: 'echec', erreur: String(msg).slice(0, 500) } }
  U.crea[idx] = { state: 'err', text: 'Échec de la vidéo', err: String(msg).slice(0, 300) }; emit(); _save(true)
}

// Reprise : après réouverture de la commande, on reprend le suivi des vidéos encore en cours sur le cloud.
export function reprendreVideos() {
  videoSlots().forEach(({ c, i }) => {
    if (c.videoUrl) return
    if (c.job && c.job.execution && c.job.etat !== 'echec') { U.crea[i] = { state: 'running', text: (c.job.etape || 'Reprise du suivi') + ' · ' + (c.job.pct || 0) + ' %', pct: c.job.pct || 0 }; suivre(i) }
    else if (c.job && c.job.etat === 'echec') U.crea[i] = { state: 'err', text: 'Échec de la vidéo', err: c.job.erreur || '' }
  })
}

// Toutes les vidéos de la production : choix des CT puis lancement en parallèle. Retourne une promesse qui se résout quand toutes sont finies.
export async function produireVideos() {
  const slots = videoSlots().filter((x) => !x.c.videoUrl && !jobEnCours(x.c))
  if (!slots.length) return Promise.all(videoSlots().map((x) => pollers.get(x.i)).filter(Boolean))
  if (!peutVideoCloud()) { U.agents[4] = { state: 'done', text: 'Vidéos non lancées : la production n\'est pas liée à une commande AdBoard.', pct: 100 }; emit(); return }
  U.agents[4] = { state: 'active', text: 'Choix des ' + slots.length + ' meilleurs CT vidéo, tous différents…', pct: 4 }; emit()
  let choix
  try { choix = await choisirCTVideo(slots.map((x) => x.c.angleIdx)) }
  catch (e) { slots.forEach(({ i }) => finEchec(i, e.message)); U.agents[4] = { state: 'done', text: 'Choix des CT vidéo impossible : ' + e.message, pct: 100 }; emit(); return }
  U.agents[4] = { state: 'active', text: 'Tournage de ' + slots.length + ' vidéos en parallèle sur le cloud', pct: 8 }; emit()
  const jobs = choix.map((ct) => {
    const s = slots.find((x) => x.c.angleIdx === ct.angleIdx)
    if (!s) return Promise.resolve()
    return lancerVideo(s.i, ct).catch((e) => finEchec(s.i, e.message))
  })
  const maj = setInterval(majAgentVideo, 3000)
  try { await Promise.all(jobs) } finally { clearInterval(maj); majAgentVideo(true) }
}
export function majAgentVideo(fin = false) {
  const v = videoSlots(); if (!v.length) return
  const pret = v.filter((x) => x.c.videoUrl).length, ko = v.filter((x) => x.c.job && x.c.job.etat === 'echec').length
  const pct = Math.round(v.reduce((s, x) => s + (x.c.videoUrl ? 100 : ((x.c.job && x.c.job.pct) || 0)), 0) / v.length)
  if (fin || pret + ko === v.length) U.agents[4] = { state: ko === v.length ? 'error' : 'done', text: pret + ' / ' + v.length + ' vidéos prêtes' + (ko ? ' · ' + ko + ' en échec (relançable)' : ''), pct: 100 }
  else U.agents[4] = { state: 'active', text: pret + ' / ' + v.length + ' vidéos prêtes · en cours : ' + pct + ' %', pct }
  emit()
}

// « Refaire cette vidéo » (même CT) ou « Autre CT » (un autre concept, jamais un CT déjà pris dans la commande)
export async function relancerVideo(idx, { autreCT = false } = {}) {
  const c = S.creatives[idx]; if (!estSlotVideo(c)) return
  U.crea[idx] = { state: 'running', text: autreCT ? 'Choix d\'un autre CT vidéo…' : 'Relance de la vidéo…', pct: 0 }; emit()
  try {
    let ct = { id: c.job && c.job.ct || c.ct, nom: c.job && c.job.ctNom, raison: c.ctRaison, poster: c.job && c.job.poster }
    if (autreCT || !ct.id) {
      const pris = new Set(S.creatives.map((x) => x.job && x.job.ct).filter(Boolean))
      ;[ct] = await choisirCTVideo([c.angleIdx], pris)
    }
    S.creatives[idx] = { ...c, videoUrl: null, thumbUrl: null }
    await lancerVideo(idx, ct, { forcer: true })
  } catch (e) { finEchec(idx, e.message) }
  majAgentVideo()
}
