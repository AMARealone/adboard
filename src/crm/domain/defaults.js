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

// Rythme des relances closing : J+1 = 1 jour après l'appel ; J+4 = 3 jours après l'ENVOI de J+1 ; J+11 = 7 jours après l'ENVOI de J+4.
// Un retard d'envoi ne décale donc que les relances suivantes (le compte à rebours part de la case « envoyé »).
export const CLOSING_JOURS  = [1, 4, 11];
export const CLOSING_DELAIS = [1, 3, 7];

export const CLOSING_LABELS = ['Relance 1', 'Relance 2', 'Relance 3'];

// Situation du prospect après l'appel (ce qui l'empêche de payer tout de suite) : chaque situation a ses trois relances.
export const CLOSING_SITUATIONS = [
  { k: 'reflechir', label: "Il veut y réfléchir" },
  { k: 'equipe', label: "Il en parle à son équipe ou ses associés" },
  { k: 'budget', label: "Son budget n'est pas complet" },
  { k: 'stock', label: "Il attend d'avoir du stock" }
];

// Ordre : situation par situation, avec J+1, J+4, J+11 pour chacune.
export const CLOSING_SLOTS = [
  { j: 1, v: 'reflechir', label: "Il veut y réfléchir · J+1" },
  { j: 4, v: 'reflechir', label: "Il veut y réfléchir · J+4" },
  { j: 11, v: 'reflechir', label: "Il veut y réfléchir · J+11" },
  { j: 1, v: 'equipe', label: "Il en parle à son équipe ou ses associés · J+1" },
  { j: 4, v: 'equipe', label: "Il en parle à son équipe ou ses associés · J+4" },
  { j: 11, v: 'equipe', label: "Il en parle à son équipe ou ses associés · J+11" },
  { j: 1, v: 'budget', label: "Son budget n'est pas complet · J+1" },
  { j: 4, v: 'budget', label: "Son budget n'est pas complet · J+4" },
  { j: 11, v: 'budget', label: "Son budget n'est pas complet · J+11" },
  { j: 1, v: 'stock', label: "Il attend d'avoir du stock · J+1" },
  { j: 4, v: 'stock', label: "Il attend d'avoir du stock · J+4" },
  { j: 11, v: 'stock', label: "Il attend d'avoir du stock · J+11" }
];

