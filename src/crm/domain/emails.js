// Emails & Séquences : regroupement des envois par campagne (les push quotidiens portent la date dans leur clé).
export const LABELS = {
  email_welcome: 'Bienvenue', email_j1_no_product: 'J1 — sans produit', email_j1_has_product: 'J1 — avec produit', email_j5_vision: 'J5 — vision',
  email_j12_offer: 'J12 — offre', email_j21_breakup: 'J21 — rupture', email_monthly_social_proof: 'Mensuel — preuve sociale', email_monthly_novelty: 'Mensuel — nouveauté', email_monthly_checkin: 'Mensuel — check-in',
  d2s_j0: 'J0 (livraison)', d2s_checkin_1: 'J2 (push check-in)', d2s_j4: 'J4 (vision)', d2s_fin_pack_1: 'J6 (push fin de pack)', d2s_j7: 'J7 (urgence)', d2s_dernier_rappel_1: 'J9 (push dernier rappel)', d2s_j10: 'J10 (rupture)',
  push_no_product: 'Push quotidien — sans produit ajouté', push_no_plan: 'Push quotidien — sans abonnement', renewal_reminder: 'Push — rappel de renouvellement', push_saw_pricing: 'Push — a consulté la tarification', push_no_brief: 'Push — brief incomplet', renewal: 'Renouvellement effectué',
}
export const norm = (k) => String(k || '').replace(/_\d{4}-\d{2}-\d{2}$/, '')
// Les séquences « Discovery → Starter » appartiennent à l'ancien Pack, supprimé : on les garde lisibles mais à part.
export const estAncienne = (k) => String(k).startsWith('d2s_')
export const famille = (k) => (estAncienne(k) ? 'Anciennes (Pack supprimé)' : 'Actives')
export function regrouper(envois, events, funnel) {
  const g = {}
  envois.forEach((r) => {
    const k = norm(r.email_key), x = g[k] || (g[k] = { cle: k, n: 0, premiere: r.sent_at, derniere: r.sent_at, ouverts: 0, clics: 0, panier: 0, paiement: 0, famille: famille(k) })
    x.n++; if (r.sent_at < x.premiere) x.premiere = r.sent_at; if (r.sent_at > x.derniere) x.derniere = r.sent_at
  })
  events.forEach((e) => { const x = g[norm(e.email_key)]; if (!x) return; if (e.event_type === 'opened') x.ouverts++; if (e.event_type === 'clicked') x.clics++ })
  funnel.forEach((e) => { const x = g[norm(e.campagne)]; if (!x) return; if (e.type === 'ajout_panier') x.panier++; if (e.type === 'paiement_initie') x.paiement++ })
  const liste = Object.values(g).sort((a, b) => b.n - a.n)
  const sum = (f) => liste.reduce((s, x) => s + f(x), 0)
  return { liste, tot: { envoyes: envois.length, ouverts: sum((x) => x.ouverts), clics: sum((x) => x.clics), conv: sum((x) => x.panier + x.paiement) }, branche: events.length > 0 || funnel.length > 0 }
}
