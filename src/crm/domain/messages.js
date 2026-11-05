// Construction des messages (reprise de l'ancien CRM). Toutes les fonctions reçoivent la config (templates enregistrés).
import { N } from './notes'
import { OFFRES } from './offres'
import * as D from './defaults'
import * as PV from './defaults_prev'
import { PREV2_DEFAULT_ECRIT } from './defaults_prev2'
// compare deux textes sans tenir compte des apostrophes typographiques, espaces et astérisques
const norm = (s) => String(s || '').replace(/[’‘]/g, "'").replace(/\*/g, '').replace(/\s+/g, ' ').trim()
const estAncien = (x, ...prevs) => prevs.some((prev) => !!prev && norm(x) === norm(prev))

const pd = (cfg) => {
  const c = (cfg && cfg.pitch_data) || {}, d = D.PITCH_DATA_DEFAUT
  const num = (v, def) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= 0 ? n : def }
  const cas = {}
  ;[1, 2, 3, 4].forEach((k) => { const x = (c.cas || {})[k] || {}; cas[k] = { b: (x.b || '').trim() || d.cas[k].b, m: (x.m || '').trim() || d.cas[k].m, n: (x.n || '').trim() || d.cas[k].n, s: (x.s || '').trim() || d.cas[k].s } })
  return { seuil_ads: num(c.seuil_ads, d.seuil_ads), seuil_jours: num(c.seuil_jours, d.seuil_jours), fraicheur_j: num(c.fraicheur_j, d.fraicheur_j), duree: c.duree === 'moy' ? 'moy' : 'med', repli: (c.repli || '').trim() ? c.repli : d.repli, cas0: (c.cas0 || '').trim() ? c.cas0 : d.cas0, cas }
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

// ── Closing après appel (J+1 / J+3 / J+7)
export function closingTemplates(cfg) {
  let t = cfg && cfg.tpl_closing
  if (!Array.isArray(t) || t.length !== D.CLOSING_SLOTS.length) t = D.DEFAULT_CLOSING
  // un modèle jamais modifié (= ancien défaut) prend le nouveau défaut (mis en gras)
  return D.CLOSING_SLOTS.map((x, i) => (!t[i] || estAncien(t[i], PV.PREV_DEFAULT_CLOSING[i])) ? D.DEFAULT_CLOSING[i] : t[i])
}
export const closingSlot = (n, i) => (i === 0 ? (n.closing_ab1 === 'B' ? 1 : 0) : i === 1 ? (n.closing_ab3 === 'B' ? 3 : 2) : 4)
export function closingMessage(p, i, cfg, lienPerso) {
  const n = N(p), tpl = (closingTemplates(cfg)[closingSlot(n, i)] || '').trim(), offre = OFFRES[n.closing_offre]
  const vals = { Prénom: (n.closing_prenom || '').trim(), Marque: p.nom_marque || '', Mots: (n.closing_mots || '').trim(), Objection: (n.closing_objection || '').trim(), Objectif: (n.closing_objectif || '').trim(), Lien: offre ? (lienPerso || offre.url) : '', Facture: offre ? offre.facture : '' }
  const manque = []
  const msg = tpl.replace(/\[(Pr[ée]nom|Marque|Mots|Objection|Objectif|Lien|Facture)\]/gi, (m, k) => {
    const key = Object.keys(vals).find((x) => x.toLowerCase() === k.toLowerCase()), v = vals[key]
    if (!v) { const nom = key === 'Lien' || key === 'Facture' ? 'offre' : key; if (!manque.includes(nom)) manque.push(nom) }
    return v
  })
  return { msg: lienPerso ? unifierLiens(msg, lienPerso) : msg, manque }
}

