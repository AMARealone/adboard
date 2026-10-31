/* DONNÉES DE LA PRÉSENTATION — remplacé avant chaque appel. Un champ vide = le bloc correspondant disparaît.
   Rien n'est affirmé sur le prospect sans qu'il l'ait dit : les freins viennent de ses propos, les titres décrivent des enjeux.
   profil : "test" | "perf" | "growth" | "scale" (choisit offre, étude de cas, freins et textes par défaut prudents).
   offre : optionnel, force TEST / PERF+ / GROWTH / SCALE.
   failles : jusqu'à 3 { type, citation?, signes?[], cause?, pourquoi?, solution?[] }  type : recherche, production, rythme, angles, gagnantes, temps, risque.
   alternatives : [{cle:"freelance"|"perso"|"copier"|"agence"|"relancer"|"multi"|"interne"} ou {nom,apporte,limite}] = ce que le prospect a essayé.
   apres : [{avant, apres}] = de son aujourd'hui à son objectif, avec ses mots.
   medias : remplace un visuel (ex. medias:{galerie:"/assets/mon-image.jpg"}). */
window.PRESENTATION = {
  profil: "",
  marque: "", prenom: "", produit: "", offre: "",
  ca: "", caValeur: null, depenses: "", objectif: "", objectifValeur: null, delai: "", element: "",
  citations: [], quotidien: [], cause: "", cout: "", reve: [], apres: [], alternatives: [],
  failles: [], raisons: [], etudeCas: "", medias: {}
};
