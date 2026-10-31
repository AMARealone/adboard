/* Suivi CRM — chargé par les pages ouvertes depuis les liens du CRM (offres, études de cas, blog, quiz).
   1) mémorise le prospect et le message d'origine (utm_content / utm_campaign) pour l'attribution ;
   2) expose adstackTrackFunnel(type) : ajout_panier / paiement_initie, une seule fois par session et par type. */
(function () {
  var SERVER = 'https://adstack-server.onrender.com';
  function lire() {
    var p = new URLSearchParams(window.location.search);
    return { prospect: p.get('utm_content'), campagne: p.get('utm_campaign') };
  }
  var u = lire();
  if (u.campagne) {
    try { localStorage.setItem('crm_attribution', JSON.stringify({ prospect_id: u.prospect || null, campagne: u.campagne, capture_le: new Date().toISOString() })); } catch (e) {}
  }
  window.adstackTrackFunnel = function (type, source) {
    try {
      var flag = 'adstack_tracked_' + type;
      if (sessionStorage.getItem(flag)) return;
      sessionStorage.setItem(flag, '1');
      var c = lire(), prospect = c.prospect, campagne = c.campagne;
      if (!campagne) {
        var a = null;
        try { a = JSON.parse(localStorage.getItem('crm_attribution') || 'null'); } catch (e) {}
        if (a) { prospect = a.prospect_id; campagne = a.campagne; }
      }
      fetch(SERVER + '/track-funnel-event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: type, source: source || 'offre', prospect_id: prospect || null, campagne: campagne || null }), keepalive: true }).catch(function () {});
    } catch (e) {}
  };
})();
