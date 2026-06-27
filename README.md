# AdBoard · Déploiement sur adstackofficial.com

## Structure
```
adboard/
├── src/
│   ├── main.jsx       → Routing React Router
│   ├── Platform.jsx   → Plateforme client (/adboard)
│   └── Demo.jsx       → Page démo prospect (/demo/:slug)
├── index.html
├── vite.config.js
├── vercel.json
└── package.json
```

## Routes
| URL | Page |
|-----|------|
| `adstackofficial.com/adboard` | Plateforme client |
| `adstackofficial.com/demo/[slug]` | Démo prospect |

---

## Déploiement (15 minutes)

### Étape 1 — Préparer le repo GitHub

```bash
cd adboard
git init
git add .
git commit -m "init adboard"
git remote add origin https://github.com/AMARealone/adboard.git
git push -u origin main
```

### Étape 2 — Déployer sur Vercel

1. Va sur **vercel.com** → "Add New Project"
2. Importe le repo `adboard`
3. Framework : **Vite** (auto-détecté)
4. Build command : `npm run build`
5. Output dir : `dist`
6. Clique **Deploy**

### Étape 3 — Connecter adstackofficial.com

1. Dans Vercel → Settings → Domains
2. Ajoute : `adstackofficial.com`
3. Vercel te donne 2 records DNS à ajouter chez ton registrar :
   ```
   Type A     @     76.76.21.21
   Type CNAME www   cname.vercel-dns.com
   ```
4. Attends 5 min → en ligne ✓

---

## Supabase — Table demos

Créer cette table pour les pages démo :

```sql
CREATE TABLE demos (
  id          TEXT PRIMARY KEY,
  slug        TEXT UNIQUE,
  brand       TEXT NOT NULL,
  product     TEXT NOT NULL,
  html        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  expires_at  TIMESTAMPTZ DEFAULT (now() + interval '30 days'),
  viewed_at   TIMESTAMPTZ
);
```

### INSERT depuis le CRM (à chaque génération de démo)

```javascript
const { error } = await supabase
  .from('demos')
  .insert({
    id: 'qzkwou',
    slug: 'danic-services-support-refroidisseur-360-qzkwou',
    brand: 'Danic Services',
    product: 'Support Refroidisseur Rotatif 360°',
    html: htmlStringDeLaMindmap,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  })
```

## Config à remplacer dans Demo.jsx

```javascript
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'
// → ta clé publique Supabase (Settings → API → anon public)
```
