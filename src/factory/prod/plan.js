// Plan des niveaux de conscience de la production (v10).
// Chaque angle = 3 créatives (1 vidéo + 2 images) qui suivent UN parcours :
//   A = Problem Aware → Solution Aware → Product Aware
//   B = Solution Aware → Product Aware → Most Aware
// Règle du fondateur : sur toute la production, au moins une créative Solution, une Product et une Most Aware.
// Comme Most Aware n'existe que dans le parcours B, au moins un angle suit B. Le reste est choisi selon le contexte
// (proposition de l'agent de sélection vidéo), puis vérifié et réparé ici par le code.
export const PARCOURS = { A: ['problem', 'solution', 'product'], B: ['solution', 'product', 'most'] }
export const LIB = { problem: 'Problem Aware', solution: 'Solution Aware', product: 'Product Aware', most: 'Most Aware' }
export const COURT = { problem: 'Problème', solution: 'Solution', product: 'Produit', most: 'Most Aware' }

// Plan par défaut (sans agent) : 1er angle en A (on ouvre le marché), dernier en B (on convertit), alternance au milieu.
export function planParDefaut(n) {
  return Array.from({ length: n }, (_, a) => {
    const p = n === 1 ? 'B' : (a === n - 1 ? 'B' : (a % 2 === 0 ? 'A' : 'B'))
    return { parcours: p, niveaux: PARCOURS[p].slice(), video: PARCOURS[p][0] }
  })
}
// Normalise une proposition ({ parcours, niveau_video } par angle) et garantit la couverture Solution / Product / Most.
// offre-forte-v1 : la VIDÉO ne porte Most Aware que si l'offre du client est jugée irrésistible (opts.offreForte) ;
// sinon Most Aware reste sur une image du parcours B et la vidéo prend Product Aware (ou le niveau proposé s'il n'est pas Most).
export function reparerPlan(n, propositions, opts = {}) {
  const offreForte = !!opts.offreForte
  const def = planParDefaut(n)
  const plan = Array.from({ length: n }, (_, a) => {
    const pr = (propositions || [])[a] || {}
    const p = /^b/i.test(String(pr.parcours || '')) || /most/i.test(String(pr.parcours || '')) ? 'B' : /^a/i.test(String(pr.parcours || '')) || /problem/i.test(String(pr.parcours || '')) ? 'A' : def[a].parcours
    const niveaux = PARCOURS[p].slice()
    const v = cle(pr.niveau_video)
    return { parcours: p, niveaux, video: niveaux.includes(v) ? v : niveaux[0] }
  })
  if (!plan.some((x) => x.parcours === 'B')) { const k = n - 1; plan[k] = { parcours: 'B', niveaux: PARCOURS.B.slice(), video: PARCOURS.B.includes(plan[k].video) ? plan[k].video : 'solution' } }
  if (!offreForte) plan.forEach((x) => { if (x.video === 'most') x.video = 'product' })
  return plan
}
export function cle(v) {
  const t = String(v || '').toLowerCase()
  if (t.includes('most')) return 'most'
  if (t.includes('product') || t.includes('produit')) return 'product'
  if (t.includes('solution')) return 'solution'
  if (t.includes('problem') || t.includes('probl')) return 'problem'
  return ''
}
// Les 2 niveaux des images d'un angle = ceux du parcours que la vidéo ne porte pas, dans l'ordre du parcours.
export const niveauxImages = (p) => p.niveaux.filter((x) => x !== p.video)
// Vérification finale de la couverture sur tout le lot (pour l'affichage et les tests).
export function couverture(plan) {
  const tous = new Set(plan.flatMap((p) => p.niveaux))
  return { ok: ['solution', 'product', 'most'].every((x) => tous.has(x)), niveaux: [...tous] }
}
