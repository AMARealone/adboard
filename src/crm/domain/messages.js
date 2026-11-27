// Construction des messages (reprise de l'ancien CRM). Toutes les fonctions reçoivent la config (templates enregistrés).
import { N } from './notes'
import { OFFRES } from './offres'
import { PARCOURS, offreAchetee, offreSuivante } from './acheteurs'
import * as D from './defaults'
import * as PV from './defaults_prev'
import { PREV3_J3_REPLI } from './defaults_prev3'
import { PREV4_RELANCES, PREV4_J3_CAS0 } from './defaults_prev4'
import { PREV5_PITCH, PREV5_RELANCES } from './defaults_prev5'
// compare deux textes sans tenir compte des apostrophes typographiques, espaces et astérisques
const norm = (s) => String(s || '').replace(/[’‘]/g, "'").replace(/\*/g, '').replace(/\s+/g, ' ').trim()
const estAncien = (x, ...prevs) => prevs.some((prev) => !!prev && norm(x) === norm(prev))

const pd = (cfg) => {
  const c = (cfg && cfg.pitch_data) || {}, d = D.PITCH_DATA_DEFAUT
  const num = (v, def) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= 0 ? n : def }
  const cas = {}
  ;[1, 2, 3, 4].forEach((k) => { const x = (c.cas || {})[k] || {}; cas[k] = { b: (x.b || '').trim() || d.cas[k].b, m: (x.m || '').trim() || d.cas[k].m, n: (x.n || '').trim() || d.cas[k].n, s: (x.s || '').trim() || d.cas[k].s } })
  return { seuil_ads: num(c.seuil_ads, d.seuil_ads), seuil_jours: num(c.seuil_jours, d.seuil_jours), fraicheur_j: num(c.fraicheur_j, d.fraicheur_j), duree: c.duree === 'moy' ? 'moy' : 'med', repli: (c.repli || '').trim() && !estAncien(c.repli, PREV3_J3_REPLI) ? c.repli : d.repli, cas0: (c.cas0 || '').trim() && !estAncien(c.cas0, PREV4_J3_CAS0, D.J3_CAS0_DEFAUT) ? c.cas0 : d.cas0, j10: c.j10 || {}, cas }
}
// Cas du prospect d'après le dernier relevé d'ads (script PC)
export function pitchVariante(p, cfg) {
  const prm = pd(cfg), a = p && p.ads_j10
  if (!a || !a.maj_at) return { cas: null, maj: false, raison: 'ads pas encore mises à jour (bouton « Mettre à jour ses ads »)' }
  const t = Date.parse(a.maj_at)
  if (!Number.isFinite(t)) return { cas: null, maj: false, raison: 'date du relevé illisible' }
  const age = Math.max(0, Math.floor((Date.now() - t) / 86400000))
  if (age > prm.fraicheur_j) return { cas: null, maj: false, age, raison: 'relevé vieux de ' + age + ' j (valable ' + prm.fraicheur_j + ' j)' }
  const ads = parseInt(a.nb, 10)
  if (!Number.isFinite(ads)) return { cas: null, maj: true, age, raison: 'nombre d\'ads illisible' }
  if (ads < 1) return { cas: 0, maj: true, ads: 0, jours: null, age }
  const dur = a[prm.duree] != null ? a[prm.duree] : (a.med != null ? a.med : a.moy)
  if (dur == null) return { cas: null, maj: true, age, raison: 'durée des ads illisible' }
  const jours = Math.max(1, parseInt(dur, 10) || 1)
  const peu = ads <= prm.seuil_ads, courte = jours < prm.seuil_jours
  const cas = peu ? (courte ? 2 : 1) : (courte ? 4 : 3)
  return { cas, maj: true, ads, jours, age, b: prm.cas[cas].b, m: prm.cas[cas].m, n: prm.cas[cas].n, s: prm.cas[cas].s }
}
export function remplirPitchDonnees(msg, v) {
  msg = msg.replace(/\s*\((?:ex|exemple)\s*:[^)]*\)/gi, '')
  const put = (nom, val) => { msg = msg.replace(new RegExp('\\[' + nom + '\\]', 'gi'), () => val) }
  // Durée approximative au-delà de 30 jours : « plusieurs semaines » (30–60 j), « plusieurs mois » (> 60 j)
  if (v.jours > 30) {
    const phrase = v.jours > 60 ? 'plusieurs mois' : 'plusieurs semaines'
    msg = msg.replace(/\[jours\](\*?)\s+jours\b(\*?)/gi, (m, a, b) => phrase + (a || b)).replace(/\[jours\]/gi, phrase)
  }
  put('ads', v.ads); put('jours', v.jours); put('bonne_nouvelle', v.b)
  put('mauvaise_nouvelle_en_2_mots', v.n); put('mauvaise_nouvelle_2_mots', v.n); put('mauvaise_nouvelle', v.m); put('solution', v.s)
  if (v.ads === 1) msg = msg.replace(/\b1(\*?) ads actives\b/gi, '1$1 ad active').replace(/ en moyenne/gi, '')
  if (v.jours === 1) msg = msg.replace(/\b1(\*?) jours\b/gi, '1$1 jour')
  return msg
}
export function resoudrePays(paysRaw) {
  const brut = (paysRaw || '').trim()
  const adj = D.PAYS_ADJ[brut.toUpperCase()] || brut
  const code = D.PAYS_CODE[adj] || (D.PAYS_PHRASE[brut.toUpperCase()] ? brut.toUpperCase() : '')
  return { code, adj, phrase: D.PAYS_PHRASE[code] || adj || brut }
}

