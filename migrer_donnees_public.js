// Migration complète des tables `public` — vide chaque table de l'ANCIEN projet puis y copie
// les vraies données du projet ACTIF. Ne touche PAS au schéma `auth` (comptes utilisateurs) —
// voir la discussion séparée à ce sujet, à faire AVANT ou APRÈS ce script mais pas à la place.
//
// Usage :
//   SUPABASE_URL_SOURCE=https://hgxcpkrqdahmxhmpouvm.supabase.co SUPABASE_KEY_SOURCE=... \
//   SUPABASE_URL_DEST=https://mifljhsusidgzelnswma.supabase.co SUPABASE_KEY_DEST=... \
//   node migrer_donnees_public.js

const SRC_URL = process.env.SUPABASE_URL_SOURCE;
const SRC_KEY = process.env.SUPABASE_KEY_SOURCE;
const DST_URL = process.env.SUPABASE_URL_DEST;
const DST_KEY = process.env.SUPABASE_KEY_DEST;

if (!SRC_URL || !SRC_KEY || !DST_URL || !DST_KEY) {
  console.error('❌ Les 4 variables (SOURCE et DEST) sont requises.');
  process.exit(1);
}

// Ordre important : les tables sans dépendances d'abord, celles qui référencent user_id
// après (mais comme auth.users n'est pas encore forcément aligné entre les 2 projets tant
// que tu n'as pas fait la migration auth séparément, les FK peuvent échouer temporairement —
// c'est attendu, voir le résumé à la fin qui liste les échecs).
const TABLES = [
  'templates', 'ct_library', 'products', 'prospects', 'demos',
  // demo_sessions volontairement exclue : état de session transitoire (progression en cours),
  // aucune valeur d'historique, et la table cause un timeout des deux côtés (probablement le
  // champ state jsonb, volumineux). Déjà vidée sur la destination — repart neuve, ce qui est
  // même préférable pour ce type de données.
  'chat_messages', 'data_insights', 'commandes', 'briefs', 'subscriptions',
  'transactions', 'pending_activations', 'user_events', 'api_usage_log',
  'clarity_snapshots', 'push_subscriptions', 'email_events', 'email_sequence_log',
  'funnel_events', 'notifications',
];

