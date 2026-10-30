/* TÉMOIGNAGES — section « Ce qu'ils en disent. » de la page de vente, juste avant les offres.
   RÈGLE : uniquement de vrais clients, avec leur accord. Rien d'inventé.
   Pour ajouter un avis : copier un bloc { ... } ci-dessous, le remplir, l'ajouter à la liste.
   Champs : texte (la citation, mot pour mot), nom, role, photo (chemin ou vide), mesure (un résultat prouvé, optionnel),
            lien (page détaillée, optionnel), audio (chemin d’une note vocale, optionnel), grand (true = carte large mise en avant). */
window.TEMOIGNAGES = [
  {
    texte: "Aujourd’hui, avec tout ce système créatif en place, mes campagnes sont beaucoup plus stables. J’ai de plus en plus de créatives gagnantes et je peux augmenter mon budget pub sans crainte. J’ai doublé mon chiffre d’affaires.",
    nom: "Aliou Cissé",
    role: "Fondateur de Vitalina",
    photo: "/assets/vente/aliou-cisse.jpg",
    mesure: "2,7 M → 6,15 M FCFA de CA par mois",
    audio: "/assets/vente/aliou-cisse-vocal.mp3",
    lien: "/etude-de-cas",
    grand: true
  }
  // MODÈLE à copier, coller après le dernier avis (avec une virgule avant) et remplir :
  /* ,{
    texte: "",
    nom: "",
    role: "",
    photo: "",
    mesure: "",
    lien: "",
    grand: false
  }  */
];
