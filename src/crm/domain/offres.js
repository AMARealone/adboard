// Source unique des offres (prix, volumes, délais, liens, phrase « facture/garantie »).
// Les clés (test, perf, growth, scale) sont celles stockées dans les fiches (closing_offre, ecrit_offre).
const BASE = 'https://www.adstackofficial.com/'
export const OFFRES = {
  test:   { key: 'test',   label: 'TEST',   prix: 75000,  n: 12, delai: '48 h', plan: 'test',    couleur: '#2EF2E8', url: BASE + 'test',   facture: 'vous recevez la facture par mail' },
  perf:   { key: 'perf',   label: 'PERF+',  prix: 140000, n: 24, delai: '48 h', plan: 'starter', couleur: '#1FB6FF', url: BASE + 'perf',   facture: 'vous recevez la facture et votre garantie par mail' },
  growth: { key: 'growth', label: 'GROWTH', prix: 260000, n: 48, delai: '24 h', plan: 'pro',     couleur: '#9b7bff', url: BASE + 'growth', facture: 'vous recevez la facture et votre garantie par mail' },
  scale:  { key: 'scale',  label: 'SCALE',  prix: 480000, n: 96, delai: '24 h', plan: 'scale',   couleur: '#ffb547', url: BASE + 'scale',  facture: 'vous recevez la facture et votre garantie par mail' },
  // ONE SHOT (8 nov. 2026) : offre d'entrée / downsell, achat unique, 6 créatives (2 vidéos + 4 images) pour 1 produit. Pas de page d'offre : le lien est le paiement Chariow lui-même (voir lienOffreSuivi).
  oneshot:{ key: 'oneshot', label: 'ONE SHOT', prix: 50000, n: 6, delai: '48 h', plan: 'oneshot', couleur: '#2EF2E8', url: 'https://shop.adstackofficial.com/prd_y6lv33mv/checkout', facture: 'vous recevez la facture par mail' },
}
export const OFFRE_KEYS = Object.keys(OFFRES)
export const fcfa = (n) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA'
