// GÉNÉRÉ depuis l'ancien CRM (adstats.html) : textes et réglages repris tels quels. Modifiables dans Templates.
export const J3_REPLI_DEFAUT = "Re-bonjour *[Marque]*, j'espère que vous allez bien 😊\n\nQuand on a vu vos publicités, une question nous est venue : comment garder des publicités qui vendent dans la durée, sans que les mêmes visuels s'essoufflent ?\n\nUne partie de notre service consiste justement à éviter *l'essoufflement publicitaire* via *la diversité créative*, et à repartir de ce qui marche pour aller chercher davantage de ventes.\n\nUn *Google Meet* pourrait être parfait ?\n\nOn voit concrètement tout ce qui pourrait freiner vos performances publicitaires et comment les résoudre.";

export const J3_CAS0_DEFAUT = "Bonjour *[Marque]*, j'espère ne pas vous avoir trop dérangé la dernière fois 😊\n\nOn vient de regarder votre compte publicitaire : vous avez *0 ad active* en ce moment.\n\nÇa veut dire une de ces deux choses : *une rupture de stock*, ou *plus de créatives qui performent*.\n\nEt une partie de notre service, c'est justement de vous assurer *un flux constant de nouvelles créatives qui performent*, pour de très bons résultats.\n\nUn *Google Meet* pourrait être parfait ?\n\nOn voit concrètement ce qui pourrait freiner vos performances publicitaires et comment les résoudre.";

export const PITCH_DATA_DEFAUT = {
  seuil_ads: 12, seuil_jours: 15, fraicheur_j: 3, duree: 'med',
  repli: J3_REPLI_DEFAUT,
  cas0: J3_CAS0_DEFAUT,
  cas: {
    1: { b: 'aviez de bonnes créatives qui durent', m: 'vous pouviez atteindre la fatigue publicitaire plus rapidement', n: "l'essoufflement publicitaire", s: 'un renouvellement régulier de vos créatives' },
    2: { b: 'étiez en train de tester de bonnes nouvelles créatives', m: 'ce petit volume peut rendre vos résultats difficiles à maintenir', n: "l'instabilité des résultats", s: 'un flux constant de nouvelles créatives' },
    3: { b: 'aviez un bon rythme de créatives qui tiennent', m: 'vous pouviez avoir plus de mal à diversifier votre contenu créatif', n: 'la répétition créative', s: 'la diversité créative' },
    4: { b: 'aviez lancé beaucoup de nouvelles créatives', m: 'vous pouviez avoir du mal à exploiter les créatives qui marchent', n: 'la dispersion créative', s: 'un suivi des créatives qui gagnent' }
  }
};

export const PITCH_CAS_LABELS = {
  0: 'Cas 0 — aucune ad active',
  1: 'Cas 1 — peu d\'ads · durée longue', 2: 'Cas 2 — peu d\'ads · durée courte',
  3: 'Cas 3 — beaucoup d\'ads · durée longue', 4: 'Cas 4 — beaucoup d\'ads · durée courte'
};

export const J3_VARS = /\[(?:ads|jours|bonne_nouvelle|mauvaise_nouvelle(?:_en_2_mots|_2_mots)?|solution)\]/i;

export const APPEL_DELAI_MS = 24 * 3600 * 1000;

export const CLOSING_JOURS  = [1, 3, 7];

export const CLOSING_LABELS = ['Relance 1', 'Relance 2', 'Relance 3'];

export const CLOSING_SLOTS = [
  { j: 1, v: 'A', label: 'J+1 — version A (« tout va bien pour le paiement ? »)' },
  { j: 1, v: 'B', label: 'J+1 — version B (reprend ses mots)' },
  { j: 3, v: 'A', label: 'J+3 — version A (coût de l\'attente)' },
  { j: 3, v: 'B', label: 'J+3 — version B (« qu\'est-ce qui vous retient ? »)' },
  { j: 7, v: '',  label: 'J+7 — dernier message' }
];

