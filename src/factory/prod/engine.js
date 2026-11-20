// Moteur de production — même logique que l'ancien Factory (prodv2*), sans aucun affichage :
// il met à jour l'état (state.js) et l'interface React se redessine toute seule.
import { prodv2State as S, SERVER, COMP_FILES, CT_IMAGES, emit, loadSkills } from './state'
import * as V from './verbatim'
import { ctGetBase64, loadCTImages } from '../ctApi'
import { r2Put, videoInfos } from '../r2'
import { confirmDlg, alertDlg, toast } from '../ui'
import * as VID from './video'
import * as PL from './plan'
import * as APP from './apprentissage' // appr-client-v1
import * as CDC from './cdc' // cdc-franchise-v1
import * as VER from './verite' // verite-v1
import * as REP from './reprise' // reprise-angle-v1
import * as SEN from './sensible' // meta-sensible-v1

const JH = { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' }
const NGROK = { 'ngrok-skip-browser-warning': '1' }
const U = S.ui
// ── reprise-production-v1 — reprise après rechargement de la page (onglet mis en veille par Chrome, F5, plantage) ──
// Le serveur garde l'hypothèse payée (clé = commande + numéro de lot) ; ici on garde de quoi retrouver la production en cours.
const CLE_MARQUEUR = 'adstack_active_production'
const PHASES_ACTIVES = ['hypothese', 'plan', 'production']
const lireMarqueur = () => { try { const m = JSON.parse(localStorage.getItem(CLE_MARQUEUR) || 'null'); return m && m.commandeId ? m : null } catch (_) { return null } }
const poserMarqueur = (commandeId, lotId, phase) => { try { localStorage.setItem(CLE_MARQUEUR, JSON.stringify({ commandeId, lotId, phase, ts: Date.now() })) } catch (_) {} }
const phaseMarqueur = (phase) => { const m = lireMarqueur(); if (m && m.commandeId === S.commandeId) poserMarqueur(m.commandeId, m.lotId, phase) }
const marqueurInterrompu = (commandeId) => { const m = lireMarqueur(); return m && m.commandeId === commandeId && PHASES_ACTIVES.includes(m.phase) && Date.now() - (m.ts || 0) < 12 * 3600 * 1000 ? m : null }
const nouveauLotId = () => 'lot-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
let lotCourant = null
let abortCtl = null
let autosaveTimer = null
VID.brancherSauvegarde((immediat) => autosave(immediat))
export const isRunning = () => U.running
export const refresh = () => emit()

// ── petits utilitaires d'état ──
export function setAgent(i, state, text, pct) {
  const a = U.agents[i]; a.state = state
  if (text) a.text = text
  if (typeof pct === 'number') a.pct = pct
  emit()
}
const resetAgents = () => {
  U.agents[1] = { state: 'pending', text: 'En attente', pct: 0 }
  U.agents[2] = { state: 'pending', text: 'En attente — 2 images par angle', pct: 0 }
  U.agents[3] = { state: 'pending', text: 'En attente — 5 hooks + 1 description par angle', pct: 0 }
  U.agents[4] = { state: 'pending', text: 'En attente — 1 vidéo par angle, tournée sur le cloud', pct: 0 }
}
const done = (c) => !!c && (c.imgB64 || c.url || c.videoUrl)
// v8 — VIDÉO EN MANUEL : chaque angle = 1 emplacement vidéo (importée depuis le Video Lab) + 2 images (Solution Aware, Product Aware).
// La génération vidéo automatique est désactivée tant que l'agent Créative Vidéo n'est pas terminé.
export const VIDEO_AUTO = true   // v9 : les vidéos se tournent automatiquement sur le moteur Cloud Run (import manuel toujours possible)
export const estSlotVideo = (c) => !!c && c.kind === 'video'
export const nbCrea = () => S.creatives.filter(done).length
export const nbCopy = () => S.copies.filter(Boolean).length
export const angleCount = () => V.prodv2GetAngleCount()
export const estComplet = () => V.prodv2EstActuellementComplet()
export const livrablesPayload = () => JSON.stringify({ verites: S.verites || null, marque_affichee: typeof S.marqueAffichee === 'string' ? S.marqueAffichee : null, creatives: S.creatives, copies: S.copies, synthesis: S.synthesis, angles: S.angles, marche: S.marche, couts: S.couts || null, planNiveaux: S.planNiveaux || null, planApprentissage: S.planApprentissage || null })

// ── Sauvegarde automatique des livrables sur la commande ──
export function autosave(immediat = false) {
  if (S.briefSource !== 'commande' || !S.commandeId) return
  clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(async () => {
    try { await fetch(`${SERVER}/commandes/${S.commandeId}/save-deliverables`, { method: 'POST', headers: JH, body: livrablesPayload() }) }
    catch (e) { console.warn('[Commande] Autosave échoué :', e.message) }
  }, immediat ? 0 : 800)
}
export function installUnloadSave() {
  const h = () => {
    if (document.visibilityState !== 'hidden') return
    if (S.briefSource !== 'commande' || !S.commandeId) return
    try { navigator.sendBeacon(`${SERVER}/commandes/${S.commandeId}/save-deliverables`, new Blob([livrablesPayload()], { type: 'application/json' })) } catch (_) {}
  }
  document.addEventListener('visibilitychange', h)
  return () => document.removeEventListener('visibilitychange', h)
}

// ── Brief : fichier manuel ──
const parseImg = (v, defMime) => {
  if (!v) return null
  if (typeof v === 'object' && v.data) return { mime: v.mime || defMime, data: v.data }
  if (typeof v === 'string') { const m = v.match(/^data:(image\/[a-z]+);base64,(.+)$/); return m ? { mime: m[1], data: m[2] } : { mime: 'image/jpeg', data: v } }
  return null
}
export async function loadBriefFile(file) {
  if (!file) return
  const raw = await file.text()
  let brief
  try { brief = JSON.parse(raw) } catch (e) { await alertDlg('brief.json invalide : ' + e.message); return }
  if (S.commandeId && !V.prodv2EstActuellementComplet()) {
    const nomActuel = S.brief?.product?.nom || S.brief?.produit || 'la production en cours'
    if (!(await confirmDlg(`"${nomActuel}" est encore en cours de génération (pas encore terminée). Charger ce nouveau brief maintenant risque de perdre ce qui n'est pas encore sauvegardé.\n\nContinuer quand même ?`))) return
  }
  brief.__manualUpload = true
  S.briefSource = 'manuel'; S.commandeId = null; S.brief = brief; S.briefRaw = raw
  const p = parseImg(brief.photo_produit, 'image/png'); if (p) { S.productMime = p.mime; S.productB64 = p.data }
  const l = parseImg(brief.logo, 'image/png'); if (l) { S.logoMime = l.mime; S.logoB64 = l.data }
  U.banner = null; U.renewal = null
  emit()
}
export function replacePhoto(file) {
  if (!file) return
  const r = new FileReader()
  r.onload = (e) => { const m = String(e.target.result).match(/^data:(image\/[a-z]+);base64,(.+)$/); if (m) { S.productMime = m[1]; S.productB64 = m[2] } emit() }
  r.readAsDataURL(file)
}
export function removePhoto() { S.productB64 = null; S.productMime = null; emit() }

// ── Brief depuis une commande AdBoard ──
// Brief de production construit depuis une commande (même construction pour la production et les tests d'agents)
export function commandeToBrief(b) {
  const p = b.product || {}
  const brief = {
    marque: p.marque || '', produit: p.nom, pays: p.pays || '',
    marches: Array.isArray(p.marches) ? p.marches : [], marches_ecartes: Array.isArray(p.marches_ecartes) ? p.marches_ecartes : [],
    prix_par_pays: (p.prix_par_pays && typeof p.prix_par_pays === 'object') ? p.prix_par_pays : {},
    prix_affichable: p.prix_affichable !== false, pricing: p.pricing || '',
    cible: p.cible_auto ? '' : (p.cible || ''), cible_suggeree: p.cible_auto ? (p.cible || '') : '',
    garantie: p.garantie || '', livraison_paiement: p.livraison_paiement || '',
    avis_textes: Array.isArray(p.avis_textes) ? p.avis_textes : [], logo_url: p.logo_url || '', notes: p.notes || '',
    documents: Array.isArray(p.documents) ? p.documents.filter((d) => d && d.url).slice(0, 5) : [],
    galerie_images: Array.isArray(p.galerie_images) ? p.galerie_images.slice(0, 10) : [],
    galerie_aspects: (p.galerie_aspects && typeof p.galerie_aspects === 'object') ? p.galerie_aspects : {},
    photos_produit: Array.isArray(p.photos_produit) ? p.photos_produit.filter((x) => x && x.aspect).slice(0, 6) : [],
    packaging_images: Array.isArray(p.packaging_images) ? p.packaging_images.slice(0, 2) : [],
    avis_captures_nb: Array.isArray(p.avis_captures) ? p.avis_captures.length : 0,
    avis_captures: Array.isArray(p.avis_captures) ? p.avis_captures.slice(0, 8) : [],
    utilite: p.utilite || '', couleurs: p.couleurs || [], quantite: b.quantity || 6, promo: p.promo || '',
    lien_page_produit: p.lien_page_produit || '',
  }
  return brief
}

export async function commandePhoto(b) {
  const p = b.product || {}
  const photoData = b.photo_nobg || p.photo_base64 || ''
  if (photoData) {
    const m = photoData.match(/^data:(image\/[a-z]+);base64,(.+)$/)
    return m ? { mime: m[1], b64: m[2] } : { mime: 'image/png', b64: photoData }
  }
  if (p.photo_url) {
    try {
      const imgResp = await V.fetchAvecTimeout(p.photo_url, {}, 15000)
      if (!imgResp.ok) throw new Error('HTTP ' + imgResp.status)
      const blob = await imgResp.blob()
      const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob) })
      const m = String(dataUrl).match(/^data:(image\/[a-z]+);base64,(.+)$/)
      if (m) return { mime: m[1], b64: m[2] }
    } catch (e) { console.warn('[Commande] photo_url échouée :', e.message) }
  }
  return null
}