export const DEFAULT_CLOSING = [
  "Bonjour [Prénom] 😊\n\nMerci encore pour l'échange d'hier. Ce que vous m'avez dit sur *[Marque]* m'a marqué : pour [Objectif], l'enjeu, c'est [Problème].\n\nPrenez le temps qu'il vous faut pour réfléchir. Je voulais juste que vous sachiez que c'est exactement le genre de situation qu'on règle, et qu'on peut s'y mettre dès que vous le décidez.\n\nLe paiement se fait ici : [Lien]\n\nQu'est-ce qui pèse le plus dans votre réflexion pour le moment ?",
  "Bonjour [Prénom] 🙂\n\nJe pensais à *[Marque]*. Imaginez dans deux semaines : vos premières créatives sont en ligne, vous savez enfin lesquelles marchent, et [Objectif] n'est plus une idée, c'est un chiffre qui bouge.\n\nChaque jour compte : plus tôt vous démarrez, plus tôt vous savez ce qui marche pour vendre.\n\nLe premier pas pour [Objectif], c'est ici : [Lien]",
  "Bonjour [Prénom],\n\nC'est mon *dernier message*, je ne veux pas vous déranger 🙂\n\nSi vous décidez de démarrer pour [Objectif], voici la suite : vous payez, vous nous donnez les infos de votre produit, et on produit votre premier lot.\n\nLe lien : [Lien]\n\nJe ne vous relance plus. Écrivez-moi *« go »* quand vous êtes prêt(e), et on démarre ensemble.",
  "Bonjour [Prénom] 😊\n\nMerci encore pour l'échange d'hier. Vous deviez en parler à votre équipe avant de décider : c'est normal, [Objectif] est une vraie décision pour *[Marque]*.\n\nSi vos associés ont des questions, je peux leur répondre directement, ici ou en appel avec eux.\n\nQuand c'est validé, le paiement se fait ici : [Lien]\n\nEst-ce qu'ils ont déjà pu en parler ?",
  "Bonjour [Prénom] 🙂\n\nJe pensais à *[Marque]*. Imaginez dans deux semaines : vos premières créatives sont en ligne, vous savez enfin lesquelles marchent, et [Objectif] n'est plus une idée, c'est un chiffre qui bouge.\n\nChaque jour compte : plus tôt votre équipe valide, plus tôt vous savez ce qui marche pour vendre. Dès que c'est validé, vous payez et on démarre ensemble.\n\nLe premier pas pour [Objectif], c'est ici : [Lien]",
  "Bonjour [Prénom],\n\nC'est mon *dernier message*, je ne veux pas vous déranger 🙂\n\nQuand votre équipe aura validé, voici la suite : vous payez, vous nous donnez les infos de votre produit, et on produit votre premier lot pour [Objectif].\n\nLe lien : [Lien]\n\nJe ne vous relance plus. Si vos associés ont des questions, écrivez-moi, je leur réponds directement.",
  "Bonjour [Prénom] 😊\n\nMerci encore pour l'échange d'hier. Vous m'avez dit que votre budget n'était pas encore complet : c'est tout à fait normal, ce n'est pas une décision qu'on prend à la légère.\n\nJe ne vous mets aucune pression. Je voulais juste que vous ayez le lien sous la main pour quand ce sera prêt : [Lien]\n\nVous pensez l'avoir d'ici combien de temps, à peu près ?",
  "Bonjour [Prénom] 🙂\n\nJe pensais à *[Marque]*. Quand votre budget sera prêt, voici ce qui vous attend : vos premières créatives en ligne, vous savez enfin lesquelles marchent, et [Objectif] n'est plus une idée, c'est un chiffre qui bouge.\n\nVos créatives sont disponibles dès le paiement : vous payez le jour où vous êtes prêt(e), et vous pouvez faire votre première demande le jour même.\n\nLe lien : [Lien]",
  "Bonjour [Prénom],\n\nC'est mon *dernier message*, je ne veux pas vous déranger 🙂\n\nQuand votre budget sera prêt, voici la suite : vous payez, vous nous donnez les infos de votre produit, et on produit votre premier lot pour [Objectif].\n\nLe lien reste actif : [Lien]\n\nJe ne vous relance plus. Écrivez-moi *« go »* à ce moment-là, et on démarre ensemble.",
  "Bonjour [Prénom] 😊\n\nMerci encore pour l'échange d'hier. Vous m'avez dit que vous deviez d'abord avoir du stock : c'est logique, inutile de lancer des pubs sans produit à livrer.\n\nJe ne vous mets aucune pression. Dès que votre stock est là, le paiement se fait ici : [Lien]\n\nVous attendez votre réapprovisionnement pour quand, à peu près ?",
  "Bonjour [Prénom] 🙂\n\nJe pensais à *[Marque]*. Le jour où votre stock est de retour, vous voulez que vos pubs soient prêtes à vendre dès le premier jour. Autant démarrer la production quelques jours avant l'arrivée du stock : vos créatives sont alors prêtes à sa réception, pour [Objectif].\n\nVous payez, vous nous donnez les infos de votre produit, et on produit votre premier lot.\n\nLe lien : [Lien]",
  "Bonjour [Prénom],\n\nC'est mon *dernier message*, je ne veux pas vous déranger 🙂\n\nDès que votre stock est de retour, voici la suite : vous payez, vous nous donnez les infos de votre produit, et on produit votre premier lot pour [Objectif].\n\nLe lien : [Lien]\n\nJe ne vous relance plus. Écrivez-moi *« go »* quand vous êtes prêt(e), et on démarre ensemble."
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
  { key: 'b1',    label: 'Bloc 1 · Diagnostic' },
  { key: 'b2',    label: 'Bloc 2 · Plan' },
  { key: 'b3',    label: 'Bloc 3 · Étude de cas' },
  { key: 'b4',    label: 'Bloc 4 · Offre' },
  { key: 'suite', label: 'Lien + suite' }
];

export const ECRIT_DELAI = { test: '48 h', perf: '48 h', growth: '24 h', scale: '24 h' };

export const ECRIT_N = { test: '12', perf: '24', growth: '48', scale: '96' };

export const ECRIT_PLAN_FIN = "\n\nVous ajoutez votre produit dans AdBoard, on fait le reste.\n\nJe vous montre l'offre qui colle à *[Marque]* ?";

