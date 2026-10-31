// Calculs de la Comptabilité (purs, testables). Montants en FCFA ; les coûts d'API arrivent en dollars.
import { dans } from './stats'
export const CATEGORIES = [
  { cle: 'acquisition', label: 'Acquisition (démo + prospection)', sources: ['demo', 'prospecteur'], couleur: '#3B82F6' },
  { cle: 'production', label: 'Production (vrais livrables clients)', sources: ['production'], couleur: '#F59E0B' },
  { cle: 'tests', label: "Tests d'agents", sources: ['agent_test'], couleur: '#8B5CF6' },
]
export function calculerCompta({ tx, api, prospects, w, tauxXofUsd }) {
  const txp = tx.filter((t) => dans(t.created_at, w)), ap = api.filter((r) => dans(r.created_at, w))
  const usd = (l) => l.reduce((s, r) => s + (r.cout_usd || 0), 0)
  const dep = CATEGORIES.map((c) => ({ ...c, usd: usd(ap.filter((r) => c.sources.includes(r.source))) }))
  const connues = CATEGORIES.flatMap((c) => c.sources)
  const autre = usd(ap.filter((r) => !connues.includes(r.source)))
  const aFcfa = (u) => (tauxXofUsd > 0 ? u / tauxXofUsd : 0)
  const depTotal = aFcfa(dep.reduce((s, c) => s + c.usd, 0) + autre)
  const net = txp.reduce((s, t) => s + (t.montant_net_fcfa || 0), 0), brut = txp.reduce((s, t) => s + (t.montant_fcfa || 0), 0)
  const prod = aFcfa(dep.find((c) => c.cle === 'production').usd)
  const parPlan = {}; txp.forEach((t) => { const k = t.plan || 'inconnu'; parPlan[k] = parPlan[k] || { n: 0, net: 0 }; parPlan[k].n++; parPlan[k].net += t.montant_net_fcfa || 0 })
  // Projection : cumul depuis toujours (toute la base de transactions, pas la période)
  const contactes = prospects.filter((p) => p.statut !== 'a_contacter').length
  const leads = prospects.filter((p) => ['lead', 'acheteur', 'standard', 'scale'].includes(p.statut)).length
  const panier = tx.length ? tx.reduce((s, t) => s + (t.montant_net_fcfa || 0), 0) / tx.length : 0
  const tLeadAchat = leads ? tx.length / leads : 0
  return {
    net, brut, depTotal, profit: net - depTotal,
    margeBrute: net > 0 ? ((net - prod) / net) * 100 : null, margeNette: net > 0 ? ((net - depTotal) / net) * 100 : null,
    dep: dep.map((c) => ({ ...c, fcfa: aFcfa(c.usd) })), autre: { usd: autre, fcfa: aFcfa(autre) },
    parPlan: Object.entries(parPlan).sort((a, b) => b[1].net - a[1].net), nbTx: txp.length, txp, ap,
    proj: { contactes, leads, tauxLead: contactes ? (leads / contactes) * 100 : 0, panier, plus10: contactes * 0.1 * tLeadAchat * panier },
  }
}
