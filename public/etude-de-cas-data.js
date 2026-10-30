/* ÉTUDE DE CAS — toutes les données de la section (page de vente) et de la page /etude-de-cas.
   Règle : un champ vide = le bloc correspondant n'est pas affiché. Rien n'est inventé par le code.
   "actif" à true : la section apparaît sur la page de vente. */
window.ETUDE_DE_CAS = {
  actif: true,
  slug: "vitalina",

  marque: "Vitalina Energy",
  secteur: "Complément alimentaire",
  pays: "Sénégal",
  produit: "Vitalina Energy — gélules à base de spiruline",
  prix: "",
  meta: "Créatives Meta Ads · E-commerce",
  lecture: "5 min de lecture",

  // Teaser sur la page de vente
  accroche: "Plusieurs angles et créatives gagnantes en l’espace de quelques semaines.",
  badge: "x2 sur le chiffre d’affaires mensuel",
  teaserTexte: "Un aperçu des résultats obtenus avec une marque ambitieuse.",

  // Haut de la page
  titre: "« C’est tout un système mis en place, pas juste des créatives. Et ça a tout changé pour moi. »",
  chiffres: [
    { valeur: "2,7 M → 6,15 M", label: "FCFA de chiffre d’affaires par mois" },
    { valeur: "4,3", label: "ROAS moyen" },
    { valeur: "+3.000 $", label: "dépensés sur nos créatives" },
    { valeur: "6 semaines", label: "pour obtenir ces résultats" }
  ],

  // Témoignage
  temoignage: {
    texte: "Avant AdStack, j’avais de bons résultats publicitaires, mais jamais assez stables pour augmenter mon budget sans casser ma rentabilité. Résultat : six mois de stagnation, très difficiles à vivre. Aujourd’hui, avec tout ce système créatif en place, mes campagnes sont beaucoup plus stables. J’ai de plus en plus de créatives gagnantes et je peux augmenter mon budget pub sans crainte. J’ai doublé mon chiffre d’affaires, et j’envisage d’aller chercher avec eux plusieurs dizaines de milliers de dollars de chiffre d’affaires par mois.",
    nom: "Aliou Cissé",
    role: "Fondateur de Vitalina",
    photo: "/assets/vente/aliou-cisse.jpg",
    youtube: ""
  },

  // La marque
  contexte: "Vitalina est une marque de compléments alimentaires active sur le marché sénégalais. Son produit principal, Vitalina Energy, est une gélule à base de spiruline. Présente sur Meta Ads depuis près d’un an, la marque stagnait autour de 2,7 millions de FCFA de chiffre d’affaires par mois. Son fondateur voulait passer un cap, et savait que cela passerait par de meilleures créatives et un vrai système autour.",
  contexteChiffres: [
    { valeur: "≈ 1 an", label: "de présence sur Meta Ads" },
    { valeur: "2.700.000 FCFA", label: "de chiffre d’affaires mensuel avant AdStack" },
    { valeur: "600.000 FCFA", label: "de budget publicitaire par mois avant AdStack" }
  ],

  // Le problème
  problemes: [
    "La production créative prenait trop de temps, en plus des commandes, des stocks, des livreurs et des assistants WhatsApp : il restait peu d’énergie pour créer de bonnes créatives.",
    "Les outils d’IA générative testés donnaient du contenu trop générique, avec un mauvais CPA sur Facebook.",
    "Les agences et freelances sans vraie expertise e-commerce produisaient du contenu pour faire du contenu, sans stratégie derrière.",
    "Les créatives marchaient 7 à 10 jours, puis les performances s’effondraient, sans nouvelles créatives pour prendre le relais.",
    "Même quand une créative fonctionnait, la marque ne savait pas comment exploiter l’angle gagnant : elle avançait au hasard."
  ],

  // La solution
  etapes: [
    { quand: "Étape 1", titre: "Onboarding et étude de marché", texte: "Le fondateur renseigne les informations de son produit dans AdBoard et lance ses demandes de production. De notre côté, nous analysons en profondeur le marché sénégalais." },
    { quand: "Étape 2", titre: "Premiers tests", texte: "Pendant 2 à 3 semaines, il reçoit de nouvelles créatives construites sur une vraie étude de marché et une logique de conversion. Les premières créatives et les premiers angles gagnants apparaissent." },
    { quand: "Étape 3", titre: "Les angles gagnants exploités", texte: "Après 4 semaines, nous savons ce qui fonctionne vraiment. Les lots suivants exploitent ces angles sur de nouveaux concepts créatifs." },
    { quand: "Étape 4", titre: "Montée en budget", texte: "Avec des créatives plus stables, la marque a pu presque doubler ses dépenses publicitaires et son chiffre d’affaires, sans casser sa rentabilité." }
  ],

  // Résultats
  resultatsIntro: "En 6 semaines, plusieurs angles gagnants identifiés et déployés sur de nouveaux concepts.",
  resultats: [
    { valeur: "3+", label: "angles marketing gagnants identifiés" },
    { valeur: "1.000 à 1.500 $", label: "dépensés par angle gagnant sur le mois, sans casser la rentabilité" },
    { valeur: "+10.000 $", label: "de chiffre d’affaires encaissé" }
  ],
  gagnantes: [],               // à remplir : { img, legende, metrique }

  // Créatives produites pour la marque
  galerie: [
    "/assets/vente/proc-step3-vitalina1.jpg",
    "/assets/vente/proc-step3-vitalina2.jpg"
  ],
  image: "/assets/vente/proc-step3-vitalina1.jpg"
};

(window.ETUDES_DE_CAS = window.ETUDES_DE_CAS || {}).vitalina = window.ETUDE_DE_CAS;