export const ECRIT_QUATRE_TEMPS = "En pratique :\n*1. On étudie* votre marché et votre client.\n*2. On crée* vos créatives.\n*3. On livre* des lots prêts à publier.\n*4. On améliore* avec ce qui gagne.";

// ── Closing par écrit : 4 blocs (1 diagnostic · 2 plan · 3 étude de cas · 4 offre) + suite.
// Les blocs 1 à 3 dépendent du cas (nombre d'ads actives × durée moyenne) ; le bloc 4 dépend de l'offre choisie dans la fiche.
const B1_TETE = "J'ai regardé votre compte publicitaire 👀\n\n";
const B2_TETE = "Voici ce qu'on ferait pour *[Marque]* 👇🏾\n\n[Remarque]\n\n";
const PRATIQUE = (e1, e2) => "En pratique :\n1. " + e1 + "\n2. " + e2 + "\n3. On vous livre des créatives prêtes à lancer\n4. Vous lancez, et on regarde ce qui marche le mieux\n\nVous nous donnez un minimum d'infos sur votre produit, on fait le reste.\n\n";
const ANGLES_DEF = "On définit vos angles marketing. Pour chaque angle, 1 vidéo et 2 images optimisées conversion";
const ANGLES_NEUFS = "On en tire de nouveaux angles marketing. Pour chaque angle, 1 vidéo et 2 images optimisées conversion";
const B3_FIN = "\n\nJe vous montre l'offre qui colle à *[Marque]* ?";
const B4_FIN = "\n\nTout le détail est ici 👇🏾\n👉🏾 [lien]\n\n*Ça vous convient ?* On peut démarrer maintenant 🙌";

