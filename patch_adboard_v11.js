// patch_adboard_v11.js — TÉLÉCHARGEMENT DIRECT DANS ADBOARD (16 nov. 2026)
// 1. « Télécharger » enregistre le fichier directement (plus d'ouverture de lien dans le navigateur), nom lisible : PRODUIT_Angle_Lot_Image-n / Video
// 2. Plusieurs fichiers = plusieurs téléchargements l'un après l'autre, jamais de zip
// 3. Vidéos : plus de chargement en mémoire (échec sur mobile), téléchargement relayé par le serveur ; le lecteur ne précharge plus tout le fichier
// Usage : node patch_adboard_v11.js [chemin vers src/Platform.jsx]   (idempotent ; s'arrête sans rien écrire si une ancre manque)
const fs = require('fs'), path = require('path');
const cible = process.argv[2] || path.join(process.cwd(), 'src', 'Platform.jsx');
if (!fs.existsSync(cible)) { console.error('Fichier introuvable : ' + cible + '\nLance la commande depuis le dossier adboard, ou donne le chemin de Platform.jsx.'); process.exit(1); }
let s = fs.readFileSync(cible, 'utf8');
if (s.includes('v11-telechargement')) { console.log('Déjà appliqué.'); process.exit(0); }
const crlf = s.includes('\r\n'); if (crlf) s = s.replace(/\r\n/g, '\n');
const un = (old, label) => { const n = s.split(old).length - 1; if (n !== 1) { console.error('ANCRE ' + label + ' : ' + n + ' occurrence(s) au lieu de 1 — rien n\'a été modifié.'); process.exit(2); } };
const remplace = (old, nouveau, label) => { un(old, label); s = s.replace(old, () => nouveau); };

// 1. nom de fichier lisible
remplace("const nomFichierCreative = (c) => `${c.angle}-${c.week}.${estVideo(c) ? 'mp4' : 'jpg'}`.replace(/[^\\w.-]+/g,'_');",
`// v11-telechargement — nom lisible et reconnaissable : PRODUIT_Angle_LotN_Video.mp4 / PRODUIT_Angle_LotN_Image-2.jpg
const nettoyerNomFichier = (t) => String(t || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const nomFichierCreative = (c, nomProduit) => {
  const ext = estVideo(c) ? 'mp4' : 'jpg';
  const lot = nettoyerNomFichier(String(c.week || '').replace(/^[SB]/, ''));
  const m = String(c.id || '').match(/_(\\d+)$/);
  const parties = [
    nettoyerNomFichier(nomProduit).slice(0, 30) || 'Adstack',
    nettoyerNomFichier(String(c.angle || '').split('*')[0]).slice(0, 40) || 'Angle',
    lot ? 'Lot' + lot : '',
    estVideo(c) ? 'Video' : 'Image' + (m ? '-' + (Number(m[1]) + 1) : ''),
  ].filter(Boolean);
  return parties.join('_') + '.' + ext;
};`, 'nomFichierCreative');

// 2. téléchargement direct par le serveur (Content-Disposition: attachment)
const i0 = s.indexOf('async function downloadImageDirect(url, filename) {');
const i1 = s.indexOf('// Mobile : ouvre le menu de partage natif');
if (i0 < 0 || i1 < i0) { console.error('ANCRE downloadImageDirect introuvable — rien n\'a été modifié.'); process.exit(2); }
s = s.slice(0, i0) + `// v11-telechargement — le serveur relaie le fichier avec « Content-Disposition: attachment » et le nom demandé : le navigateur l'enregistre directement
// (ordinateur comme mobile), sans ouvrir de lien, sans charger la vidéo en mémoire, sans CORS.
function downloadImageDirect(url, filename) {
  const nom = filename || 'creative.jpg';
  const a = document.createElement('a');
  a.href = 'https://adstack-server.onrender.com/dl?u=' + encodeURIComponent(url) + '&n=' + encodeURIComponent(nom);
  a.download = nom; a.rel = 'noopener'; a.style.display = 'none';
  document.body.appendChild(a); a.click();
  setTimeout(() => { try { document.body.removeChild(a); } catch(e) {} }, 3000);
}

` + s.slice(i1);

// 3. mobile : jamais de blob pour une vidéo
remplace("async function shareOrDownloadImage(url, filename, isMobile) {\n  if (isMobile && navigator.share && navigator.canShare) {",
         "async function shareOrDownloadImage(url, filename, isMobile) {\n  if (isMobile && navigator.share && navigator.canShare && !/\\.mp4$/i.test(filename || '')) {   // v11 : une vidéo (12 à 40 Mo) ne passe jamais par la mémoire du téléphone", 'shareOrDownloadImage');
remplace("async function shareOrDownloadMultiple(items, isMobile, onProgress) {\n  if (isMobile && navigator.share && navigator.canShare) {",
         "async function shareOrDownloadMultiple(items, isMobile, onProgress, nomDe) {\n  const nomDuFichier = (it) => nomFichierCreative(it, nomDe ? nomDe(it) : undefined);\n  if (isMobile && navigator.share && navigator.canShare && !items.some(estVideo)) {   // v11 : partage groupé natif seulement pour des images ; sinon un téléchargement par fichier, jamais de zip", 'shareOrDownloadMultiple');
remplace("return new File([blob], nomFichierCreative(item), { type: blob.type || (estVideo(item) ? 'video/mp4' : 'image/jpeg') });", "return new File([blob], nomDuFichier(item), { type: blob.type || (estVideo(item) ? 'video/mp4' : 'image/jpeg') });", 'multi File');
remplace("await shareOrDownloadImage(urlFichierCreative(item), nomFichierCreative(item), isMobile);\n    fait += 1; if (onProgress) onProgress(fait, items.length);\n    await new Promise(r => setTimeout(r, 350));",
         "await shareOrDownloadImage(urlFichierCreative(item), nomDuFichier(item), isMobile);\n    fait += 1; if (onProgress) onProgress(fait, items.length);\n    await new Promise(r => setTimeout(r, 900));   // v11 : les navigateurs refusent des téléchargements trop rapprochés", 'multi boucle');

// 4. appels : nom du produit
remplace("await shareOrDownloadMultiple(items, isMobile, (fait, total) => setProgressionDl({ fait, total }));",
         "await shareOrDownloadMultiple(items, isMobile, (fait, total) => setProgressionDl({ fait, total }), (cr) => (products.find(p => p.id === cr.productId) || {}).nom);", 'appel multi');
remplace("shareOrDownloadImage(urlFichierCreative(selected), nomFichierCreative(selected), isMobile)",
         "shareOrDownloadImage(urlFichierCreative(selected), nomFichierCreative(selected, (products.find(p => p.id === selected.productId) || {}).nom), isMobile)", 'appel simple');

// 5. lecteur : ne précharge plus toute la vidéo
remplace('<video ref={ref} key={c.id} src={c.videoUrl} poster={affiche} playsInline preload="auto" loop', '<video ref={ref} key={c.id} src={c.videoUrl} poster={affiche} playsInline preload="metadata" loop', 'preload');

if (crlf) s = s.replace(/\n/g, '\r\n');
fs.writeFileSync(cible + '.avant_v11', fs.readFileSync(cible));
fs.writeFileSync(cible, s, 'utf8');
console.log('OK — Platform.jsx corrigé (sauvegarde : Platform.jsx.avant_v11).');
