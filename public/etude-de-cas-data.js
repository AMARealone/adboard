/* ÉTUDE DE CAS — toutes les données de la section (page de vente) et de la page /etude-de-cas.
   Règle : un champ vide = le bloc correspondant n'est pas affiché. Rien n'est inventé par le code.
   Quand les chiffres sont renseignés, passer "actif" à true : la section apparaît sur la page de vente. */
window.ETUDE_DE_CAS = {
  actif: false,

  marque: "Vitalina Energy",
  secteur: "Complément naturel · E-commerce",
  pays: "Sénégal",
  produit: "Spiruline séchée au soleil",
  prix: "14.900 FCFA",
  meta: "Créatives Meta Ads · E-commerce",
  lecture: "",                 // ex. "3 min de lecture"

  // Teaser sur la page de vente
  accroche: "",                // ex. « Plusieurs créatives gagnantes dès le premier mois »
  badge: "",                   // pastille jaune du teaser, ex. « 2 000 000 FCFA de pub investis »
  teaserTexte: "",             // une phrase sous le titre

  // Haut de la page
  titre: "",                   // citation du fondateur ou promesse du résultat
  chiffres: [],                // jusqu'à 3 : { valeur: "", label: "" }

  // Témoignage (écrit, avec photo et/ou vidéo YouTube si disponibles)
  temoignage: { texte: "", nom: "", role: "", photo: "", youtube: "" },

  // La marque
  contexte: "",                // 2-3 phrases : qui est la marque, ce qu'elle vend, où, sur quel budget
  contexteChiffres: [],        // { valeur, label } ex. budget pub mensuel avant

  // Le problème (liste)
  problemes: [],               // ex. ["Une seule créative qui tourne depuis des semaines", ...]

  // La solution : étapes du travail avec AdStack
  etapes: [
    { quand: "Étape 1", titre: "Étude de marché",       texte: "" },
    { quand: "Étape 2", titre: "Angles marketing",       texte: "" },
    { quand: "Étape 3", titre: "Production des lots",    texte: "" },
    { quand: "Étape 4", titre: "Amélioration continue",  texte: "" }
  ],

  // Résultats
  resultatsIntro: "",
  resultats: [],               // { valeur, label }
  gagnantes: [],               // { img, legende, metrique } créatives qui ont le mieux marché

  // Créatives produites pour la marque (images, déjà dans /assets/vente)
  galerie: [
    "/assets/vente/proc-step3-vitalina1.jpg",
    "/assets/vente/proc-step3-vitalina2.jpg"
  ],
  image: "/assets/vente/proc-step3-vitalina1.jpg"   // visuel principal du teaser
};