export const DEFAULT_ECRIT = {
  // ── Bloc 1 · diagnostic (aucune question, aucune phrase de fin : le bloc 2 suit tout de suite)
  b1_cas0: "J'ai regardé votre compte publicitaire : *0 ad active* en ce moment.\n\nDans la plupart des cas, c'est une rupture de stock, ou plus de créatives qui performent.\n\nDans les deux cas, on repart pareil : avec de nouvelles créatives, prêtes à performer.\n\nC'est ce qu'on apporte à *[Marque]*.",
  b1_cas1: B1_TETE + "Vous avez *[ads] ads actives*, depuis en moyenne *[jours] jours*.\n\nDes pubs qui tiennent aussi longtemps, c'est un très bon signe : elles parlent à votre audience.\n\nCe qu'on voit souvent à ce stade : quand tout repose sur quelques créatives, il reste peu de marge pour monter le budget sans risque.\n\nPour avancer, il faut un renouvellement continu de créatives prêtes à performer, avec une vraie diversité créative.\n\nC'est ce qu'on apporte à *[Marque]*.",
  b1_cas2: B1_TETE + "Vous avez *[ads] ads actives*, depuis en moyenne *[jours] jours*.\n\nC'est une bonne base : vous avez déjà lancé et vous êtes en mouvement.\n\nCe qu'on voit souvent chez les marques à ce stade : avec peu de créatives en parallèle, Meta a peu de choix pour trouver la bonne combinaison.\n\nAvec plus de créatives et des angles bien différents, les résultats montent beaucoup plus vite.\n\nC'est exactement là qu'on peut accélérer *[Marque]*.",
  b1_cas3: B1_TETE + "Vous avez *[ads] ads actives*, depuis en moyenne *[jours] jours*.\n\nC'est du solide : beaucoup de pubs, et elles tiennent dans la durée. Vous savez ce qui marche pour *[Marque]*.\n\nÀ ce stade, ce qu'on voit souvent, c'est qu'on finit par manquer d'idées de nouvelles créatives à lancer.\n\nLes résultats se tassent, et on se dit que le marché est saturé.\n\nEn général, il reste de la place. Il manque juste de nouvelles idées pour la prendre.",
  b1_cas4: B1_TETE + "Vous avez *[ads] ads actives*, depuis en moyenne *[jours] jours*.\n\nVous testez beaucoup, et c'est le bon réflexe : c'est comme ça qu'on trouve ce qui marche.\n\nCe qu'on voit souvent à ce stade : les pubs partent d'une même idée de base, avec des variantes. Pour Meta, ça fait peu de vrai choix, donc aucune ne ressort vraiment.\n\nOn coupe, on relance, et le cycle recommence.\n\nAvec des idées vraiment distinctes, chaque test apprend quelque chose.",

  // ── Bloc 2 · plan (3 puces tirées de la situation du cas, « En pratique », transition vers l'étude de cas, aucune question)
  b2_cas0: B2_TETE + "Sans pub active, les ventes s'arrêtent. L'objectif : vous remettre en route vite, et durablement.\n\n• Un redémarrage rapide : vos premières créatives prêtes à lancer, sans attendre\n• Des créatives construites sur ce que vos clients veulent vraiment, pas au hasard\n• Un flux de nouvelles créatives pour ne plus jamais revenir à zéro pub\n\n" + PRATIQUE("On étudie votre marché et vos clients", ANGLES_DEF) + "Des marques sont reparties de zéro avec nous. Regardez ce que ça a donné 👇🏾",
  b2_cas1: B2_TETE + "Vous avez déjà des pubs qui tiennent. L'objectif : vous donner de quoi monter plus haut.\n\n• De la diversité créative : de vrais nouveaux concepts, pas des variantes\n• Après votre premier lancement, on repart de ce qui marche\n• Une campagne plus stable, pour monter le budget sans crainte\n\n" + PRATIQUE("On étudie votre marché et vos clients", ANGLES_DEF) + "Une marque dans votre situation a franchi ce cap. Regardez ce que ça a donné 👇🏾",
  b2_cas2: B2_TETE + "Votre point de départ est bon. L'objectif, c'est de le pousser plus loin, plus vite.\n\n• Plus de matière pour Meta : il a plus de créatives à tester, donc plus de chances de trouver celles qui performent\n• Des angles vraiment différents : chacun parle à un type de client différent\n• Une gagnante identifiée plus tôt, pour mettre votre budget dessus\n\n" + PRATIQUE("On analyse votre marché et vos clients", ANGLES_DEF) + "Des marques sont parties d'une situation proche de la vôtre. Regardez ce que ça a donné 👇🏾",
  b2_cas3: B2_TETE + "Vous avez de bonnes bases. Notre rôle : vous éviter de tomber à court d'idées.\n\n• Une source d'idées qui ne s'épuise pas : toujours de nouvelles créatives à lancer\n• On écoute vos clients et on regarde vos concurrents, pour trouver ce que personne n'exploite encore\n• Un marché pas saturé : des places encore libres, qu'on vous ouvre\n\n" + PRATIQUE("On étudie vos clients et vos concurrents", ANGLES_NEUFS) + "Des marques qui scalaient déjà sont passées par là. Regardez ce que ça a donné 👇🏾",
  b2_cas4: B2_TETE + "Vous avez déjà le réflexe de tester. On vous aide à ce que chaque test compte.\n\n• Moins de pubs à couper : chaque créative part d'une vraie idée, pas d'une simple variante\n• Des idées qui n'ont rien à voir entre elles : Meta a enfin de quoi choisir\n• Des créatives pensées pour convertir dès le lancement, pour qu'elles aient le temps de faire leurs preuves\n\n" + PRATIQUE("On part de vos clients : ce qu'ils veulent, ce qui les freine", ANGLES_NEUFS) + "Des marques testaient beaucoup avant de trouver leur formule. Regardez ce que ça a donné 👇🏾",

  // ── Bloc 3 · preuve (étude de cas du profil, lien, puis la question vers l'offre)
  b3_cas0: "Veloce est partie de zéro, avec un petit budget.\n\nCampagne rentable dès les premières créatives. Ensuite, elle a scalé en ajoutant de nouvelles créatives.\n\nRésultat : de 0 à 5K$ de profit par mois en 90 jours, avec +50 créatives produites et +8 gagnantes.\n\n👉🏾 adstackofficial.com/etude-de-cas/veloce" + B3_FIN,
  b3_cas1: "Vitalina avait de bons résultats, mais jamais assez stables pour augmenter son budget sans casser sa rentabilité.\n\nAvec un flux de nouvelles créatives, ses campagnes sont devenues stables. Elle a pu monter son budget sans crainte.\n\nRésultat : un chiffre d'affaires mensuel presque doublé en 6 semaines, avec un ROAS moyen de 4,3.\n\n👉🏾 adstackofficial.com/etude-de-cas/vitalina" + B3_FIN,
  b3_cas2: "Veloce est partie de zéro, avec un petit budget.\n\nCampagne rentable dès les premières créatives. Ensuite, elle a scalé en ajoutant de nouvelles créatives.\n\nRésultat : de 0 à 5K$ de profit par mois en 90 jours, avec +50 créatives produites et +8 gagnantes.\n\n👉🏾 adstackofficial.com/etude-de-cas/veloce" + B3_FIN,
  b3_cas3: "Saelia pensait avoir saturé son marché : plus d'idées de nouvelles créatives, et des résultats qui baissaient.\n\nEn quelques semaines, tout a été remis en place, avec une vraie diversité créative.\n\nRésultat : +10K$ dépensés sur Meta Ads avec nos créatives, en restant rentable. ROAS de 3,6 et +8 créatives top performer.\n\n👉🏾 adstackofficial.com/etude-de-cas/saelia" + B3_FIN,
  b3_cas4: "Chez Vitalina, les créatives marchaient quelques jours, puis les résultats s'effondraient. Et quand une créative gagnait, impossible de savoir comment l'exploiter.\n\nAvec de nouvelles créatives construites sur une vraie étude de marché, les angles gagnants sont apparus, puis ont été exploités.\n\nRésultat : un chiffre d'affaires mensuel presque doublé en 6 semaines, avec un ROAS moyen de 4,3.\n\n👉🏾 adstackofficial.com/etude-de-cas/vitalina" + B3_FIN,

  // ── Bloc 4 · offre (choisie dans la fiche ; jamais de prix, de détail des fonctionnalités ni de garantie ; toujours le lien)
  b4_test: "Pour *[Marque]*, on commencerait par l'offre *TEST*.\n\n*[n] créatives stratégiques*, prêtes à performer, appuyées sur une étude de marché.\n\nL'objectif : trouver vos premières gagnantes sans tâtonner." + B4_FIN,
  b4_perf: "Pour *[Marque]*, on vous recommande l'offre *PERF+*.\n\n*[n] créatives stratégiques*, prêtes à performer, appuyées sur une étude de marché.\n\nL'objectif : garder ce qui gagne et ne plus jamais repartir de zéro." + B4_FIN,
  b4_growth: "Pour *[Marque]*, on vous recommande l'offre *GROWTH*.\n\n*[n] créatives stratégiques*, prêtes à performer, appuyées sur une étude de marché.\n\nL'objectif : tester beaucoup d'idées en parallèle, trouver vite ce qui gagne et scaler dessus." + B4_FIN,
  b4_scale: "Pour *[Marque]*, on vous recommande l'offre *SCALE*.\n\n*[n] créatives stratégiques*, prêtes à performer, appuyées sur une étude de marché.\n\nL'objectif : porter votre croissance sur plusieurs marchés, chacun avec ses propres angles." + B4_FIN,

  suite: "Parfait 🙌\n\nVoici la page de votre offre : [Lien]\n\nDès que c'est fait, [Facture]. On connecte *AdBoard* ensemble, et *votre premier lot arrive en [delai] maximum*.\n\nJe suis là à chaque étape."
};