export async function loadBriefFromCommande(b) {
  const p = b.product || {}
  const brief = commandeToBrief(b)
  S.brief = brief; S.briefRaw = JSON.stringify(brief, null, 2); S.briefSource = 'commande'; S.commandeId = b.id; S.productId = p.id || null
  S.verites = null; S.marqueAffichee = undefined   // verite-v1 : jamais la fiche d'une autre commande
  S.reprise = (b.reprise && b.reprise.creative_id) ? b.reprise : null   // reprise-angle-v1 : la créative que le client veut voir refaite
  try { const m = lireMarqueur(); if (!m || m.commandeId !== b.id) localStorage.setItem(CLE_MARQUEUR, JSON.stringify({ commandeId: b.id, ts: Date.now() })) } catch (_) {}   // reprise-production-v1 : ne jamais écraser le marqueur (phase, numéro de lot) d'une production à reprendre
  const photoData = b.photo_nobg || p.photo_base64 || ''
  if (photoData) {
    const m = photoData.match(/^data:(image\/[a-z]+);base64,(.+)$/)
    if (m) { S.productMime = m[1]; S.productB64 = m[2] } else { S.productMime = 'image/png'; S.productB64 = photoData }
  } else if (p.photo_url) {
    try {
      const imgResp = await V.fetchAvecTimeout(p.photo_url, {}, 15000)
      if (!imgResp.ok) throw new Error('HTTP ' + imgResp.status)
      const blob = await imgResp.blob()
      const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob) })
      const m = String(dataUrl).match(/^data:(image\/[a-z]+);base64,(.+)$/)
      if (m) { S.productMime = m[1]; S.productB64 = m[2] }
    } catch (e) { console.warn('[Commande] Récupération photo_url échouée :', e.message); S.productB64 = null; S.productMime = null }
  } else { S.productB64 = null; S.productMime = null }
  S.logoB64 = null; S.logoMime = null; S.renewalContext = null; U.renewal = null
  // v10 — le logo du client est chargé : il est envoyé tel quel au générateur d'images et au contrôle qualité
  if (brief.logo_url) {
    try {
      const r = await V.fetchAvecTimeout(brief.logo_url, {}, 15000)
      if (r.ok) { const blob = await r.blob(); const du = await new Promise((ok, ko) => { const f = new FileReader(); f.onload = () => ok(f.result); f.onerror = ko; f.readAsDataURL(blob) }); const m = String(du).match(/^data:(image\/[a-z+]+);base64,(.+)$/); if (m && /png|jpeg|webp/.test(m[1])) { S.logoMime = m[1]; S.logoB64 = m[2] } }
    } catch (e) { console.warn('[Commande] Logo non chargé :', e.message) }
  }
  if (S.productId) {
    try {
      const nbA = (() => { try { return V.prodv2GetAngleCount() } catch (_) { return 4 } })()
      const rc = await V.fetchAvecTimeout(`${SERVER}/products/${S.productId}/renewal-context?nb_angles=${nbA}`, { headers: NGROK }, 25000)
      S.renewalContext = await rc.json()
    } catch (e) { console.warn('[Renouvellement] Récupération du contexte échouée :', e.message) }
  }
  const rctx = S.renewalContext
  if (rctx) {
    if (rctx.commandeActiveAilleurs) U.renewal = { kind: 'warn', text: "Une autre commande est déjà en production pour ce produit — attends qu'elle se termine avant de lancer celle-ci, pour que l'historique d'angles reste cohérent." }
    else if (rctx.estRenouvellement) U.renewal = { kind: 'info', text: rctx.rotationNecessaire
      ? `Renouvellement pour ce produit — dernière cible utilisée : "${rctx.cibleActuelle || '?'}" (${rctx.nbAnglesCibleCourante} angles déjà exploités, seuil atteint). Si tu gardes la même cible, une rotation vers une cible élargie sera proposée. Si tu as changé la cible dans la fiche produit, elle sera prise en compte à la place.`
      : `Renouvellement pour ce produit — dernière cible utilisée : "${rctx.cibleActuelle || '?'}" (${rctx.nbAnglesCibleCourante}/18 angles déjà exploités sur elle). Si tu as changé la cible dans la fiche produit, la nouvelle sera utilisée à la place — ceci n'est qu'un rappel du dernier lot, pas une décision déjà prise.` }
  }
  { const ap = rctx && rctx.apprentissage; if (ap && ap.resume && !rctx.commandeActiveAilleurs) U.renewal = { kind: (U.renewal && U.renewal.kind) || 'info', text: (U.renewal ? U.renewal.text + ' ' : '') + 'Apprentissage de ce client : ' + ap.resume + '.' } }
  emit()
}

// ── Retour sur une production interrompue (page rechargée) : l'écran dit où elle en était, l'hypothèse est récupérée sur le serveur ──
const texteInterruption = (hypo, nc, np, nbTot, nbAngles) =>
  (document.wasDiscarded ? "Chrome avait mis cet onglet en veille, puis l'a rechargé. " : 'La page a été rechargée pendant la production. ') +
  "Rien n'est perdu : " + (hypo ? "l'hypothèse est sauvegardée" : "l'hypothèse est en cours de récupération sur le serveur") +
  (nc || np ? ` · ${nc}/${nbTot} créatives et ${np}/${nbAngles} sets ad copy déjà faits` : '') +
  ". Clique « Reprendre la production » : seul ce qui manque est produit, rien n'est repayé."
async function recupererHypotheseServeur(mq) {
  const cmd0 = S.commandeId
  if (!mq || !mq.lotId || !cmd0 || U.running || S.synthesis) return
  setAgent(1, 'active', "Récupération de l'hypothèse déjà payée sur le serveur…", 40)
  try {
    const r = await V.fetchAvecTimeout(`${SERVER}/analyste-reprise`, { method: 'POST', headers: JH, body: JSON.stringify({ commandeId: cmd0, lotId: mq.lotId }) }, 480000)
    const d = r.ok ? await r.json().catch(() => ({})) : {}
    if (S.commandeId !== cmd0 || U.running || S.synthesis) return
    if (!d || !d.text) { setAgent(1, 'pending', "Hypothèse introuvable sur le serveur : « Reprendre la production » la refera (coût d'une hypothèse).", 0); return }
    const nbAngles = U.nbAngles || V.prodv2GetAngleCount()
    const { synthesisText, marche } = V.prodv2SplitSynthesisAndMarche(d.text)
    S.synthesis = synthesisText; S.marche = marche; S.angles = V.anglesProduction(synthesisText, nbAngles)
    setAgent(1, 'done', `Synthèse récupérée sur le serveur · ${Math.round(synthesisText.length / 1000)}K · ${nbAngles} angles · déjà payée, rien à repayer`, 100)
    U.banner = { kind: 'warn', text: texteInterruption(true, S.creatives.filter(done).length, S.copies.filter(Boolean).length, nbAngles * 3, nbAngles) }
    autosave(true); emit()
  } catch (e) {
    if (S.commandeId === cmd0 && !U.running && !S.synthesis) setAgent(1, 'pending', 'Récupération impossible (' + String(e.message || e).slice(0, 80) + ') : « Reprendre la production » refera l\'hypothèse si besoin.', 0)
  }
}
// Y a-t-il quelque chose à reprendre ? (production interrompue, arrêtée ou incomplète — jamais une commande déjà livrée)
export function lotIncomplet() {
  const n = U.nbAngles || 0
  if (!n) return false
  if (!S.synthesis) return true
  if (S.creatives.length < n * 3) return true
  if (S.creatives.some((c) => !estSlotVideo(c) && !done(c))) return true
  return S.copies.filter(Boolean).length < n
}
export const peutReprendre = () => !U.running && !U.dejaLivre && S.briefSource === 'commande' && !!S.commandeId && !!S.brief && !!S.productB64 && (!!U.interrompu || lotIncomplet())
// Fermer ou recharger la page pendant une production : le navigateur demande confirmation.
export function installGardeFermeture() {
  const h = (e) => { if (!U.running) return; e.preventDefault(); e.returnValue = '' }
  window.addEventListener('beforeunload', h)
  return () => window.removeEventListener('beforeunload', h)
}

// ── Reprendre l'affichage d'une commande (livrables déjà générés) ──
export async function restoreFromCommande(b) {
  const dejaLivre = b.status === 'done'
  const d = b.deliverables || {}
  const nc = d.creatives ? d.creatives.filter(done).length : 0
  const np = d.copies ? d.copies.filter(Boolean).length : 0
  await loadBriefFromCommande(b)
  S.synthesis = d.synthesis || null; S.creatives = d.creatives || []; S.copies = d.copies || []; S.marche = d.marche || null; S.planNiveaux = d.planNiveaux || null; S.planApprentissage = d.planApprentissage || null
  S.verites = Array.isArray(d.verites) ? d.verites : null; S.marqueAffichee = typeof d.marque_affichee === 'string' ? d.marque_affichee : undefined   // verite-v1
  // v10 : le nombre d'angles vient de la quantité commandée (6 créatives = 2 angles), jamais du nombre d'angles écrits dans la synthèse
  const nbAngles = Math.max(V.prodv2GetAngleCount(), Math.ceil(S.creatives.length / 3))
  S.angles = (d.angles || []).slice(0, nbAngles)
  if (S.copies.length > nbAngles) S.copies = S.copies.slice(0, nbAngles)
  const nbTot = nbAngles * 3
  U.nbAngles = nbAngles; S.activeAngle = 0; U.synOpen = false; U.sending = {}
  resetAgents()
  U.crea = Array.from({ length: nbTot }, (_, i) => { const it = S.creatives[i]; if (estSlotVideo(it)) return it.videoUrl ? { state: 'done', text: 'Vidéo prête' } : VID.jobEnCours(it) ? { state: 'running', text: (it.job.etape || 'Reprise du suivi') + ' · ' + (it.job.pct || 0) + ' %', pct: it.job.pct || 0 } : (it.job && it.job.etat === 'echec') ? { state: 'err', text: 'Échec de la vidéo', err: it.job.erreur || '' } : { state: 'video', text: 'Vidéo à lancer' }; return it && it.status === 'done' ? { state: 'done', text: 'Prêt' } : { state: 'pending', text: 'En attente' } })
  U.copy = Array.from({ length: nbAngles }, (_, i) => ({ state: S.copies[i] ? 'done' : 'wait' }))
  if (dejaLivre) { try { localStorage.removeItem('adstack_active_production') } catch (_) {} }
  const nom = b.product?.nom || '?'
  const mq = dejaLivre ? null : marqueurInterrompu(b.id)   // une production tournait quand la page a été perdue
  U.interrompu = !!mq; U.dejaLivre = dejaLivre
  U.banner = { kind: dejaLivre || nc || np ? 'info' : 'info', text: dejaLivre
    ? `Cette commande a déjà été livrée au client — "${nom}" (${nc}/${nbTot} créatives, ${np}/${nbAngles} sets ad copy). Affichage en lecture seule.`
    : nc || np ? `Contenu déjà généré restauré — "${nom}" (${nc}/${nbTot} créatives, ${np}/${nbAngles} sets ad copy déjà sauvegardés). Rien n'a été perdu.`
    : `Brief chargé — "${nom}". Aucune génération n'a encore commencé.` }
  if (mq) U.banner = { kind: 'warn', text: texteInterruption(!!S.synthesis, nc, np, nbTot, nbAngles) }
  U.launched = !(nc === 0 && np === 0) || S.creatives.some((c) => c && c.job) || !!mq
  if (U.launched) {
    if (S.synthesis) setAgent(1, 'done', `Synthèse · ${Math.round(S.synthesis.length / 1000)}K chars · ${nbAngles} angles extraits`, 100)
    setAgent(2, nc === nbTot ? 'done' : 'pending', `${nc} / ${nbTot} créatives générées${nc === nbTot ? '' : ' · à compléter'}`, Math.round(nc / nbTot * 100))
    setAgent(3, np === nbAngles ? 'done' : 'pending', `${np} / ${nbAngles} sets ad copy générés${np === nbAngles ? '' : ' · à compléter'}`, Math.round(np / nbAngles * 100))
    VID.majAgentVideo()
    U.launchLabel = 'Relancer la production'
  } else U.launchLabel = 'Lancer la production'
  U.running = false
  emit()
  VID.reprendreVideos(); VID.majAgentVideo()
  if (mq && !S.synthesis) recupererHypotheseServeur(mq)   // gratuit : le serveur rend l'hypothèse déjà payée, ou répond « absente » sans rien calculer
}

// Ouvre une commande dans la production (équivalent de « Lancer / Ouvrir » de l'ancien Factory).
export async function openCommande(id) {
  if (S.commandeId && S.commandeId !== id && !V.prodv2EstActuellementComplet()) {
    const nomActuel = S.brief?.produit || 'la production en cours'
    if (!(await confirmDlg(`"${nomActuel}" est encore en cours de génération (pas encore terminée). La quitter maintenant risque de perdre ce qui n'est pas encore sauvegardé.\n\nContinuer quand même ?`))) return false
  }
  if (U.running && S.commandeId === id) return true
  if (U.running) { await alertDlg("Une production est en cours sur cet écran. Annule-la ou attends sa fin avant d'ouvrir une autre commande."); return false }
  try {
    await loadSkills(); await loadCTImages()
    await fetch(`${SERVER}/commandes/${id}/start`, { method: 'POST', headers: NGROK })
    const briefs = await fetch(`${SERVER}/commandes`, { headers: NGROK }).then((r) => r.json()).catch(() => [])
    const b = briefs.find((x) => x.id === id)
    if (!b) { await alertDlg('Commande introuvable.'); return false }
    await restoreFromCommande(b)
    return true
  } catch (e) { await alertDlg('Erreur : ' + e.message); return false }
}

