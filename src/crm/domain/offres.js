// Source unique des offres (prix, volumes, délais, liens, phrase « facture/garantie »).
// Les clés (test, perf, growth, scale) sont celles stockées dans les fiches (closing_offre, ecrit_offre).
const BASE = 'https://www.adstackofficial.com/'
export const OFFRES = {
  // TEST n'est plus vendue depuis le 19 nov. 2026 (son produit Chariow est devenu le ONE SHOT) : gardée pour lire les anciennes fiches, jamais proposée.
  test:   { key: 'test',   label: 'TEST (ancienne)', prix: 75000,  n: 12, delai: '48 h', plan: 'test',    couleur: '#2EF2E8', url: BASE + 'perf',   facture: 'vous recevez la facture par mail', retiree: true },
  perf:   { key: 'perf',   label: 'PERF+',  prix: 250000, n: 24, delai: '48 h', plan: 'starter', couleur: '#1FB6FF', url: BASE + 'perf',   facture: 'vous recevez la facture et votre garantie par mail' },
  growth: { key: 'growth', label: 'GROWTH', prix: 480000, n: 48, delai: '24 h', plan: 'pro',     couleur: '#9b7bff', url: BASE + 'growth', facture: 'vous recevez la facture et votre garantie par mail' },
  scale:  { key: 'scale',  label: 'SCALE',  prix: 920000, n: 96, delai: '24 h', plan: 'scale',   couleur: '#ffb547', url: BASE + 'scale',  facture: 'vous recevez la facture et votre garantie par mail' },
  // ONE SHOT (19 nov. 2026) : offre d'entrée, achat unique à 75 000 FCFA, 6 créatives (2 vidéos + 4 images) pour 1 produit. Sa page : /test (paiement prd_yslvdsuz).
  oneshot:{ key: 'oneshot', label: 'ONE SHOT', prix: 75000, n: 6, delai: '48 h', plan: 'oneshot', couleur: '#2EF2E8', url: BASE + 'test', facture: 'vous recevez la facture par mail' },
}
export const OFFRE_KEYS = Object.keys(OFFRES).filter((k) => !OFFRES[k].retiree)

// offres-v1 — /offres.json est la source unique : prix et volumes relus au chargement du CRM (une valeur douteuse garde celle d'ici).
;(async () => {
  try {
    const r = await fetch('/offres.json', { cache: 'no-store' }); if (!r.ok) return
    const j = await r.json()
    const n = (x, a, b) => { x = Number(x); return Number.isFinite(x) && x >= a && x <= b ? Math.round(x) : null }
    const cle = { starter: 'perf', pro: 'growth', scale: 'scale' }
    ;(Array.isArray(j.offres) ? j.offres : []).forEach((o) => { const k = cle[o.id]; if (!k || !OFFRES[k]) return; const p = n(o.prix, 10000, 5e7), cm = n(o.creatives_mois, 1, 2000); if (p) OFFRES[k].prix = p; if (cm) OFFRES[k].n = cm; if (typeof o.delai === 'string' && o.delai) OFFRES[k].delai = o.delai.replace(/(\d)h/, '$1 h') })
    if (j.oneshot) { const p = n(j.oneshot.prix, 5000, 5e6), cr = n(j.oneshot.creatives, 1, 200); if (p) OFFRES.oneshot.prix = p; if (cr) OFFRES.oneshot.n = cr }
  } catch (_) { }
})()
export const fcfa = (n) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA'
