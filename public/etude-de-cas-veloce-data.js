/* ÉTUDE DE CAS — Veloce (sport, Guinée & Côte d’Ivoire). Même structure que les autres fichiers etude-de-cas-*-data.js.
   Règle : un champ vide = le bloc correspondant n'est pas affiché. */
(window.ETUDES_DE_CAS = window.ETUDES_DE_CAS || {}).veloce = {
  actif: true,
  slug: "veloce",

  marque: "Veloce",
  secteur: "Sport",
  pays: "Guinée, Côte d’Ivoire",
  produit: "Lunette de vitesse photochromique",
  meta: "Créatives Meta Ads · E-commerce",
  lecture: "5 min de lecture",

  // Teaser sur la page de vente
  accroche: "Des angles qui visent là où il faut.",
  carteTitre: "Comment Veloce est passé de 0 à 5K$ de profit mensuel en 90 jours",
  carteLigne: "+50 créatives livrées, +8 gagnantes.",
  carteBg: "#DCE8F5",
  badge: "0 à 5K$ de profit/mois en 90 jours",
  teaserTexte: "Un ancien développeur e-commerce qui hésitait à lancer sa première publicité.",
  teaserImages: ["/assets/vente/veloce-lunette.jpg"],

  // Haut de la page
  titre: "« Ancien développeur pour e-commerçants, je savais créer une page et une offre qui convertissent. Vous avez amené la cible qui achète. »",
  chiffres: [
    { valeur: "3 mois", label: "de collaboration" },
    { valeur: "+50", label: "créatives livrées" },
    { valeur: "+8", label: "créatives gagnantes" }
  ],

  // Témoignage (texte retravaillé pour la lecture : à faire valider par le fondateur avant publication)
  temoignage: {
    texte: "Ça faisait plusieurs semaines que j’hésitais à lancer ma boutique dans la niche sportive : je ne savais pas par où commencer côté créatives. Je voulais simplement tester mon produit. Dès les premières créatives reçues, elles étaient si bien pensées que j’ai su que j’avais fait le bon choix. Ma campagne a été rentable dès le départ, puis j’ai pu scaler et stabiliser en injectant régulièrement de nouvelles créatives stratégiques.",
    nom: "Ibrahim Gomis",
    role: "Owner de Veloce",
    photo: "/assets/vente/ibrahim-gomis.jpg",
    youtube: ""
  },

  // La marque
  contexte: "Veloce est une boutique en ligne qui vend des produits pour les sportifs, plus précisément tout ce qui se porte. Son fondateur est un ancien développeur pour e-commerçants : il sait construire une page de vente qui convertit et concevoir une offre. Il a même mis en place tout un système d’automatisation. En revanche, la publicité, il ne la maîtrisait pas. Il démarrait sur le marché guinéen, avec un budget restreint et sans ad-spend fixe.",
  contexteChiffres: [
    { valeur: "Guinée", label: "marché de départ" },
    { valeur: "1", label: "produit phare à tester" },
    { valeur: "Budget restreint", label: "pas d’ad-spend fixe au départ" }
  ],
  produitsImgs: [
    { img: "/assets/vente/veloce-lunette.jpg", legende: "Lunette de vitesse photochromique" }
  ],

  // Le problème
  problemes: [
    "Aucune donnée et aucune compétence préalable pour construire de bonnes créatives.",
    "Il ne connaissait pas sa cible : qui viser, avec quel message ? Beaucoup de confusion.",
    "ChatGPT lui proposait des angles marketing, mais une fois vérifiés, ils ne tenaient pas : des angles génériques, que tout le monde utilise.",
    "Un freelance avait été essayé avant AdStack, mais le rendu était inutilisable : impossible à publier.",
    "Le stock était déjà commandé alors que le produit n’avait même pas été testé."
  ],

  // La solution
  etapes: [
    { quand: "Semaine 1", titre: "Offre TEST et premières créatives", texte: "Pour tester son produit, il prend l’offre TEST et nous donne toutes les informations sur sa lunette : spécificités, offre, arguments. Dès la première semaine, il reçoit son premier lot de créatives et sait avant même de les lancer qu’elles vont fonctionner." },
    { quand: "Semaine 2", titre: "Premiers résultats", texte: "Les premières créatives sortent avec d’excellents ROAS, allant parfois jusqu’à 7." },
    { quand: "Mois 1", titre: "Des gagnantes et une campagne rentable", texte: "À la fin du premier mois, il a ses premières créatives gagnantes et sa campagne est rentable." },
    { quand: "Mois 2", titre: "Passage à l’offre PERF+", texte: "Le volume de créatives est doublé. Il peut dépenser beaucoup plus, et de nouvelles créatives gagnantes apparaissent à un rythme régulier." },
    { quand: "Mois 3", titre: "Un rythme stable", texte: "Après trois mois, la boutique atteint 15 000 $ de chiffre d’affaires par mois, pour 5 000 $ de profit." }
  ],

  // Résultats
  resultatsIntro: "Une bonne offre, une bonne stratégie créative, et le bon équilibre entre volume et qualité. Par la suite, il nous a aussi recommandés à plusieurs de ses clients e-commerce.",
  resultats: [
    { valeur: "0 → 5K$", label: "de profit par mois en 90 jours" },
    { valeur: "+8", label: "créatives gagnantes depuis le début" },
    { valeur: "15K$", label: "de chiffre d’affaires par mois" }
  ],
  gagnantes: [],
  galerie: [],
  image: ""
};