function headers(key) {
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

// Récupère tous les user_id valides du côté destination (via l'API Admin Auth — auth.users
// n'est pas exposée par l'API REST classique). Sert à filtrer les lignes orphelines (user_id
// qui ne correspond à aucun compte, même sur le projet source — vieux comptes déjà supprimés
// dont les données associées n'ont jamais été nettoyées) plutôt que de bloquer toute la table.
async function recupererUserIdsValides() {
  const valides = new Set();
  let page = 1;
  while (true) {
    const r = await fetch(`${DST_URL}/auth/v1/admin/users?page=${page}&per_page=1000`, { headers: headers(DST_KEY) });
    if (!r.ok) throw new Error(`Admin Auth API : HTTP ${r.status} — ${await r.text()}`);
    const data = await r.json();
    const users = data.users || [];
    users.forEach(u => valides.add(u.id));
    if (users.length < 1000) break;
    page++;
  }
  return valides;
}

async function viderTable(nom) {
  // Suppression par paquets plutôt qu'un DELETE unique sur toute la table — une table ayant
  // accumulé beaucoup de lignes (ex: demo_sessions après un mois d'usage) peut faire dépasser
  // le statement_timeout de Postgres avec un seul DELETE massif.
  while (true) {
    const rGet = await fetch(`${DST_URL}/rest/v1/${nom}?select=id&limit=500`, { headers: headers(DST_KEY) });
    if (!rGet.ok) return { ok: false, erreur: await rGet.text() };
    const lignes = await rGet.json();
    if (lignes.length === 0) return { ok: true };
    const filtre = lignes.map(l => `"${String(l.id).replace(/"/g, '\\"')}"`).join(',');
    const rDel = await fetch(`${DST_URL}/rest/v1/${nom}?id=in.(${filtre})`, {
      method: 'DELETE',
      headers: { ...headers(DST_KEY), Prefer: 'return=minimal' },
    });
    if (!rDel.ok) return { ok: false, erreur: await rDel.text() };
  }
}

// Tables dont l'id est une colonne d'identité stricte (GENERATED ALWAYS) — impossible d'y
// imposer une valeur explicite via l'API REST (PostgREST ne supporte pas OVERRIDING SYSTEM
// VALUE). Sans conséquence ici : aucune autre table ne référence ces id par clé étrangère,
// donc laisser Postgres générer de nouveaux id à l'insertion est parfaitement sûr.
const TABLES_ID_AUTO = new Set(['funnel_events']);

async function recupererTout(nom) {
  let tout = [];
  let offset = 0;
  const taille = 1000;
  while (true) {
    const r = await fetch(`${SRC_URL}/rest/v1/${nom}?select=*&order=id.asc`, {
      headers: { ...headers(SRC_KEY), Range: `${offset}-${offset + taille - 1}` },
    });
    if (!r.ok && r.status !== 206) throw new Error(`HTTP ${r.status} : ${await r.text()}`);
    const lignes = await r.json();
    tout = tout.concat(lignes);
    if (lignes.length < taille) break;
    offset += taille;
  }
  return tout;
}

async function inserer(nom, lignes) {
  if (lignes.length === 0) return { ok: true };
  // Par lots de 500 pour rester raisonnable niveau taille de requête.
  for (let i = 0; i < lignes.length; i += 500) {
    const lot = lignes.slice(i, i + 500);
    const r = await fetch(`${DST_URL}/rest/v1/${nom}`, {
      method: 'POST',
      headers: { ...headers(DST_KEY), Prefer: 'return=minimal' },
      body: JSON.stringify(lot),
    });
    if (!r.ok) return { ok: false, erreur: await r.text() };
  }
  return { ok: true };
}

async function main() {
  console.log('🚀 Migration en cours...\n');
  const resume = [];

  console.log('📡 Récupération des comptes valides côté destination...');
  const userIdsValides = await recupererUserIdsValides();
  console.log(`   ${userIdsValides.size} comptes trouvés.\n`);

  for (const table of TABLES) {
    process.stdout.write(`  ${table.padEnd(22)} — `);
    try {
      const videRes = await viderTable(table);
      if (!videRes.ok) { console.log(`⚠️ échec du vidage — ${videRes.erreur.slice(0, 200)}`); resume.push({ table, statut: 'échec vidage', detail: videRes.erreur.slice(0, 200) }); continue; }

      let lignes = await recupererTout(table);
      if (lignes.length === 0) { console.log('vide côté source, rien à faire'); resume.push({ table, statut: 'vide' }); continue; }

      if (TABLES_ID_AUTO.has(table)) {
        lignes = lignes.map(({ id, ...reste }) => reste);
      }

      // Filtre les lignes orphelines (user_id qui n'existe nulle part, même côté source).
      const nbAvant = lignes.length;
      lignes = lignes.filter(l => !('user_id' in l) || !l.user_id || userIdsValides.has(l.user_id));
      const nbOrphelines = nbAvant - lignes.length;

      const res = await inserer(table, lignes);
      if (res.ok) {
        const suffixe = nbOrphelines > 0 ? ` (${nbOrphelines} orpheline(s) ignorée(s))` : '';
        console.log(`✅ ${lignes.length} lignes migrées${suffixe}`);
        resume.push({ table, statut: 'ok', lignes: lignes.length, orphelines: nbOrphelines });
      } else {
        console.log(`❌ échec insertion — ${res.erreur.slice(0, 150)}`);
        resume.push({ table, statut: 'échec insertion', detail: res.erreur.slice(0, 200) });
      }
    } catch (e) {
      console.log(`❌ erreur — ${e.message}`);
      resume.push({ table, statut: 'erreur', detail: e.message });
    }
  }

  console.log('\n📊 Résumé :');
  resume.forEach(r => console.log(`  ${r.table.padEnd(22)} ${r.statut}${r.lignes ? ' (' + r.lignes + ' lignes)' : ''}`));

  const echecs = resume.filter(r => r.statut.includes('échec') || r.statut === 'erreur');
  if (echecs.length > 0) {
    console.log(`\n⚠️ ${echecs.length} table(s) en échec — le plus souvent une contrainte de clé étrangère`);
    console.log('   vers auth.users (user_id) tant que la migration des comptes n\'est pas faite.');
    console.log('   Relance ce script après avoir migré auth.users — il vide et recopie proprement.');
  }
}

main();
