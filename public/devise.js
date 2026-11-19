/* devise-v1 (19 nov. 2026) — CONVERTISSEUR DE DEVISE AUTOMATIQUE des pages d'offre, du quiz et de la présentation.
   Même règle que la page de vente et AdBoard : devise du visiteur détectée par son pays, taux du jour depuis le FCFA,
   +3,5 % (marge de change de Chariow), arrondi commercial à la hausse (3 % au plus). Les prix restent facturés en FCFA par Chariow.
   Usage : <b data-fcfa="250000">250.000</b><span data-suffixe="/ mois">FCFA / mois</span> puis window.adsDevise() après chaque rendu. */
(function () {
  var COEFF = 1.035, SANS_DEC = ['XOF','XAF','GNF','KMF','DJF','RWF','BIF','UGX','TZS','MGA','JPY','KRW','VND','CLP','PYG','IDR','MMK'];
  var etat = null;
  function arrondi(v, dec) {
    if (!(v > 0)) return v;
    var base = Math.pow(10, Math.floor(Math.log10(v))), pas = [1,0.5,0.25,0.1,0.05,0.025,0.01,0.005,0.0025,0.001];
    for (var i = 0; i < pas.length; i++) { var st = base * pas[i], c = Math.ceil(v / st - 1e-9) * st; if (c / v - 1 <= 0.03 || i === pas.length - 1) { c = Math.round(c * 1e6) / 1e6; return dec ? Math.round(c * 100) / 100 : Math.round(c); } }
    return v;
  }
  function fmt(fcfa) {
    var dec = SANS_DEC.indexOf(etat.cur) < 0, v = arrondi(fcfa * etat.taux * COEFF, dec);
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: etat.cur, minimumFractionDigits: dec && !Number.isInteger(v) ? 2 : 0, maximumFractionDigits: dec ? 2 : 0 }).format(v);
  }
  window.adsDevise = function () {
    if (!etat) return;
    document.querySelectorAll('[data-fcfa]').forEach(function (el) {
      var n = parseFloat(el.getAttribute('data-fcfa')); if (!(n > 0)) return;
      el.textContent = fmt(n);
      var p = el.parentElement, s = p && p.querySelector('[data-suffixe]');
      if (s) s.textContent = s.getAttribute('data-suffixe');
    });
  };
  function lireCache() { try { var c = JSON.parse(sessionStorage.getItem('ads_devise') || 'null'); return c && Date.now() - c.t < 6 * 3600000 ? c : null; } catch (e) { return null; } }
  (async function () {
    try {
      var c = lireCache();
      if (!c) {
        var geo = await fetch('https://ipapi.co/json/').then(function (r) { return r.json(); });
        var cur = String(geo.currency || 'XOF').toUpperCase();
        c = { cur: cur, taux: 1, t: Date.now() };
        if (cur !== 'XOF' && cur !== 'XAF') {
          var tx = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/xof.json').then(function (r) { return r.json(); });
          c.taux = tx && tx.xof && tx.xof[cur.toLowerCase()];
        }
        try { sessionStorage.setItem('ads_devise', JSON.stringify(c)); } catch (e) {}
      }
      if (c.cur === 'XOF' || c.cur === 'XAF' || !(c.taux > 0)) return;
      etat = c; window.adsDevise();
    } catch (e) { /* pas de conversion : les prix restent en FCFA */ }
  })();
})();
