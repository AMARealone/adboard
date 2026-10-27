// Moteur de production — même logique que l'ancien Factory (prodv2*), sans aucun affichage :
// il met à jour l'état (state.js) et l'interface React se redessine toute seule.
import { prodv2State as S, SERVER, COMP_FILES, CT_IMAGES, emit, loadSkills } from './state'
import * as V from './verbatim'
import { ctGetBase64, loadCTImages } from '../ctApi'
import { confirmDlg, alertDlg, toast } from '../ui'

const JH = { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' }
const NGROK = { 'ngrok-skip-browser-warning': '1' }
const U = S.ui
let abortCtl = null
let autosaveTimer = null
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
  U.agents[2] = { state: 'pending', text: 'En attente — créatives à produire (3 par angle)', pct: 0 }
  U.agents[3] = { state: 'pending', text: 'En attente — 5 hooks + 1 description par angle', pct: 0 }
}
const done = (c) => !!c && (c.imgB64 || c.url)
export const nbCrea = () => S.creatives.filter(done).length
export const nbCopy = () => S.copies.filter(Boolean).length
export const angleCount = () => V.prodv2GetAngleCount()
export const estComplet = () => V.prodv2EstActuellementComplet()
export const livrablesPayload = () => JSON.stringify({ creatives: S.creatives, copies: S.copies, synthesis: S.synthesis, angles: S.angles, marche: S.marche })

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
  try { localStorage.setItem('adstack_active_production', JSON.stringify({ commandeId: b.id, ts: Date.now() })) } catch (_) {}
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
  if (S.productId) {
    try {
      const rc = await V.fetchAvecTimeout(`${SERVER}/products/${S.productId}/renewal-context`, { headers: NGROK }, 15000)
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
  emit()
}

// ── Reprendre l'affichage d'une commande (livrables déjà générés) ──
export async function restoreFromCommande(b) {
  const dejaLivre = b.status === 'done'
  const d = b.deliverables || {}
  const nc = d.creatives ? d.creatives.filter(done).length : 0
  const np = d.copies ? d.copies.filter(Boolean).length : 0
  await loadBriefFromCommande(b)
  S.synthesis = d.synthesis || null; S.angles = d.angles || []; S.creatives = d.creatives || []; S.copies = d.copies || []; S.marche = d.marche || null
  const nbAngles = Math.max(V.prodv2GetAngleCount(), S.angles.length, Math.ceil(S.creatives.length / 3), S.copies.length)
  const nbTot = nbAngles * 3
  U.nbAngles = nbAngles; S.activeAngle = 0; U.synOpen = false; U.sending = {}
  resetAgents()
  U.crea = Array.from({ length: nbTot }, (_, i) => { const it = S.creatives[i]; return it && it.status === 'done' ? { state: 'done', text: 'Prêt' } : { state: 'pending', text: 'En attente' } })
  U.copy = Array.from({ length: nbAngles }, (_, i) => ({ state: S.copies[i] ? 'done' : 'wait' }))
  if (dejaLivre) { try { localStorage.removeItem('adstack_active_production') } catch (_) {} }
  const nom = b.product?.nom || '?'
  U.banner = { kind: dejaLivre || nc || np ? 'info' : 'info', text: dejaLivre
    ? `Cette commande a déjà été livrée au client — "${nom}" (${nc}/${nbTot} créatives, ${np}/${nbAngles} sets ad copy). Affichage en lecture seule.`
    : nc || np ? `Contenu déjà généré restauré — "${nom}" (${nc}/${nbTot} créatives, ${np}/${nbAngles} sets ad copy déjà sauvegardés). Rien n'a été perdu.`
    : `Brief chargé — "${nom}". Aucune génération n'a encore commencé.` }
  U.launched = !(nc === 0 && np === 0)
  if (U.launched) {
    if (S.synthesis) setAgent(1, 'done', `Synthèse · ${Math.round(S.synthesis.length / 1000)}K chars · ${nbAngles} angles extraits`, 100)
    setAgent(2, nc === nbTot ? 'done' : 'active', `${nc} / ${nbTot} créatives générées`, Math.round(nc / nbTot * 100))
    setAgent(3, np === nbAngles ? 'done' : 'active', `${np} / ${nbAngles} sets ad copy générés`, Math.round(np / nbAngles * 100))
    U.launchLabel = 'Relancer la production'
  } else U.launchLabel = 'Lancer la production'
  U.running = false
  emit()
}

// Ouvre une commande dans la production (équivalent de « Lancer / Ouvrir » de l'ancien Factory).
export async function openCommande(id) {
  if (S.commandeId && S.commandeId !== id && !V.prodv2EstActuellementComplet()) {
    const nomActuel = S.brief?.produit || 'la production en cours'
    if (!(await confirmDlg(`"${nomActuel}" est encore en cours de génération (pas encore terminée). La quitter maintenant risque de perdre ce qui n'est pas encore sauvegardé.\n\nContinuer quand même ?`))) return false
  }
  if (U.running && S.commandeId === id) return true
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

// ── Lancer la production ──
export async function launch() {
  if (!S.brief || !S.productB64) { await alertDlg('Charge un brief.json valide avec photo_produit avant de lancer.'); return }
  const aDejaDuContenu = S.creatives.some(done)
  if (aDejaDuContenu && !(await confirmDlg("Relancer la production ?\n\nLe batch actuel (déjà généré, éventuellement déjà envoyé) sera ABANDONNÉ définitivement — y compris chez le client si tu l'avais déjà envoyé.\n\nLe nouveau batch qui va être généré sera le SEUL valide à partir de maintenant.", { ok: 'Relancer', danger: true }))) return
  if ((S.briefSource !== 'commande' || !S.commandeId) && !(await confirmDlg("Cette production N'EST PAS liée à un ticket de commande.\n\nLa sauvegarde automatique des livrables ne sera PAS active — si tu fermes l'onglet avant d'avoir cliqué « Envoyer au client », tout sera perdu.\n\nLance plutôt depuis un ticket (« Lancer » / « Relancer ») si c'est pour un vrai client.\n\nContinuer quand même (test) ?"))) return
  if (S.renewalContext?.commandeActiveAilleurs) { await alertDlg("Une autre commande est déjà en production pour ce produit.\n\nAttends qu'elle se termine (ou soit envoyée au client) avant de lancer celle-ci — sinon l'historique d'angles marketing ne sera plus fiable."); return }
  await loadSkills(); await loadCTImages()
  S.startTime = Date.now()
  if (S.commandeId) {
    fetch(`${SERVER}/commandes/${S.commandeId}/generation-started`, { method: 'POST' }).catch(() => {})
    try { localStorage.setItem('adstack_active_production', JSON.stringify({ commandeId: S.commandeId, ts: Date.now() })) } catch (_) {}
    if (aDejaDuContenu) toast("Ancien batch abandonné — nouvelle génération en cours, c'est elle qui compte désormais.")
  }
  S.synthesis = null; S.angles = []; S.creatives = []; S.copies = []; S.marche = null
  abortCtl = new AbortController()
  const nbAngles = V.prodv2GetAngleCount()
  const nbTot = nbAngles * 3
  U.nbAngles = nbAngles; S.activeAngle = 0; U.synOpen = false; U.sending = {}; U.banner = null
  U.crea = Array.from({ length: nbTot }, () => ({ state: 'pending', text: 'En attente' }))
  U.copy = Array.from({ length: nbAngles }, () => ({ state: 'run' }))
  resetAgents(); U.launched = true; U.running = true; U.launchLabel = 'Production en cours…'; emit()
  const signal = abortCtl.signal
  try {
    setAgent(1, 'active', 'Recherche multi-sources + synthèse S0→S7…', 20)
    const { analysteSystem, analysteParts } = await V.buildAnalysteInputs(nbAngles, nbTot)
    const raw = await V.apiAnalysteSynthese(analysteSystem, analysteParts, 64000, S.brief, signal)
    const { synthesisText, marche } = V.prodv2SplitSynthesisAndMarche(raw)
    S.synthesis = synthesisText; S.marche = marche; S.angles = V.prodv2ExtractAngles(synthesisText, nbAngles)
    setAgent(1, 'done', `Synthèse · ${Math.round(synthesisText.length / 1000)}K chars · ${nbAngles} angles extraits`, 100)
    setAgent(2, 'active', 'Sélection des CTs adaptés à la synthèse…', 5)
    const ctPick = await V.selectCTsForGeneration(synthesisText, nbTot, 'production', S.renewalContext?.ctsUtilisesDernierLot)
    if (ctPick.length === 0) throw new Error('Galerie CT vide — ajoute des CTs dans la Galerie CT image.')
    console.log('[PROD] CTs sélectionnés :', ctPick.map((id) => CT_IMAGES[id + '_name'] || id).join(' / '))
    for (let a = 0; a < nbAngles; a++) for (let c = 0; c < 3; c++) {
      const idx = a * 3 + c
      S.creatives.push({ angleIdx: a, ctIdx: c, ct: ctPick[idx % ctPick.length], status: 'pending' })
    }
    setAgent(2, 'active', `0 / ${nbTot} créatives générées`, 0)
    setAgent(3, 'active', 'Écriture des hooks et descriptions…', 10)
    let creativesDone = 0
    const runCreatives = async () => {
      for (let a = 0; a < nbAngles; a++) for (let c = 0; c < 3; c++) {
        if (signal.aborted) throw new DOMException('Annulé', 'AbortError')
        const idx = a * 3 + c
        try { await generateOneCreativeWithRetry(idx, a, c, ctPick[idx], signal) }
        catch (err) {
          if (err.name === 'AbortError' && signal.aborted) throw err
          console.error(`Erreur créative ${idx + 1} :`, err)
          markCreativeError(idx, err.message || 'Erreur inconnue')
        }
        creativesDone++
        setAgent(2, 'active', `${creativesDone} / ${nbTot} créatives générées`, Math.round(creativesDone / nbTot * 100))
        if (creativesDone % 3 === 0 || creativesDone === nbTot) autosave(creativesDone === nbTot)
      }
    }
    const seqPromise = runCreatives().catch((err) => { if (err.name === 'AbortError') throw err; console.error('Erreur génération créatives :', err); setAgent(2, 'active', `Erreur : ${err.message}`, 0) })
    const copyPromises = []
    for (let a = 0; a < nbAngles; a++) copyPromises.push(generateOneCopy(a, signal).catch((err) => { if (err.name === 'AbortError') throw err; markCopyError(a, err.message) }))
    if (S.productId && !S.marche) console.warn('[Données Marché] Extraction échouée pour ce batch.')
    await Promise.all([seqPromise, ...copyPromises])
    setAgent(2, 'done', `${nbTot} / ${nbTot} créatives générées`, 100)
    setAgent(3, 'done', `${nbAngles} / ${nbAngles} sets ad copy générés`, 100)
    if (S.briefSource === 'commande' && S.commandeId) {
      try {
        const r = await fetch(`${SERVER}/commandes/${S.commandeId}/save-deliverables`, { method: 'POST', headers: JH, body: livrablesPayload() })
        if (!r.ok) throw new Error('HTTP ' + r.status)
      } catch (e) {
        console.warn('[Commande] Sauvegarde livrables échouée :', e.message)
        await alertDlg(`La sauvegarde automatique des livrables a échoué (${e.message}).\n\nNE FERME PAS CET ONGLET — utilise directement le bouton « Envoyer au client » en bas de cette page, il fonctionne avec ce qui est déjà affiché.`)
      }
    }
    U.running = false; U.launchLabel = 'Relancer la production'; abortCtl = null; emit()
  } catch (err) {
    if (err.name === 'AbortError' || (abortCtl && abortCtl.signal.aborted)) { U.launchLabel = 'Relancer la production' }
    else { console.error(err); await alertDlg('Erreur production : ' + err.message); U.launchLabel = 'Réessayer' }
    U.running = false; abortCtl = null; emit()
  }
}
export function cancel() { if (abortCtl) abortCtl.abort() }

// ── Créatives ──
async function generateOneCreativeWithRetry(idx, angleIdx, ctIdx, ctName, signal) {
  const RETRY_DELAY_MS = 30000, MAX_RETRIES = 2
  let lastErr = null
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    if (signal && signal.aborted) throw new DOMException('Annulé', 'AbortError')
    try { return await generateOneCreative(idx, angleIdx, ctIdx, ctName, signal) }
    catch (err) {
      const vraieAnnulation = err.name === 'AbortError' && signal && signal.aborted
      if (vraieAnnulation) throw err
      lastErr = err
      const msg = (err.message || '').toLowerCase()
      const isTimeout = err.name === 'AbortError' || err.name === 'TimeoutError' || msg.includes('timeout')
      const isQuota = msg.includes('exhausted') || msg.includes('quota') || msg.includes('429') || msg.includes('rate')
      if ((!isQuota && !isTimeout) || attempt > MAX_RETRIES) throw err
      U.crea[idx] = { state: 'running', text: isTimeout ? `Timeout serveur — retry ${attempt}/${MAX_RETRIES} dans 30s` : `Rate limit Gemini — retry ${attempt}/${MAX_RETRIES} dans 30s` }
      emit()
      await new Promise((resolve, reject) => {
        const t = setTimeout(resolve, RETRY_DELAY_MS)
        if (signal) signal.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Annulé', 'AbortError')) }, { once: true })
      })
    }
  }
  throw lastErr
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

async function generateOneCreative(idx, angleIdx, ctPositionInAngle, ctName, signal) {
  U.crea[idx] = { state: 'running', text: 'En cours' }; emit()
  await loadSkills()
  const ctMimeRaw = CT_IMAGES[ctName + '_mime'] || 'image/jpeg'
  const ctB64 = await V.compressImg(await ctGetBase64(ctName), ctMimeRaw)
  const productB64 = await V.compressImg(S.productB64, S.productMime || 'image/jpeg')
  const { creativeSystem, angleInstruction } = V.buildCreativeInstruction(angleIdx, ctPositionInAngle)
  // 600 s : large marge au-dessus du pire cas serveur (voir l'historique des correctifs de l'ancien Factory)
  const combinedSignal = (typeof AbortSignal.any === 'function') ? AbortSignal.any([signal, AbortSignal.timeout(600000)]) : signal
  const res = await fetch(SERVER + '/creative-prod', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: combinedSignal,
    body: JSON.stringify({ systemPrompt: creativeSystem, synthese: S.synthesis, brief: S.brief, angleInstruction, ctBase64: ctB64, ctMime: 'image/jpeg', productBase64: productB64, productMime: 'image/jpeg' }),
  })
  const d = await res.json()
  if (d.error) throw new Error(d.error)
  const imgB64 = d.imageData
  const imageMime = d.imageMime || 'image/png'
  const desc = (d.meta && d.meta.length > 5) ? d.meta.slice(0, 200) : `Créative · ${ctName} · Angle ${angleIdx + 1}`
  // Affichage immédiat avec le base64
  S.creatives[idx] = { ...S.creatives[idx], imgB64, desc, status: 'done', imageMime }
  U.crea[idx] = { state: 'done', text: 'Prêt' }; emit()
  // Upload immédiat vers le Storage : seul un lien léger est gardé ensuite (évite les lignes trop lourdes en base)
  let url = null, thumbUrl = null
  if (S.briefSource === 'commande' && S.commandeId) {
    try {
      const thumbB64 = await genThumb(imgB64, imageMime)
      const rUp = await fetch(`${SERVER}/commandes/${S.commandeId}/upload-creative-now`, { method: 'POST', headers: JH, body: JSON.stringify({ imgB64, mime: imageMime, index: idx, thumbB64 }) })
      const dUp = await rUp.json()
      if (dUp.ok && dUp.url) { url = dUp.url; thumbUrl = dUp.thumbUrl || null }
    } catch (e) { console.warn(`[Upload immédiat] Créative ${idx} — échoué, conservée en base64 en secours :`, e.message) }
  }
  S.creatives[idx] = url
    ? { ...S.creatives[idx], url, thumbUrl, imgB64: null, desc, status: 'done', imageMime }
    : { ...S.creatives[idx], imgB64, desc, status: 'done', imageMime }
  emit()
}
function markCreativeError(idx, msg) { U.crea[idx] = { state: 'err', text: 'Erreur', err: String(msg).slice(0, 200) }; emit() }
export async function regenerateCrea(idx) {
  const c = S.creatives[idx]; if (!c) return
  U.crea[idx] = { state: 'running', text: 'En cours' }
  S.creatives[idx] = { ...c, imgB64: null, url: null, status: 'pending' }; emit()
  try { await generateOneCreative(idx, c.angleIdx, c.ctIdx, c.ct, new AbortController().signal); autosave() }
  catch (err) { markCreativeError(idx, err.message) }
}
export function downloadCrea(idx) {
  const c = S.creatives[idx]; if (!c || (!c.url && !c.imgB64)) return
  const a = document.createElement('a')
  a.href = c.url || ('data:image/png;base64,' + c.imgB64)
  a.download = `creative_angle${c.angleIdx + 1}_${c.ct}.png`; a.target = '_blank'
  document.body.appendChild(a); a.click(); a.remove()
}

// ── Copies ──
async function generateOneCopy(angleIdx, signal) {
  U.copy[angleIdx] = { state: 'run' }; emit()
  await loadSkills()
  for (let t = 1; t <= 2; t++) {
    const { hooks, description } = await V.prodv2GenerateOneCopyAttempt(angleIdx, signal)
    if (description && description !== "(description vide — Gemini n'a pas suivi le format)") {
      S.copies[angleIdx] = { hooks, description }; U.copy[angleIdx] = { state: 'done' }; emit()
      autosave(angleIdx === S.angles.length - 1); return
    }
    if (t < 2) console.warn(`[Copywriter] Description vide pour l'angle ${angleIdx + 1}, nouvelle tentative...`)
  }
  const { hooks, description } = await V.prodv2GenerateOneCopyAttempt(angleIdx, signal)
  S.copies[angleIdx] = { hooks, description }; U.copy[angleIdx] = { state: 'done' }; emit()
  autosave(angleIdx === S.angles.length - 1)
}
function markCopyError(a, msg) { U.copy[a] = { state: 'err', err: msg }; emit() }
export async function regenerateCopy(angleIdx) {
  try { await generateOneCopy(angleIdx, new AbortController().signal) }
  catch (err) { if (err.name !== 'AbortError') markCopyError(angleIdx, err.message) }
}
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
  const res = await fetch(`${SERVER}/manual-deliver`, { method: 'POST', headers: JH, body: JSON.stringify({ userId: user.id, productId: productId || undefined, newProductName: productId ? undefined : newName, ticketId: S.commandeId || undefined, deliverables: d }) })
  if (!res.ok) throw new Error('HTTP ' + res.status)
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
