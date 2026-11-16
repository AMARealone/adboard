// Top Performer — chiffres fournis par le client + classement automatique (v2, 16 nov. 2026).
// CE FICHIER EST AUSSI COPIÉ TEL QUEL DANS serveur.js (bloc « TOP PERFORMER »), pour que le
// classement vu par le client, l'angle gagnant et l'apprentissage du serveur soient toujours identiques.
// Ne rien importer ici : fonctions pures uniquement.
//
// MÉTHODE (recoupée avec la pratique publicitaire : on compare chaque créative aux autres de SON groupe — même produit, même cible —,
// jamais à un seuil universel ; un ratio observé sur peu d'achats est du bruit, donc il est ramené vers la moyenne du groupe) :
//   1. Chaque chiffre est comparé à la MÉDIANE du groupe (robuste : une créative extrême ne fausse pas la référence).
//      ROAS, achats, dépenses, CTR, jours : plus c'est haut, mieux c'est. CPA : plus c'est bas, mieux c'est.
//   2. Les rapports sont combinés en moyenne géométrique pondérée (ROAS et CPA pèsent le plus : c'est l'efficacité réelle ;
//      achats et dépenses disent que la diffusion a confiance dans la créative ; jours et CTR sont des signaux secondaires).
//   3. FIABILITÉ : le résultat est ramené vers « dans la moyenne » quand il repose sur peu d'achats (achats / (achats + 8)).
//      Un ROAS 4 sur 2 achats compte donc beaucoup moins qu'un ROAS 3 sur 40 achats. Moins de 3 jours de diffusion : fiabilité × 0,7.
//   4. score = 1 pour la moyenne du groupe, 1,5 = 50 % mieux. « indice » = score × 100.

// Les chiffres que le client peut donner. Tous facultatifs. `sens` : 'haut' = plus c'est grand, mieux c'est.
export const TP_CHAMPS = [
  { k: 'roas',     label: 'ROAS',          aide: 'ex. 2,8',            unite: '×',  sens: 'haut', poids: 3,   max: 200 },
  { k: 'cpa',      label: 'CPA',           aide: 'en $ ou €',     unite: '',   sens: 'bas',  poids: 3,   max: 100000000 },
  { k: 'depenses', label: 'Dépenses',      aide: 'en $ ou €',      unite: '',   sens: 'haut', poids: 0.8, max: 1000000000 },
  { k: 'jours',    label: 'Jours actifs',  aide: 'ex. 12',             unite: 'j',  sens: 'haut', poids: 0.4, max: 365, entier: true },
  { k: 'achats',   label: 'Ventes',        aide: 'nombre de ventes',   unite: '',   sens: 'haut', poids: 1,   max: 10000000, entier: true },
  { k: 'ctr',      label: 'CTR',           aide: 'ex. 1,9',            unite: '%',  sens: 'haut', poids: 0.7, max: 100 },
];

const K_ACHATS = 8; // nombre d'achats à partir duquel les chiffres pèsent « à moitié »

