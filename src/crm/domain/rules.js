// Règles métier (reprises de l'ancien CRM) : qui est dans Appels, Closing, Écrit, Leads, et ce qui est dû.
import { N, jours } from './notes'
import { CLOSING_JOURS, APPEL_DELAI_MS } from './defaults'

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
export const closingProchainJ = (n) => { for (const j of CLOSING_JOURS) if (!n['closing_sent_j' + j]) return j; return null }
export const closingEnRetard = (n, now) => { const pj = closingProchainJ(n); return pj !== null && closingJours(n, now) >= pj }
export const closingInfosIncompletes = (n) => !n.closing_prenom || !n.closing_mots || !n.closing_offre

// Relances Leads J+3 / J+10 / J+21 : « envoyée » = case cochée à la main OU envoi depuis le CRM
export const RELANCES = [3, 10, 21]
export const relanceEnvoyee = (n, j) => !!(n['sent_j' + j] || n['j' + j + '_envoye'])
export const prochaineRelance = (n) => { for (const j of RELANCES) if (!relanceEnvoyee(n, j)) return j; return null }
export const jDepuisLead = (p, now = Date.now()) => Math.floor((now - new Date(p.date_lead || p.date_contact || now)) / 86400000)
export function leadsARelancer(prospects) { return prospects.filter((p) => p.statut === 'lead' && !horsLeads(p) && !N(p).pas_interesse) }

// Écrit : étape suivante à envoyer
export const ECRIT_ORDRE = ['b1', 'b2', 'b3', 'suite']
export const ecritB1Saute = (n) => !!(n.sent_j3 || n.sent_j10 || n.sent_j21 || n.j3_envoye)
export function ecritProchaine(n) {
  for (const e of ECRIT_ORDRE) { if (e === 'b1' && ecritB1Saute(n)) continue; if (!n['ecrit_sent_' + e]) return e }
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
      const j = jDepuisLead(p, now), pj = prochaineRelance(n)
      if (pj !== null && j >= pj) out.relances.push({ p, j: pj, retard: j - pj })
    }
  }
  out.appels.sort((a, b) => a.at - b.at)
  out.closing.sort((a, b) => b.age - a.age)
  out.relances.sort((a, b) => b.retard - a.retard)
  return out
}
