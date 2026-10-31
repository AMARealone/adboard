// Calculs du Dashboard (fonctions pures : mêmes entrées → mêmes chiffres, testables sans écran).
import { N } from './notes'
import { appelDansListe } from './rules'

export const CORE_PLANS = ['discovery', 'test', 'starter', 'pro', 'scale']
// Campagnes suivies. « lien: false » = message sans lien (rien à mesurer côté clics).
export const CAMPAGNES = [
  { cle: 'pitch', label: 'Pitch', groupe: 'Prospection' },
  { cle: 'demo', label: 'Démo (ancien)', groupe: 'Prospection', historique: true },
  { cle: 'j3', label: 'Relance J+3', groupe: 'Relances', lien: false },
  { cle: 'j10', label: 'Relance J+10', groupe: 'Relances' },
  { cle: 'j21', label: 'Relance J+21', groupe: 'Relances' },
  { cle: 'closing_j1', label: 'Closing J+1', groupe: 'Closing' },
  { cle: 'closing_j3', label: 'Closing J+3', groupe: 'Closing' },
  { cle: 'closing_j7', label: 'Closing J+7', groupe: 'Closing' },
  { cle: 'ecrit_b3', label: 'Écrit · offre', groupe: 'Écrit' },
  { cle: 'ecrit_suite', label: 'Écrit · suite', groupe: 'Écrit' },
  { cle: 'statut_whatsapp', label: 'Statut WhatsApp', groupe: 'Autres', sansEnvoi: true },
]

// Réservation faite par le formulaire du site : le formulaire écrit source='formulaire_site' (+ form_nom) ; anciennes fiches : appel_via='site'.
export const depuisSite = (n) => n.source === 'formulaire_site' || !!n.form_nom || n.appel_via === 'site'
const JOUR = 86400000
export function fenetre(choix, now = Date.now()) {
  if (choix.de || choix.a) {
    const t0 = choix.de ? Date.parse(choix.de + 'T00:00:00') : 0, t1 = choix.a ? Date.parse(choix.a + 'T23:59:59') : Infinity
    return { t0, t1 }
  }
  if (choix.jours === 0) { const d = new Date(now); d.setHours(0, 0, 0, 0); return { t0: d.getTime(), t1: Infinity } }
  if (!choix.jours || choix.jours >= 9999) return { t0: 0, t1: Infinity }
  const d = new Date(now - choix.jours * JOUR); d.setHours(0, 0, 0, 0)
  return { t0: d.getTime(), t1: Infinity }
}
export const dans = (iso, w) => { const t = Date.parse(iso || ''); return !isNaN(t) && t >= w.t0 && t <= w.t1 }
const pct = (a, b) => (b > 0 ? (a / b) * 100 : null)

