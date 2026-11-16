// Apprentissage par client — côté Factory (appr-client-v1).
// Le serveur calcule la décision (carnet du client : angles, concepts, CT, retours qualité) et la renvoie dans renewal-context.apprentissage.
// Ici, le code l'APPLIQUE : rôle de chaque angle (reprise ou test), CT gagnant rejoué sur un nouvel angle, mode de chaque CT (concept gagnant / exploration),
// consignes qualité du client injectées dans les agents. Aucune de ces décisions n'est laissée au hasard du modèle.
import { prodv2State as S, CT_IMAGES } from './state'
import { niveauCT } from '../ctApi'

const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
export const titreCourt = (a) => String(a || '').split('*')[0].replace(/^\s*angle\s*\d+\s*[:—–-]?\s*/i, '').trim()
const memeAngle = (a, b) => {   // égalité, ou l'un contient l'autre quand le plus court est assez long pour ne pas être un hasard
  const x = norm(titreCourt(a)), y = norm(titreCourt(b)); if (!x || !y) return false
  if (x === y) return true
  const [c, l] = x.length <= y.length ? [x, y] : [y, x]
  return c.length >= 10 && l.includes(c)
}

export const directives = () => (S.renewalContext && S.renewalContext.apprentissage) || null
export const bloc = (nom) => { const d = directives(); return (d && d.blocs && d.blocs[nom]) || '' }

// Rôle de chaque angle de la synthèse : 'exploit' (angle gagnant repris) ou 'test'.
export function rolesAngles(angles) {
  const d = directives(), ex = (d && d.exploit) || []
  return (angles || []).map((a, i) => ({ angleIdx: i, nom: titreCourt(a), role: ex.some((e) => memeAngle(a, e.nom)) ? 'exploit' : 'test' }))
}

// CT vidéo gagnant : posé sur un angle « test » dont le niveau de la vidéo correspond. `liste` = galerie vidéo, `plan` = niveaux, `sortie` = choix de l'agent.
export function forcerCTVideo(liste, plan, sortie, balises) {
  const d = directives(); S.apprVideoForce = null
  const g = d && d.ctGagnant; if (!g || g.format !== 'video') return sortie
  const ct = (liste || []).find((c) => c.id === g.ctId); if (!ct) return sortie
  if (sortie.some((x) => x.id === g.ctId)) return sortie
  const roles = rolesAngles(S.angles)
  const cible = sortie.find((x) => (roles[x.angleIdx] || {}).role === 'test' && balises(ct).includes(plan[x.angleIdx].video))
  if (!cible) return sortie
  S.apprVideoForce = { ctId: g.ctId, angleIdx: cible.angleIdx }
  return sortie.map((x) => x === cible ? { ...x, id: ct.id, nom: ct.name || ct.id, poster: ct.posterUrl || '', duree_s: ct.duree_s || 0, raison: 'CT GAGNANT de ce client (indice ' + g.indice + ') rejoué sur un nouvel angle : on garde le concept qui a marché, on change l\'angle.', direction: null } : x)
}

// Construit le plan d'apprentissage de la production et marque chaque emplacement. À appeler quand les emplacements existent.
export function construirePlan(slots) {
  const d = directives(); S.planApprentissage = null
  if (!d) return null
  const roles = rolesAngles(S.angles), g = d.ctGagnant
  let ctGagnant = null
  if (g && g.format !== 'video' && CT_IMAGES[g.ctId]) {
    const i = slots.findIndex((c) => c.kind !== 'video' && (roles[c.angleIdx] || {}).role === 'test' && (CT_IMAGES[g.ctId + '_awareness'] || []).some((a) => niveauCT(a) === c.niveau))
    if (i >= 0) { slots[i] = { ...slots[i], ctForce: g.ctId }; ctGagnant = { ctId: g.ctId, format: 'image', slot: i, angleIdx: slots[i].angleIdx, indice: g.indice } }
  }
  if (!ctGagnant && S.apprVideoForce) ctGagnant = { ctId: S.apprVideoForce.ctId, format: 'video', slot: null, angleIdx: S.apprVideoForce.angleIdx, indice: g && g.indice }
  let k = 0
  slots.forEach((c, i) => {
    if (c.kind === 'video' || c.ctForce) return
    if ((roles[c.angleIdx] || {}).role !== 'test') { slots[i] = { ...c, modeCT: 'libre' }; return }
    slots[i] = { ...c, modeCT: d.blocs.ct_famille && k % 3 === 0 ? 'famille' : (d.blocs.ct_explore ? 'explore' : 'libre') }; k++
  })
  const trouves = roles.filter((r) => r.role === 'exploit').length
  S.planApprentissage = { version: d.version, calcule_le: d.calcule_le, nbAngles: roles.length, ratio: d.ratio, roles, ctGagnant, exploit_attendus: (d.exploit || []).map((e) => e.nom), exploit_trouves: trouves,
    modes: slots.map((c, i) => c.kind === 'video' ? null : { slot: i, mode: c.ctForce ? 'ct_gagnant' : c.modeCT }).filter(Boolean), resume: d.resume }
  return S.planApprentissage
}

// Texte de consigne pour le choix d'UN CT (selon le mode de l'emplacement).
export function consigneCT(slot) {
  const d = directives(); if (!d) return ''
  const mode = slot && slot.modeCT
  return [d.blocs.ct_base, mode === 'famille' ? d.blocs.ct_famille + " Si aucun CT proposé ne correspond, choisis librement." : mode === 'explore' ? d.blocs.ct_explore + " Si aucun ne convient, prends le plus éloigné de ceux-ci." : ''].filter(Boolean).join('\n\n')
}
export const ctSatures = () => { const d = directives(); return (d && d.ctSatures) || [] }
// Message d'état affiché sous le bandeau de la production.
export function messagePlan() {
  const p = S.planApprentissage; if (!p) return null
  const manque = p.ratio && p.ratio.exploit > p.exploit_trouves
  return { kind: manque ? 'warn' : 'info', text: 'Apprentissage de ce client : ' + p.resume + '.' + (manque ? ' ⚠ L\'analyste n\'a repris que ' + p.exploit_trouves + ' angle(s) gagnant(s) sur ' + p.ratio.exploit + ' demandé(s) : vérifie la synthèse (S2).' : '') }
}