// Reprise automatique après fermeture de l'onglet
export async function checkResume() {
  if (S.brief) return
  let marker
  try { marker = JSON.parse(localStorage.getItem('adstack_active_production') || 'null') } catch (_) { return }
  if (!marker || !marker.commandeId) return
  U.resuming = true; U.resumeError = ''; emit()
  const t = setTimeout(() => { if (U.resuming) { U.resuming = false; U.resumeError = 'La reprise a pris trop de temps. Réessaie de rafraîchir, ou recharge le brief manuellement.'; emit() } }, 20000)
  try {
    await loadSkills(); await loadCTImages()
    const briefs = await V.fetchAvecTimeout(`${SERVER}/commandes`, { headers: NGROK }, 15000).then((r) => r.json())
    const b = briefs.find((x) => x.id === marker.commandeId)
    if (!b || b.status === 'cancelled' || b.status === 'probleme_agence') { clearTimeout(t); localStorage.removeItem('adstack_active_production'); U.resuming = false; emit(); return }
    clearTimeout(t); await restoreFromCommande(b); U.resuming = false; emit()
  } catch (e) { console.warn('[Reprise] Échec :', e.message); clearTimeout(t); U.resuming = false; emit() }
}

// ── Lancer la production complète (v10) ──
// Un seul lancement à la fois (verrou posé AVANT tout await : un double clic ne peut plus lancer deux productions).
// Chaque lancement a un numéro : tout résultat d'un lancement annulé ou remplacé est ignoré.
// Ordre : hypothèse → plan des niveaux de conscience + CT vidéo → [vidéos cloud ∥ images (2 à la fois, contrôle qualité) ∥ ad copies].
const IMG_PARALLELES = 2                 // au-delà, Gemini Image renvoie des 429 (quota du projet)
const COUT = { choixCT: 0.08, prompt: 0.12, image: 0.14, qa: 0.03, copie: 0.10 }   // estimations prudentes (USD)
const BUDGET_HORS_VIDEO_6 = 5            // 5 $ pour 6 créatives (hypothèse, ad copies, images, corrections) — proportionnel au volume
const MAX_CORRECTIONS = 2
let verrou = false, runCourant = 0
const annule = () => new DOMException('Annulé', 'AbortError')
export const budgetHorsVideo = (nbTot) => Math.round(BUDGET_HORS_VIDEO_6 * Math.max(6, nbTot) / 6 * 100) / 100
function depenser(usd, poste) {
  if (!S.budget) return
  S.budget.depense = Math.round((S.budget.depense + usd) * 1000) / 1000
  S.budget.postes[poste] = Math.round(((S.budget.postes[poste] || 0) + usd) * 1000) / 1000
}
const resteBudget = () => (S.budget ? S.budget.total - S.budget.depense : 0)

