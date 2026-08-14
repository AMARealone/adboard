/**
 * Compresse toutes les images (jpg/jpeg/png) dans public/assets/vente/ (y compris le dossier
 * travaux/), EN PLACE — mêmes noms de fichiers, mêmes extensions. Zéro modification de
 * vente.html nécessaire après coup, contrairement au script précédent qui changeait les
 * extensions (source du bazar avec git la dernière fois).
 *
 * Prérequis (une seule fois) :
 *   npm install sharp --save-dev
 *
 * LANCEMENT (depuis la racine du repo adboard) :
 *   node compresser-images-vente.cjs
 *
 * Redimensionne uniquement les images plus larges que 1000px (jamais d'agrandissement), et
 * réencode en qualité 80 — visuellement quasi indiscernable de l'original, testé sur les
 * images déjà livrées dans cette conversation. N'écrase le fichier que si le résultat est
 * vraiment plus léger, jamais l'inverse.
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'public', 'assets', 'vente');
const MAX_WIDTH = 1000;
const JPEG_QUALITY = 80;
const PNG_QUALITY = 80;

function trouverImages(dir) {
  let resultats = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      resultats = resultats.concat(trouverImages(p));
    } else if (/\.(jpe?g|png)$/i.test(entry.name)) {
      resultats.push(p);
    }
  }
  return resultats;
}

async function compresserUne(filePath) {
  const avant = fs.statSync(filePath).size;
  const buffer = fs.readFileSync(filePath);
  const image = sharp(buffer);
  const meta = await image.metadata();

  let pipeline = image;
  if (meta.width && meta.width > MAX_WIDTH) {
    pipeline = pipeline.resize({ width: MAX_WIDTH });
  }

  const ext = path.extname(filePath).toLowerCase();
  let out;
  if (ext === '.png') {
    out = await pipeline.png({ quality: PNG_QUALITY, compressionLevel: 9, palette: true }).toBuffer();
  } else {
    out = await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
  }

  if (out.length < avant) {
    fs.writeFileSync(filePath, out);
    return { avant, apres: out.length };
  }
  return { avant, apres: avant };
}

async function main() {
  if (!fs.existsSync(DIR)) {
    console.error(`❌ Introuvable : ${DIR}`);
    process.exit(1);
  }
  const images = trouverImages(DIR);
  if (images.length === 0) {
    console.log('Aucune image trouvée dans public/assets/vente/.');
    return;
  }
  console.log(`→ ${images.length} image(s) trouvée(s) dans public/assets/vente/\n`);

  let totalAvant = 0, totalApres = 0, echecs = 0;
  for (const img of images) {
    try {
      const { avant, apres } = await compresserUne(img);
      totalAvant += avant;
      totalApres += apres;
      const pct = avant > 0 ? Math.round((1 - apres / avant) * 100) : 0;
      const icone = pct >= 1 ? '✅' : '➖';
      console.log(`${icone} ${path.relative(DIR, img)} : ${(avant / 1024).toFixed(0)}K → ${(apres / 1024).toFixed(0)}K (${pct >= 1 ? '-' + pct + '%' : 'déjà optimisée'})`);
    } catch (e) {
      echecs++;
      console.error(`❌ ${path.relative(DIR, img)} : ${e.message}`);
    }
  }

  console.log(`\nTotal : ${(totalAvant / 1024 / 1024).toFixed(2)} Mo → ${(totalApres / 1024 / 1024).toFixed(2)} Mo`);
  if (echecs > 0) console.log(`⚠️  ${echecs} échec(s) — fichiers laissés inchangés.`);
}

main();
