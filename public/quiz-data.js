/* Données du quiz « Quelle offre est faite pour vous ? » — questions, scores et textes de résultat.
   Scores : [TEST, PERF+, GROWTH, SCALE]. Pour modifier une phrase ou un poids, c'est ici uniquement. */
window.QUIZ = {
  plans: ['test','starter','pro','scale'],
  questions: [
    { q:"Où en êtes-vous avec la pub aujourd’hui ?", rep:[
      { t:"Je n’ai pas encore de vraies ventes avec la pub, je veux d’abord savoir si mon produit peut marcher.", s:[4,0,0,0] },
      { t:"Mon produit se vend déjà, mais les résultats restent irréguliers d’un jour à l’autre.", s:[0,3,1,0] },
      { t:"Je vends bien, mais presque tout vient de deux ou trois publicités qui finiront par s’user.", s:[0,3,2,0] },
      { t:"Ça marche, et je veux passer à la vitesse supérieure en augmentant mon budget.", s:[0,0,4,0] },
      { t:"Je vends déjà sur plusieurs produits ou plusieurs pays, et je veux en ouvrir d’autres.", s:[0,0,1,4] } ] },
    { q:"Combien dépensez-vous en publicité chaque mois ?", rep:[
      { t:"Moins de 100 000 FCFA par mois, je démarre.", s:[3,0,0,0] },
      { t:"Entre 100 000 et 300 000 FCFA par mois.", s:[1,3,0,0] },
      { t:"Entre 300 000 et 800 000 FCFA par mois.", s:[0,2,3,0] },
      { t:"Entre 800 000 FCFA et 2 millions par mois.", s:[0,0,3,2] },
      { t:"Plus de 2 millions de FCFA par mois.", s:[0,0,1,4] } ] },
    { q:"Combien de vos publicités vendent vraiment ?", rep:[
      { t:"Aucune pour l’instant, je n’ai pas encore trouvé ce qui marche.", s:[3,0,0,0] },
      { t:"Une ou deux, et j’ai peur qu’elles s’arrêtent de marcher.", s:[0,3,0,0] },
      { t:"Quelques-unes, mais je n’arrive pas à en trouver de nouvelles au même niveau.", s:[0,2,2,0] },
      { t:"Plusieurs, et je teste en continu pour en avoir toujours de nouvelles.", s:[0,0,3,1] },
      { t:"Beaucoup, réparties sur plusieurs marchés ou plusieurs produits.", s:[0,0,1,3] } ] },
    { q:"Qu’est-ce qui vous bloque le plus aujourd’hui ?", rep:[
      { t:"Je ne sais pas quels angles ou quelles idées tester pour mon produit.", s:[3,1,0,0] },
      { t:"J’attends que mes publicités s’essoufflent pour chercher quoi les remplacer.", s:[0,3,0,0] },
      { t:"Je perds un temps fou entre freelances, retouches et allers-retours.", s:[0,1,3,0] },
      { t:"Je n’ose pas augmenter mon budget, faute de nouvelles créatives à tester.", s:[0,1,3,0] },
      { t:"Chaque pays ou chaque produit demande ses propres angles, je n’arrive plus à suivre.", s:[0,0,0,4] } ] },
    { q:"Qui s’occupe de vos créatives aujourd’hui ?", rep:[
      { t:"Moi, tout seul, quand j’ai le temps.", s:[2,1,0,0] },
      { t:"Un freelance ou un graphiste, avec des résultats inégaux.", s:[0,2,1,0] },
      { t:"Mon media buyer, mais il n’a pas de vraie stratégie créative.", s:[0,1,2,0] },
      { t:"Une petite équipe de 2 à 5 personnes qui a du mal à suivre le rythme.", s:[0,0,3,0] },
      { t:"Plusieurs personnes ou agences, sur plusieurs marchés.", s:[0,0,0,3] } ] }
  ],
  resultats: {
    test:    { titre:"TEST est l’offre qu’il vous faut.", sous:"Vous voulez savoir vite si votre produit tient en publicité, avant d’investir davantage. Voici le moyen le plus simple de le découvrir." },
    starter: { titre:"PERF+ est faite pour vous.", sous:"Vos ventes existent déjà, mais elles reposent sur trop peu de publicités. Il est temps d’en avoir de nouvelles, prêtes avant que les anciennes s’usent." },
    pro:     { titre:"GROWTH est l’offre qui va faire décoller votre marque.", sous:"Vous avez déjà ce qui marche. Il vous manque le volume et la vitesse pour augmenter votre budget sans crainte, et sans gérer une équipe." },
    scale:   { titre:"SCALE est faite pour votre ambition.", sous:"Plusieurs produits, plusieurs marchés : chacun a ses propres angles. SCALE les produit en 24h, sans exploser vos coûts." }
  },
  offres: (function(){
    var STRAT=['Stratégie Marketing',': recherche sur marché, concurrents, cible'], LEARN=['Apprentissage',': itération + amélioration des prochains lots'], BOARD=['AdBoard',': gestion des créatives, données et produits'],
        COPY=['Ad Copies',': titres et textes optimisés conversion'], DATA=['Données Marché',': vues détaillées, recommandations et opportunités'];
    return {
    test:   { name:'TEST',   price:75000,  productId:'prd_yslvdsuz', tagline:'Tester et trouver vos premières créatives gagnantes sur votre produit.', creas:12, lead:'', items:[
      STRAT,['Jusqu’à 2 lots / mois',': 2 vidéos et 4 images par lot'],['Couverture',': jusqu’à 2 produits'],LEARN,BOARD,['Délai Production',': 48h']] },
    starter:{ name:'PERF+',  price:140000, productId:'prd_ljowq8',   tagline:'Automatiser la production de vos créatives, tout en améliorant vos performances publicitaires.', creas:24, lead:'', items:[
      STRAT,['Jusqu’à 4 lots de créatives / mois',''],COPY,DATA,['Couverture',': jusqu’à 4 produits'],LEARN,BOARD,['Compte Employé',': ajoutez 2 membres à AdBoard'],['Délai Production',': 48h'],['Garantie',': Performance en 60 jours']] },
    pro:    { name:'GROWTH', price:260000, productId:'prd_34w031',   tagline:'Accélérer la production créative et la croissance de votre marque, sans la prise de tête de gérer une équipe.', creas:48, lead:'', items:[
      STRAT,['Jusqu’à 8 lots de créatives / mois',''],COPY,DATA,['Couverture',': jusqu’à 8 produits'],LEARN,BOARD,['Compte Employé',': ajoutez 5 membres à AdBoard'],['Délai Production',': 24h'],['Garantie',': Croissance en 60 jours']] },
    scale:  { name:'SCALE',  price:480000, productId:'prd_9fi79y',   tagline:'Exploiter plusieurs marchés avec des langues et cultures différentes, sans exploser vos coûts ni augmenter la complexité.', creas:96, lead:'', items:[
      STRAT,['Jusqu’à 16 lots de créatives / mois',''],COPY,DATA,['Couverture',': jusqu’à 16 produits'],LEARN,BOARD,['Compte Employé',': ajoutez +10 membres à AdBoard'],['Délai Production',': 24h + file prioritaire'],['Garantie',': Scaling en 60 jours']] }
    };
  })(),
  /* Calcule le plan : somme des scores ; en cas d’égalité, le plan favorisé par la question budget l’emporte. */
  calcul: function(idx){
    var tot=[0,0,0,0], i, j;
    for(i=0;i<idx.length;i++){ var r=this.questions[i].rep[idx[i]]; if(!r) continue; for(j=0;j<4;j++) tot[j]+=r.s[j]; }
    var bud=idx[1]!=null?this.questions[1].rep[idx[1]].s:[0,0,0,0], best=0;
    for(j=1;j<4;j++){ if(tot[j]>tot[best] || (tot[j]===tot[best] && bud[j]>bud[best])) best=j; }
    return this.plans[best];
  }
};
