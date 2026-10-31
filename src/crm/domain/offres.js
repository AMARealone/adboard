// Source unique des offres (prix, volumes, délais, liens, phrase « facture/garantie »).
// Les clés (test, perf, growth, scale) sont celles stockées dans les fiches (closing_offre, ecrit_offre).
const BASE = 'https://www.adstackofficial.com/'
export const OFFRES = {
  test:   { key: 'test',   label: 'TEST',   prix: 75000,  n: 12, delai: '48 h', plan: 'test',    couleur: '#2EF2E8', url: BASE + 'test',   facture: 'vous recevez la facture par mail' },
  perf:   { key: 'perf',   label: 'PERF+',  prix: 140000, n: 24, delai: '48 h', plan: 'starter', couleur: '#1FB6FF', url: BASE + 'perf',   facture: 'vous recevez la facture et votre garantie par mail' },
  growth: { key: 'growth', label: 'GROWTH', prix: 260000, n: 48, delai: '24 h', plan: 'pro',     couleur: '#9b7bff', url: BASE + 'growth', facture: 'vous recevez la facture et votre garantie par mail' },
  scale:  { key: 'scale',  label: 'SCALE',  prix: 480000, n: 96, delai: '24 h', plan: 'scale',   couleur: '#ffb547', url: BASE + 'scale',  facture: 'vous recevez la facture et votre garantie par mail' },
}
export const OFFRE_KEYS = Object.keys(OFFRES)
export const fcfa = (n) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA'