export const DEFAULT_CLOSING = [
  "Bonjour [Prénom] 🙂\n\nMerci encore pour notre échange d'hier, j'ai vraiment aimé parler de *[Marque]*.\n\nJe voulais juste m'assurer que *tout va bien pour le paiement*. Si quelque chose a bloqué, dites-moi, *on le règle ensemble*.\n\nVoici la page de votre offre : [Lien]\n\nDès que c'est fait, [Facture], et *on connecte AdBoard ensemble*.",
  "Bonjour [Prénom],\n\nMerci pour hier. J'ai repensé à ce que vous m'avez dit : « *[Mots]* ».\n\nC'est exactement *ce qu'on règle pour vous*.\n\nSi une question vous est revenue depuis, écrivez-moi, *je vous réponds tout de suite*. Et quand vous êtes prêt(e) : [Lien]",
  "Bonjour [Prénom],\n\nJe pense à *[Marque]*. Vous m'aviez dit : « *[Mots]* ».\n\nChaque semaine qui passe, c'est *une semaine de plus comme ça*, alors que vous étiez motivé(e) à changer les choses.\n\nOn peut le faire ensemble *aujourd'hui*, simplement : voici le lien [Lien], et je reste avec vous pour *connecter AdBoard et lancer votre première demande*.\n\nDites-moi si je peux vous aider.",
  "Bonjour [Prénom],\n\nVous m'aviez dit : « *[Mots]* », et je me suis dit que je ne voulais pas que *le doute décide à votre place*.\n\nQu'est-ce qui vous retient encore ? Si c'est [Objection], *on peut en parler deux minutes ici*, sans engagement.\n\nEt si tout est clair : [Lien]",
  "Bonjour [Prénom],\n\nC'est mon *dernier message* pour ne pas vous déranger 🙂\n\nJ'ai vraiment aimé échanger avec vous sur *[Marque]*, et je crois sincèrement qu'on peut vous aider à *[Objectif]*.\n\n*Le lien reste valable* quand vous voulez : [Lien]\n\nSi ce n'est pas le moment, aucun souci, je reste disponible. Et si vous avez 10 secondes, dites-moi simplement *ce qui vous a fait hésiter* : ça m'aide beaucoup."
];

export const CLOSING_OBJECTIONS = ['le prix', 'la peur que ça ne donne pas de résultats', 'le besoin d\'en parler à votre associé(e)', 'le besoin de réfléchir', 'la crainte de perdre du temps', 'le fait d\'avoir déjà essayé autre chose'];

export const ECRIT_FAILLES = {
  rythme:    'Peu de nouvelles pubs / rythme lent',
  angles:    'Mêmes angles, mêmes visuels',
  gagnantes: 'Une ou deux pubs portent tout',
  production:'Production lente ou dépendante (freelance, lui-même)',
  recherche: 'Il devine sa cible et ses angles',
  temps:     'Pas le temps de gérer ça',
  risque:    'Déjà déçu / peur de payer pour rien',
  dispersion:'Beaucoup de pubs, ne sait plus lesquelles marchent',
  vide:      '0 ad active (rupture de stock ou plus de créatives)'
};

// La faille se définit toute seule d'après le cas de ses ads (le bouton « Mettre à jour les ads » suffit).
export const ECRIT_FAILLE_AUTO = { 0: 'vide', 1: 'gagnantes', 2: 'rythme', 3: 'angles', 4: 'dispersion' };

export const ECRIT_ETAPES = [
  { key: 'b1',    label: 'Bloc 1 · Audit' },
  { key: 'b2',    label: 'Bloc 2 · Plan' },
  { key: 'b3',    label: 'Bloc 3 · Offre' },
  { key: 'suite', label: 'Lien + suite' }
];

export const ECRIT_DELAI = { test: '48 h', perf: '48 h', growth: '24 h', scale: '24 h' };

export const ECRIT_N = { test: '12', perf: '24', growth: '48', scale: '96' };

export const ECRIT_PLAN_FIN = "\n\nVous ajoutez votre produit dans AdBoard, on fait le reste.\n\nJe vous montre l'offre qui colle à *[Marque]* ?";

export const ECRIT_QUATRE_TEMPS = "En pratique :\n*1. On étudie* votre marché et votre client.\n*2. On crée* vos créatives.\n*3. On livre* des lots prêts à publier.\n*4. On améliore* avec ce qui gagne.";

const B2_ENTETE = "Voici ce qu'on ferait pour *[Marque]* 👇🏾\n\n[Remarque]\n\n";
const B1_FIN = "\n\nJe vous montre comment on ferait pour *[Marque]* ?";
const B3_FIN = "\n\n*Ça vous convient ?* On peut démarrer maintenant 🙌";