export async function launch() { return lancer(false) }
// Reprise : même lot, même génération — seul ce qui manque est produit (jamais de nouvelle hypothèse payée si elle existe déjà).
export async function reprendre() { return lancer(true) }
async function lancer(reprise) {
  if (verrou || U.running) { toast('Une production est déjà en cours sur cet écran.'); return }
  verrou = true; U.running = true; U.launchLabel = reprise ? 'Reprise…' : 'Préparation…'; emit()
  try { await lancerProduction(reprise) }
  finally { verrou = false }
}
async function lancerProduction(reprise = false) {
  const stop = (msg) => { U.running = false; U.launchLabel = 'Générer tous les livrables'; emit(); if (msg) alertDlg(msg) }
  if (!S.brief || !S.productB64) return stop('Charge une commande avec sa photo produit avant de lancer.')
  const aDejaDuContenu = S.creatives.some(done) || S.copies.some(Boolean)
  if (aDejaDuContenu && !reprise && !(await confirmDlg("Relancer la production ?\n\nLe lot actuel (déjà généré, éventuellement déjà envoyé) sera ABANDONNÉ — y compris chez le client si tu l'avais déjà envoyé.\n\nLe nouveau lot sera le SEUL valide à partir de maintenant.", { ok: 'Relancer', danger: true }))) return stop()
  if ((S.briefSource !== 'commande' || !S.commandeId) && !(await confirmDlg("Cette production N'EST PAS liée à une commande.\n\nPas de sauvegarde automatique, et pas de vidéo automatique (le moteur vidéo lit la commande).\n\nContinuer quand même (test) ?"))) return stop()
  if (S.renewalContext?.commandeActiveAilleurs) return stop("Une autre commande est déjà en production pour ce produit.\n\nAttends qu'elle se termine (ou soit envoyée au client) avant de lancer celle-ci.")
  if (!reprise && VID.videoSlots().some((x) => VID.jobEnCours(x.c))) return stop("Des vidéos de cette commande tournent encore sur le cloud.\n\nAttends leur fin, ou arrête-les avec « Annuler », avant de relancer.")
  const monRun = ++runCourant
  dernierDossier = null
  abortCtl = new AbortController()
  const signal = abortCtl.signal
  const actif = () => runCourant === monRun && !signal.aborted
  const verifier = () => { if (!actif()) throw annule() }
  try {
    await loadSkills(); await loadCTImages(); verifier()
    S.startTime = Date.now()
    { const m0 = reprise ? lireMarqueur() : null; lotCourant = (m0 && m0.commandeId === S.commandeId && m0.lotId) || nouveauLotId() }
    if (S.commandeId) {
      // generation-started = VRAI départ d'une génération (le serveur change la version du lot et remet le suivi d'envoi à zéro) : jamais en reprise.
      if (!reprise) fetch(`${SERVER}/commandes/${S.commandeId}/generation-started`, { method: 'POST' }).catch(() => {})
      poserMarqueur(S.commandeId, lotCourant, 'hypothese')
    }
    const nbAngles = V.prodv2GetAngleCount()
    const nbTot = nbAngles * 3
    const videoCloud = VID.peutVideoCloud() && !CDC.videosManuelles()   // cdc-franchise-v1
    const garde = !!reprise   // reprise : on garde l'hypothèse, le plan, les images, les ad copies et les vidéos déjà là
    if (!garde) { S.synthesis = null; S.angles = []; S.creatives = []; S.copies = []; S.marche = null; S.planNiveaux = null; S.planApprentissage = null; S.verites = null; S.marqueAffichee = undefined }
    { const cp0 = S.couts || {}; S.budget = { total: budgetHorsVideo(nbTot), depense: garde ? Number(cp0.hors_video || 0) : 0, postes: garde ? { ...(cp0.postes || {}) } : {} } }
    U.nbAngles = nbAngles; S.activeAngle = 0; U.synOpen = false; U.sending = {}; U.banner = null; U.vjournal = {}; U.envoyeMoi = null; U.verif = null; U.interrompu = false; U.dejaLivre = false
    if (!garde || U.crea.length !== nbTot) U.crea = Array.from({ length: nbTot }, () => ({ state: 'pending', text: 'En attente du plan' }))
    if (!garde || U.copy.length !== nbAngles) U.copy = Array.from({ length: nbAngles }, () => ({ state: 'wait' }))
    resetAgents(); U.launched = true; U.launchLabel = reprise ? 'Reprise en cours…' : 'Production en cours…'; U.etapeDebut = Date.now(); U.finiLe = null; emit()
    if (videoCloud) VID.prechargerCTVideo()
    U.banner = reprise ? { kind: 'info', text: 'Reprise de la production : seul ce qui manque est produit — hypothèse, images, ad copies et vidéos déjà faites ne sont pas refaites, donc pas repayées.' } : { kind: 'info', text: `Lot de ${nbTot} créatives : ${nbAngles} angles × (1 vidéo + 2 images). Budget : ${S.budget.total.toFixed(2)} $ pour l'hypothèse, les ad copies, les images et leurs corrections, + jusqu'à ${BUDGET_VIDEO_MAX} $ par vidéo (tous les plans en Veo Fast).` }; emit()

    // ── 1. hypothèse de marché ──
    const hypoDejaLa = garde && !!S.synthesis
    let raw = null, bal = null
    if (!hypoDejaLa) {
      setAgent(1, 'active', 'Recherche multi-sources + synthèse S0→S7…', 20)
      const { analysteSystem, analysteParts } = await V.buildAnalysteInputs(nbAngles, nbTot)
      // commandeId + lotId : le serveur garde la réponse payée ; si la page est perdue, elle est retrouvée sans rien repayer.
      raw = await V.apiAnalysteSynthese(analysteSystem, analysteParts, 64000, S.brief, signal, false, { productId: S.productId, nbAngles, commandeId: S.commandeId || null, lotId: S.commandeId ? lotCourant : null })
      verifier()
      bal = V.dernierBalayage()
      depenser(V.dernierCout() ?? 0.5, 'hypothese')
    }
    if (!hypoDejaLa) try {
      const dg = await V.fetchAvecTimeout(`${SERVER}/lot/diagnostic`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ synthese: raw }) }, 10000)
      if (dg.ok) { const j = await dg.json(); S.diagnostic = j.diagnostic; if (j.diagnostic && j.diagnostic.aMigrer) U.banner = { kind: 'warn', text: `Hypothèse incomplète : ${j.diagnostic.maturite ? '' : 'profil de maturité de la cible absent ; '}${j.diagnostic.anglesSansRaisons.length ? 'raisons d\'acheter absentes sur les angles ' + j.diagnostic.anglesSansRaisons.join(', ') : ''}. La production continue.` } }
    } catch (_) {}
    verifier()
    if (!hypoDejaLa) {
      const { synthesisText, marche } = V.prodv2SplitSynthesisAndMarche(raw)
      S.synthesis = synthesisText; S.marche = marche; S.angles = V.anglesProduction(synthesisText, nbAngles)
      { const pr = REP.placerAngle(); if (pr && !pr.trouve) console.warn('[Reprise] l\'analyste n\'a pas écrit l\'angle demandé : il est remis tel quel en angle 1.') }   // reprise-angle-v1
      setAgent(1, 'done', `Synthèse · ${Math.round(synthesisText.length / 1000)}K · ${nbAngles} angles retenus${bal ? (bal.reutilise ? ' · hypothèse stockée réutilisée' : ' · nouveau balayage du marché') : ''}${marche ? '' : ' · ⚠ Données Marché non extraites'}`, 100)
    } else setAgent(1, 'done', `Synthèse déjà faite · ${Math.round(S.synthesis.length / 1000)}K · ${S.angles.length || nbAngles} angles · rien à repayer`, 100)
    phaseMarqueur('plan'); autosave(true)   // point de sauvegarde : l'hypothèse payée est dans la commande dès maintenant
    if (!Object.keys(CT_IMAGES).some((k) => !/_(mime|name|addedAt|meta|awareness|styleTags|niche)$/.test(k))) throw new Error('Galerie CT image vide — ajoute des CT dans la Galerie CT image.')

    // ── 2. plan des niveaux de conscience + CT des vidéos ──
    const planDeja = garde && !!S.planNiveaux && S.creatives.length === nbTot   // reprise : le plan, les CT choisis et les images déjà faites sont gardés
    let choixVideo = []
    // verite-v1 — en parallèle du plan (aucune attente ajoutée) : le nom de marque affichable et la fiche de vérité de chaque angle,
    // partagés ensuite par les images, les ad copies et les vidéos. Un échec ne bloque rien : chaque agent travaille alors comme avant.
    const veritePromise = (async () => {
      try { if (typeof S.marqueAffichee !== 'string') S.marqueAffichee = await VER.resoudreMarque(signal) } catch (_) { }
      try { if (!Array.isArray(S.verites) || !S.verites.some(Boolean)) { S.verites = await VER.fichesVerite(nbAngles, signal); depenser(0.05, 'hypothese') } } catch (e) { if (!actif()) throw annule(); console.warn('[Vérité] fiches non faites :', e.message); S.verites = null }
    })()
    if (!planDeja) {
    setAgent(4, 'active', videoCloud ? 'Plan des niveaux de conscience et choix des ' + nbAngles + ' CT vidéo (tous différents)…' : 'Plan des niveaux de conscience…', 4)
    let plan
    try { const r = await VID.planifier(nbAngles, { avecVideo: videoCloud }); plan = r.plan; choixVideo = r.choix
      // reprise-angle-v1 : la vidéo à refaire garde son CT (et le niveau de conscience de ce CT quand le parcours de l'angle le contient)
      if (videoCloud && REP.active() && REP.active().format === 'video') { choixVideo = REP.forcerVideo(choixVideo, await VID.prechargerCTVideo()); const nv = PL.cle(REP.active().niveau || ''); if (nv && plan[0] && Array.isArray(plan[0].niveaux) && plan[0].niveaux.includes(nv)) plan[0] = { ...plan[0], video: nv } } }
    catch (e) { plan = PL.planParDefaut(nbAngles); U.banner = { kind: 'warn', text: 'Choix des CT vidéo impossible (' + e.message + ') : les vidéos sont à lancer depuis leur carte.' } }
    verifier()
    S.planNiveaux = plan
    const slots = []
    plan.forEach((p, a) => {
      slots.push({ angleIdx: a, kind: 'video', ctIdx: 'video', niveau: p.video, rang: p.niveaux.indexOf(p.video), ct: null, status: 'pending' })
      PL.niveauxImages(p).forEach((niv) => slots.push({ angleIdx: a, ctIdx: niv, niveau: niv, rang: p.niveaux.indexOf(niv), ct: null, status: 'pending' }))
    })
    APP.construirePlan(slots); { const m = APP.messagePlan(); if (m) U.banner = { kind: m.kind, text: (U.banner ? U.banner.text + ' ' : '') + m.text } }
    REP.forcerImage(slots); { const m = REP.message(); if (m) U.banner = { kind: 'info', text: (U.banner ? U.banner.text + ' ' : '') + m } }   // reprise-angle-v1
    S.creatives = slots
    U.crea = slots.map((c) => estSlotVideo(c) ? (videoCloud && choixVideo.some((x) => x.angleIdx === c.angleIdx) ? { state: 'running', text: 'En file', pct: 0 } : { state: 'video', text: 'Vidéo à lancer' }) : { state: 'pending', text: 'En attente' })
    emit()
    }
    await veritePromise; verifier()
    { const a = SEN.analyser(); if (a.niveau) U.banner = { kind: 'info', text: (U.banner ? U.banner.text + ' ' : '') + 'Produit sensible sur Meta (' + a.libelle + ') : formulations adaptées sans perdre le ton, CT avec mention préférés, mention légale posée sur chaque image et chaque vidéo.' } }   // meta-sensible-v1
    phaseMarqueur('production')
    // La commande reçoit tout de suite la synthèse et les angles : le moteur vidéo les lit pour fabriquer les vidéos.
    let sauveOk = true
    if (S.briefSource === 'commande' && S.commandeId) {
      try { const r = await fetch(`${SERVER}/commandes/${S.commandeId}/save-deliverables`, { method: 'POST', headers: JH, body: livrablesPayload(), signal }); sauveOk = r.ok } catch (e) { if (!actif()) throw annule(); sauveOk = false }
    }
    verifier()

    // ── 3. vidéos (cloud, en parallèle de tout le reste) ──
    let videosPromise = Promise.resolve()
    if (planDeja) { VID.reprendreVideos(); VID.majAgentVideo() }   // reprise : on reprend le suivi des vidéos déjà lancées ; les vidéos manquantes se lancent depuis leur carte (jamais toutes seules)
    else if (videoCloud && sauveOk && choixVideo.length) videosPromise = VID.produireVideos(choixVideo, actif).catch((err) => { console.error('Erreur vidéos :', err); setAgent(4, 'error', 'Erreur : ' + err.message, 0) })
    else if (videoCloud) { setAgent(4, 'error', sauveOk ? 'Aucun CT vidéo choisi : lance les vidéos depuis leur carte.' : 'Sauvegarde de la commande impossible : les vidéos n\'ont pas été lancées (relance-les depuis leur carte).', 0); S.creatives.forEach((c, i) => { if (estSlotVideo(c)) U.crea[i] = { state: 'video', text: 'Vidéo à lancer' } }); emit() }
    else setAgent(4, 'pending', CDC.videosManuelles() ? 'Vidéos : à lancer à la main depuis leur carte, après validation des ad copies par le propriétaire' : 'Vidéos : import manuel (production non liée à une commande)', 0)

    // ── 4. images (2 à la fois, contrôle qualité) et ad copies (toutes en parallèle) ──
    const toutesImg = S.creatives.map((c, i) => i).filter((i) => !estSlotVideo(S.creatives[i]))
    const aFaire = toutesImg.filter((i) => !done(S.creatives[i]))   // reprise : les images déjà faites ne sont pas refaites
    const nbImg = toutesImg.length
    let faites = nbImg - aFaire.length
    setAgent(2, 'active', `${faites} / ${nbImg} images`, Math.round(faites / Math.max(1, nbImg) * 100))
    setAgent(3, 'active', 'Écriture des hooks et descriptions…', 10)
    let chaineCT = Promise.resolve()   // les choix de CT se font un par un (diversité du lot) ; les générations tournent en parallèle
    const choisirCT = (idx) => {
      const p = chaineCT.then(async () => {
        verifier()
        const c = S.creatives[idx]
        U.crea[idx] = { state: 'running', text: 'Choix du CT par l\'agent' }; emit()
        const deja = new Set(S.creatives.map((x) => x.ct).filter(Boolean))
        let ctId, ctRaison = ''
        try { const r = await V.choisirCTProd(c.angleIdx, c.niveau, deja, signal, c.rang, c); ctId = r.id; ctRaison = r.raison; depenser(COUT.choixCT, 'images') }
        catch (errCT) {
          if (!actif()) throw annule()
          const sec = V.ctSecours(c.niveau, deja)
          if (!sec) throw new Error('Aucun CT disponible : ' + errCT.message)
          ctId = sec.id; ctRaison = 'CT de secours (agent indisponible : ' + errCT.message + ')' + (sec.bonNiveau ? '' : ' — aucun CT balisé à ce niveau')
        }
        verifier()
        S.creatives[idx] = { ...S.creatives[idx], ct: ctId, ctRaison }
        return ctId
      })
      chaineCT = p.catch(() => {})
      return p
    }
    let suivant = 0
    const ouvrier = async (n) => {
      if (n) await new Promise((ok) => setTimeout(ok, 4000 * n))   // départs échelonnés
      while (suivant < aFaire.length) {
        verifier()
        const idx = aFaire[suivant++]
        try {
          const ctId = S.creatives[idx].ct || await choisirCT(idx)   // reprise : un CT déjà choisi pour cet emplacement est gardé
          await genererAvecReprises(idx, ctId, signal, actif)
        } catch (err) {
          if (!actif()) throw annule()
          console.error(`Erreur créative ${idx + 1} :`, err); markCreativeError(idx, err.message || 'Erreur inconnue')
        }
        faites++
        setAgent(2, 'active', `${faites} / ${nbImg} images`, Math.round(faites / nbImg * 100))
        autosave(faites === nbImg)
      }
    }
    const imagesPromise = Promise.all(Array.from({ length: Math.min(IMG_PARALLELES, aFaire.length) }, (_, n) => ouvrier(n)))
    const copyPromises = Array.from({ length: nbAngles }, (_, a) => (garde && S.copies[a]) ? Promise.resolve() : generateOneCopy(a, signal, actif).catch((err) => { if (!actif()) throw annule(); markCopyError(a, err.message) }))
    const surAnnulation = new Promise((_, ko) => signal.addEventListener('abort', () => ko(annule()), { once: true }))
    await Promise.race([Promise.all([imagesPromise, ...copyPromises]), surAnnulation])
    verifier()
    const nbImgOk = S.creatives.filter((x) => !estSlotVideo(x) && done(x)).length
    setAgent(2, nbImgOk === nbImg ? 'done' : 'error', `${nbImgOk} / ${nbImg} images${nbImgOk < nbImg ? ' · ' + (nbImg - nbImgOk) + ' à refaire (bouton ↻)' : ''}`, 100)
    setAgent(3, S.copies.filter(Boolean).length === nbAngles ? 'done' : 'error', `${S.copies.filter(Boolean).length} / ${nbAngles} sets ad copy`, 100)
    S.couts = { ...(S.couts || {}), hors_video: S.budget.depense, budget_hors_video: S.budget.total, postes: S.budget.postes, estime: true }
    autosave(true)

    // ── 5. on attend la dernière vidéo ──
    if (VID.videoSlots().some((x) => VID.jobEnCours(x.c) || (U.crea[x.i] && U.crea[x.i].state === 'running'))) U.launchLabel = 'En attente des vidéos…'
    emit()
    await Promise.race([videosPromise.then(() => VID.attendreVideos()), surAnnulation])
    verifier()
    S.couts = { ...(S.couts || {}), videos: Math.round(VID.videoSlots().reduce((s, x) => s + Number((x.c.job || {}).cout_usd || 0), 0) * 100) / 100 }
    if (S.briefSource === 'commande' && S.commandeId) {
      try { const r = await saveNow(); if (!r.ok) throw new Error('HTTP ' + r.status) }
      catch (e) { await alertDlg(`La sauvegarde automatique des livrables a échoué (${e.message}).\n\nNE FERME PAS CET ONGLET — « Envoyer » fonctionne avec ce qui est affiché.`) }
    }
    U.running = false; U.launchLabel = 'Relancer la production'; U.finiLe = Date.now(); abortCtl = null; phaseMarqueur('termine'); emit()
    // auto-prod-v1 : le dossier complet de CHAQUE production est fait et conservé (liste « Dossiers » de Factory), sans rien bloquer
    if (S.briefSource === 'commande' && S.commandeId) dernierDossier = genererDossier({ silencieux: true }).catch(() => null)
  } catch (err) {
    const annulation = err.name === 'AbortError' || runCourant !== monRun || signal.aborted
    if (runCourant !== monRun) return            // un autre lancement a pris la main : on ne touche plus à rien
    if (!annulation) { console.error(err); await alertDlg('Erreur production : ' + err.message) }
    S.creatives.forEach((c, i) => { if (!estSlotVideo(c) && U.crea[i] && U.crea[i].state === 'running') U.crea[i] = { state: 'pending', text: 'Arrêtée' } })
    U.copy.forEach((x, a) => { if (x && x.state === 'run') U.copy[a] = { state: 'wait' } })
    ;[1, 2, 3].forEach((k) => { if (U.agents[k].state === 'active') U.agents[k] = { ...U.agents[k], state: 'error', text: annulation ? 'Arrêté (Annuler)' : U.agents[k].text } })
    U.running = false; U.launchLabel = annulation ? 'Relancer la production' : 'Réessayer'; U.finiLe = Date.now(); abortCtl = null; phaseMarqueur('arret'); emit()
    autosave(true)
  }
}
export const BUDGET_VIDEO_MAX = 15