const CAS_L = ['0 ad active', 'peu d\'ads, elles tiennent', 'peu d\'ads, durée courte', 'beaucoup d\'ads, elles tiennent', 'beaucoup d\'ads, durée courte']
export const ECRIT_TPL_LABELS = {
  suite: 'Après son « oui » · lien de l\'offre + suite (variables [Lien] [Facture] [delai])'
};
;[0, 1, 2, 3, 4].forEach((c) => {
  ECRIT_TPL_LABELS['b1_cas' + c] = 'Bloc 1 · Diagnostic — cas ' + c + ' : ' + CAS_L[c] + (c ? ' (variables [ads] [jours])' : '')
  ECRIT_TPL_LABELS['b2_cas' + c] = 'Bloc 2 · Plan — cas ' + c + ' : ' + CAS_L[c]
  ECRIT_TPL_LABELS['b3_cas' + c] = 'Bloc 3 · Étude de cas — cas ' + c + ' : ' + CAS_L[c]
})
Object.assign(ECRIT_TPL_LABELS, { b4_test: 'Bloc 4 · Offre TEST', b4_perf: 'Bloc 4 · Offre PERF+', b4_growth: 'Bloc 4 · Offre GROWTH', b4_scale: 'Bloc 4 · Offre SCALE' })

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