export const DEFAULT_ECRIT = {
  b1_cas0: "J'ai regardé votre compte publicitaire : *0 ad active* en ce moment.\n\nÇa veut dire une de ces deux choses : *une rupture de stock*, ou *plus de créatives qui performent*.\n\nDans les deux cas, il faut *des créatives prêtes pour repartir fort*. C'est notre métier : on vous assure *un flux constant de nouvelles créatives qui performent*, pour de très bons résultats." + B1_FIN,
  b1_cas1: "J'ai regardé vos pubs.\n\nVous avez *[ads] ads actives*, depuis *[jours] jours* en moyenne.\n\nC'est bon signe : *vos créatives tiennent*, votre message parle à votre audience.\n\nMais une pub qui tourne longtemps finit par *s'user*. Et si rien n'est prêt pour prendre le relais, *vos ventes baissent*.\n\nNous, on prépare les prochaines pendant que les vôtres marchent encore." + B1_FIN,
  b1_cas2: "J'ai regardé vos pubs.\n\nVous avez *[ads] ads actives*, depuis *[jours] jours* en moyenne.\n\nVous testez, c'est la bonne démarche. Mais avec si peu de créatives, *un mauvais résultat ne dit rien* : le produit, le message ou la pub ? Impossible de savoir.\n\nIl vous faut *plus de créatives, et surtout différentes*. C'est ce qu'on fait : un flux régulier de nouvelles créatives, avec des angles variés." + B1_FIN,
  b1_cas3: "J'ai regardé vos pubs.\n\nVous avez *[ads] ads actives*, depuis *[jours] jours* en moyenne.\n\nC'est solide : *du volume, et ça tient*.\n\nLe risque : *tout finit par se ressembler*, et votre audience ne réagit plus, elle a déjà tout vu.\n\nCe qui relance les résultats, c'est *la variété* : des angles vraiment différents, chacun pour un type de client." + B1_FIN,
  b1_cas4: "J'ai regardé vos pubs.\n\nVous avez *[ads] ads actives*, depuis *[jours] jours* en moyenne.\n\nVous lancez beaucoup, et vite : c'est une vraie énergie.\n\nLe piège : *on ne sait plus ce qui marche*. Une bonne pub se noie parmi les autres.\n\nIl faut *repérer celles qui gagnent*, comprendre pourquoi, et s'en servir pour les suivantes." + B1_FIN,
  b2_vide: B2_ENTETE + "Sans pub active, *vous ne vendez pas*. Il faut repartir avec de *bons angles*, pas au hasard.\n\n• *[n] créatives par mois*, chacune sur un angle pensé pour votre client\n• Des lots *prêts à publier* en *[delai] maximum*\n\n" + ECRIT_QUATRE_TEMPS + ECRIT_PLAN_FIN,
  b2_rythme: B2_ENTETE + "Avec peu de créatives, vous ne savez jamais ce qui marche. Il faut *du volume, et des angles différents*.\n\n• *[n] créatives par mois*, chacune sur un angle différent\n• Vous trouvez vos *gagnantes beaucoup plus vite*\n\n" + ECRIT_QUATRE_TEMPS + ECRIT_PLAN_FIN,
  b2_gagnantes: B2_ENTETE + "Une pub gagnante finit toujours par s'user. Il faut *la suivante prête avant que ça arrive*.\n\n• On repère vos gagnantes et on comprend *pourquoi elles marchent*\n• On les décline : *mêmes ressorts, nouveaux visuels*\n\n" + ECRIT_QUATRE_TEMPS + ECRIT_PLAN_FIN,
  b2_angles: B2_ENTETE + "Meta montre vos pubs à des gens très différents. Un message unique ne parle qu'à *un seul type de client*.\n\n• Chaque lot défend *plusieurs angles différents*\n• Chaque angle vise *un type de client précis*\n\n" + ECRIT_QUATRE_TEMPS + ECRIT_PLAN_FIN,
  b2_dispersion: B2_ENTETE + "Quand on lance beaucoup, on finit par *ne plus savoir ce qui marche*. Il faut trier, pas lancer plus.\n\n• On repère vos *vraies gagnantes*\n• On vous dit *pourquoi* elles gagnent, et on s'en sert pour les suivantes\n\n" + ECRIT_QUATRE_TEMPS + ECRIT_PLAN_FIN,
  b2_production: B2_ENTETE + "Créer de bonnes créatives prend du temps : analyse, idée, design, retouches. *Ça mange vite toute votre semaine*.\n\n• Un seul interlocuteur, un seul espace : *AdBoard*\n• Des lots *prêts à publier* en *[delai] maximum*\n\n" + ECRIT_QUATRE_TEMPS + ECRIT_PLAN_FIN,
  b2_recherche: B2_ENTETE + "Sans étude de marché, *chaque angle est un pari*, et un pari perdu, c'est du budget perdu.\n\n• On étudie *vos concurrents* et leurs pubs qui marchent\n• On cerne *votre client idéal* : ce qu'il craint, ce qu'il veut\n• On en tire des *angles précis*\n\n" + ECRIT_QUATRE_TEMPS + ECRIT_PLAN_FIN,
  b2_temps: B2_ENTETE + "Quand tout repose sur vous, *les pubs passent toujours après le reste*.\n\n• *On gère* l'analyse, la création et la livraison\n• Vous gardez votre énergie pour *votre boutique*\n\n" + ECRIT_QUATRE_TEMPS + ECRIT_PLAN_FIN,
  b2_risque: B2_ENTETE + "Tant qu'on ne sait pas ce qui marche, chaque dépense est un risque. Il vous faut *des preuves avant d'investir plus*.\n\n• On teste *sur un volume maîtrisé*\n• On repère ce qui marche *avant de monter en budget*\n\n" + ECRIT_QUATRE_TEMPS + ECRIT_PLAN_FIN,
  b3_test: "Pour *[Marque]*, je vous propose de commencer par l'offre *TEST* 🙂\n\nChaque mois : *12 créatives stratégiques, prêtes à performer*, en 2 lots livrés en *48 h*.\n\nElles viennent d'une vraie étude de votre marché : *fini le budget pub gaspillé* sur des créatives faites au hasard.\n\nVous trouvez vos *premières créatives gagnantes* et vous accumulez les données qui améliorent vos résultats.\n\nTout arrive dans *AdBoard*." + B3_FIN,
  b3_perf: "Pour *[Marque]*, je vous recommande l'offre *PERF+* 🙂\n\nChaque mois : *24 créatives stratégiques*, avec leurs titres et textes déjà optimisés pour vendre. 4 lots, chacun livré en *48 h*.\n\nAprès chaque lot, on garde ce qui gagne et on corrige le reste : *vous ne repartez jamais de zéro*.\n\nVous avez les données de votre marché, et 2 membres de votre équipe peuvent rejoindre *AdBoard*.\n\nEt la *garantie Performance de 60 jours* vous couvre." + B3_FIN,
  b3_growth: "Pour *[Marque]*, je vous recommande l'offre *GROWTH* 🙂\n\nChaque mois : *48 créatives stratégiques*, avec leurs titres et textes déjà optimisés pour vendre. 8 lots, chacun livré en *24 h*.\n\nC'est le rythme pour *tester beaucoup d'angles en même temps*, trouver vite ce qui gagne, et scaler dessus.\n\nVous avez les données détaillées de votre marché, et jusqu'à 5 membres de votre équipe dans *AdBoard*.\n\nEt la *garantie Croissance de 60 jours* vous couvre." + B3_FIN,
  b3_scale: "Pour *[Marque]*, je vous recommande l'offre *SCALE* 🙂\n\nChaque mois : *96 créatives stratégiques*, avec leurs titres et textes déjà optimisés pour vendre. 16 lots, livrés en *24 h* et *en priorité*.\n\nPensée pour vendre sur *plusieurs marchés* : chacun a sa langue, sa culture, et ses propres angles.\n\nVous avez les données détaillées de vos marchés, et plus de 10 membres de votre équipe dans *AdBoard*.\n\nEt la *garantie Scaling de 60 jours* vous couvre." + B3_FIN,
  suite: "Parfait 🙌\n\nVoici la page de votre offre : [Lien]\n\nDès que c'est fait, [Facture]. On connecte *AdBoard* ensemble, et *votre premier lot arrive en [delai] maximum*.\n\nJe suis là à chaque étape."
};