// Annuler : arrête TOUT de suite les images, les ad copies et l'analyse (rien de nouveau n'est lancé, les réponses
// en vol sont ignorées). Les vidéos du cloud : arrêtées aussi si le fondateur le confirme.
export async function cancel() {
  if (!U.running) return
  const enCours = VID.videoSlots().filter((x) => VID.jobEnCours(x.c))
  let arreterVid = false
  if (enCours.length) arreterVid = await confirmDlg(`Arrêter aussi les ${enCours.length} vidéo(s) qui tournent sur le cloud ?\n\n« Tout arrêter » : les machines sont coupées maintenant (ce qu'elles ont déjà dépensé est perdu).\nFermer cette fenêtre : les vidéos continuent et arrivent ici quand elles sont prêtes ; seuls les images et ad copies sont arrêtés.`, { ok: 'Tout arrêter', danger: true })
  runCourant++
  if (abortCtl) abortCtl.abort()
  if (arreterVid) { const n = await VID.arreterVideos(); toast(n + ' vidéo(s) arrêtée(s).') }
  S.creatives.forEach((c, i) => { if (!estSlotVideo(c) && U.crea[i] && U.crea[i].state === 'running') U.crea[i] = { state: 'pending', text: 'Arrêtée' } })
  U.copy.forEach((x, a) => { if (x && x.state === 'run') U.copy[a] = { state: 'wait' } })
  ;[1, 2, 3].forEach((k) => { if (U.agents[k] && U.agents[k].state === 'active') U.agents[k] = { ...U.agents[k], state: 'error', text: 'Arrêté (Annuler)' } })
  U.running = false; U.launchLabel = 'Relancer la production'; U.finiLe = Date.now(); abortCtl = null; verrou = false; phaseMarqueur('arret')
  emit(); autosave(true)
  if (!arreterVid && enCours.length) VID.reprendreVideos()
}

// ── Une image : génération, contrôle qualité, corrections tant que le budget le permet ──
const estQuota = (m) => /exhausted|quota|429|rate/i.test(m || '')
async function avecReessai(fn, signal, idx, quoi) {
  let dernier = null
  for (let essai = 1; essai <= 4; essai++) {
    if (signal && signal.aborted) throw annule()
    try { return await fn() }
    catch (err) {
      if (signal && signal.aborted) throw annule()
      dernier = err
      const m = String(err.message || '')
      const timeout = err.name === 'TimeoutError' || /timeout/i.test(m)
      if ((!estQuota(m) && !timeout) || essai === 4) throw err
      const att = 15000 * essai
      U.crea[idx] = { state: 'running', text: (timeout ? 'Délai serveur' : 'Quota Gemini atteint') + ` — ${quoi} reprend dans ${att / 1000} s` }; emit()
      await new Promise((ok, ko) => { const t = setTimeout(ok, att); if (signal) signal.addEventListener('abort', () => { clearTimeout(t); ko(annule()) }, { once: true }) })
    }
  }
  throw dernier
}
async function appelCreative(idx, ctName, signal, reprise) {
  const c = S.creatives[idx]
  await loadSkills()
  const ctMimeRaw = CT_IMAGES[ctName + '_mime'] || 'image/jpeg'
  const ctB64 = reprise ? null : await V.compressImg(await ctGetBase64(ctName), ctMimeRaw)
  const productB64 = await V.compressImg(S.productB64, S.productMime || 'image/jpeg')
  const { creativeSystem, angleInstruction: ai0 } = V.buildCreativeInstruction(c.angleIdx, c.niveau || c.ctIdx, c.rang)
  const angleInstruction = ai0 + (VER.bloc(c.angleIdx, 'image') ? '\n\n' + VER.bloc(c.angleIdx, 'image') : '')
  const sig = (typeof AbortSignal.any === 'function') ? AbortSignal.any([signal, AbortSignal.timeout(600000)]) : signal
  const res = await fetch(SERVER + '/creative-prod-v10', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: sig,
    body: JSON.stringify({ systemPrompt: creativeSystem, synthese: S.synthesis, brief: VER.briefAgents(), angleInstruction, ctBase64: ctB64, ctMime: 'image/jpeg', productBase64: productB64, productMime: 'image/jpeg', logoBase64: S.logoB64 || null, logoMime: S.logoMime || null, niveau: V.NIVEAU_LIB[c.niveau] || '', reprise: reprise || null }),
  })
  const txt = await res.text(); let d = null; try { d = JSON.parse(txt) } catch (_) {}
  if (!d) throw new Error(res.status === 404 ? 'route /creative-prod-v10 absente (serveur Render pas à jour)' : 'réponse inattendue (HTTP ' + res.status + ')')
  if (d.error) throw new Error(d.error)
  return d
}
async function controleQualite(idx, gen, signal) {
  const c = S.creatives[idx]
  const productB64 = await V.compressImg(S.productB64, S.productMime || 'image/jpeg')
  const imgC = await V.compressImg(gen.imageData, gen.imageMime || 'image/png')
  let ctC = null   // qa-vs-ct-v1 : le contrôle voit le CT d'origine pour juger si la créative fait au moins aussi bien
  try { if (c.ct) ctC = await V.compressImg(await ctGetBase64(c.ct), CT_IMAGES[c.ct + '_mime'] || 'image/jpeg') } catch (_) { ctC = null }
  const r = await fetch(SERVER + '/creative-qa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
    body: JSON.stringify({ imageBase64: imgC, imageMime: 'image/jpeg', ctBase64: ctC, ctMime: 'image/jpeg', productBase64: productB64, productMime: 'image/jpeg', logoBase64: S.logoB64 || null, logoMime: S.logoMime || null, prompt: gen.prompt, brief: VER.briefAgents(), niveau: V.NIVEAU_LIB[c.niveau] || '', angle: S.angles[c.angleIdx] || '', verite: VER.bloc(c.angleIdx, 'image') || '', meta: SEN.blocControle() || '' }) })
  const d = await r.json().catch(() => ({}))
  if (!r.ok || d.error) throw new Error(d.error || 'HTTP ' + r.status)
  return d
}
const genId = {}   // v10c — jeton par créative : « Annuler » sur une carte invalide la génération en cours sans toucher aux autres
async function genererAvecReprises(idx, ctName, signal, actif = () => true, { corrections = MAX_CORRECTIONS, budgetLibre = false } = {}) {
  const mon = (genId[idx] = (genId[idx] || 0) + 1)
  const verifierLocal = () => { if (!actif() || (signal && signal.aborted) || genId[idx] !== mon) throw annule() }
  U.crea[idx] = { state: 'running', text: 'Prompt et image en cours' }; emit()
  let gen = await avecReessai(() => appelCreative(idx, ctName, signal, null), signal, idx, 'la génération')
  verifierLocal(); depenser(COUT.prompt + COUT.image, 'images')
  let meilleur = { gen, qa: null, corr: 0 }, nbCorr = 0
  const qaHist = []   // v10c — chaque tentative : prompt, verdict, défauts (pour le dossier complet)
  for (let k = 0; k <= corrections; k++) {
    U.crea[idx] = { state: 'running', text: k ? `Contrôle qualité de la correction ${k}` : 'Contrôle qualité' }; emit()
    let qa = null
    try { qa = await avecReessai(() => controleQualite(idx, gen, signal), signal, idx, 'le contrôle'); depenser(COUT.qa, 'controle') }
    catch (e) { verifierLocal(); console.warn('[Contrôle qualité] indisponible :', e.message); qa = { verdict: 'inconnu', score: null, defauts: [], resume: 'contrôle indisponible (' + String(e.message).slice(0, 80) + ')' } }
    verifierLocal()
    qaHist.push({ tentative: k, prompt: gen.prompt, meta: gen.meta, verdict: qa.verdict, score: qa.score, defauts: qa.defauts, resume: qa.resume, ecart_ct: qa.ecart_ct || '', consignes_correction: qa.consignes_correction || null })
    if (!meilleur.qa || (qa.score || 0) > (meilleur.qa.score || 0) || qa.verdict === 'ok') meilleur = { gen, qa, corr: nbCorr }
    if (qa.verdict !== 'corriger') break
    const bloquants = (qa.defauts || []).filter((x) => x.gravite === 'bloquant')
    if (!bloquants.length) break
    if (k === corrections) break
    if (!budgetLibre && resteBudget() < COUT.image + COUT.qa + 0.05) { meilleur.qa = { ...meilleur.qa, budget_atteint: true }; break }
    U.crea[idx] = { state: 'running', text: `Correction ${k + 1} : ${String(bloquants[0].detail || bloquants[0].type).slice(0, 70)}` }; emit()
    gen = await avecReessai(() => appelCreative(idx, ctName, signal, { prompt: meilleur.gen.prompt, meta: meilleur.gen.meta, corrections: qa.consignes_correction || bloquants.map((x) => x.detail).join(' ; ') }), signal, idx, 'la correction')
    verifierLocal(); depenser(COUT.image, 'corrections'); nbCorr++
  }
  verifierLocal()
  const g = meilleur.gen, q = meilleur.qa || {}
  let imgB64 = g.imageData, imageMime = g.imageMime || 'image/png'
  // meta-sensible-v1 : produit sensible et mention absente ou illisible (ou contrôle indisponible) → mention propre apposée par le code
  let mentionAjoutee = false
  if (SEN.estSensible() && q.mention !== 'ok') {
    try { const r = await SEN.apposerMention(imgB64, imageMime, SEN.claim()); if (r) { imgB64 = r.b64; imageMime = r.mime; mentionAjoutee = true } }
    catch (e) { console.warn('[Meta] mention non apposée :', e.message) }
  }
  const desc = (g.meta && g.meta.length > 5) ? g.meta.slice(0, 200) : `Créative · ${ctName} · Angle ${S.creatives[idx].angleIdx + 1}`
  const qaRes = { mention: SEN.estSensible() ? (mentionAjoutee ? 'ajoutée' : (q.mention || 'inconnue')) : null, verdict: q.verdict || 'inconnu', score: q.score ?? null, defauts: (q.defauts || []).slice(0, 6), resume: q.resume || '', ecart_ct: q.ecart_ct || '', corrections: nbCorr, version_gardee: meilleur.corr, budget_atteint: !!q.budget_atteint }
  S.creatives[idx] = { ...S.creatives[idx], imgB64, desc, status: 'done', imageMime, qa: qaRes, prompt: g.prompt || '', meta: g.meta || '', qaHist: qaHist.map((h) => ({ ...h, prompt: String(h.prompt || '').slice(0, 6000), meta: String(h.meta || '').slice(0, 3000) })), ctUrl: CT_IMAGES[ctName] || '' }
  U.crea[idx] = { state: 'done', text: 'Prêt' }; emit()
  if (S.briefSource === 'commande' && S.commandeId) {
    try {
      const thumbB64 = await genThumb(imgB64, imageMime)
      const rUp = await fetch(`${SERVER}/commandes/${S.commandeId}/upload-creative-now`, { method: 'POST', headers: JH, body: JSON.stringify({ imgB64, mime: imageMime, index: idx, thumbB64 }) })
      const dUp = await rUp.json()
      if (dUp.ok && dUp.url && S.creatives[idx] && S.creatives[idx].imgB64 === imgB64) S.creatives[idx] = { ...S.creatives[idx], url: dUp.url, thumbUrl: dUp.thumbUrl || null, imgB64: null }
    } catch (e) { console.warn(`[Upload immédiat] Créative ${idx} — échoué, conservée en base64 en secours :`, e.message) }
  }
  emit()
}

function genThumb(base64Data, mime) {
  return new Promise((resolve) => {
    try {
      const img = new Image()
      img.onload = () => {
        try {
          const scale = Math.min(1, 400 / img.width)
          const w = Math.round(img.width * scale) || img.width, h = Math.round(img.height * scale) || img.height
          const c = document.createElement('canvas'); c.width = w; c.height = h
          c.getContext('2d').drawImage(img, 0, 0, w, h)
          resolve(c.toDataURL('image/jpeg', 0.78).split(',')[1] || null)
        } catch (_) { resolve(null) }
      }
      img.onerror = () => resolve(null)
      img.src = `data:${mime};base64,${base64Data}`
    } catch (_) { resolve(null) }
  })
}

