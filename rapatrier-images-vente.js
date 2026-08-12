/**
 * Rapatrie toutes les images encore hébergées sur le CDN Systeme.io (d1yei2z3i6k35z.cloudfront.net)
 * référencées dans public/vente.html, les télécharge dans public/assets/vente/, et réécrit le
 * fichier HTML pour qu'il pointe vers ces copies locales au lieu du CDN externe.
 *
 * Zéro dépendance — uniquement la bibliothèque standard Node.js.
 *
 * LANCEMENT (depuis la racine du repo adboard, une fois public/vente.html en place) :
 *   node rapatrier-images-vente.js
 *
 * Après exécution : vérifier le résultat, puis commit + push comme d'habitude.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const HTML_PATH = path.join(__dirname, 'public', 'vente.html');
const ASSETS_DIR = path.join(__dirname, 'public', 'assets', 'vente');
const CDN_HOST = 'd1yei2z3i6k35z.cloudfront.net';
const URL_REGEX = new RegExp(`https://${CDN_HOST}/[a-zA-Z0-9._~%\\-/]+`, 'g');

function telecharger(url, destPath) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} pour ${url}`));
        return;
      }
      const fileStream = fs.createWriteStream(destPath);
      res.pipe(fileStream);
      fileStream.on('finish', () => fileStream.close(resolve));
      fileStream.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  if (!fs.existsSync(HTML_PATH)) {
    console.error(`❌ Introuvable : ${HTML_PATH}`);
    console.error('   Place public/vente.html avant de lancer ce script.');
    process.exit(1);
  }
  fs.mkdirSync(ASSETS_DIR, { recursive: true });

  let html = fs.readFileSync(HTML_PATH, 'utf8');
  const urls = [...new Set(html.match(URL_REGEX) || [])];

  if (urls.length === 0) {
    console.log('✅ Aucune image du CDN Systeme.io trouvée — rien à faire (déjà fait, ou fichier différent).');
    return;
  }

  console.log(`→ ${urls.length} image(s) unique(s) à rapatrier depuis ${CDN_HOST}...\n`);

  let ok = 0, echecs = 0;
  for (const url of urls) {
    // Nom de fichier = dernier segment de l'URL (déjà unique côté Systeme.io, ex: 69a39967490e3_AVIS7.png)
    const filename = url.split('/').pop().split('?')[0];
    const destPath = path.join(ASSETS_DIR, filename);
    try {
      await telecharger(url, destPath);
      const localUrl = `/assets/vente/${filename}`;
      // Remplace TOUTES les occurrences de cette URL exacte dans le HTML par le chemin local
      html = html.split(url).join(localUrl);
      console.log(`✅ ${filename}`);
      ok++;
    } catch (e) {
      console.error(`❌ ${filename} — ${e.message}`);
      echecs++;
    }
  }

  fs.writeFileSync(HTML_PATH, html, 'utf8');
  console.log(`\n${ok} image(s) rapatriée(s), ${echecs} échec(s).`);
  console.log('public/vente.html réécrit avec les chemins locaux.');
  if (echecs > 0) {
    console.log('⚠️  Vérifie les échecs ci-dessus avant de déployer — ces images-là pointent encore vers Systeme.io.');
  }
}

main();
