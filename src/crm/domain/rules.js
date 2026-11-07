// Règles métier (reprises de l'ancien CRM) : qui est dans Appels, Closing, Écrit, Leads, et ce qui est dû.
import { N, jours } from './notes'
import { CLOSING_JOURS, CLOSING_DELAIS, APPEL_DELAI_MS } from './defaults'

export const closingEtat = (p) => (N(p).closing_etat || '')
export const ecritEtat = (p) => (N(p).ecrit_etat || '')
export const ecritActif = (p) => ecritEtat(p) === 'actif'
export const actif = (p) => p && p.statut !== 'a_contacter' && p.statut !== 'archive'
export const appelDansListe = (p) => actif(p) && !!N(p).appel_reserve
export const appelAffiche = (p) => appelDansListe(p) && !closingEtat(p)
export const closingDansListe = (p) => actif(p) && closingEtat(p) === 'relance' && !N(p).pas_interesse
export const horsLeads = (p) => appelDansListe(p) || ecritActif(p)
export const estInstagram = (p) => (p.canal_contact ? p.canal_contact === 'instagram' : !!p.lien_instagram)
export const numeroWa = (p) => (p.lien_wa || '').replace('https://wa.me/', '').split('?')[0].replace(/\D/g, '')

const ts = (v) => { const t = Date.parse(v || ''); return isNaN(t) ? null : t }
export const appelProgrammeTs = (n) => ts(n.appel_programme_at)
export const appelEcheance = (n) => { const pr = appelProgrammeTs(n); if (pr !== null) return pr; const t = ts(n.appel_reserve_at); return t === null ? null : t + APPEL_DELAI_MS }
export const appelEnRetard = (n, now = Date.now()) => { if (!n || n.appel_fait) return false; const e = appelEcheance(n); return e !== null && now >= e }

export const closingJours = (n, now = Date.now()) => { const t = ts(n.closing_at || n.appel_fait_at); return t === null ? 0 : Math.max(0, Math.floor((now - t) / 86400000)) }
// Anciens rythmes J+3 / J+7 : une relance déjà envoyée sous l'ancien nom compte pour la nouvelle (J+3 → J+4, J+7 → J+11).
const CLOSING_ANCIEN = { 4: 3, 11: 7 }
export const closingEnvoye = (n, j) => !!(n['closing_sent_j' + j] || (CLOSING_ANCIEN[j] && n['closing_sent_j' + CLOSING_ANCIEN[j]]))
const closingEnvoiAt = (n, j) => ts(n['closing_sent_j' + j + '_at']) ?? (CLOSING_ANCIEN[j] ? ts(n['closing_sent_j' + CLOSING_ANCIEN[j] + '_at']) : null)
export const closingProchainJ = (n) => { for (const j of CLOSING_JOURS) if (!closingEnvoye(n, j)) return j; return null }
// Échéancier : J+1 se compte depuis l'appel ; J+4 se compte 3 jours après l'ENVOI de J+1 ; J+11 se compte 7 jours après l'ENVOI de J+4.
// Si la date d'envoi précédente est inconnue (anciennes données), on retombe sur J+X depuis l'appel.
export function closingEcheance(n, now = Date.now()) {
  const pj = closingProchainJ(n); if (pj === null) return null
  const i = CLOSING_JOURS.indexOf(pj), appel = ts(n.closing_at || n.appel_fait_at)
  let ref = appel, delai = pj
  if (i > 0) { const t = closingEnvoiAt(n, CLOSING_JOURS[i - 1]); if (t !== null) { ref = t; delai = CLOSING_DELAIS[i] } }
  else delai = CLOSING_DELAIS[0]
  const ecoule = ref === null ? 0 : Math.floor((now - ref) / 86400000)
  return { pj, ecoule, delai, reste: delai - ecoule }
}
export const closingEnRetard = (n, now) => { const e = closingEcheance(n, now); return !!e && e.reste <= 0 }
export const closingInfosIncompletes = (n) => !n.closing_prenom || !n.closing_mots || !n.closing_objectif || !n.closing_offre