function markCreativeError(idx, msg) { if (msg === 'Annulé') return; U.crea[idx] = { state: 'err', text: 'Erreur', err: String(msg).slice(0, 200) }; emit() }
export async function regenerateCrea(idx) {
  const c = S.creatives[idx]; if (!c || estSlotVideo(c) || !c.ct) return
  if (U.crea[idx] && U.crea[idx].state === 'running') return
  try { await genererAvecReprises(idx, c.ct, new AbortController().signal, () => true, { corrections: 1, budgetLibre: true }); autosave() }
  catch (err) { markCreativeError(idx, err.message) }
}
// « Autre CT » : la même créative, un concept différent (le CT actuel et ceux déjà pris dans ce lot sont exclus).
export async function regenerateCreaAutreCT(idx) {
  const c = S.creatives[idx]; if (!c || estSlotVideo(c)) return
  if (U.crea[idx] && U.crea[idx].state === 'running') return
  if (!S.synthesis) { await alertDlg("La synthèse de l'analyste est nécessaire pour choisir un nouveau CT."); return }
  U.crea[idx] = { state: 'running', text: "Choix d'un autre CT" }; emit()
  try {
    await loadCTImages()
    const deja = new Set(S.creatives.map((x) => x.ct).filter(Boolean))
    let ctId, ctRaison = ''
    const niv = c.niveau || c.ctIdx
    try { const r = await V.choisirCTProd(c.angleIdx, niv, deja, new AbortController().signal, c.rang); ctId = r.id; ctRaison = r.raison }
    catch (eCT) { const sec = V.ctSecours(niv, deja); if (!sec) throw eCT; ctId = sec.id; ctRaison = 'CT de secours (' + eCT.message + ')' }
    S.creatives[idx] = { ...c, ct: ctId, ctRaison }; emit()
    await genererAvecReprises(idx, ctId, new AbortController().signal, () => true, { corrections: 1, budgetLibre: true }); autosave()
  } catch (err) { markCreativeError(idx, err.message) }
}
// v8 — import d'une vidéo produite dans le Video Lab dans l'emplacement vidéo de son angle (Cloudflare R2, affiche capturée)
export async function importerVideo(idx, file) {
  const c = S.creatives[idx]; if (!estSlotVideo(c) || !file) return
  if (!/^video\//.test(file.type || '') && !/\.(mp4|mov|webm)$/i.test(file.name || '')) { await alertDlg('Choisis un fichier vidéo (mp4, mov ou webm).'); return }
  if (file.size > 300 * 1048576) { await alertDlg('Vidéo trop lourde (plus de 300 Mo) : exporte-la plus légère depuis le Video Lab.'); return }
  const avant = { ...U.crea[idx] }
  U.crea[idx] = { state: 'running', text: 'Envoi de la vidéo… 0 %' }; emit()
  try {
    const dossier = 'liv-' + String(S.commandeId || 'test').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60)
    const ext = (/\.(mp4|mov|webm)$/i.exec(file.name || '') || [, 'mp4'])[1].toLowerCase()
    const base = `ct-video/${dossier}/angle${c.angleIdx + 1}_${Date.now()}`
    const videoUrl = await r2Put(file, base + '.' + ext, (p) => { U.crea[idx] = { state: 'running', text: 'Envoi de la vidéo… ' + Math.round(p * 100) + ' %' }; emit() })
    let thumbUrl = null, duree = 0
    try { const inf = await videoInfos(file, 0.15); duree = inf.duree || 0; if (inf.poster) thumbUrl = await r2Put(inf.poster, base + '_affiche.jpg') } catch (_) {}
    S.creatives[idx] = { ...c, type: 'video', videoUrl, thumbUrl, url: null, imgB64: null, status: 'done', desc: 'Vidéo · ' + (file.name || '') + (duree ? ' · ' + duree + ' s' : ''), duree }
    U.crea[idx] = { state: 'done', text: 'Vidéo prête' }; emit(); autosave(true)
    toast('Vidéo importée pour l\'angle ' + (c.angleIdx + 1) + '.')
  } catch (e) { U.crea[idx] = avant; emit(); await alertDlg("Envoi de la vidéo impossible : " + e.message) }
}
export async function retirerVideo(idx) {
  const c = S.creatives[idx]; if (!estSlotVideo(c) || !c.videoUrl) return
  if (!(await confirmDlg("Retirer cette vidéo de l'emplacement ? (Si elle a déjà été envoyée au client, elle reste chez lui.)", { ok: 'Retirer' }))) return
  S.creatives[idx] = { angleIdx: c.angleIdx, kind: 'video', ctIdx: 'video', niveau: c.niveau, rang: c.rang, ct: null, status: 'pending' }
  U.crea[idx] = { state: 'video', text: 'Vidéo à importer' }; emit(); autosave(true)
}
// v8 — refaire l'analyse de marché (synthèse, hypothèse, données marché) sans toucher aux créatives ni aux ad copies déjà faites
export async function regenerateAnalyse() {
  if (U.running || U.sending.ana === 'busy') return
  if (!(await confirmDlg("Refaire l'analyse de marché ?\n\nLa synthèse, l'hypothèse et les Données Marché sont recalculées (coût d'un appel analyste). Les angles peuvent changer : les images et ad copies déjà faites restent telles quelles — régénère-les ensuite si besoin.", { ok: "Refaire l'analyse" }))) return
  U.sending.ana = 'busy'; setAgent(1, 'active', 'Nouvelle analyse de marché…', 20)
  try {
    await loadSkills()
    const nbAngles = U.nbAngles || V.prodv2GetAngleCount()
    const { analysteSystem, analysteParts } = await V.buildAnalysteInputs(nbAngles, nbAngles * 3)
    const raw = await V.apiAnalysteSynthese(analysteSystem, analysteParts, 64000, S.brief, undefined, false, { productId: S.productId, nbAngles })
    const { synthesisText, marche } = V.prodv2SplitSynthesisAndMarche(raw)
    S.synthesis = synthesisText; S.marche = marche; S.angles = V.anglesProduction(synthesisText, nbAngles)
    setAgent(1, 'done', `Synthèse refaite · ${Math.round(synthesisText.length / 1000)}K chars · ${nbAngles} angles${marche ? '' : ' · ⚠ Données Marché non extraites'}`, 100)
    autosave(true); toast('Analyse de marché refaite et sauvegardée.')
  } catch (e) { setAgent(1, 'done', 'Analyse précédente conservée (' + String(e.message || e).slice(0, 80) + ')', 100); await alertDlg("Nouvelle analyse impossible : " + e.message + "\n\nL'analyse précédente est conservée.") }
  finally { delete U.sending.ana; emit() }
}
// v10c — contrôle AVANT tout envoi : rien ne doit partir incomplet sans que tu le saches (créative absente, encore en cours, ad copy ou marché manquants)
export function controleLivraison() {
  const pb = [], n = U.nbAngles || 0
  const crea = S.creatives || []
  const attendu = n * 3
  if (attendu && crea.length < attendu) pb.push(`${attendu - crea.length} créative(s) jamais créée(s) (${crea.length}/${attendu})`)
  crea.forEach((c, i) => {
    const ui = U.crea[i] || {}, v = estSlotVideo(c), lib = (v ? 'Vidéo' : 'Image') + ' de l\'angle ' + (((c && c.angleIdx) || 0) + 1)
    if (ui.state === 'running') pb.push(lib + ' : encore en cours de génération')
    else if (!done(c)) pb.push(lib + ' : pas prête' + (ui.state === 'err' ? ' (erreur)' : ''))
  })
  for (let a = 0; a < n; a++) {
    const cp = S.copies[a]
    if (!cp) pb.push('Ad copy de l\'angle ' + (a + 1) + ' : absente')
    else if (!Array.isArray(cp.hooks) || cp.hooks.filter((h) => String(h || '').trim().length > 3).length < 5 || String(cp.description || '').trim().length < 60) pb.push('Ad copy de l\'angle ' + (a + 1) + ' : incomplète (5 hooks et une description attendus)')
  }
  if (!S.marche) pb.push('Données marché : absentes')
  return pb
}
async function confirmerLivraisonIncomplete(cible) {
  const pb = controleLivraison(); if (!pb.length) return true
  return confirmDlg(`Attention : ce lot n'est pas complet.\n\n• ${pb.slice(0, 8).join('\n• ')}${pb.length > 8 ? '\n• … (+' + (pb.length - 8) + ')' : ''}\n\nEnvoyer quand même ${cible} ce qui est prêt ?`, { ok: 'Envoyer quand même' })
}
export const videosManquantes = () => S.creatives.map((c, i) => ({ c, i })).filter((x) => estSlotVideo(x.c) && !x.c.videoUrl).map((x) => x.c.angleIdx + 1)
export function downloadCrea(idx) {
  const c = S.creatives[idx]; if (!c || (!c.url && !c.imgB64 && !c.videoUrl)) return
  if (c.videoUrl) { window.open(c.videoUrl, '_blank'); return }
  const a = document.createElement('a')
  a.href = c.url || ('data:image/png;base64,' + c.imgB64)
  a.download = `creative_angle${c.angleIdx + 1}_${c.ct}.png`; a.target = '_blank'
  document.body.appendChild(a); a.click(); a.remove()
}

// ── Copies ──
const copieValide = (h, d) => Array.isArray(h) && h.filter((x) => String(x || '').trim().length > 3).length >= 5 && d && d !== "(description vide — Gemini n'a pas suivi le format)" && String(d).length > 60
async function generateOneCopy(angleIdx, signal, actif = () => true) {
  U.copy[angleIdx] = { state: 'run' }; emit()
  await loadSkills()
  let dernier = null, correction = ''
  for (let t = 1; t <= 3; t++) {   // contrôle : 5 hooks, une vraie description et un closer honnête, sinon réécriture (max 2 reprises)
    const { hooks, description } = await V.prodv2GenerateOneCopyAttempt(angleIdx, signal, correction)
    if (!actif()) throw new DOMException('Annulé', 'AbortError')
    depenser(COUT.copie, 'copies')
    const valide = copieValide(hooks, description)
    // verite-v1 — le closer est relu : raison vraie, une seule action, aucune rareté ni offre absente du brief
    const cl = valide ? await VER.closerOk(angleIdx, description, signal) : { ok: true }
    if (!actif()) throw new DOMException('Annulé', 'AbortError')
    if (valide) depenser(0.01, 'copies')
    if (valide && cl.ok) { dernier = { hooks, description, essais: t }; break }
    if (valide && (!dernier || !dernier.closerOk)) dernier = { hooks, description, essais: t, closerOk: false, closer: cl.probleme || '' }
    else if (!dernier) dernier = { hooks, description, essais: t }
    correction = valide ? 'FIN À RÉÉCRIRE — la version précédente avait ce défaut dans son closer : ' + (cl.probleme || '') + ' Réécris l\'ensemble en gardant ce qui marchait, et corrige ce point.' : ''
    console.warn(`[Copywriter] Ad copy de l'angle ${angleIdx + 1} ${valide ? 'closer à corriger : ' + cl.probleme : 'incomplète'} (essai ${t}) : réécriture.`)
  }
  S.copies[angleIdx] = dernier; U.copy[angleIdx] = { state: 'done' }; emit()
  autosave()
}
function markCopyError(a, msg) { U.copy[a] = { state: 'err', err: msg }; emit() }
export async function regenerateCopy(angleIdx) {
  try { await generateOneCopy(angleIdx, new AbortController().signal) }
  catch (err) { if (err.name !== 'AbortError') markCopyError(angleIdx, err.message) }
}
export const relancerVideo = VID.relancerVideo
export const lancerVideosManquantes = async () => { for (const x of VID.videoSlots()) { if (!x.c.videoUrl && !VID.jobEnCours(x.c)) await VID.relancerVideo(x.i) } }
export const attacherLienVideo = (idx, url) => VID.attacherLien(idx, url)
export const copyIsFallback = (c) => !!c && c.description === "(description vide — Gemini n'a pas suivi le format)"