// Closing après appel (J+1 / J+4 / J+11) et closing par écrit : retirés le 27/11/2026.

// ── Relances Leads J+3 (pitch avec les ads, variables) / J+10 (preuve) / J+21 (alerte)
export function relanceTemplates(cfg) { const t = cfg && cfg.tpl_relances; return Array.isArray(t) && t.length ? t.map((x, i) => (estAncien(x, PREV5_RELANCES[i]) || (i <= 1 && estAncien(x, PREV4_RELANCES[i])) || (i > 0 && (estAncien(x, PV.PREV_DEFAULT_RELANCES[i]) || (i === 2 && /trou sur la route/i.test(x))))) ? D.DEFAULT_RELANCES[i] : x) : D.DEFAULT_RELANCES }
export function relanceMessage(p, idx, cfg) {
  let tpl = relanceTemplates(cfg)[idx] || ''
  if (idx !== 0 && D.J3_VARS.test(tpl)) tpl = D.DEFAULT_RELANCES[idx] || ''
  if (idx === 2 && tpl === D.OLD_J21_DEFAUT) tpl = D.DEFAULT_RELANCES[2]
  let v = null, bloque = '', trace = ''
  // J+3 : il faut un relevé d'ads à jour. Sinon on n'envoie rien : le CRM demande de mettre les ads à jour (pas de texte de repli).
  if (idx === 0 && D.J3_VARS.test(tpl)) {
    v = pitchVariante(p, cfg)
    if (v.cas === 0) { tpl = pd(cfg).cas0; trace = 'cas0' } else if (v.cas) { tpl = remplirPitchDonnees(tpl, v); trace = 'cas' + v.cas } else bloque = v.raison || 'ads pas à jour'
  }
  // J+10 : l'étude de cas suit le cas relevé à l'envoi du J+3 (notes.j3_cas) ; à défaut, le relevé du jour.
  if (idx === 1 && /\[cas_(histoire|solution|resultat|slug)\]/i.test(tpl)) {
    const n3 = N(p).j3_cas
    let cas = Number.isInteger(n3) ? n3 : null
    if (cas === null) { v = pitchVariante(p, cfg); cas = v.cas }
    if (cas === null || cas === undefined) bloque = (v && v.raison) || 'ads pas à jour'
    else {
      const cle = D.J10_ETUDE_DE_CAS[cas], base = D.J10_ETUDES[cle], perso = pd(cfg).j10[cle] || {}
      const val = (k) => ((perso[k] || '').trim() ? perso[k] : base[k])
      trace = 'cas' + cas + ':' + cle
      tpl = tpl.replace(/\[cas_histoire\]/gi, () => val('histoire')).replace(/\[cas_solution\]/gi, () => val('solution')).replace(/\[cas_resultat\]/gi, () => val('resultat')).replace(/\[cas_slug\]/gi, () => base.slug)
    }
  }
  let msg = tpl.replace(/\[Marque\]/gi, p.nom_marque || '')
  if (/\[Produit\]/i.test(msg)) msg = msg.replace(/\[Produit\]/gi, p.produit || '')
  if (/\[Pays\]/i.test(msg)) {
    const { phrase } = resoudrePays(p.pays)
    msg = msg.replace(/\b(en|au|à)\s+\*\[pays\]\*/gi, '*' + phrase + '*').replace(/\*\[pays\]\*/gi, '*' + phrase + '*').replace(/\b(en|au|à)\s+\[Pays\]/gi, phrase).replace(/\[Pays\]/gi, phrase).replace(/\b(en|au|à)\s+\*?\s*(en|au|à)\b/gi, '$2')
  }
  let chemin = ((msg.match(/adstackofficial\.com(\/[\w\-\/]*)?/i) || [])[1] || '')
  if (idx === 0 && (!chemin || chemin === '/')) chemin = '/analyse'   // 20 nov. 2026 : le J+3 a sa propre miniature (page /analyse, qui renvoie sur la page de vente)
  return { msg, v, bloque, trace, chemin }
}
export const lienRelance = (idx, id, chemin) => {
  const campagne = ['j3', 'j10', 'j21'][idx] || 'relance'
  const ch = chemin && /^\/[\w\-\/]*$/.test(chemin) ? chemin.replace(/\/+$/, '') : ''
  return `https://www.adstackofficial.com${ch || '/'}?utm_source=crm&utm_medium=relance&utm_campaign=${campagne}&utm_content=${id}`
}
// Un seul lien suivi par message : toute mention du site (« adstackofficial.com », avec ou sans @, https, www, *…*) ou [lien]
// devient le lien suivi ; si le même lien se retrouve plusieurs fois, on ne garde que le premier.
const MENTION_SITE = /@?\*?(?:https?:\/\/)?(?:www\.)?adstackofficial\.com(?:\/[^\s*)]*)?\*?/gi
export function unifierLiens(msg, lien) {
  if (!lien) return msg
  let out = msg.replace(MENTION_SITE, () => lien).replace(/\*?\[lien_demo\]\*?/gi, () => lien).replace(/\*?\[lien\]\*?/gi, () => lien)
  const i = out.indexOf(lien)
  if (i < 0) return out
  const fin = i + lien.length
  const reste = out.slice(fin).split(lien).join('')
  out = out.slice(0, fin) + reste
  return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n')
}
export function insererLien(msg, lien) { return unifierLiens(msg, lien) }