// Relances Leads J+3 / J+10 / J+21 : « envoyée » = case cochée à la main OU envoi depuis le CRM
export const RELANCES = [3, 10, 21]
export const relanceEnvoyee = (n, j) => !!(n['sent_j' + j] || n['j' + j + '_envoye'])
export const prochaineRelance = (n) => { for (const j of RELANCES) if (!relanceEnvoyee(n, j)) return j; return null }
export const jDepuisLead = (p, now = Date.now()) => Math.floor((now - new Date(p.date_lead || p.date_contact || now)) / 86400000)
// Échéancier : J+3 se compte depuis l'entrée en lead ; J+10 se compte 7 jours après l'ENVOI de J+3 ; J+21 se compte 11 jours après l'ENVOI de J+10.
// Le retard d'une relance ne décale donc que la suivante, jamais les autres. Si la date d'envoi précédente est inconnue (anciennes données), on retombe sur J+X depuis le lead.
export const RELANCES_DELAIS = [3, 7, 11]
export function etatRelances(p, now = Date.now()) {
  const n = N(p), pj = prochaineRelance(n)
  if (pj === null) return { pj: null, ecoule: 0, delai: 0, reste: 0, retard: 0 }
  const i = RELANCES.indexOf(pj), lead = new Date(p.date_lead || p.date_contact || now).getTime()
  let ref = lead, delai = pj
  if (i > 0) { const t = ts(n['j' + RELANCES[i - 1] + '_envoye_at']); if (t !== null) { ref = t; delai = RELANCES_DELAIS[i] } }
  else delai = RELANCES_DELAIS[0]
  const ecoule = Math.floor((now - ref) / 86400000)
  return { pj, ecoule, delai, reste: delai - ecoule, retard: Math.max(0, ecoule - delai) }
}
export function leadsARelancer(prospects) { return prospects.filter((p) => p.statut === 'lead' && !horsLeads(p) && !N(p).pas_interesse) }

// Écrit : étape suivante à envoyer
export const ECRIT_ORDRE = ['b1', 'b2', 'b3', 'b4', 'suite']
// Avant la refonte en 4 blocs, « b3 » était le message d'offre : un prospect qui l'a déjà reçu est considéré comme ayant eu l'étude de cas et l'offre.
export const b3Ancien = (n) => !!n.ecrit_sent_b3 && !n.ecrit_sent_b4 && (ts(n.ecrit_sent_b3_at) || 0) < Date.parse('2026-11-08T00:00:00Z')
export const ecritEnvoye = (n, e) => !!n['ecrit_sent_' + e] || (e === 'b4' && b3Ancien(n))
export const ecritB1Saute = (n) => !!(n.sent_j3 || n.sent_j10 || n.sent_j21 || n.j3_envoye)
export function ecritProchaine(n) {
  for (const e of ECRIT_ORDRE) { if (e === 'b1' && ecritB1Saute(n)) continue; if (!ecritEnvoye(n, e)) return e }
  return null
}
export function ecritDerniereAt(n) { let best = null; ECRIT_ORDRE.forEach((e) => { const t = ts(n['ecrit_sent_' + e + '_at']); if (t !== null && (best === null || t > best)) best = t }); return best || ts(n.ecrit_at) }

// « À faire aujourd'hui » : tout ce qui est dû, trié par urgence
export function aFaire(prospects, cfg, now = Date.now()) {
  const out = { appels: [], noshow: [], closing: [], ecrit: [], relances: [], ads: 0 }
  const noshowDelaiH = typeof cfg.noshow_delai_h === 'number' ? cfg.noshow_delai_h : 2
  const finJour = new Date(now); finJour.setHours(23, 59, 59, 999)
  for (const p of prospects) {
    const n = N(p)
    if (appelAffiche(p)) {
      const e = appelEcheance(n)
      const pr = appelProgrammeTs(n)
      if (!n.appel_fait && pr !== null && now >= pr + noshowDelaiH * 3600000 && (p.statut === 'lead' || p.statut === 'en_suivi')) out.noshow.push({ p, depuis: now - pr })
      else if (e !== null && e <= finJour.getTime()) out.appels.push({ p, retard: now >= e, at: e })
    } else if (closingDansListe(p) && closingEnRetard(n, now)) {
      out.closing.push({ p, j: closingProchainJ(n), age: closingJours(n, now) })
    } else if (ecritActif(p)) {
      const e = ecritProchaine(n)
      if (e) out.ecrit.push({ p, etape: e, depuis: ecritDerniereAt(n) })
    } else if (p.statut === 'lead' && !horsLeads(p) && !n.pas_interesse) {
      const e = etatRelances(p, now)
      if (e.pj !== null && e.reste <= 0) out.relances.push({ p, j: e.pj, retard: e.retard })
    }
  }
  out.appels.sort((a, b) => a.at - b.at)
  out.closing.sort((a, b) => b.age - a.age)
  out.relances.sort((a, b) => b.retard - a.retard)
  return out
}