// ── Envois ──
const needCmd = async () => { if (!S.commandeId) { await alertDlg("Cette production n'est pas liée à une commande AdBoard — rien à envoyer automatiquement."); return false } return true }
const saveNow = () => fetch(`${SERVER}/commandes/${S.commandeId}/save-deliverables`, { method: 'POST', headers: JH, body: livrablesPayload() })
async function withBusy(key, label, fn) {
  U.sending[key] = 'busy'; emit()
  try { await fn(); U.sending[key] = 'ok'; emit(); setTimeout(() => { delete U.sending[key]; emit() }, 1500) }
  catch (e) { delete U.sending[key]; emit(); await alertDlg(`${label} : ${e.message}`) }
}
export async function sendOneCreative(idx) {
  if (!(await needCmd())) return
  await withBusy('c' + idx, 'Envoi de cette créative échoué', async () => {
    await saveNow()
    const r = await fetch(`${SERVER}/commandes/${S.commandeId}/send-one-creative`, { method: 'POST', headers: JH, body: JSON.stringify({ index: idx }) })
    const data = await r.json().catch(() => ({}))
    if (!r.ok || !data.ok) throw new Error(data.error || ('HTTP ' + r.status))
  })
}
export async function sendOneCopy(a) {
  if (!(await needCmd())) return
  await withBusy('p' + a, 'Envoi de cette ad copy échoué', async () => {
    await saveNow()
    const r = await fetch(`${SERVER}/commandes/${S.commandeId}/send-one-copy`, { method: 'POST', headers: JH, body: JSON.stringify({ index: a }) })
    const data = await r.json().catch(() => ({}))
    if (!r.ok || !data.ok) throw new Error(data.error || ('HTTP ' + r.status))
  })
}
export async function sendMarche() {
  if (!(await needCmd())) return
  if (!S.marche) { await alertDlg("Aucune donnée marché générée pour l'instant — rien à envoyer."); return }
  await withBusy('m', 'Envoi des Données Marché échoué', async () => {
    await saveNow()
    const r = await fetch(`${SERVER}/commandes/${S.commandeId}/send-marche`, { method: 'POST', headers: NGROK })
    const data = await r.json().catch(() => ({}))
    if (!r.ok || !data.ok) throw new Error(data.error || ('HTTP ' + r.status))
  })
}
export async function sendClient(reload) {
  if (!(await needCmd())) return
  if (!S.creatives.some(done) && !S.copies.some(Boolean)) { await alertDlg("Aucun livrable généré pour l'instant — rien à envoyer."); return }
  if (!(await confirmerLivraisonIncomplete('au client'))) return
  U.sending.all = 'busy'; U.sendLabel = 'Envoi en cours…'; emit()
  const fin = (label, ok) => { delete U.sending.all; U.sendLabel = label || null; emit() }
  try {
    await saveNow()
    const r = await fetch(`${SERVER}/commandes/${S.commandeId}/done`, { method: 'POST', headers: NGROK })
    if (!r.ok) throw new Error('HTTP ' + r.status)
    const result = await r.json().catch(() => ({}))
    const push = result?.push
    if (push && push.manqueVsQuantiteDemandee) {
      await alertDlg(`Seulement ${push.expectedCount}/${push.quantiteDemandee} créatives ont été sauvegardées — les ${push.quantiteDemandee - push.expectedCount} manquantes n'ont jamais été enregistrées (probablement une sauvegarde en échec pendant la génération). Clique sur « Relancer la production » pour régénérer les manquantes — un simple renvoi ne suffira pas.`)
      fin(`${push.expectedCount}/${push.quantiteDemandee} seulement`); reload && reload(); return
    }
    if (push && push.pushedCount < push.expectedCount) {
      await alertDlg(`Envoi partiel : ${push.pushedCount}/${push.expectedCount} créatives réellement transmises à AdBoard. Clique à nouveau sur « Envoyer au client » pour renvoyer — les créatives déjà bien reçues ne seront pas dupliquées.`)
      fin(`Renvoyer (${push.pushedCount}/${push.expectedCount})`); reload && reload(); return
    }
    if (push && (!push.adCopiesOk || !push.marcheOk)) {
      const manques = []
      if (!push.adCopiesOk) manques.push(`ad copies (${push.adCopiesCount}/${push.adCopiesAttendu} sets confirmés)`)
      if (!push.marcheOk) manques.push('données marché')
      await alertDlg(`Créatives bien transmises (${push.pushedCount}/${push.expectedCount}), mais problème détecté sur : ${manques.join(', ')}. Clique à nouveau sur « Envoyer au client » pour réessayer.`)
      fin('Renvoyer'); reload && reload(); return
    }
    try { localStorage.removeItem('adstack_active_production') } catch (_) {}
    fin('Envoyé au client')
    verifierApresEnvoi(null, true)
    await alertDlg(push ? `Envoyé et confirmé au client :\n• ${push.pushedCount}/${push.expectedCount} créatives\n• ${push.adCopiesCount}/${push.adCopiesAttendu} sets ad copy\n• Données marché ✓` : 'Envoyé au client.', { title: 'Livraison' })
    reload && reload()
  } catch (e) { await alertDlg("Erreur lors de l'envoi : " + e.message); fin(null) }
}

// Envoi à un autre compte (test) — scope : null (tout) | {type:'creative'|'copy'|'marche', index}
export async function searchUsers(q) {
  const res = await fetch(`${SERVER}/users/search?q=${encodeURIComponent(q)}`, { headers: NGROK }); return res.json()
}
export async function userProducts(userId) {
  const res = await fetch(`${SERVER}/users/${userId}/products`, { headers: NGROK }); return res.json()
}
export function hasAnyDeliverable() { return S.creatives.some(done) || S.copies.some(Boolean) }
export async function manualDeliver({ scope, user, productId, newName }) {
  let d
  if (scope?.type === 'creative') { const arr = []; arr[scope.index] = S.creatives[scope.index]; d = { creatives: arr, copies: [], synthesis: null, angles: [], marche: null } }
  else if (scope?.type === 'copy') { const arr = []; arr[scope.index] = S.copies[scope.index]; d = { creatives: [], copies: arr, synthesis: S.synthesis, angles: S.angles, marche: null } }
  else if (scope?.type === 'marche') d = { creatives: [], copies: [], synthesis: S.synthesis, angles: S.angles, marche: S.marche }
  else d = { creatives: S.creatives, copies: S.copies, synthesis: S.synthesis, angles: S.angles, marche: S.marche }
  const res = await fetch(`${SERVER}/manual-deliver`, { method: 'POST', headers: JH, body: JSON.stringify({ userId: user.id, productId: productId || undefined, newProductName: productId ? undefined : newName, ticketId: S.commandeId || undefined, remplacer: S.commandeId ? (scope?.type === 'creative' ? 'creative' : scope?.type ? undefined : 'tout') : undefined, deliverables: d }) })
  const j = await res.json().catch(() => ({}))
  if (!res.ok || j.ok === false) throw new Error((j && j.error) || 'HTTP ' + res.status)
  // v10c — vérification : tout ce qui devait partir est bien écrit chez le compte
  const p = j.push
  if (p && !scope) {
    const pb = []
    if (p.pushedCount < p.expectedCount) pb.push(`créatives : ${p.pushedCount}/${p.expectedCount} reçues`)
    if (!p.adCopiesOk) pb.push(`ad copies : ${p.adCopiesCount}/${p.adCopiesAttendu}`)
    if (!p.marcheOk) pb.push('données marché non écrites')
    if (pb.length) throw new Error('Envoi incomplet — ' + pb.join(' · ') + '. Clique à nouveau sur « Renvoyer sur mon compte ».')
  } else if (!p) toast('Envoi fait, mais le serveur n\'a pas pu confirmer le contenu reçu (serveur pas à jour).')
  return j.productId || productId || null
}

