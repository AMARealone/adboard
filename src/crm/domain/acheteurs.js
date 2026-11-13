// Acheteurs : tout prospect qui a payé. C'est l'état FINAL de la prospection : il quitte Appels, Closing, Closing écrit et Leads,
// et entre dans la section « Acheteurs », où se déroule le parcours marketing (bienvenue, démarrage, résultats, montée en gamme).
import { N } from './notes'
import { OFFRES } from './offres'

export const STATUTS_ACHETEUR = ['acheteur', 'standard', 'scale']
// Payé = statut acheteur (ou plan AdBoard) OU « a payé » enregistré après un appel, un closing ou un écrit.
export const estAcheteur = (p) => {
  if (!p) return false
  const n = N(p)
  return STATUTS_ACHETEUR.includes(p.statut) || n.closing_etat === 'paye' || n.ecrit_etat === 'paye'
}
export const dateAchat = (p) => { const n = N(p); return p.date_achat || n.closing_paye_at || n.ecrit_paye_at || null }
export const jDepuisAchat = (p, now = Date.now()) => { const t = Date.parse(dateAchat(p) || ''); return isNaN(t) ? 0 : Math.max(0, Math.floor((now - t) / 86400000)) }

// Offre souscrite : choisie à la main (acheteur_offre), sinon celle discutée en closing / écrit.
export const offreAchetee = (p) => { const n = N(p), k = n.acheteur_offre || n.closing_offre || n.ecrit_offre; return OFFRES[k] ? k : '' }
// Échelle de montée en gamme (ONE SHOT = offre d'entrée / downsell). Modifiable ici.
export const SUIVANTE = { oneshot: 'perf', test: 'perf', perf: 'growth', growth: 'scale', scale: null }
export const offreSuivante = (k) => SUIVANTE[k] || null
// Revenu mensuel d'une offre : tout sauf l'achat unique (ONE SHOT).
export const mrr = (k) => (OFFRES[k] && k !== 'oneshot' ? OFFRES[k].prix : 0)
// Gain mensuel si le client passe à l'offre suivante.
export const potentiel = (k) => { const s = OFFRES[offreSuivante(k)]; return s && OFFRES[k] ? Math.max(0, s.prix - mrr(k)) : 0 }

// Parcours marketing d'un acheteur (point de départ, à adapter à la stratégie) : une étape = un message (Templates › Acheteurs),
// proposée à J+« jour » après l'achat. L'étape « upsell » n'existe que s'il y a une offre supérieure à proposer.
export const PARCOURS = [
  { cle: 'bienvenue', jour: 0, label: 'Bienvenue', aide: 'Confirmer le paiement et dire ce qui se passe ensuite.' },
  { cle: 'demarrage', jour: 3, label: 'Démarrage', aide: 'Vérifier que les premières créatives sont reçues et lancées.' },
  { cle: 'resultats', jour: 14, label: 'Premiers résultats', aide: 'Demander les chiffres et recueillir un avis.' },
  { cle: 'upsell', jour: 25, label: 'Montée en gamme', aide: "Proposer l'offre supérieure avant le renouvellement.", upsell: true },
]
export const etapeFaite = (n, cle) => !!n['acheteur_sent_' + cle]
export const etapesDe = (k) => PARCOURS.filter((e) => !e.upsell || offreSuivante(k))
// Première étape due (jour atteint, pas encore envoyée), ou null.
export const etapeDue = (p, now = Date.now()) => { const n = N(p), j = jDepuisAchat(p, now); return etapesDe(offreAchetee(p)).find((e) => !etapeFaite(n, e.cle) && j >= e.jour) || null }
