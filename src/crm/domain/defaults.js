// GÉNÉRÉ depuis l'ancien CRM (adstats.html) : textes et réglages repris tels quels. Modifiables dans Templates.
export const J3_REPLI_DEFAUT = "Re-bonjour *[Marque]*, j'espère que vous allez bien 😊\n\nQuand on a vu vos publicités, une question nous est venue : comment garder des publicités qui vendent dans la durée, sans que les mêmes visuels s'essoufflent ?\n\nUne partie de notre service consiste justement à éviter *l'essoufflement publicitaire* via *la diversité créative*, et à repartir de ce qui marche pour aller chercher davantage de ventes.\n\nUn *Google Meet* pourrait être parfait ?\n\nOn voit concrètement tout ce qui pourrait freiner vos performances publicitaires et comment les résoudre.";

export const J3_CAS0_DEFAUT = "Bonjour *[Marque]* 😊\n\nOn a regardé votre compte publicitaire : *0 ad active* en ce moment.\n\nUne pause, ça arrive : une rupture de stock, ou des créatives qui ne performaient plus comme avant.\n\nDans les deux cas, l'important, c'est de repartir vite avec de nouvelles créatives prêtes à performer.\n\nC'est ce qu'on apporte (adstackofficial.com) : un flux de nouvelles créatives qui performent, pour que les ventes de *[Marque]* redémarrent.\n\nUn *Google Meet* pour regarder ça ensemble ?";

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

// Relances après appel (closing J+1/J+4/J+11) et closing par écrit : retirés le 27/11/2026.
// ECRIT_PLAN_FIN et ECRIT_QUATRE_TEMPS restent : d'anciens modèles (defaults_prev.js) s'en servent pour reconnaître les textes jamais modifiés.

export const ECRIT_PLAN_FIN = "\n\nVous ajoutez votre produit dans AdBoard, on fait le reste.\n\nJe vous montre l'offre qui colle à *[Marque]* ?";

export const ECRIT_QUATRE_TEMPS = "En pratique :\n*1. On étudie* votre marché et votre client.\n*2. On crée* vos créatives.\n*3. On livre* des lots prêts à publier.\n*4. On améliore* avec ce qui gagne.";

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

export const RELANCE_LABELS = ['Constat sur ses ads + piège du timing (relevé du jour)', 'Preuve : les trois études de cas (Veloce, Saelia, Vitalina)', 'Dernier message : Meta Andromeda 2.0 (lien vers l\'article)'];

export const DEFAULT_INTROS = ["Bonjour *[Marque]*,\nje viens de voir votre pub pour *[Produit]*\nEst-ce vous qui l'avez faite ?", "Bonjour *[Marque]*,\nvotre pub sur *[Produit]*\nJe me demandais, est-ce vous qui l'avez créée ?", "Bonjour *[Marque]*,\nje suis tombé sur votre pub *[Produit]* en scrollant\nEst-ce vous qui êtes derrière ?", "Bonjour *[Marque]*, petite question\nLa pub *[Produit]* que je viens de voir,\nest-ce vous qui l'avez faite ?", "Bonjour *[Marque]*\nJe viens de voir votre pub avec *[Produit]*\nEst-ce vous qui la gérez ?", "Bonjour *[Marque]*,\nje regardais votre pub sur *[Produit]*. J'avais une question !\nEst-ce vous qui l'avez faites ?", "Bonjour *[Marque]*,\nj'ai vu votre pub pour *[Produit]* passer aujourd'hui\nEst-ce vous qui la gérez ?", "Bonjour *[Marque]*,\nje viens de consulter votre publicité pour *[Produit]*\nEst-ce vous qui l'avez réalisée ?", "Bonjour *[Marque]*,\nje suis tombé sur vos pubs, notamment celle pour *[Produit]*\nEst-ce vous qui l'avez faite ?", "Bonjour *[Marque]*,\nje viens de tomber sur votre pub avec *[Produit]* à l'instant\nEst-ce vous qui êtes derrière ?"];

export const OLD_J21_DEFAUT = "Salut *[Marque]*,\n\nRécemment une étude a montré que *80%* des profits d'une marque e-commerce sur Facebook Ads venaient de l'exploitation des créatives performantes, recyclées correctement sur d'autres concepts créatifs.\n\nMais cela n'est possible que si l'on a un bon suivi et une organisation qui permet d'agir vite.\n\nC'est pour ça qu'on a *AdBoard* (adstackofficial.com/adboard) : notre plateforme où toutes vos créatives sont organisées et classées, afin de repartir de ce qui marche et d'améliorer les prochaines.\n\nLe tout pour que vous ne ratiez pas ces *80%* de revenus potentiels.\n\nEn tout cas voici mon dernier message ! J'espère que vous passerez une excellente semaine.";