// ── Closing par écrit (blocs 1 à 3 + suite)
export function ecritTemplates(cfg) {
  const saved = (cfg && cfg.tpl_ecrit2) || {}, out = {}
  Object.keys(D.DEFAULT_ECRIT).forEach((k) => { out[k] = typeof saved[k] === 'string' && saved[k].trim() && !estAncien(saved[k], PV.PREV_DEFAULT_ECRIT[k], PREV2_DEFAULT_ECRIT[k]) ? saved[k] : D.DEFAULT_ECRIT[k] })
  return out
}
export function ecritMessage(p, etape, cfg, lienPerso) {
  const n = N(p), T = ecritTemplates(cfg), offre = n.ecrit_offre || ''
  let cle = etape
  const v = pitchVariante(p, cfg)
  let casEcrit = null
  if (etape === 'b1') {
    if (v.cas != null) { cle = 'b1_cas' + v.cas; casEcrit = v.cas }
    else if (v.maj) return { msg: '', manque: ['durée des ads illisible (relance « Mettre à jour les ads »)'], cle: 'b1' }
    else return { msg: '', manque: ['ads à jour (clique sur « Mettre à jour les ads » : l\'audit a besoin de ses vrais chiffres)'], cle: 'b1' }
  }
  if (etape === 'b2') {
    // la faille vient de ses ads (cas relevé à l'envoi du bloc 1, sinon relevé actuel) ; un choix manuel passe avant
    const auto = D.ECRIT_FAILLE_AUTO[n.ecrit_cas != null ? n.ecrit_cas : v.cas]
    cle = 'b2_' + (n.ecrit_faille || auto || '')
  }
  if (etape === 'b3') cle = 'b3_' + offre
  let tpl = T[cle]
  const manque = []
  if (!tpl) { manque.push(etape === 'b2' ? 'faille (mets à jour ses ads, elle se définit d\'après eux)' : 'offre'); return { msg: '', manque, cle } }
  const o = OFFRES[offre] || {}
  const vals = { marque: p.nom_marque || '', produit: (p.produit || '').trim() || 'votre produit', pays: p.pays || '', remarque: (n.ecrit_remarque || '').trim(), lien: o.url ? (lienPerso || o.url) : '', facture: o.facture || '', delai: D.ECRIT_DELAI[offre] || '48 h', n: D.ECRIT_N[offre] || '' }
  tpl = tpl.split('\n').filter((l) => !(/\[remarque\]/i.test(l) && !vals.remarque)).join('\n').replace(/\n{3,}/g, '\n\n')
  let msg = tpl.replace(/\[(marque|produit|pays|remarque|lien|facture|delai|n)\]/gi, (m, k) => {
    const x = vals[k.toLowerCase()]
    if (!x) { const nom = k.toLowerCase() === 'lien' || k.toLowerCase() === 'facture' ? 'offre' : k; if (!manque.includes(nom)) manque.push(nom) }
    return x
  })
  if (/^b1_cas/.test(cle)) msg = remplirPitchDonnees(msg, v)
  if (lienPerso) msg = unifierLiens(msg, lienPerso)
  return { msg, manque, cle, cas: casEcrit }
}

// ── Relances Leads J+3 (pitch avec les ads, variables) / J+10 (preuve) / J+21 (alerte)
export function relanceTemplates(cfg) { const t = cfg && cfg.tpl_relances; return Array.isArray(t) && t.length ? t.map((x, i) => (i > 0 && (estAncien(x, PV.PREV_DEFAULT_RELANCES[i]) || (i === 2 && /trou sur la route/i.test(x)))) ? D.DEFAULT_RELANCES[i] : x) : D.DEFAULT_RELANCES }
export function relanceMessage(p, idx, cfg) {
  let tpl = relanceTemplates(cfg)[idx] || ''
  if (idx !== 0 && D.J3_VARS.test(tpl)) tpl = D.DEFAULT_RELANCES[idx] || ''
  if (idx === 2 && tpl === D.OLD_J21_DEFAUT) tpl = D.DEFAULT_RELANCES[2]
  let v = null, avertir = false, trace = ''
  if (idx === 0 && D.J3_VARS.test(tpl)) {
    v = pitchVariante(p, cfg)
    if (v.cas === 0) { tpl = pd(cfg).cas0; trace = 'cas0' } else if (v.cas) { tpl = remplirPitchDonnees(tpl, v); trace = 'cas' + v.cas } else { tpl = pd(cfg).repli; trace = 'repli'; avertir = !v.maj }
  }
  let msg = tpl.replace(/\[Marque\]/gi, p.nom_marque || '')
  if (/\[Produit\]/i.test(msg)) msg = msg.replace(/\[Produit\]/gi, p.produit || '')
  if (/\[Pays\]/i.test(msg)) {
    const { phrase } = resoudrePays(p.pays)
    msg = msg.replace(/\b(en|au|à)\s+\*\[pays\]\*/gi, '*' + phrase + '*').replace(/\*\[pays\]\*/gi, '*' + phrase + '*').replace(/\b(en|au|à)\s+\[Pays\]/gi, phrase).replace(/\[Pays\]/gi, phrase).replace(/\b(en|au|à)\s+\*?\s*(en|au|à)\b/gi, '$2')
  }
  return { msg, v, avertir, trace, chemin: ((msg.match(/adstackofficial\.com(\/[\w\-\/]*)?/i) || [])[1] || '') }
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
  closing_j1: 'Closing J+1', closing_j3: 'Closing J+3', closing_j7: 'Closing J+7',
  ecrit_b3: 'Écrit · offre', ecrit_suite: 'Écrit · suite',
}
export const lienOffreSuivi = (offreKey, campagne, medium, id) => {
  const o = OFFRES[offreKey]; if (!o) return ''
  return `https://www.adstackofficial.com/${offreKey}?utm_source=crm&utm_medium=${medium}&utm_campaign=${campagne}&utm_content=${id}`
}

// ── Pitch (envoyé quand le prospect a répondu) : lien suivi, campagne « pitch »
export const lienPitch = (id) => `https://www.adstackofficial.com/?utm_source=crm&utm_medium=pitch&utm_campaign=pitch&utm_content=${id}`
export function pitchMessage(p, cfg, lien) {
  const tpl = (cfg && cfg.tpl_pitch) || D.DEFAULT_PITCH
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