// ── Liens suivis (UTM) vers la page d'une offre : une campagne par type de message, l'identifiant du prospect en utm_content.
export const CAMPAGNES_LIENS = {
  pitch: 'Pitch (1er message)', j10: 'Relance J+10', j21: 'Relance J+21',
  closing_j1: 'Closing J+1', closing_j4: 'Closing J+4', closing_j11: 'Closing J+11', closing_j3: 'Closing J+3 (ancien)', closing_j7: 'Closing J+7 (ancien)',
  ecrit_b4: 'Écrit · offre', ecrit_b3: 'Écrit · offre (ancien)', ecrit_suite: 'Écrit · suite',
}
// `v` change à chaque nouvelle miniature d'offre : le lien devient « nouveau » pour WhatsApp, qui ne ressert plus l'ancien aperçu gardé en cache.
const V_MINIATURES = 5
export const lienOffreSuivi = (offreKey, campagne, medium, id) => {
  const o = OFFRES[offreKey]; if (!o) return ''
  // 19 nov. 2026 : le ONE SHOT a sa page (/test) ; TEST n'est plus vendue, une ancienne fiche TEST pointe vers PERF+
  const page = offreKey === 'oneshot' ? 'test' : offreKey === 'test' ? 'perf' : offreKey
  return `https://www.adstackofficial.com/${page}?utm_source=crm&utm_medium=${medium}&utm_campaign=${campagne}&utm_content=${id}&v=${V_MINIATURES}`
}