// J+10 : une étude de cas choisie d'après le cas relevé à l'envoi du J+3 (mémorisé dans les notes : j3_cas).
export const J10_ETUDE_DE_CAS = { 0: 'veloce', 1: 'saelia', 2: 'veloce', 3: 'saelia', 4: 'vitalina' };
export const J10_ETUDES = {
  veloce: {
    label: 'Veloce · cas 0 et 2 (aucune ad ou peu d\'ads récentes)', slug: 'veloce',
    histoire: "On a accompagné *Veloce*, une boutique de sport. Son fondateur, ancien développeur pour e-commerçants, savait faire une page de vente et une offre, mais il n'y connaissait rien en pub.",
    solution: "Avec une *recherche marketing approfondie* et une *stratégie personnalisée*, il a visé juste dès ses premiers lancements.",
    resultat: "Résultat : *5K$ de profit par mois* en 3 mois."
  },
  vitalina: {
    label: 'Vitalina · cas 4 (beaucoup d\'ads récentes)', slug: 'vitalina',
    histoire: "On a accompagné *Vitalina*, une marque de compléments alimentaires. Ses créatives s'essoufflaient en quelques jours, et la marque stagnait depuis longtemps.",
    solution: "On a trouvé les *angles et concepts que ses concurrents n'exploitaient pas encore*. Ses pubs ont duré beaucoup plus longtemps.",
    resultat: "Résultat : *chiffre d'affaires presque doublé en 6 semaines*, avec un ROAS de *4,3*."
  },
  saelia: {
    label: 'Saelia · cas 1 et 3 (ads qui tiennent longtemps)', slug: 'saelia',
    histoire: "On a accompagné *Saelia*, une boutique de cosmétiques en RDC. Elle pensait avoir saturé son marché : plus aucune idée de nouvelles créatives.",
    solution: "Avec de *nouvelles idées et une vraie diversité créative*, la marque a retrouvé de l'élan.",
    resultat: "Résultat : *+10K$ dépensés en 2 mois*, avec un bon ROAS de *3,6*."
  }
};

export const DEFAULT_RELANCES = [
  "Bonjour *[Marque]* 😊, j'espère ne pas vous avoir trop dérangé la fois passée.\nEn regardant vos publicités, on a vu *[ads]* ads actives, en moyenne depuis *[jours]* jours. Ça montre que vous *[bonne_nouvelle]*.\nÀ ce stade, *[mauvaise_nouvelle]*.\nC'est souvent là que la croissance ralentit sans prévenir. Notre système *(adstackofficial.com)* évite *[mauvaise_nouvelle_en_2_mots]* grâce à *[solution]*, pour que *[Marque]* continue de *croître*.\nPartant pour un *Google Meet* ? On analyse la situation de *[Marque]* et les axes à exploiter en priorité.",
  "Bonjour *[Marque]* 👋🏾, ces derniers mois, on a accompagné des marques dans des situations très différentes :\nVeloce (sport) *partait de zéro en publicité*, Saelia (cosmétiques) *pensait son marché saturé* et Vitalina (compléments) *stagnait depuis longtemps*.\nPour chacune, on a trouvé ce qui clochait et mis en place une stratégie personnalisée, avec d'excellents résultats présentés ici 👉🏾 https://www.adstackofficial.com/etude-de-cas\nEt au cas où, je suis dispo pour un *Meet* afin qu'on voie ensemble jusqu'où on pourrait aller avec *[Marque]* ?",
  "Salut *[Marque]*, un petit message d'ami avant de vous laisser tranquille 🙂\n\nLe 28 octobre, Meta a dévoilé *Andromeda 2.0* : c'est désormais la créative elle-même qui décide à qui votre pub est montrée.\n\nUne créative qui ne dit pas clairement *à qui elle parle et pourquoi acheter* passe beaucoup moins. Publier comme avant, c'est *payer plus cher pour vendre moins*.\n\nOn s'est déjà adaptés, tout est expliqué ici : adstackofficial.com/blog/meta-andromeda-2-0\n\nSi vous voulez voir ce que ça change pour *[Marque]*, je suis dispo pour un *Meet*.\n\nC'est mon *dernier message*, belle semaine !"
];


export const DEFAULT_PITCH = "Je posais la question car notre *AGENCE(https://adstackofficial.com)*\naide des marques e-commerce à *croître*📈 sans avoir à courir après les créatives :\nNous étudions votre cible en profondeur, concevons des *publicités* qui lui parlent et apprenons de ce qui a marché pour rendre les suivantes encore plus *rentables*.\nSeriez-vous partant pour un *Google Meet* : on analyse la situation de *[Marque]*, puis on voit ensemble les axes d'amélioration à exploiter ?";

// Parcours acheteur : messages de départ (modifiables dans Templates › Acheteurs), un par étape de PARCOURS (domain/acheteurs.js).
export const DEFAULT_ACHETEUR = [
  "Bonjour [Prénom] 😊\n\nMerci pour votre confiance ! Votre abonnement *[Offre]* est bien enregistré.\n\nPour que l'équipe démarre vite, il reste une étape : ajouter les infos de *[Marque]* et de votre produit dans AdBoard. Dès que c'est fait, vos premières créatives arrivent sous [Délai].\n\nSi vous bloquez quelque part, répondez-moi ici, je vous aide tout de suite.",
  "Bonjour [Prénom] 😊\n\nQuelques jours après le démarrage : avez-vous bien reçu vos premières créatives pour *[Marque]* ? Et les avez-vous déjà lancées en publicité ?\n\nSi vous voulez, je regarde avec vous comment les tester pour apprendre vite ce qui marche.",
  "Bonjour [Prénom],\n\nÇa fait deux semaines que vos créatives tournent. Comment ça se passe côté résultats pour *[Marque]* ? Les ventes, le coût par achat, ce qui vous a surpris ?\n\nVotre retour nous sert à ajuster les prochains angles. Et si vous êtes satisfait(e), un petit avis de votre part nous aiderait beaucoup 🙏",
  "Bonjour [Prénom] 😊\n\nVotre abonnement *[Offre]* approche de son renouvellement. Si les résultats sont là, la suite logique pour *[Marque]* est de produire plus et de tester plus d'angles à la fois : c'est le rôle de l'offre *[Offre_suivante]* ([Volume_suivant] créatives par mois, livrées en [Délai_suivant]).\n\nSi ça vous intéresse, voici la page : [Lien]"
];