export const ECRIT_TPL_LABELS = {
  b1_cas0: 'Bloc 1 · Audit — cas 0 : 0 ad active (rupture de stock ou plus de créatives)',
  b1_cas1: 'Bloc 1 · Audit — cas 1 : peu d\'ads, elles tiennent (variables [ads] [jours])',
  b1_cas2: 'Bloc 1 · Audit — cas 2 : peu d\'ads, récentes',
  b1_cas3: 'Bloc 1 · Audit — cas 3 : beaucoup d\'ads, elles tiennent',
  b1_cas4: 'Bloc 1 · Audit — cas 4 : beaucoup d\'ads, récentes',
  b2_rythme: 'Bloc 2 · Plan — ' + ECRIT_FAILLES.rythme, b2_angles: 'Bloc 2 · Plan — ' + ECRIT_FAILLES.angles,
  b2_gagnantes: 'Bloc 2 · Plan — ' + ECRIT_FAILLES.gagnantes, b2_production: 'Bloc 2 · Plan — ' + ECRIT_FAILLES.production,
  b2_recherche: 'Bloc 2 · Plan — ' + ECRIT_FAILLES.recherche, b2_dispersion: 'Bloc 2 · Plan — ' + ECRIT_FAILLES.dispersion, b2_vide: 'Bloc 2 · Plan — ' + ECRIT_FAILLES.vide, b2_temps: 'Bloc 2 · Plan — ' + ECRIT_FAILLES.temps, b2_risque: 'Bloc 2 · Plan — ' + ECRIT_FAILLES.risque,
  b3_test: 'Bloc 3 · Offre TEST', b3_perf: 'Bloc 3 · Offre PERF+', b3_growth: 'Bloc 3 · Offre GROWTH', b3_scale: 'Bloc 3 · Offre SCALE',
  suite: 'Après son « oui » · lien de l\'offre + suite (variables [Lien] [Facture] [delai])'
};

