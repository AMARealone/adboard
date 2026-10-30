/* ÉTUDE DE CAS — Saelia (cosmétiques, RDC). Même structure que etude-de-cas-data.js.
   Règle : un champ vide = le bloc correspondant n'est pas affiché. Rien n'est inventé par le code.
   Les créatives réellement produites pour la marque se rangent dans "galerie" (et les plus performantes dans "gagnantes"). */
(window.ETUDES_DE_CAS = window.ETUDES_DE_CAS || {}).saelia = {
  actif: true,
  slug: "saelia",

  marque: "Saelia",
  secteur: "Cosmétiques",
  pays: "RDC",
  produit: "Sérum Anua Niacinamide 10% + TXA 4%, AXIS Y Sérum, Numbuzin Tampon Éclaircissant",
  meta: "Créatives Meta Ads · E-commerce",
  lecture: "5 min de lecture",

  // Teaser sur la page de vente
  accroche: "Trop de créatives top performer.",
  badge: "+10K$ d’adspend",
  teaserTexte: "Une boutique cosmétique qui croyait avoir saturé son marché.",
  teaserImages: ["/assets/vente/saelia-anua.jpg", "/assets/vente/saelia-numbuzin.jpg"],

  // Haut de la page
  titre: "« Nous avons dépensé +10K$ sur Meta Ads, en restant rentables, avec les créatives d’AdStack. »",
  chiffres: [
    { valeur: "+8", label: "créatives top performer" },
    { valeur: "10K$", label: "d’adspend sur nos créatives" },
    { valeur: "3,6", label: "ROAS" }
  ],

  // Témoignage (texte retravaillé pour la lecture : à faire valider par la fondatrice avant publication)
  temoignage: {
    texte: "Je pensais avoir saturé mon marché. Je n’arrivais plus à trouver de nouvelles idées créatives, et mes résultats baissaient de plus en plus : c’était inquiétant. En quelques semaines, AdStack a tout remis en place, avec une excellente diversité créative. Ça a redonné vie à ma marque.",
    nom: "Anissa Coli",
    role: "Owner de Saelia",
    photo: "/assets/vente/anissa-coli.jpg",
    youtube: ""
  },

  // La marque
  contexte: "Saelia est une boutique en ligne qui revend des marques de cosmétiques, comme le sérum Anua. Active sur Meta Ads depuis plus de deux ans en RDC, elle s’appuie sur une petite équipe de deux à trois personnes pour le media buying et les créatives. Avec environ 2 000 $ de budget publicitaire par mois, la marque pensait avoir saturé son marché : ses résultats baissaient, faute de nouvelles idées créatives.",
  contexteChiffres: [
    { valeur: "+2 ans", label: "de présence sur Meta Ads" },
    { valeur: "2 000 $", label: "de budget publicitaire par mois avant AdStack" },
    { valeur: "2 à 3", label: "personnes pour le media buying et les créatives" }
  ],
  produitsImgs: [
    { img: "/assets/vente/saelia-anua.jpg", legende: "Anua Niacinamide 10% + TXA 4%" },
    { img: "/assets/vente/saelia-axisy.jpg", legende: "AXIS Y Sérum" },
    { img: "/assets/vente/saelia-numbuzin.jpg", legende: "Numbuzin Tampon Éclaircissant" }
  ],

  // Le problème
  problemes: [
    "Pas de vraie équipe créative capable de gérer toute la chaîne : idées, construction des créatives et itérations. Tout se faisait un peu par hasard.",
    "Beaucoup de créatives se ressemblaient : sur les vidéos, seuls la musique de fond et les titres changeaient, jamais l’idée.",
    "L’équipe et les ressources étaient trop petites pour absorber un gros volume de créatives publicitaires.",
    "Les images publicitaires (static ads) n’étaient pas exploitées : la marque ne faisait que de la vidéo.",
    "Les tests se faisaient au hasard, sans règle claire pour lancer de nouvelles créatives."
  ],

  // La solution
  etapes: [
    { quand: "Onboarding", titre: "Les produits dans AdBoard", texte: "La fondatrice renseigne les informations sur ses produits et demande des productions pour deux ou trois d’entre eux. Elle reçoit rapidement ses premières créatives." },
    { quand: "Semaines 1 à 5", titre: "Tests et premiers gagnants", texte: "Pendant les premières semaines, elle teste les créatives. Vers la 4e et la 5e semaine, les premiers angles gagnants se dégagent." },
    { quand: "Semaines 7 à 8", titre: "Une réserve de créatives gagnantes", texte: "Au bout de deux mois, la marque dispose de nombreuses créatives et de nombreux angles marketing gagnants." },
    { quand: "Montée en budget", titre: "Des résultats stables", texte: "Avec d’excellents résultats, et surtout stables, la marque augmente son budget et dépense plus de 10 000 $ sur nos créatives en deux mois." }
  ],

  // Résultats
  resultatsIntro: "En deux mois, plus de 10 000 $ dépensés, avec une vraie diversité créative. Prochaine étape visée : l’international.",
  resultats: [
    { valeur: "+8", label: "créatives top performer" },
    { valeur: "+10.000 $", label: "dépensés sur nos créatives en deux mois" },
    { valeur: "3,6", label: "ROAS" }
  ],
  gagnantes: [],               // à remplir : { img, legende, metrique }

  // Créatives produites pour la marque (à remplir avec les vraies créatives)
  galerie: [],
  image: ""
};