// ── Pitch (envoyé quand le prospect a répondu) : lien suivi, campagne « pitch »
export const lienPitch = (id) => `https://www.adstackofficial.com/?utm_source=crm&utm_medium=pitch&utm_campaign=pitch&utm_content=${id}`
export function pitchMessage(p, cfg, lien) {
  const tpl = (cfg && cfg.tpl_pitch && !estAncien(cfg.tpl_pitch, PREV5_PITCH)) ? cfg.tpl_pitch : D.DEFAULT_PITCH   // 20 nov. 2026 : l'ancien pitch enregistré passe au nouveau
  let msg = tpl.replace(/\[Produit\]/gi, (p.produit || '').trim() || 'votre produit').replace(/\[Marque\]/gi, p.nom_marque || '')
  const avait = /adstackofficial\.com/i.test(msg) || /\[lien\]/i.test(msg)
  msg = unifierLiens(msg, lien)
  if (!avait) msg += '\n\n' + lien
  return msg
}

// ── Premiers messages (accroches) : une version par modèle enregistré
export function introMessages(p, cfg) {
  const t = cfg && Array.isArray(cfg.tpl_intros) && cfg.tpl_intros.length ? cfg.tpl_intros : D.DEFAULT_INTROS
  return t.map((tpl, i) => ({ label: 'V' + (i + 1), texte: tpl.replace(/\[Marque\]/g, p.nom_marque || '').replace(/\[Produit\]/g, p.produit || '').replace(/\[Pays\]/g, p.pays || '') }))
}

// ── Acheteurs : un message par étape du parcours (PARCOURS), modifiable dans Templates › Acheteurs.
export function acheteurTemplates(cfg) {
  const t = cfg && cfg.tpl_acheteur
  return PARCOURS.map((e, i) => (Array.isArray(t) && typeof t[i] === 'string' && t[i].trim() ? t[i] : D.DEFAULT_ACHETEUR[i]))
}
export function acheteurMessage(p, cle, cfg, lien) {
  const n = N(p), i = PARCOURS.findIndex((e) => e.cle === cle), tpl = acheteurTemplates(cfg)[i] || ''
  const k = offreAchetee(p), o = OFFRES[k], s = OFFRES[offreSuivante(k)]
  const prenom = (n.closing_prenom || '').trim() || ('*' + (p.nom_marque || 'vous') + '*')
  const vals = { 'Prénom': prenom, Marque: p.nom_marque || '', Offre: o ? o.label : '', 'Délai': o ? o.delai : '', Offre_suivante: s ? s.label : '', Volume_suivant: s ? String(s.n) : '', 'Délai_suivant': s ? s.delai : '', Lien: lien || (s ? s.url : '') }
  const sansAccent = (x) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const manque = []
  const msg = tpl.replace(/\[(Pr[ée]nom|Marque|Offre_suivante|Volume_suivant|D[ée]lai_suivant|D[ée]lai|Offre|Lien)\]/gi, (m, key) => {
    const found = Object.keys(vals).find((x) => sansAccent(x) === sansAccent(key))
    const v = found ? vals[found] : ''
    if (!v) { const nom = found === 'Lien' ? 'offre suivante' : (found || key); if (!manque.includes(nom)) manque.push(nom) }
    return v || m
  })
  return { msg, manque }
}