export function calculer({ prospects, liens, funnel, tx, w }) {
  const P = prospects.map((p) => ({ p, n: N(p) }))
  // — Tunnel principal : cohorte = contactés dans la période (vraie date de contact)
  const coh = P.filter(({ p }) => p.date_contact && dans(p.date_contact, w))
  const c = coh.length
  const r = coh.filter(({ p }) => p.a_repondu).length
  const i = coh.filter(({ p }) => p.interesse).length
  const l = coh.filter(({ p }) => ['lead', 'acheteur', 'standard', 'scale'].includes(p.statut)).length
  const appelsRes = P.filter(({ p, n }) => appelDansListe(p) && dans(n.appel_reserve_at, w)).length
  const txCore = tx.filter((t) => CORE_PLANS.includes(t.plan) && dans(t.created_at, w))
  const acheteurs = new Set(txCore.map((t) => t.user_id)).size
  const hero = [
    { l: 'Contactés', v: c, p: 100 }, { l: 'Réponses', v: r, p: pct(r, c) }, { l: 'Intéressés', v: i, p: pct(i, c) },
    { l: 'Leads', v: l, p: pct(l, c) }, { l: 'Appels', v: appelsRes, p: pct(appelsRes, c) }, { l: 'Acheteurs', v: acheteurs, p: pct(acheteurs, c), accent: true },
  ]
  // — Appels
  const reserves = P.filter(({ n }) => dans(n.appel_reserve_at, w))
  const appels = {
    reserves: reserves.length,
    site: reserves.filter(({ n }) => depuisSite(n)).length,
    manuel: reserves.filter(({ n }) => !depuisSite(n)).length,
    faits: P.filter(({ n }) => n.appel_fait && dans(n.appel_fait_at, w)).length,
    noShows: P.filter(({ n }) => dans(n.no_show_at, w)).length,
  }
  // — Messages envoyés (clés des fiches)
  const env = {}; CAMPAGNES.forEach((x) => { env[x.cle] = 0 })
  const compte = (cle, ok, at) => { if (ok && dans(at, w)) env[cle]++ }
  P.forEach(({ n }) => {
    compte('pitch', n.pitch_envoye, n.pitch_envoye_at); compte('demo', n.demo_envoye, n.demo_envoye_at)
    ;[3, 10, 21].forEach((j) => compte('j' + j, n['sent_j' + j] || n['j' + j + '_envoye'], n['sent_j' + j + '_at'] || n['j' + j + '_envoye_at']))
    ;[1, 3, 7].forEach((j) => compte('closing_j' + j, n['closing_sent_j' + j], n['closing_sent_j' + j + '_at']))
    ;['b3', 'suite'].forEach((e) => compte('ecrit_' + e, n['ecrit_sent_' + e], n['ecrit_sent_' + e + '_at']))
  })
  // — Clics, panier, paiement, achats par campagne
  const clics = {}; (liens || []).forEach((x) => { if (dans(x.created_at, w)) clics[x.campagne] = (clics[x.campagne] || 0) + (x.clicks || 0) })
  const panier = {}, paiement = {}, achatEv = {}
  ;(funnel || []).forEach((f) => {
    if (!f.campagne || !dans(f.created_at, w)) return
    const m = f.type === 'ajout_panier' ? panier : f.type === 'paiement_initie' ? paiement : f.type === 'achat' ? achatEv : null
    if (m) m[f.campagne] = (m[f.campagne] || 0) + 1
  })
  // Anciennes relances : l'achat était rattaché à la main (j_plus_achat). On garde le plus grand des deux comptages.
  const jc = { j3: 0, j10: 0, j21: 0 }
  P.forEach(({ p }) => { if (!dans(p.date_achat, w)) return; const k = { 'J+3': 'j3', 'J+10': 'j10', 'J+21': 'j21' }[p.j_plus_achat]; if (k) jc[k]++ })
  const lignes = CAMPAGNES.map((x) => {
    const e = env[x.cle], k = x.lien === false ? null : (clics[x.cle] || 0)
    const a = Math.max(achatEv[x.cle] || 0, jc[x.cle] || 0), pn = panier[x.cle] || 0, pm = paiement[x.cle] || 0
    return { ...x, envoyes: e, clics: k, ctr: k === null ? null : pct(k, e), panier: pn, paiement: pm, achats: a, tPanier: k ? pct(pn, k) : null, tPaiement: k ? pct(pm, k) : null, tAchat: k ? pct(a, k) : null }
  }).filter((x) => !x.historique || x.envoyes > 0 || x.clics > 0)
  const suivies = lignes.filter((x) => !x.sansEnvoi)
  const tot = {
    envoyes: suivies.reduce((s, x) => s + x.envoyes, 0), clics: suivies.reduce((s, x) => s + (x.clics || 0), 0),
    panier: suivies.reduce((s, x) => s + x.panier, 0), paiement: suivies.reduce((s, x) => s + x.paiement, 0), achats: suivies.reduce((s, x) => s + x.achats, 0),
  }
  tot.ctr = pct(tot.clics, tot.envoyes)
  const attribues = lignes.reduce((s, x) => s + x.achats, 0)
  const achatsTx = txCore.length
  // — Closing et Écrit
  const closingEntres = P.filter(({ n }) => n.closing_etat && dans(n.closing_at, w))
  const ab = (jour, cle) => ['A', 'B'].map((v) => {
    const g = P.filter(({ n }) => n['closing_sent_j' + jour] && (n[cle] === 'B' ? 'B' : 'A') === v)
    return { v, envoyes: g.length, payes: g.filter(({ p, n }) => p.statut === 'acheteur' || n.closing_etat === 'paye').length }
  })
  const closing = {
    entres: closingEntres.length, payes: P.filter(({ n }) => dans(n.closing_paye_at, w)).length,
    perdus: P.filter(({ n }) => n.pas_interesse && dans(n.pas_interesse_at, w)).length,
    j1: ab(1, 'closing_ab1'), j3: ab(3, 'closing_ab3'),
  }
  const ecritEnv = (e) => P.filter(({ n }) => n['ecrit_sent_' + e] && dans(n['ecrit_sent_' + e + '_at'], w)).length
  const ecrit = {
    entres: P.filter(({ n }) => n.ecrit_etat && dans(n.ecrit_at, w)).length, payes: P.filter(({ n }) => dans(n.ecrit_paye_at, w)).length,
    perdus: P.filter(({ n }) => n.ecrit_etat === 'perdu').length, b1: ecritEnv('b1'), b2: ecritEnv('b2'), b3: ecritEnv('b3'), suite: ecritEnv('suite'),
  }
  // — Acheteurs par jour (30 derniers jours, transactions)
  const jours = []
  for (let k = 29; k >= 0; k--) { const d = new Date(Date.now() - k * JOUR); jours.push({ j: d.toISOString().slice(0, 10), v: 0 }) }
  tx.filter((t) => CORE_PLANS.includes(t.plan)).forEach((t) => { const j = (t.created_at || '').slice(0, 10), x = jours.find((y) => y.j === j); if (x) x.v++ })
  return { hero, appels, lignes, tot, attribues, achatsTx, nonAttribues: Math.max(0, achatsTx - attribues), closing, ecrit, jours }
}