// ── Mon compte (envoi de contrôle avant le client) ──
const CLE_COMPTE = 'adstack_mon_compte'
export const monCompte = () => { try { return JSON.parse(localStorage.getItem(CLE_COMPTE) || 'null') } catch (_) { return null } }
export function setMonCompte(v) { try { if (v) localStorage.setItem(CLE_COMPTE, JSON.stringify(v)); else localStorage.removeItem(CLE_COMPTE) } catch (_) {} U.compteV = (U.compteV || 0) + 1; emit() }
// Envoie TOUS les livrables sur le compte mémorisé. 1re fois : le produit est créé puis mémorisé (pas de doublon ensuite).
export async function envoyerSurMonCompte() {
  const m = monCompte(); if (!m) return false
  if (!hasAnyDeliverable()) { await alertDlg("Aucun livrable généré pour l'instant — rien à envoyer."); return true }
  if (!(await confirmerLivraisonIncomplete('sur ton compte'))) return true
  if (S.commandeId) { try { await saveNow() } catch (_) {} }
  let pidFinal = null
  await withBusy('moi', 'Envoi sur ton compte échoué', async () => {
    // v10c — la fiche produit se crée toute seule dans ce compte (copie de la fiche officielle, toutes les variables), ou se lie si le produit y est déjà
    let pid = S.commandeId ? (m.produits && m.produits[S.commandeId]) || null : m.productId || null
    if (!pid) {
      const r = await fetch(`${SERVER}/production/compte-produit`, { method: 'POST', headers: JH, body: JSON.stringify({ userId: m.user.id, commandeId: S.commandeId || undefined, nom: (S.brief && S.brief.produit) || m.newName || undefined }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || j.error || !j.productId) throw new Error(j.error || 'création/liaison du produit impossible (HTTP ' + r.status + ') — le serveur est-il à jour ?')
      pid = j.productId
      toast(j.created ? `Fiche produit « ${j.nom} » créée dans ton compte, avec toutes ses variables.` : `Produit « ${j.nom} » déjà présent dans ton compte : livrables liés à cette fiche.`)
      if (S.commandeId) setMonCompte({ ...m, produits: { ...(m.produits || {}), [S.commandeId]: pid } }); else setMonCompte({ ...m, productId: pid })
    }
    await manualDeliver({ scope: null, user: m.user, productId: pid })
    U.envoyeMoi = Date.now(); pidFinal = pid
  })
  if (pidFinal) verifierApresEnvoi(pidFinal, false)
  return true
}

// v10c — après un envoi : portrait de la cible garanti, puis relecture d'AdBoard (créatives, vidéos, ad copies, marché, statut du compte à rebours)
const attendre = (ms) => new Promise((ok) => setTimeout(ok, ms))
export async function verifierApresEnvoi(productId, client) {
  const cmd = S.commandeId; if (!cmd) return null
  const maj = (texte, etat = 'busy') => { U.verif = { etat, texte }; emit() }
  try {
    maj('Vérification du portrait de la cible…')
    let portrait = 'inconnu', raisonP = ''
    try {
      const r = await fetch(`${SERVER}/production/portrait-ensure`, { method: 'POST', headers: JH, body: JSON.stringify(client ? { commandeId: cmd } : { productId }) })
      let j = await r.json().catch(() => ({}))
      const t0 = Date.now()
      while (j.etat === 'en_cours' && Date.now() - t0 < 6 * 60000) {
        maj('Portrait de la cible en cours de génération…')
        await attendre(8000)
        const rs = await fetch(`${SERVER}/production/portrait-status?${client ? 'commandeId=' + cmd : 'productId=' + productId}`, { headers: JH })
        j = await rs.json().catch(() => ({ etat: 'inconnu' }))
      }
      portrait = j.etat === 'pret' ? 'ok' : j.etat === 'sans_persona' ? 'sans' : 'ko'; raisonP = j.raison || j.erreur || (j.etat === 'en_cours' ? 'toujours en cours après 6 min' : '')
    } catch (e) { portrait = 'ko'; raisonP = e.message }
    maj('Relecture de ce qui est arrivé dans AdBoard…')
    const rv = await fetch(`${SERVER}/production/verifier-livraison?commande=${cmd}&product=${productId || ''}&client=${client ? 1 : 0}&reparer=${client ? 1 : 0}`, { headers: JH })
    const v = await rv.json().catch(() => ({}))
    if (!rv.ok || v.error) throw new Error(v.error || 'HTTP ' + rv.status)
    const pb = [...(v.probleme || [])]
    if (portrait === 'ko') pb.push('portrait de la cible non généré (' + String(raisonP).slice(0, 120) + ')')
    const resume = `${v.creatives}/${v.attendu} créatives (dont ${v.videos} vidéo${v.videos > 1 ? 's' : ''}) · ${v.copies}/${v.copiesAttendues} ad copies · marché ${v.marche ? '✓' : '✗'} · portrait ${portrait === 'ok' ? '✓' : portrait === 'sans' ? 'aucun' : '✗'}${client ? ' · statut ' + (v.statut || '?') : ''}`
    if (pb.length) { maj('⚠ À vérifier : ' + pb[0], 'err'); await alertDlg(`Vérification ${client ? 'chez le client' : 'sur ton compte'} : des points ne sont pas bons.\n\n• ${pb.join('\n• ')}\n\nCe qui est arrivé : ${resume}\n\nClique à nouveau sur l'envoi pour réessayer.`, { title: 'Vérification de la livraison' }) }
    else { maj('✓ Vérifié : ' + resume, 'ok'); toast('Livraison vérifiée : ' + resume) }
    return { ok: !pb.length, v, portrait }
  } catch (e) { maj('Vérification impossible : ' + e.message, 'err'); return null }
}

// ── livrables-v1 (20 nov. 2026) — visualiseur des livrables d'une commande + vrai envoi depuis la liste ──
// Charge une commande dans le moteur SANS la repasser « en production » (pas de /start) : sert à revoir,
// régénérer, envoyer sur mon compte ou refaire le dossier d'une commande déjà produite (même livrée).
export async function chargerCommande(id) {
  if (S.commandeId === id && S.brief) return true
  if (U.running) { await alertDlg("Une production tourne en ce moment dans la vue Production. Attends sa fin (ou annule-la) avant d'ouvrir les livrables d'une autre commande."); return false }
  if (S.commandeId && S.commandeId !== id && !V.prodv2EstActuellementComplet()) {
    if (!(await confirmDlg(`« ${S.brief?.produit || 'la production en cours'} » n'est pas terminée dans la vue Production. L'écran va passer sur cette commande (tout ce qui est déjà généré reste sauvegardé dans sa carte).\n\nContinuer ?`))) return false
  }
  try {
    await loadSkills(); await loadCTImages()
    const briefs = await fetch(`${SERVER}/commandes`, { headers: NGROK }).then((r) => r.json()).catch(() => [])
    const b = briefs.find((x) => x.id === id)
    if (!b) { await alertDlg('Commande introuvable.'); return false }
    await restoreFromCommande(b)
    return true
  } catch (e) { await alertDlg('Erreur : ' + e.message); return false }
}
// Résumé des livrables rangés dans une commande (lu depuis la carte, rien n'est recalculé)
export function resumeLivrables(b) {
  const d = (b && b.deliverables) || {}, q = (b && b.quantity) || 6, nbA = Math.max(1, Math.ceil(q / 3))
  const cr = (d.creatives || []).filter(Boolean)
  const vid = (c) => !!c && (c.type === 'video' || c.kind === 'video' || c.ctIdx === 'video' || !!c.videoUrl)
  const ok = (c) => c && c.status === 'done' && (c.url || c.videoUrl || c.imgB64)
  const r = { attendu: q, creatives: cr.filter(ok).length, videos: cr.filter((c) => ok(c) && vid(c)).length, copies: (d.copies || []).filter(Boolean).length, copiesAttendues: nbA, marche: !!(d.marche || d.synthesis) }
  r.rien = r.creatives + r.copies === 0
  r.complet = r.creatives >= q && r.copies >= nbA && r.marche
  return r
}
// « Envoyer au client » depuis la liste des commandes : envoie VRAIMENT les livrables rangés dans la carte, avec un compte rendu.
export async function envoyerCommande(b, reload) {
  const id = b.id, r = resumeLivrables(b)
  const qui = (b.client && b.client.email) || 'le client'
  if (r.rien) { await alertDlg("Aucun livrable n'est encore rangé dans cette commande : rien à envoyer. Ouvre-la dans la production (« Reprendre ») pour produire d'abord."); return }
  const manques = []
  if (r.creatives < r.attendu) manques.push(`${r.attendu - r.creatives} créative(s) manquante(s) (${r.creatives}/${r.attendu})`)
  if (r.copies < r.copiesAttendues) manques.push(`ad copies : ${r.copies}/${r.copiesAttendues}`)
  if (!r.marche) manques.push('données marché absentes')
  const txt = `Envoyer à ${qui} :\n• ${r.creatives}/${r.attendu} créatives (dont ${r.videos} vidéo${r.videos > 1 ? 's' : ''})\n• ${r.copies}/${r.copiesAttendues} sets d'ad copy\n• Données marché ${r.marche ? '✓' : '✗'}\n\nIl les verra tout de suite dans son AdBoard.` + (manques.length ? `\n\n⚠ Lot incomplet : ${manques.join(' · ')}.` : '')
  if (!(await confirmDlg(txt, { ok: manques.length ? 'Envoyer quand même' : 'Envoyer au client', title: b.status === 'done' ? 'Renvoyer au client' : 'Envoyer au client' }))) return
  if (S.commandeId === id) { try { await saveNow() } catch (e) { console.warn('[Envoi] Sauvegarde de sécurité pré-envoi échouée :', e.message) } }
  try {
    const res = await fetch(`${SERVER}/commandes/${id}/done`, { method: 'POST', headers: NGROK })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const push = ((await res.json().catch(() => ({}))) || {}).push
    try { const m = JSON.parse(localStorage.getItem('adstack_active_production') || 'null'); if (m && m.commandeId === id) localStorage.removeItem('adstack_active_production') } catch (_) {}
    reload && reload()
    if (!push) { await alertDlg('Commande marquée livrée, mais le serveur n\'a pas confirmé ce qui est arrivé chez le client. Ouvre « Livrables » puis renvoie si besoin.', { title: 'Livraison' }); return }
    if (push.pushedCount < push.expectedCount || !push.adCopiesOk || !push.marcheOk) {
      const pb = []
      if (push.pushedCount < push.expectedCount) pb.push(`créatives : ${push.pushedCount}/${push.expectedCount} reçues`)
      if (!push.adCopiesOk) pb.push(`ad copies : ${push.adCopiesCount}/${push.adCopiesAttendu}`)
      if (!push.marcheOk) pb.push('données marché non écrites')
      await alertDlg(`Envoi partiel chez ${qui} :\n• ${pb.join('\n• ')}\n\nClique sur « Renvoyer » : ce qui est déjà arrivé ne sera pas dupliqué.`, { title: 'Livraison' }); return
    }
    await alertDlg(`Envoyé et confirmé chez ${qui} :\n• ${push.pushedCount}/${push.expectedCount} créatives\n• ${push.adCopiesCount}/${push.adCopiesAttendu} sets d'ad copy\n• Données marché ✓`, { title: 'Livraison' })
  } catch (e) { await alertDlg("Erreur lors de l'envoi : " + e.message) }
}

// ── Actions sur les commandes ──
export async function marquerLivre(id, reload) {
  if (!(await confirmDlg('Marquer cette commande comme livrée ?', { ok: 'Marquer livrée' }))) return
  if (S.commandeId === id) { try { await saveNow() } catch (e) { console.warn('[Envoi] Sauvegarde de sécurité pré-envoi échouée :', e.message) } }
  await fetch(`${SERVER}/commandes/${id}/done`, { method: 'POST', headers: NGROK })
  try { const m = JSON.parse(localStorage.getItem('adstack_active_production') || 'null'); if (m && m.commandeId === id) localStorage.removeItem('adstack_active_production') } catch (_) {}
  reload && reload()
}
export async function supprimerTicket(id, reload) {
  if (!(await confirmDlg('Supprimer définitivement cette commande client ? Cette action est irréversible.', { ok: 'Supprimer', danger: true }))) return
  await fetch(`${SERVER}/commandes/${id}/delete`, { method: 'POST', headers: NGROK })
  reload && reload()
}

// v10c — DOSSIER COMPLET : un seul zip (brief, marché, plan, copies, images + prompts + contrôle qualité, vidéos + historique + CT source)
// auto-prod-v1 — dossiers conservés : chaque dossier complet fait est enregistré dans la commande (serveur), visible dans « Dossiers ».
let dernierDossier = null
export const attendreDossier = async () => (dernierDossier ? await dernierDossier : await genererDossier({ silencieux: true }))
function conserverDossier(d) {
  try {
    if (!d || !d.url || !S.commandeId) return
    let t = ''; try { t = (JSON.parse(localStorage.getItem('factory_admin_sb_session') || 'null') || {}).access_token || '' } catch (_) {}
    const jeton = (typeof window !== 'undefined' && window.__AUTO && window.__AUTO.jeton) || undefined
    fetch(SERVER + '/auto/etat', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: JSON.stringify({ commande_id: S.commandeId, jeton, dossier_url: d.url, dossier_fichiers: d.fichiers, dossier_mo: d.mo }) }).catch(() => {})
  } catch (_) {}
}
export async function genererDossier({ silencieux = false } = {}) {
  if (!S.brief) return null
  U.dossier = { etat: 'busy', url: U.dossier && U.dossier.url }; emit()
  try {
    const journal = []
    Object.keys(U.vjournal || {}).forEach((i) => { journal.push('── Vidéo, créative ' + (Number(i) + 1) + ' ──'); (U.vjournal[i] || []).forEach((l) => journal.push(typeof l === 'string' ? l : JSON.stringify(l))) })
    const creatives = S.creatives.map((c) => c && { ...c, imgB64: null })
    const r = await fetch(SERVER + '/production/dossier', { method: 'POST', headers: JH, body: JSON.stringify({ commande_id: S.commandeId, brief: S.brief, journal,
      deliverables: { synthesis: S.synthesis, marche: S.marche, angles: S.angles, planNiveaux: S.planNiveaux, planApprentissage: S.planApprentissage || null, couts: { ...(S.couts || {}), budget: S.budget || null }, copies: S.copies, creatives } }) })
    const d = await r.json().catch(() => ({}))
    if (!r.ok || d.error) throw new Error(d.error || 'HTTP ' + r.status)
    U.dossier = { etat: 'ok', url: d.url, fichiers: d.fichiers, mo: d.mo, manques: d.manques || [] }; emit()
    conserverDossier(d)   // auto-prod-v1 : le lien est rangé dans la commande, il ne se perd plus
    if (!silencieux) toast('Dossier complet prêt (' + d.fichiers + ' fichiers, ' + d.mo + ' Mo).')
    return d
  } catch (e) { U.dossier = { etat: 'err', erreur: e.message }; emit(); if (!silencieux) await alertDlg('Dossier complet impossible : ' + e.message); return null }
}

// v10c — bouton « Annuler » sur chaque carte : arrête cette créative seule, puis « Relancer » repart proprement
export async function annulerCrea(idx) {
  const c = S.creatives[idx]; if (!c) return
  if (estSlotVideo(c)) { await VID.annulerVideo(idx); return }
  genId[idx] = (genId[idx] || 0) + 1
  U.crea[idx] = { state: 'err', text: 'Annulée', err: 'Annulée à ta demande — clique sur ↻ pour relancer.' }; emit()
}
