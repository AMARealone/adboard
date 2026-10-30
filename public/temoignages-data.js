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
    lien: "/etude-de-cas/vitalina",
    grand: true
  },
  {
    texte: "Je pensais avoir saturé mon marché. Je n’arrivais plus à trouver de nouvelles idées créatives, et mes résultats baissaient de plus en plus : c’était inquiétant. En quelques semaines, AdStack a tout remis en place, avec une excellente diversité créative. Ça a redonné vie à ma marque.",
    nom: "Anissa Coli",
    role: "Owner de Saelia",
    photo: "/assets/vente/anissa-coli.jpg",
    mesure: "+10K$ d’adspend · ROAS 3,6",
    lien: "/etude-de-cas/saelia",
    grand: false
  },
  {
    texte: "Ça faisait plusieurs semaines que j’hésitais à lancer ma boutique dans la niche sportive : je ne savais pas par où commencer côté créatives. Dès les premières créatives reçues, elles étaient si bien pensées que j’ai su que j’avais fait le bon choix. Ma campagne a été rentable dès le départ, puis j’ai pu scaler et stabiliser en injectant régulièrement de nouvelles créatives stratégiques.",
    nom: "Ibrahim Gomis",
    role: "Owner de Veloce",
    photo: "/assets/vente/ibrahim-gomis.jpg",
    mesure: "0 → 5K$ de profit par mois en 90 jours",
    lien: "/etude-de-cas/veloce",
    grand: false
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
