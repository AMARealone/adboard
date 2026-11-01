// Top Performer — chiffres fournis par le client + classement automatique.
// CE FICHIER EST AUSSI COPIÉ TEL QUEL DANS serveur.js (bloc « TOP PERFORMER »), pour que le
// classement vu par le client et l'angle gagnant calculé par le serveur soient toujours identiques.
// Ne rien importer ici : fonctions pures uniquement.

// Les chiffres que le client peut donner. Tous facultatifs. `sens` : 'haut' = plus c'est grand, mieux c'est.
export const TP_CHAMPS = [
  { k: 'roas',     label: 'ROAS',          aide: 'ex. 2,8',            unite: '×',  sens: 'haut', poids: 3,   max: 200 },
  { k: 'cpa',      label: 'CPA',           aide: 'en $ ou €',     unite: '',   sens: 'bas',  poids: 3,   max: 100000000 },
  { k: 'depenses', label: 'Dépenses',      aide: 'en $ ou €',      unite: '',   sens: 'haut', poids: 1.5, max: 1000000000 },
  { k: 'jours',    label: 'Jours actifs',  aide: 'ex. 12',             unite: 'j',  sens: 'haut', poids: 1,   max: 365, entier: true },
  { k: 'achats',   label: 'Achats',        aide: 'nombre de ventes',   unite: '',   sens: 'haut', poids: 1,   max: 10000000, entier: true },
  { k: 'ctr',      label: 'CTR',           aide: 'ex. 1,9',            unite: '%',  sens: 'haut', poids: 1,   max: 100 },
];

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

// Score de chaque créative, PAR RAPPORT aux autres créatives du même groupe (même produit, même cible).
// Pour chaque chiffre : on compare à la moyenne du groupe (1 = dans la moyenne, 2 = deux fois mieux),
// à l'envers pour le CPA (plus bas = mieux). Puis moyenne pondérée des chiffres que la créative a donnés.
// Une créative sans aucun chiffre n'a pas de score : elle reste au classement manuel (repli).
export function scoresTopPerformer(creatives) {
  const liste = (creatives || []).filter(Boolean);
  const moyennes = {};
  for (const ch of TP_CHAMPS) {
    const vals = liste.map(c => c.tpStats && c.tpStats[ch.k]).filter(Number.isFinite);
    if (vals.length) moyennes[ch.k] = vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  const res = {};
  for (const c of liste) {
    let somme = 0, poids = 0, n = 0;
    for (const ch of TP_CHAMPS) {
      const v = c.tpStats && c.tpStats[ch.k];
      if (!Number.isFinite(v) || !moyennes[ch.k]) continue;
      const ratio = ch.sens === 'haut' ? v / moyennes[ch.k] : moyennes[ch.k] / v;
      somme += ch.poids * _borne(ratio, 0.25, 3);
      poids += ch.poids; n++;
    }
    res[c.id] = n ? { score: somme / poids, chiffre: true, nbChiffres: n } : { score: null, chiffre: false, nbChiffres: 0 };
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