export const PAYS_ADJ = {
  'CI':'ivoirien', 'CÔTE D\'IVOIRE':'ivoirien', 'COTE D IVOIRE':'ivoirien', 'IVOIRE':'ivoirien',
  'SN':'sénégalais', 'SÉNÉGAL':'sénégalais', 'SENEGAL':'sénégalais',
  'CM':'camerounais', 'CAMEROUN':'camerounais',
  'NG':'nigérian', 'NIGERIA':'nigérian',
  'TG':'togolais', 'TOGO':'togolais',
  'BJ':'béninois', 'BENIN':'béninois', 'BÉNIN':'béninois',
  'ML':'malien', 'MALI':'malien',
  'BF':'burkinabè', 'BURKINA FASO':'burkinabè', 'BURKINA':'burkinabè',
  'GN':'guinéen', 'GUINÉE':'guinéen', 'GUINEE':'guinéen',
  'CD':'congolais', 'CG':'congolais', 'CONGO':'congolais',
  'RDC':'congolais', 'RD CONGO':'congolais', 'RÉPUBLIQUE DÉMOCRATIQUE DU CONGO':'congolais',
  'REPUBLIQUE DEMOCRATIQUE DU CONGO':'congolais',
  'GH':'ghanéen', 'GHANA':'ghanéen',
  'TD':'tchadien', 'TCHAD':'tchadien',
  'MG':'malgache', 'MADAGASCAR':'malgache',
  'MR':'mauritanien', 'MAURITANIE':'mauritanien',
  'GA':'gabonais', 'GABON':'gabonais'
};

export const PAYS_CODE = {
  'sénégalais':'SN','ivoirien':'CI','camerounais':'CM','nigérian':'NG','togolais':'TG',
  'béninois':'BJ','malien':'ML','burkinabè':'BF','guinéen':'GN','congolais':'CD',
  'ghanéen':'GH','tchadien':'TD','malgache':'MG','mauritanien':'MR','gabonais':'GA'
};

export const PAYS_PHRASE = {
  'CI':'en Côte d\'Ivoire', 'SN':'au Sénégal', 'CM':'au Cameroun', 'NG':'au Nigeria',
  'TG':'au Togo', 'BJ':'au Bénin', 'ML':'au Mali', 'BF':'au Burkina Faso',
  'GN':'en Guinée', 'CD':'en RD Congo', 'CG':'au Congo', 'GH':'au Ghana',
  'TD':'au Tchad', 'MG':'à Madagascar', 'MR':'en Mauritanie', 'GA':'au Gabon'
};

export const RELANCE_JOURS  = [3, 10, 21];

export const RELANCE_LABELS = ['Pitch personnalisé (ads du jour)', 'Preuve et autorité (étude de cas)', 'Alerte d\'ami : nouveau Meta Andromeda (lien vers l\'article)'];