function _nombre(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// Nettoie ce que le client a saisi : ne garde que des nombres valides (> 0 et sous la borne).
// Renvoie null si rien d'exploitable. Jamais d'erreur : une saisie bancale est simplement ignorée.
export function nettoyerStats(brut) {
  if (!brut || typeof brut !== 'object') return null;
  const out = {};
  for (const ch of TP_CHAMPS) {
    let n = _nombre(brut[ch.k]);
    if (n === null || n <= 0 || n > ch.max) continue;
    if (ch.entier) n = Math.round(n);
    else n = Math.round(n * 1000) / 1000;
    out[ch.k] = n;
  }
  if (!Object.keys(out).length) return null;
  return out;
}

export const aDesChiffres = (c) => !!(c && c.tpStats && TP_CHAMPS.some(ch => Number.isFinite(c.tpStats[ch.k])));

const _borne = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const _mediane = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// Complète ce qui se déduit des autres chiffres (jamais l'inverse : on n'invente rien d'inconnu).
// dépenses ÷ CPA = ventes ; dépenses ÷ ventes = CPA. Renvoie une COPIE.
export function completerStats(st) {
  const s = { ...(st || {}) };
  if (!Number.isFinite(s.achats) && Number.isFinite(s.depenses) && Number.isFinite(s.cpa) && s.cpa > 0) { s.achats = Math.round(s.depenses / s.cpa); s._achatsDeduits = true; }
  if (!Number.isFinite(s.cpa) && Number.isFinite(s.depenses) && Number.isFinite(s.achats) && s.achats > 0) s.cpa = Math.round(s.depenses / s.achats * 1000) / 1000;
  return s;
}

// Score de chaque créative, PAR RAPPORT aux autres créatives du même groupe (même produit, même cible).
// Renvoie, par id : { score (1 = moyenne du groupe), indice (100 = moyenne), fiabilite ('solide'|'moyenne'|'faible'), chiffre, nbChiffres }.
// Une créative sans aucun chiffre n'a pas de score : elle reste au classement manuel (repli).
export function scoresTopPerformer(creatives) {
  const liste = (creatives || []).filter(Boolean);
  const stats = {};
  liste.forEach(c => { stats[c.id] = completerStats(c.tpStats); });
  // Référence du groupe pour chaque chiffre : médiane, et seulement si au moins 2 créatives le donnent (sinon rien à comparer).
  const ref = {};
  for (const ch of TP_CHAMPS) {
    const vals = liste.map(c => stats[c.id][ch.k]).filter(Number.isFinite);
    if (vals.length >= 2) ref[ch.k] = _mediane(vals);
  }
  const res = {};
  for (const c of liste) {
    const st = stats[c.id];
    let somme = 0, poids = 0, n = 0;
    for (const ch of TP_CHAMPS) {
      const v = st[ch.k];
      if (!Number.isFinite(v)) continue;
      n++;
      if (!ref[ch.k]) continue;
      const ratio = ch.sens === 'haut' ? v / ref[ch.k] : ref[ch.k] / v;
      somme += ch.poids * Math.log(_borne(ratio, 0.25, 4));
      poids += ch.poids;
    }
    if (!n) { res[c.id] = { score: null, indice: null, fiabilite: null, chiffre: false, nbChiffres: 0 }; continue; }
    // Fiabilité : combien d'achats reposent derrière ces chiffres (donnés, déduits, ou estimés avec le CPA médian du groupe).
    const achats = Number.isFinite(st.achats) ? st.achats : (Number.isFinite(st.depenses) && ref.cpa ? st.depenses / ref.cpa : null);
    let conf = achats === null ? 0.5 : achats / (achats + K_ACHATS);
    if (Number.isFinite(st.jours) && st.jours < 3) conf *= 0.7;
    const log = poids ? somme / poids : 0;
    const score = Math.exp(conf * log);
    res[c.id] = { score, indice: Math.round(score * 100), fiabilite: conf >= 0.65 ? 'solide' : conf >= 0.4 ? 'moyenne' : 'faible', chiffre: true, nbChiffres: n, comparable: poids > 0 };
  }
  return res;
}

// Classement : d'abord les créatives chiffrées (meilleur score en tête), puis celles sans chiffres,
// dans l'ordre manuel du client (rang 1 d'abord, sans rang à la fin).
export function classerTopPerformer(creatives) {
  const liste = [...(creatives || [])];
  const sc = scoresTopPerformer(liste);
  const rang = (c) => (c.topPerformerRank ?? Infinity);
  return liste.sort((a, b) => {
    const A = sc[a.id], B = sc[b.id];
    if (A.chiffre !== B.chiffre) return A.chiffre ? -1 : 1;
    if (A.chiffre && B.chiffre && Math.abs(A.score - B.score) > 1e-9) return B.score - A.score;
    if (A.chiffre && B.chiffre) {
      const r = (b.tpStats.roas || 0) - (a.tpStats.roas || 0);
      if (r) return r;
      const d = (b.tpStats.depenses || 0) - (a.tpStats.depenses || 0);
      if (d) return d;
    }
    return rang(a) - rang(b);
  });
}

// Poids d'une créative marquée dans le calcul de l'angle gagnant (remplace le seul « rang manuel »).
// Chiffrée : son score (0,3 à 3). Sinon : repli sur le rang manuel (rang 1 = ×2, rang 2 = ×1,5 …), neutre sans rang.
export function multiplicateurTP(c, scores) {
  const s = scores && scores[c.id];
  if (s && s.chiffre) return _borne(s.score, 0.3, 3);
  return c.topPerformerRank ? (1 + 1 / c.topPerformerRank) : 1;
}
