const fs = require('fs');
const path = require('path');

// ── Fix 1 : index.html ─────────────────────────────────────────────────────
const indexHtml = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AdStack · Adboard</title>
    <link rel="icon" href="/favicon.ico" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`;

fs.writeFileSync('index.html', indexHtml, 'utf8');
console.log('✅ index.html réécrit proprement');

// ── Fix 2 : Platform.jsx — suppression du style @import ───────────────────
const platformPath = path.join('src', 'Platform.jsx');
let c = fs.readFileSync(platformPath, 'utf8');

// Supprime le BOM si présent
c = c.replace(/^\uFEFF/, '');

// Supprime toute balise <style> contenant @import
c = c.replace(/<style[^>]*>[\s\S]*?@import[\s\S]*?<\/style>/g, '');

// Supprime aussi la variante JSX : <style>{`...@import...`}</style>
c = c.replace(/<style>\{`[\s\S]*?@import[\s\S]*?`\}<\/style>/g, '');

fs.writeFileSync(platformPath, c, 'utf8');
console.log('✅ Platform.jsx nettoyé (style @import supprimé)');

console.log('\nFix terminé. Lance maintenant :');
console.log('  git add .');
console.log('  git commit -m "fix index.html and remove style import"');
console.log('  git push');