export const DEFAULT_INTROS = ["Bonjour *[Marque]*,\nje viens de voir votre pub pour *[Produit]*\nEst-ce vous qui l'avez faite ?", "Bonjour *[Marque]*,\nvotre pub sur *[Produit]*\nJe me demandais, est-ce vous qui l'avez créée ?", "Bonjour *[Marque]*,\nje suis tombé sur votre pub *[Produit]* en scrollant\nEst-ce vous qui êtes derrière ?", "Bonjour *[Marque]*, petite question\nLa pub *[Produit]* que je viens de voir,\nest-ce vous qui l'avez faite ?", "Bonjour *[Marque]*\nJe viens de voir votre pub avec *[Produit]*\nEst-ce vous qui la gérez ?", "Bonjour *[Marque]*,\nje regardais votre pub sur *[Produit]*. J'avais une question !\nEst-ce vous qui l'avez faites ?", "Bonjour *[Marque]*,\nj'ai vu votre pub pour *[Produit]* passer aujourd'hui\nEst-ce vous qui la gérez ?", "Bonjour *[Marque]*,\nje viens de consulter votre publicité pour *[Produit]*\nEst-ce vous qui l'avez réalisée ?", "Bonjour *[Marque]*,\nje suis tombé sur vos pubs, notamment celle pour *[Produit]*\nEst-ce vous qui l'avez faite ?", "Bonjour *[Marque]*,\nje viens de tomber sur votre pub avec *[Produit]* à l'instant\nEst-ce vous qui êtes derrière ?"];

export const OLD_J21_DEFAUT = "Salut *[Marque]*,\n\nRécemment une étude a montré que *80%* des profits d'une marque e-commerce sur Facebook Ads venaient de l'exploitation des créatives performantes, recyclées correctement sur d'autres concepts créatifs.\n\nMais cela n'est possible que si l'on a un bon suivi et une organisation qui permet d'agir vite.\n\nC'est pour ça qu'on a *AdBoard* (adstackofficial.com/adboard) : notre plateforme où toutes vos créatives sont organisées et classées, afin de repartir de ce qui marche et d'améliorer les prochaines.\n\nLe tout pour que vous ne ratiez pas ces *80%* de revenus potentiels.\n\nEn tout cas voici mon dernier message ! J'espère que vous passerez une excellente semaine.";

export const DEFAULT_RELANCES = [
  "Bonjour *[Marque]*, j'espère ne pas vous avoir trop dérangé la dernière fois 😊 car on a vu que :\n\nVous aviez *[ads]* ads actives, en moyenne depuis *[jours]* jours, ce qui montre que vous *[bonne_nouvelle]* mais aussi que *[mauvaise_nouvelle]*.\n\nEt une partie de notre service consiste à éviter *[mauvaise_nouvelle_en_2_mots]* via *[solution]* pour aller chercher davantage de ventes.\n\nUn *Google Meet* pourrait être parfait ?\n\nOn voit concrètement tout ce qui pourrait freiner vos performances publicitaires et comment les résoudre.",
  "Re-bonjour *[Marque]* 👋\n\nQuand *Saelia* nous a contactés, elle pensait avoir *saturé son marché* : ses résultats baissaient, faute de nouvelles idées créatives.\n\nOn a d'abord *repéré ce qui bloquait*, puis remis en place la production. Résultat : *+10K$ dépensés en pub avec nos créatives, ROAS de 3,6*.\n\nOn ferait la même chose pour *[Marque]* : *trouver la faille avant de scaler*.\n\nLe cas complet : adstackofficial.com/etude-de-cas/saelia\n\nUn petit *Google Meet* pour voir ce que ça donnerait chez vous ?",
  "Salut *[Marque]*, un petit message d'ami avant de vous laisser tranquille 🙂\n\nLe 28 octobre, Meta a dévoilé *Andromeda 2.0*, le système qui choisit les pubs montrées à chaque personne.\n\nUne créative qui ne dit pas clairement *à qui elle parle et pourquoi acheter* a maintenant *beaucoup moins de chances de passer*. Publier comme avant, c'est *risquer de perdre en résultats*.\n\nOn s'est déjà adaptés, tout est expliqué ici : adstackofficial.com/blog/meta-andromeda-2-0\n\nLisez-le, et si vous voulez voir ce que ça change pour *[Marque]*, je suis là.\n\nC'est mon *dernier message*, belle semaine !"
];


export const DEFAULT_PITCH = "Je posais la question car notre *AGENCE*\n\naide des *Marques E-commerce* à accroître leurs *revenus* 📈 grâce à un système complet de *publicités pensées pour vendre* :\n\nNous analysons votre marché, concevons vos publicités *(vidéos et images)* et améliorons les prochaines à partir de ce qui a le mieux performé pour vous.\n\nÊtes-vous ouvert à un *Google Meet* pour identifier ensemble comment améliorer vos performances publicitaires afin de soutenir une croissance continue pour *[Marque]* ?\n\nEt si vous voulez voir nos *réalisations et offres* en premier, voici notre site web : adstackofficial.com\n\nPassez une excellente semaine !";
