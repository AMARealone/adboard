// AdStack Image Server — Zero dependencies, just Node.js built-ins
// SERVER_VERSION v5.72-analyste-budget (analyste : suivi du coût avec plafond 2 $, YouTube 10 vidéos/120 commentaires, Trends multi-termes avec requêtes en hausse, 3 recherches approfondies en parallèle) | v5.70-top-performer-chiffres (Top Performer sans délai de 7 jours, chiffres facultatifs, classement automatique par produit et cible) | v5.69-ct-niveau-conscience (choix de CT : niveau de conscience imposé, seuls les CT balisés à ce niveau sont candidats) | v5.68-balayage-probleme (analyste : recherche qui part du problème, ScrapeCreators Reddit/TikTok/pubs Meta, hypothèse stockée réutilisée 30 jours tant qu'il reste des angles en réserve) | v5.67-ct-video (route /name-ct-video : nom, méta-description et balises d'un CT vidéo) | v5.66-cible-souple (la personne des photos suit la CIBLE réelle du brief, jamais une règle pays → apparence ; remplacement seulement si la cible est certaine et la personne la contredit nettement) | v5.65-photos-au-lancement (les photos ne sont préparées qu'au lancement de la production, plus à la réception de la demande) | v5.64-apparence-doublons (apparence du marché déduite même pour un pays absent de la table ou Cameroun ; brief renvoyé plusieurs fois par le navigateur : doublons ignorés, enregistrement du seul brief reçu) | v5.63-modeles-verifies (créative image et copywriter sur Gemini 3.1 Pro ; sonde de TOUS les modèles au démarrage ; page GET /modeles qui affiche l'état réel de chaque tâche) | v5.62-aspects-ia (assemblage des aspects par Gemini 3 Pro Image puis contrôle, repli montage simple ; aspect kit/cadeaux ; sélecteur de CT informé des assets du client) | v5.61-photos-aspects (créative image : l'agent choisit les aspects du produit selon le CT, le code les assemble en UNE seule image (4 max) pour Gemini Image ; photos du produit : chaque aspect est analysé, nettoyé avec discernement ou gardé tel quel, la personne est remplacée si elle ne correspond pas au marché cible, tout est vérifié et mis en cache ; fin de la recherche de meilleure image et du choix dans le carrousel) | v5.60-multi-marche (marchés compatibles : le serveur garde la liste des marchés et les prix par pays, écarte un pays incompatible, analyste et créatives en mode multi-pays sans lieu ni prix ambigu ; captures d'avis transcrites) | v5.59-analyste-modeles (analyste : Gemini 3.1 Pro pour l'hypothese et la recherche Google Search, Gemini 3 Flash pour les controles, routeur avec repli automatique et sonde au demarrage) | v5.58-modeles (un modele Gemini par tache, reglable par variable d'environnement Render ; adaptateur de reflexion pour Gemini 3+ ; budget de sortie de l'analyste porte a 64000) | v5.57-avis-15 (15 avis dans la fiche, analyste : jusqu'à 100 cartes d'avis) | v5.56-navigateur (Chromium côté serveur : avis et contenus chargés en JavaScript, fiche auto + analyste) | v5.55-redirection-locale (v5.54-aspects-uniques) (remplissage auto : Shopify .js + politiques, garde-fous bilingues, aspects photo au lieu d'emballage) | v5.51-offres (grille 180/330/600k, garantie 45 jours) | v5.50-faits-client (documents integraux, DONNEES BRUTES garanties) | v5.49-fiche-auto (fetch-product-info : remplissage quasi complet de la fiche par Gemini — logo, couleurs, garantie, livraison, avis, cible, tri visuel des images ; webhook/brief : galerie + infos fiche produit v7.0)
const http = require('http');
const https = require('https');
const { Resvg } = require('@resvg/resvg-js');
const PDFDocument = require('pdfkit');
const webpush = require('web-push');
const crypto = require('crypto');
const zlib = require('zlib');
const path = require('path');
// ── v5.72 — Suivi du coût d'UNE production d'hypothèse (plafond 2 $). Estimation : tarifs réglables par variables Render. ──
const { AsyncLocalStorage } = require('async_hooks');
const _coutALS = new AsyncLocalStorage();
const COUT_MAX_HYPOTHESE = parseFloat(process.env.COUT_MAX_HYPOTHESE || '2');
const TARIFS = {
  pro_in:  parseFloat(process.env.TARIF_PRO_IN  || '2'),
  pro_out: parseFloat(process.env.TARIF_PRO_OUT || '12'),
  fl_in:   parseFloat(process.env.TARIF_FLASH_IN  || '0.5'),
  fl_out:  parseFloat(process.env.TARIF_FLASH_OUT || '3'),
  recherche: parseFloat(process.env.TARIF_RECHERCHE || '0.014')
};
const _COUTS_AGENTS = {};   // depuis le dernier démarrage du serveur
function agentDeAppel(t) {
  t = String(t || '');
  if (/^analyste/.test(t)) return 'Analyste de marché';
  if (/^copywriter/.test(t)) return 'Copywriter';
  if (/^creative_prod|^selection_ct|^aspects|^photo/.test(t)) return 'Creative Image';
  if (/video/i.test(t)) return 'Créative Vidéo';
  if (/^generation_image/.test(t)) return 'Creative Image';
  return 'Autres (fiche produit, démo, divers)';
}
function nouveauSuiviCout() { const st = { usd: 0, lignes: {}, max: COUT_MAX_HYPOTHESE }; _coutALS.enterWith(st); return st; }
function noterCout(modele, data, typeAppel) {
  if (!data) return;
  const st = _coutALS.getStore();
  const u = data.usageMetadata || {};
  const pro = /pro/i.test(String(modele));
  const tin = u.promptTokenCount || 0, tout = (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0);
  const q = ((data.candidates && data.candidates[0] && data.candidates[0].groundingMetadata && data.candidates[0].groundingMetadata.webSearchQueries) || []).length;
  const usd = (tin * (pro ? TARIFS.pro_in : TARIFS.fl_in) + tout * (pro ? TARIFS.pro_out : TARIFS.fl_out)) / 1e6 + q * TARIFS.recherche;
  const ag = agentDeAppel(typeAppel);
  const reg = _COUTS_AGENTS[ag] || (_COUTS_AGENTS[ag] = { appels: 0, usd: 0, tok_in: 0, tok_out: 0, recherches: 0, derniere_usd: 0, productions: 0 });
  reg.appels++; reg.usd += usd; reg.tok_in += tin; reg.tok_out += tout; reg.recherches += q;
  if (st) {
    st.usd += usd;
    const k = pro ? 'pro' : 'flash'; st.lignes[k] = (st.lignes[k] || 0) + usd;
    if (q) st.lignes.recherches = (st.lignes.recherches || 0) + q * TARIFS.recherche;
  }
}
const fs = require('fs');
const sharp = require('sharp');
// ── Diagnostic temporaire (bug miniatures, échec systématique "vipspng: libpng read error"
// malgré Node 24 LTS + cache de build vidé) — affiche au démarrage les versions natives
// réellement chargées par sharp, pour voir s'il y a un mismatch plutôt que de continuer à
// deviner. À retirer une fois le bug résolu.
try {
  console.log('[Sharp Diagnostic] Versions natives chargées :', JSON.stringify(sharp.versions));
  console.log('[Sharp Diagnostic] Plateforme :', process.platform, process.arch, '— Node', process.version);
} catch(eDiag) {
  console.error('[Sharp Diagnostic] Échec au chargement de sharp lui-même :', eDiag.message);
}

const PORT = 3001;
const PROJECT_ID = 'adstack-ecosystem-api';
const LOCATION = 'us-central1';
// ── MODÈLES GEMINI PAR TÂCHE ──────────────────────────────────────────────
// Chaque tâche a son modèle, réglable par variable d'environnement Render SANS
// redéploiement : il suffit d'ajouter la variable et de redémarrer le service.
// Raison d'être : les modèles Gemini sont retirés régulièrement (gemini-2.5-pro
// et gemini-2.5-flash ont une date de retrait annoncée). Garder les noms en dur
// dans le code obligeait à un redéploiement à chaque changement.
const MODELES = {
  analyste:     process.env.MODELE_ANALYSTE     || 'gemini-3.1-pro',     // hypothèse de marché (rédaction)
  creative:     process.env.MODELE_CREATIVE     || 'gemini-3.1-pro',     // prompt de créative image (choix des aspects, structure du CT)
  copywriter:   process.env.MODELE_COPYWRITER   || 'gemini-3.1-pro',     // ad copies
  raisonnement: process.env.MODELE_RAISONNEMENT || 'gemini-2.5-pro',     // défaut des tâches de raisonnement
  scraping:     process.env.MODELE_SCRAPING     || 'gemini-3.1-pro',     // recherche Google Search de l'analyste (données brutes)
  tendances:    process.env.MODELE_TENDANCES    || 'gemini-3-flash',     // analyste : classement de la catégorie pour Google Trends
  documents:    process.env.MODELE_DOCUMENTS    || 'gemini-3-flash',     // analyste : lecture des documents fournis par le client
  fiche:        process.env.MODELE_FICHE        || 'gemini-2.5-flash',   // remplisseur de fiche produit
  utilitaire:   process.env.MODELE_UTILITAIRE   || 'gemini-2.5-flash',   // petites tâches courtes
  demo:         process.env.MODELE_DEMO         || 'gemini-2.5-flash',   // stratège de démo
  chat:         process.env.MODELE_CHAT         || 'gemini-2.5-flash',   // Ava
  photos:       process.env.MODELE_PHOTOS       || 'gemini-3-flash',     // inspection et contrôle des photos du produit
  image:        process.env.MODELE_IMAGE        || 'gemini-3-pro-image'  // génération d'images
};

// Réglage de réflexion. On construit toujours le format historique (thinkingBudget) ;
// c'est le routeur de modèles (plus bas) qui l'adapte au modèle réellement appelé :
// il retire un budget 0 sur un modèle Pro (qui ne sait pas désactiver sa réflexion)
// et, si un modèle refuse le réglage, il refait l'appel sans réglage.
function reflexion(modele, budget) {
  if (budget === null || budget === undefined) return {};
  return { thinkingConfig: { thinkingBudget: budget } };
}

const MODEL = MODELES.image;
console.log('[modeles] ' + Object.entries(MODELES).map(([k, v]) => k + '=' + v).join(' | '));

// ── Clés Sources Analyste de Marché ──
const YOUTUBE_API_KEY = 'AIzaSyAhujEfLY6V4-IJkuy0BoHlldwEV0zyXFg';
// GOOGLE_CSE_KEY / GOOGLE_CSE_CX retirés — Custom Search JSON API fermée aux nouveaux projets (voir Source 5/5)

const PAYS_TO_GEO = {
  'Sénégal':'SN', "Côte d'Ivoire":'CI', 'Cameroun':'CM', 'Bénin':'BJ',
  'Guinée':'GN', 'Mali':'ML', 'Burkina Faso':'BF', 'Togo':'TG', 'RD Congo':'CD'
};

const PAYS_TO_JUMIA_TLD = {
  'Sénégal':'sn', "Côte d'Ivoire":'ci', 'Cameroun':'cm'
  // Bénin/Guinée/Mali/Burkina Faso/Togo/RD Congo : pas de Jumia → source ignorée
};

// ── Copywriting LIVE de la page de vente — évite exactement le genre de dérive déjà corrigée
// une fois côté prix (prompt statique qui se désynchronise du vrai contenu après une
// modification). Récupère et nettoie le texte réel de adstackofficial.com, mis en cache 15 min
// pour ne pas re-télécharger la page à chaque message envoyé au chatbot.
let _venteCopyCache = { texte: '', recuLe: 0 };
function _htmlVersTexte(html) {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&eacute;/g, 'é').replace(/&egrave;/g, 'è')
    .replace(/&agrave;/g, 'à').replace(/&ccedil;/g, 'ç').replace(/&ocirc;/g, 'ô').replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"').replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/\s+/g, ' ').trim();
}
async function getVenteCopyLive() {
  const QUINZE_MIN = 15 * 60 * 1000;
  if (_venteCopyCache.texte && (Date.now() - _venteCopyCache.recuLe) < QUINZE_MIN) return _venteCopyCache.texte;
  try {
    const r = await fetch('https://www.adstackofficial.com/', { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const html = await r.text();
    const texte = _htmlVersTexte(html).slice(0, 9000);
    _venteCopyCache = { texte, recuLe: Date.now() };
    return texte;
  } catch(e) {
    console.error('[getVenteCopyLive] échec fetch, on garde le cache existant (même périmé):', e.message);
    return _venteCopyCache.texte; // périmé mais mieux que rien — jamais planter le chat pour ça
  }
}

// ── Source UNIQUE des offres — miroir exact du tableau PLANS de Platform.jsx ──
// Créée pour corriger un bug réel : le prompt système d'Ava (endpoint /chat) citait des prix
// codés en dur qui avaient dérivé des vrais prix affichés/facturés dans AdBoard. Tout endpoint
// qui doit mentionner un prix ou un lien de paiement lit maintenant CET objet — jamais un chiffre
// recopié à la main. Si les prix changent un jour dans Platform.jsx, il faut répercuter ici aussi
// (pas encore automatisé d'un seul côté — Platform.jsx reste la source visuelle, celle-ci la
// source texte pour les chatbots) : à garder en tête, pas de mécanisme de sync auto pour l'instant.
// MAJ pricing (oct. 2026, grille 180 000 / 330 000 / 600 000 FCFA par mois, abonnement MENSUEL uniquement, garantie 45 jours) :
// tarifs en FCFA, volumes 24 / 48 / 96 créatives par MOIS (= 6 / 12 / 24 par semaine : 1 / 2 / 4 lots de 2 vidéos + 4 images),
// production en 24h max. Les identifiants internes (starter / pro / scale) restent ceux de la base et des webhooks ; seuls les noms
// affichés changent (PERF+ / GROWTH / SCALE). L'offre trimestrielle n'est plus vendue (ses produits restent reconnus dans PLAN_MAP pour
// les abonnés existants). Pack de 6 publicités à 50 000 FCFA pour ceux qui ne sont pas prêts pour un abonnement.
// Chariow gère la devise réelle au moment du checkout.
const PACK_PRIX_FCFA = 50000;
const OFFERS = {
  starter: {
    id: 'starter', name: 'PERF+',
    tagline: 'Automatiser la production de vos créatives, tout en améliorant vos performances publicitaires.',
    imagesPerWeek: 6, batchesPerWeek: 1, creativesPerMonth: 24, videosPerMonth: 8, imagesPerMonth: 16, produitsPerWeek: '1',
    garantie: 'Performance en 45 jours',
    // prixImg = prix moyen par créative (vidéos + images), arrondi
    monthly: { price: 180000, prixImg: 7500, delivery: '24h', checkout: 'https://shop.adstackofficial.com/prd_ljowq8/checkout' },
  },
  pro: {
    id: 'pro', name: 'GROWTH', best: true,
    tagline: 'Accélérer la production et la croissance de votre marque, sans la prise de tête de gérer une équipe.',
    imagesPerWeek: 12, batchesPerWeek: 2, creativesPerMonth: 48, videosPerMonth: 16, imagesPerMonth: 32, produitsPerWeek: "jusqu'à 2",
    garantie: 'Croissance en 45 jours',
    monthly: { price: 330000, prixImg: 6875, delivery: '24h', checkout: 'https://shop.adstackofficial.com/prd_34w031/checkout' },
  },
  scale: {
    id: 'scale', name: 'SCALE',
    tagline: 'Exploiter plusieurs marchés avec des langues et cultures différentes, sans exploser vos coûts ni augmenter la complexité.',
    imagesPerWeek: 24, batchesPerWeek: 4, creativesPerMonth: 96, videosPerMonth: 32, imagesPerMonth: 64, produitsPerWeek: "jusqu'à 4",
    garantie: 'Scaling en 45 jours',
    monthly: { price: 600000, prixImg: 6250, delivery: '24h', checkout: 'https://shop.adstackofficial.com/prd_9fi79y/checkout' },
  },
};

// Formatte le bloc offres pour un prompt système (utilisé par Ava ET le chatbot page de vente).
// Plus de conversion de devise ici : tarifs fixes en FCFA pour tout le monde, quelle que
// soit la localisation détectée (currency/currencyRate ne sont plus utilisés, gardés en
// paramètres pour ne pas casser les appelants existants le temps de les nettoyer).
function formatOffresPourPrompt(currency, currencyRate) {
  const fmt = (fcfa) => fcfa.toLocaleString('fr-FR') + ' FCFA';
  const { starter, pro, scale } = OFFERS;
  const ligne = (o) => `${o.name} : ${fmt(o.monthly.price)}/mois (abonnement mensuel, résiliable à tout moment) · ${o.creativesPerMonth} créatives/mois (${o.videosPerMonth} vidéos + ${o.imagesPerMonth} images, ${o.batchesPerWeek} ${o.batchesPerWeek > 1 ? 'lots' : 'lot'}/semaine) · ${o.produitsPerWeek} produit${o.produitsPerWeek === '1' ? '' : 's'} couvert${o.produitsPerWeek === '1' ? '' : 's'}/semaine · stratégie marketing (recherche marché, concurrents, cible), ad copies, apprentissage continu et accès à AdBoard inclus · production en ${o.monthly.delivery} max après demande · garantie ${o.garantie}`;
  // Offre de départ sans abonnement (affichée sous les 3 offres sur la page de vente) — ne jamais l'appeler « One Shot ».
  const depart = `Pack de 6 publicités (pour ceux qui ne sont pas prêts pour un abonnement) : ${fmt(PACK_PRIX_FCFA)}, une seule fois — 2 vidéos + 4 images optimisées conversion, reçues dans AdBoard. Si la personne s'abonne dans les 30 jours, ${fmt(PACK_PRIX_FCFA)} sont déduits de son 1er mois.`;
  return [ligne(starter), ligne(pro), ligne(scale), depart].join('\n');
}

// Domaines suggérés à Gemini grounding pour la recherche ciblée (V4 — 6 sources enrichies)
// Note : Gemini Search grounding est l'unique outil de recherche web (Custom Search est fermé).
// Pour atteindre la profondeur d'un vrai scraping multi-source, on demande EXPLICITEMENT
// à Gemini d'aller chercher dans ces sites lors de la Source 1.
const TARGET_DOMAINS_HINT = [
  // E-commerce avis riches en verbatims authentiques
  'aliexpress.com (reviews avec photos sur la catégorie du produit — verbatims clients authentiques)',
  'amazon.fr / amazon.com (reviews sur produits équivalents — analyses détaillées 1★ et 5★)',
  // Avis structurés
  'trustpilot.com (avis vérifiés sur la marque ET ses 3 principaux concurrents)',
  'google.com/maps (Google Reviews locales sur magasins/marques du pays cible)',
  // Conversations communautaires
  'reddit.com (sous-reddits pertinents : posts upvotés et commentaires riches)',
  'twitter.com / x.com (hashtags + mentions de la marque et catégorie produit)',
  // E-commerce local
  'jumia.com.gh, jumia.com.ng, jumia.ma (autres marchés Jumia pour comparaison prix)',
  // Forums santé/bien-être francophones
  'doctissimo.fr, aufeminin.com, futura-sciences.com (forums santé en français)',
  // Social
  'facebook.com (groupes locaux du pays cible si visibles)'
].join('\n   • ');

// ── Mindmap hosting ──
const PUBLIC_URL = process.env.PUBLIC_URL || 'https://www.adstackofficial.com';
const MINDMAPS_DIR = path.join(__dirname, 'mindmaps');
if (!fs.existsSync(MINDMAPS_DIR)) fs.mkdirSync(MINDMAPS_DIR, { recursive: true });

function slugify(s) {
  return String(s || 'mindmap')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'mindmap';
}

function randomId(len = 8) {
  return crypto.randomBytes(12).toString('base64')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()
    .slice(0, len);
}

// ── Gemini 2.5 Pro : génération du prompt creative pour le mode DÉMO ──
// (Le mode PRODUCTION utilise Gemini 2.5 Pro également, voir endpoint /creative-prod — Sonnet 4.6 n'est pas connecté actuellement)
async function callGeminiForCreativePrompt(token, systemPrompt, ctBase64, ctMime, productBase64, productMime, synthesis) {

  // Filtre la synthèse : ne garde que les sections utilisées par la compétence (S0, S1, S2, S5, S7).
  // Vague 5 : suppression du plafond de 20 lignes/section qui amputait le contenu même des sections gardées.
  function trimSynthesis(text) {
    if (!text || text.length < 800) return text;
    const keep = ['S0', 'S1', 'S2', 'S5', 'S7'];
    const lines = text.split('\n');
    let result = [];
    let capturing = false;
    for (const line of lines) {
      const sMatch = line.match(/^S(\d)\s*[—–-]/);
      if (sMatch) {
        const currentSection = 'S' + sMatch[1];
        capturing = keep.includes(currentSection);
      }
      if (capturing) {
        result.push(line);
      }
    }
    const trimmed = result.join('\n').trim();
    const ratio = Math.round((1 - trimmed.length / text.length) * 100);
    if (trimmed.length > 400) {
      console.log(`   [Creative Démo] Synthèse filtrée (S0/S1/S2/S5/S7) : ${text.length} → ${trimmed.length} chars (−${ratio}%)`);
      return trimmed;
    }
    return text;
  }

  const trimmedSynthesis = trimSynthesis(synthesis);

  // Vague 5 : vocabulaire "le CT" / "le PRODUIT FOURNI" — plus de IMAGE 1/IMAGE 2 (cause de confusion identifiée).
  // Les règles (hiérarchie produit, palette hard-lock, etc.) vivent désormais uniquement dans la compétence (systemPrompt) — plus de duplication ici.
  const userText = [
    'Les deux images ci-jointes, dans cet ordre : le CT (inspiration à décoder — structure et intention uniquement) puis le PRODUIT FOURNI (produit réel du client — vérité absolue du packaging).',
    '',
    'SYNTHÈSE MARCHÉ :',
    trimmedSynthesis
  ].join('\n');

  // Fixed header prepended to Gemini prompt
  const FIXED_HEADER = `⚠️ IMAGE FOURNIE — PRODUIT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Analyse l'image produit fournie frame par frame.
Reproduis avec une fidélité absolue : dimensions, proportions,
couleurs exactes, tons, textures, étiquette, reflets.
Rien n'est ajouté. Rien n'est modifié. Ce que tu vois = ce que tu génères.

`;

  const vertexBody = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: ctMime || 'image/jpeg', data: ctBase64 } },
        { inlineData: { mimeType: productMime || 'image/jpeg', data: productBase64 } },
        { text: userText }
      ]
    }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 10000,
      ...reflexion(MODELES.raisonnement, 24576)
    }
  };

  const data = await vertexRequest(token, MODELES.raisonnement, vertexBody);
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

  const cand = data.candidates?.[0];
  let text = cand?.content?.parts?.[0]?.text || '';
  if (!text) throw new Error('Pas de texte dans la réponse Gemini 2.5 Pro.');

  // Log diagnostic (même format que Vague 1 côté PROD) — visibilité sur le raisonnement réel de Gemini, absente jusqu'ici côté démo.
  const finishReason = cand?.finishReason || 'inconnu';
  const usage = data.usageMetadata || {};
  console.log(`   [Creative Démo] finishReason=${finishReason} · tokens prompt=${usage.promptTokenCount ?? '?'} thinking=${usage.thoughtsTokenCount ?? 0} output=${usage.candidatesTokenCount ?? '?'} total=${usage.totalTokenCount ?? '?'}`);
  if (finishReason === 'MAX_TOKENS') {
    console.log(`   ⚠️  [Creative Démo] Réponse tronquée par maxOutputTokens (10000) — le prompt final est probablement incomplet`);
  }

  // Extrait à partir de FORMAT: — retire toute analyse écrite avant (garde-fou de sécurité)
  const formatIdx = text.indexOf('FORMAT :');
  if (formatIdx > 0) {
    text = text.slice(formatIdx);
    console.log(`   [Creative Démo] Extraction depuis FORMAT: (retiré ${formatIdx} chars d'analyse résiduelle)`);
  }

  return FIXED_HEADER + text;
}

const SA = (() => {
  const raw = process.env.GOOGLE_CREDENTIALS;
  if (!raw) return { client_email: '', private_key: '' };
  try {
    const creds = JSON.parse(raw);
    if (creds.private_key) creds.private_key = creds.private_key.replace(/\\n/g, '\n');
    return creds;
  } catch(e) {
    console.error('[SA] Erreur GOOGLE_CREDENTIALS:', e.message);
    return { client_email: '', private_key: '' };
  }
})();


// ── JWT Generation ─────────────────────────────
function b64url(str) {
  return Buffer.from(str).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
}

function makeJWT() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    iss: SA.client_email, sub: SA.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/cloud-platform'
  }));
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  const sig = sign.sign(SA.private_key).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  return `${header}.${payload}.${sig}`;
}

// ── Get Access Token ───────────────────────────
function getToken() {
  return new Promise((resolve, reject) => {
    const jwt = makeJWT();
    const body = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`;
    const req = https.request({
      hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { const j = JSON.parse(d); j.access_token ? resolve(j.access_token) : reject(new Error(j.error_description || d)); }
        catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

// ── Vertex AI Global Request (gemini-3-pro-image) ──
function vertexRequestGlobal(token, model, body, timeoutMs = 120000, typeAppel = 'generation_image') {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const path = `/v1/projects/${PROJECT_ID}/locations/global/publishers/google/models/${model}:generateContent`;
    const req = https.request({
      hostname: 'aiplatform.googleapis.com', path, method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      },
      timeout: timeoutMs
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(d);
          // Une réponse d'erreur Vertex (429 "Resource exhausted", quota, etc.) arrive
          // avec un JSON valide — avant, ça résolvait comme un succès, donc le réessai
          // ne voyait JAMAIS passer ces erreurs (il n'attrape que les pannes réseau).
          // On rejette explicitement ici pour que le réessai puisse enfin les traiter.
          if (parsed?.error || res.statusCode >= 400) {
            const err = new Error(parsed?.error?.message || `Erreur Vertex AI (HTTP ${res.statusCode})`);
            err.statusCode = res.statusCode;
            err.isRateLimit = res.statusCode === 429 || /resource exhausted|quota/i.test(parsed?.error?.message || '');
            reject(err);
            return;
          }
          const usage = parsed?.usageMetadata || {};
          logCoutApi(categoriserAppel(typeAppel), typeAppel, usage);
          resolve(parsed);
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout Vertex AI Image (${timeoutMs/1000}s)`)); });
    req.write(bodyStr); req.end();
  });
}

// Réessaie automatiquement en cas d'échec — un seul réessai (comme avant), mais avec une
// courte attente d'abord si c'est une limite de débit (429), pour éviter de retomber
// instantanément dessus. Attente volontairement courte (8s, pas 15-30s comme un premier essai
// l'avait fait) : le total (tentative + attente + réessai) doit rester proche du fonctionnement
// d'avant (120s+120s max), sinon on risque de dépasser la limite de temps que Render impose à
// une requête HTTP — ce qui provoquait justement un "Failed to fetch" côté navigateur.
async function vertexRequestGlobalAvecReessai(token, model, body, timeoutMs = 120000, typeAppel = 'generation_image') {
  // Cause profonde corrigée (échec persistant sur des 429 malgré un "retry" déjà en place) :
  // seulement 2 tentatives au total (1 essai + 1 réessai après 8s fixe) — trop fragile pour une
  // erreur de limite de débit, qui a souvent besoin de plusieurs secondes de plus pour se libérer.
  // 4 tentatives maintenant, avec un recul exponentiel (8s/16s/32s) sur les erreurs de débit
  // spécifiquement — recommandation standard de Google pour ce type d'erreur précis.
  let derniereErreur;
  for (let tentative = 1; tentative <= 4; tentative++) {
    try {
      return await vertexRequestGlobal(token, model, body, timeoutMs, typeAppel);
    } catch(e) {
      derniereErreur = e;
      if (tentative < 4) {
        const attente = e.isRateLimit ? 8000 * Math.pow(2, tentative - 1) : 3000;
        console.log(`⚠️  Échec tentative ${tentative}/4 (${e.message})${e.isRateLimit ? ` — limite de débit détectée, attente ${attente/1000}s...` : ' — nouvel essai...'}`);
        await new Promise(r => setTimeout(r, attente));
      }
    }
  }
  throw derniereErreur;
}

// ── Vertex AI Request ──────────────────────────
// ── Suivi des coûts API (Phase 2 AdStats) ──────────────────────────
// Tarifs Gemini 2.5/3 Pro sur Vertex AI (contexte ≤200K) : $1.25/M tokens entrée, $10/M sortie texte.
// Les tokens de sortie IMAGE sont facturés à part, bien plus cher : $120/M (confirmé, pas une supposition).
const GEMINI_PRIX_IN        = 1.25 / 1_000_000;
const GEMINI_PRIX_OUT       = 10.00 / 1_000_000;
const GEMINI_PRIX_IMAGE_OUT = 120.0 / 1_000_000;

// Catégorise chaque appel pour le dashboard "Dépenses API" — Cause profonde corrigée : source
// était hardcodé à 'demo' pour TOUT appel, peu importe son origine réelle (test d'agent,
// production réelle, démo...). Chaque typeAppel est maintenant classé explicitement.
function categoriserAppel(typeAppel) {
  if (!typeAppel) return 'autre';
  if (typeAppel.endsWith('_test')) return 'agent_test';
  if (typeAppel.startsWith('demo') || typeAppel.endsWith('_demo')) return 'demo';
  if (typeAppel.endsWith('_prod')) return 'production';
  if (typeAppel === 'remplissage_message_demo') return 'demo';
  return 'autre';
}

function logCoutApi(source, typeAppel, usage) {
  // Jamais bloquant — une erreur ici ne doit jamais casser la génération en cours.
  // Gemini détaille les tokens de sortie par modalité (candidatesTokensDetails) et compte
  // séparément les tokens de "réflexion" (thoughtsTokenCount) — les deux sont réels et
  // facturés, mais absents du simple candidatesTokenCount si on ne creuse pas la réponse.
  try {
    const tokensIn = usage?.promptTokenCount || 0;
    const details = usage?.candidatesTokensDetails || [];
    const tokensImage = details.filter(d => d.modality === 'IMAGE').reduce((s,d) => s + (d.tokenCount||0), 0);
    const tokensTexteDetail = details.filter(d => d.modality !== 'IMAGE').reduce((s,d) => s + (d.tokenCount||0), 0);
    // Si l'API ne détaille pas par modalité (réponse texte simple, cas le plus courant),
    // se rabattre sur le total brut candidatesTokenCount.
    const tokensTexte = details.length ? tokensTexteDetail : (usage?.candidatesTokenCount || 0);
    const tokensReflexion = usage?.thoughtsTokenCount || 0;

    const cout = tokensIn * GEMINI_PRIX_IN
               + tokensImage * GEMINI_PRIX_IMAGE_OUT
               + tokensTexte * GEMINI_PRIX_OUT
               + tokensReflexion * GEMINI_PRIX_OUT;
    const tokensOutTotal = tokensImage + tokensTexte + tokensReflexion;

    fetch(`${SUPABASE_URL_INT}/rest/v1/api_usage_log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        source, type_appel: typeAppel,
        tokens_in: tokensIn, tokens_out: tokensOutTotal,
        cout_usd: Math.round(cout * 1e6) / 1e6,
      })
    }).catch(() => {});
  } catch(e) {}
}

function vertexRequestRegional(token, model, body, timeoutMs = 90000, typeAppel = 'texte_gemini') {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const path = `/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${model}:generateContent`;
    const req = https.request({
      hostname: `${LOCATION}-aiplatform.googleapis.com`, path, method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      },
      timeout: timeoutMs
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(d);
          // Une réponse d'erreur (429 "Resource exhausted", quota, etc.) arrive avec un JSON
          // valide — avant, ça résolvait comme un succès, laissant l'appelant gérer l'erreur
          // APRÈS coup sans jamais pouvoir réessayer. On rejette ici pour permettre un vrai
          // réessai automatique (voir vertexRequestAvecReessai).
          if (parsed?.error || res.statusCode >= 400) {
            const err = new Error(parsed?.error?.message || `Erreur Vertex AI (HTTP ${res.statusCode})`);
            err.statusCode = res.statusCode;
            err.isRateLimit = res.statusCode === 429 || /resource exhausted|quota/i.test(parsed?.error?.message || '');
            reject(err);
            return;
          }
          const usage = parsed?.usageMetadata || {};
          logCoutApi(categoriserAppel(typeAppel), typeAppel, usage);
          resolve(parsed);
        } catch(e) { reject(new Error('Réponse Vertex invalide: ' + d.slice(0,200))); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout Vertex AI (${timeoutMs/1000}s)`)); });
    req.write(bodyStr); req.end();
  });
}


// ── ROUTEUR DE MODÈLES TEXTE ───────────────────────────────────────────────
// Même principe que le labo vidéo : on appelle le meilleur modèle de la tâche, et s'il
// n'existe pas sur le projet ou refuse la requête, on passe automatiquement au suivant.
// Une tâche ne s'arrête jamais parce qu'un modèle est indisponible : la ligne [modeles]
// du journal Render dit lequel a réellement répondu.
// Les modèles de génération 3 et plus sont servis par l'endpoint global ; les 2.5 par
// l'endpoint régional (comme avant).
const REPLIS_MODELES = {
  'gemini-3.1-pro':  ['gemini-3.1-pro-preview', 'gemini-2.5-pro'],
  'gemini-3-flash':  ['gemini-3-flash-preview', 'gemini-2.5-flash'],
  'gemini-3.8-flash': ['gemini-3-flash', 'gemini-2.5-flash']
};
const _MODELES_INDISPO = new Map();   // modèle -> raison (indisponible pour toute la session)
const _MODELES_VUS = new Set();       // couples tâche|modèle déjà annoncés dans le journal
function generationModele(m) { const g = String(m || '').match(/^gemini-(\d+)/); return g ? parseInt(g[1], 10) : 0; }
function chaineModeles(modele) {
  const m = String(modele || '').trim();
  let repli = REPLIS_MODELES[m];
  if (!repli && generationModele(m) >= 3) repli = [/pro/i.test(m) ? 'gemini-2.5-pro' : 'gemini-2.5-flash'];
  return [m, ...(repli || [])];
}
const _modeleIndispo = e => e && (e.statusCode === 404 || e.statusCode === 403 || /not found|NOT_FOUND|does not exist|PERMISSION_DENIED|permission|unknown model|invalid model/i.test(String(e.message || '')));
function corpsPourModele(body, modele) {
  const tc = body && body.generationConfig && body.generationConfig.thinkingConfig;
  if (tc && generationModele(modele) >= 3 && tc.thinkingBudget === 0 && /pro/i.test(modele)) {
    const c = JSON.parse(JSON.stringify(body)); delete c.generationConfig.thinkingConfig; return c;
  }
  return body;
}
function appelUnModele(token, modele, body, timeoutMs, typeAppel) {
  return generationModele(modele) >= 3
    ? vertexRequestGlobal(token, modele, body, timeoutMs, typeAppel)
    : vertexRequestRegional(token, modele, body, timeoutMs, typeAppel);
}
async function vertexRequest(token, model, body, timeoutMs = 90000, typeAppel = 'texte_gemini') {
  const chaine = chaineModeles(model);
  let derniereErreur;
  for (let i = 0; i < chaine.length; i++) {
    const cand = chaine[i];
    const dernier = i === chaine.length - 1;
    if (_MODELES_INDISPO.has(cand) && !dernier) continue;
    let corps = corpsPourModele(body, cand);
    for (let essai = 0; essai < 2; essai++) {
      try {
        const data = await appelUnModele(token, cand, corps, timeoutMs, typeAppel);
        try { noterCout(cand, data, typeAppel); } catch (_) {}
        const cle = typeAppel + '|' + cand;
        if (!_MODELES_VUS.has(cle)) { _MODELES_VUS.add(cle); console.log('[modeles] ' + typeAppel + ' → ' + cand + (cand !== model ? ' (repli ; modèle demandé : ' + model + ')' : '')); }
        return data;
      } catch (e) {
        derniereErreur = e;
        if (e.isRateLimit || !e.statusCode) throw e;            // 429, réseau, délai : le réessai général s'en charge
        if (_modeleIndispo(e)) {
          _MODELES_INDISPO.set(cand, String(e.message).slice(0, 140));
          console.log('[modeles] ' + cand + ' indisponible sur ce projet (' + String(e.message).slice(0, 120) + ')' + (dernier ? '' : ' → modèle suivant.'));
          break;
        }
        if (e.statusCode === 400 && essai === 0 && corps.generationConfig && corps.generationConfig.thinkingConfig && generationModele(cand) >= 3) {
          console.log('[modeles] ' + cand + ' refuse le réglage de réflexion → nouvel essai sans réglage.');
          corps = JSON.parse(JSON.stringify(corps)); delete corps.generationConfig.thinkingConfig; continue;
        }
        if (e.statusCode === 400 && !dernier) { console.log('[modeles] ' + cand + ' a refusé la requête (' + String(e.message).slice(0, 120) + ') → modèle suivant.'); break; }
        throw e;
      }
    }
    if (dernier) throw derniereErreur;
  }
  throw derniereErreur;
}

// Sonde au démarrage : vérifie en une fois quels modèles répondent réellement sur ce projet
// et l'écrit dans le journal. Appels minuscules (quelques tokens) ; ne bloque jamais le démarrage.
const _SONDE = {};   // modèle -> 'OK' | 'INDISPONIBLE (...)' | 'non vérifié (...)'
async function sonderModeles() {
  try {
    const token = await getToken();
    const candidats = new Set();
    for (const cle of Object.keys(MODELES)) for (const m of chaineModeles(MODELES[cle])) candidats.add(m);
    const lignes = [];
    for (const m of candidats) {
      try {
        await appelUnModele(token, m, { contents: [{ role: 'user', parts: [{ text: 'ok' }] }], generationConfig: { maxOutputTokens: 16 } }, 30000, 'sonde_modele');
        _SONDE[m] = 'OK'; lignes.push(m + ' : OK');
      } catch (e) {
        if (_modeleIndispo(e)) { _MODELES_INDISPO.set(m, String(e.message).slice(0, 140)); _SONDE[m] = 'INDISPONIBLE (' + String(e.message).slice(0, 80) + ')'; lignes.push(m + ' : ' + _SONDE[m]); }
        else { _SONDE[m] = 'non vérifié (' + String(e.message).slice(0, 80) + ')'; lignes.push(m + ' : ' + _SONDE[m]); }
      }
    }
    console.log('[modeles] sonde : ' + lignes.join(' | '));
  } catch (e) { console.log('[modeles] sonde impossible : ' + e.message); }
}
// Pour chaque tâche : le modèle demandé, la chaîne de repli, et celui qui servira réellement d'après la sonde.
function etatModeles() {
  const taches = {};
  for (const cle of Object.keys(MODELES)) {
    const chaine = chaineModeles(MODELES[cle]);
    const reel = chaine.find(m => !_MODELES_INDISPO.has(m)) || null;
    taches[cle] = { demande: MODELES[cle], sert_reellement: reel, repli_actif: !!reel && reel !== MODELES[cle], etat: chaine.map(m => m + ' : ' + (_SONDE[m] || 'pas encore sondé')) };
  }
  return { sonde_terminee: Object.keys(_SONDE).length > 0, taches };
}

// Réessaie automatiquement en cas d'échec — le générateur démo doit TOUJOURS terminer sa
// tâche plutôt que d'abandonner sur un premier incident ponctuel (timeout réseau, limite de
// débit passagère). 1 réessai immédiat pour une panne réseau/timeout ; pour une limite de
// débit (429), courte attente (8s) avant de réessayer pour ne pas retomber instantanément dessus.
async function vertexRequestAvecReessai(token, model, body, timeoutMs = 90000, typeAppel = 'texte_gemini') {
  // Même correctif que vertexRequestGlobalAvecReessai — 2 tentatives fixes était trop fragile
  // pour une erreur de limite de débit.
  let derniereErreur;
  for (let tentative = 1; tentative <= 4; tentative++) {
    try {
      return await vertexRequest(token, model, body, timeoutMs, typeAppel);
    } catch(e) {
      derniereErreur = e;
      if (tentative < 4) {
        const attente = e.isRateLimit ? 8000 * Math.pow(2, tentative - 1) : 3000;
        console.log(`⚠️  Échec tentative ${tentative}/4 (${e.message})${e.isRateLimit ? ` — limite de débit détectée, attente ${attente/1000}s...` : ' — nouvel essai...'}`);
        await new Promise(r => setTimeout(r, attente));
      }
    }
  }
  throw derniereErreur;
}

// ── HTML (inline fallback) ─────────────────────
const HTML_B64 = 'PCFET0NUWVBFIGh0bWw+CjxodG1sIGxhbmc9ImZyIj4KPGhlYWQ+CjxtZXRhIGNoYXJzZXQ9IlVURi04Ij4KPG1ldGEgbmFtZT0idmlld3BvcnQiIGNvbnRlbnQ9IndpZHRoPWRldmljZS13aWR0aCwgaW5pdGlhbC1zY2FsZT0xLjAiPgo8dGl0bGU+QWRTdGFjayDigJQgSW1hZ2UgR2VuZXJhdG9yPC90aXRsZT4KPGxpbmsgaHJlZj0iaHR0cHM6Ly9mb250cy5nb29nbGVhcGlzLmNvbS9jc3MyP2ZhbWlseT1TeW5lOndnaHRANDAwOzUwMDs2MDA7NzAwOzgwMCZmYW1pbHk9RE0rTW9ubzp3Z2h0QDQwMDs1MDAmZGlzcGxheT1zd2FwIiByZWw9InN0eWxlc2hlZXQiPgo8c3R5bGU+CiAgOnJvb3QgewogICAgLS1iZzogIzBBMEEwQjsKICAgIC0tc3VyZmFjZTogIzExMTExMzsKICAgIC0tc3VyZmFjZTI6ICMxODE4MUM7CiAgICAtLWJvcmRlcjogIzIyMjIyODsKICAgIC0tYm9yZGVyMjogIzJFMkUzODsKICAgIC0tYWNjZW50OiAjMUZCNkZGOwogICAgLS1hY2NlbnQyOiAjMzJGRjdFOwogICAgLS1hY2NlbnQzOiAjRkY2QjM1OwogICAgLS1hY2NlbnQ0OiAjQjQ0RkZGOwogICAgLS10ZXh0OiAjRjBGMEY1OwogICAgLS10ZXh0MjogIzg4ODhBMDsKICAgIC0tdGV4dDM6ICM0QTRBNjA7CiAgICAtLWNhcmQ6ICMxMzEzMUE7CiAgfQogICogeyBtYXJnaW46IDA7IHBhZGRpbmc6IDA7IGJveC1zaXppbmc6IGJvcmRlci1ib3g7IH0KICBib2R5IHsKICAgIGJhY2tncm91bmQ6IHZhcigtLWJnKTsKICAgIGNvbG9yOiB2YXIoLS10ZXh0KTsKICAgIGZvbnQtZmFtaWx5OiAnU3luZScsIHNhbnMtc2VyaWY7CiAgICBtaW4taGVpZ2h0OiAxMDB2aDsKICB9CiAgYm9keTo6YmVmb3JlIHsKICAgIGNvbnRlbnQ6ICcnOwogICAgcG9zaXRpb246IGZpeGVkOwogICAgaW5zZXQ6IDA7CiAgICBiYWNrZ3JvdW5kLWltYWdlOgogICAgICBsaW5lYXItZ3JhZGllbnQocmdiYSgxODAsNzksMjU1LDAuMDI1KSAxcHgsIHRyYW5zcGFyZW50IDFweCksCiAgICAgIGxpbmVhci1ncmFkaWVudCg5MGRlZywgcmdiYSgxODAsNzksMjU1LDAuMDI1KSAxcHgsIHRyYW5zcGFyZW50IDFweCk7CiAgICBiYWNrZ3JvdW5kLXNpemU6IDQwcHggNDBweDsKICAgIHBvaW50ZXItZXZlbnRzOiBub25lOwogICAgei1pbmRleDogMDsKICB9CiAgLndyYXAgeyBtYXgtd2lkdGg6IDk2MHB4OyBtYXJnaW46IDAgYXV0bzsgcGFkZGluZzogNDBweCAyNHB4IDgwcHg7IHBvc2l0aW9uOiByZWxhdGl2ZTsgei1pbmRleDogMTsgfQoKICAvKiBIRUFERVIgKi8KICBoZWFkZXIgeyBkaXNwbGF5OiBmbGV4OyBhbGlnbi1pdGVtczogY2VudGVyOyBnYXA6IDE2cHg7IG1hcmdpbi1ib3R0b206IDQ4cHg7IHBhZGRpbmctYm90dG9tOiAyNHB4OyBib3JkZXItYm90dG9tOiAxcHggc29saWQgdmFyKC0tYm9yZGVyKTsgfQogIC5sb2dvLW1hcmsgeyB3aWR0aDogNDBweDsgaGVpZ2h0OiA0MHB4OyBiYWNrZ3JvdW5kOiB2YXIoLS1hY2NlbnQ0KTsgYm9yZGVyLXJhZGl1czogMTBweDsgZGlzcGxheTogZmxleDsgYWxpZ24taXRlbXM6IGNlbnRlcjsganVzdGlmeS1jb250ZW50OiBjZW50ZXI7IGZvbnQtc2l6ZTogMThweDsgZm9udC13ZWlnaHQ6IDgwMDsgY29sb3I6ICNmZmY7IGZsZXgtc2hyaW5rOiAwOyB9CiAgLmhlYWRlci10ZXh0IGgxIHsgZm9udC1zaXplOiAyMHB4OyBmb250LXdlaWdodDogNzAwOyBsZXR0ZXItc3BhY2luZzogLTAuNXB4OyB9CiAgLmhlYWRlci10ZXh0IHAgeyBmb250LXNpemU6IDEycHg7IGNvbG9yOiB2YXIoLS10ZXh0Mik7IGZvbnQtZmFtaWx5OiAnRE0gTW9ubycsIG1vbm9zcGFjZTsgbWFyZ2luLXRvcDogMnB4OyB9CiAgLmJhZGdlIHsgbWFyZ2luLWxlZnQ6IGF1dG87IGJhY2tncm91bmQ6IHJnYmEoMTgwLDc5LDI1NSwwLjEpOyBib3JkZXI6IDFweCBzb2xpZCByZ2JhKDE4MCw3OSwyNTUsMC4yNSk7IGNvbG9yOiB2YXIoLS1hY2NlbnQ0KTsgZm9udC1mYW1pbHk6ICdETSBNb25vJywgbW9ub3NwYWNlOyBmb250LXNpemU6IDExcHg7IHBhZGRpbmc6IDRweCAxMHB4OyBib3JkZXItcmFkaXVzOiAyMHB4OyB9CgoKCiAgLyogU0VDVElPTiBMQUJFTCAqLwogIC5zZWN0aW9uLWxhYmVsIHsgZm9udC1mYW1pbHk6ICdETSBNb25vJywgbW9ub3NwYWNlOyBmb250LXNpemU6IDExcHg7IGNvbG9yOiB2YXIoLS1hY2NlbnQ0KTsgbGV0dGVyLXNwYWNpbmc6IDJweDsgdGV4dC10cmFuc2Zvcm06IHVwcGVyY2FzZTsgbWFyZ2luLWJvdHRvbTogMTJweDsgZGlzcGxheTogZmxleDsgYWxpZ24taXRlbXM6IGNlbnRlcjsgZ2FwOiA4cHg7IH0KICAuc2VjdGlvbi1sYWJlbDo6YWZ0ZXIgeyBjb250ZW50OiAnJzsgZmxleDogMTsgaGVpZ2h0OiAxcHg7IGJhY2tncm91bmQ6IHZhcigtLWJvcmRlcik7IH0KCiAgLyogVVBMT0FEIEdSSUQgKi8KICAudXBsb2FkLWdyaWQgeyBkaXNwbGF5OiBncmlkOyBncmlkLXRlbXBsYXRlLWNvbHVtbnM6IDFmciAxZnI7IGdhcDogMTZweDsgbWFyZ2luLWJvdHRvbTogMTZweDsgfQogIC51cGxvYWQtY2FyZCB7IGJhY2tncm91bmQ6IHZhcigtLXN1cmZhY2UpOyBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1ib3JkZXIpOyBib3JkZXItcmFkaXVzOiAxNHB4OyBvdmVyZmxvdzogaGlkZGVuOyB0cmFuc2l0aW9uOiBib3JkZXItY29sb3IgMC4yczsgfQogIC51cGxvYWQtY2FyZDpob3ZlciB7IGJvcmRlci1jb2xvcjogdmFyKC0tYm9yZGVyMik7IH0KICAudXBsb2FkLWNhcmQtaGVhZGVyIHsgcGFkZGluZzogMTJweCAxNnB4OyBib3JkZXItYm90dG9tOiAxcHggc29saWQgdmFyKC0tYm9yZGVyKTsgZm9udC1mYW1pbHk6ICdETSBNb25vJywgbW9ub3NwYWNlOyBmb250LXNpemU6IDExcHg7IGNvbG9yOiB2YXIoLS10ZXh0Mik7IGRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IGdhcDogOHB4OyB9CiAgLmRvdCB7IHdpZHRoOiA2cHg7IGhlaWdodDogNnB4OyBib3JkZXItcmFkaXVzOiA1MCU7IGZsZXgtc2hyaW5rOiAwOyB9CiAgLmRvdC5ibHVlIHsgYmFja2dyb3VuZDogdmFyKC0tYWNjZW50KTsgfQogIC5kb3QucHVycGxlIHsgYmFja2dyb3VuZDogdmFyKC0tYWNjZW50NCk7IH0KICAuZG90LmdyZWVuIHsgYmFja2dyb3VuZDogdmFyKC0tYWNjZW50Mik7IH0KCiAgLyogVVBMT0FEIFpPTkUgKi8KICAudXBsb2FkLXpvbmUgeyBwb3NpdGlvbjogcmVsYXRpdmU7IG1pbi1oZWlnaHQ6IDE4MHB4OyBkaXNwbGF5OiBmbGV4OyBmbGV4LWRpcmVjdGlvbjogY29sdW1uOyBhbGlnbi1pdGVtczogY2VudGVyOyBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjsgY3Vyc29yOiBwb2ludGVyOyBwYWRkaW5nOiAyMHB4OyBnYXA6IDEwcHg7IHRyYW5zaXRpb246IGJhY2tncm91bmQgMC4yczsgfQogIC51cGxvYWQtem9uZTpob3ZlciB7IGJhY2tncm91bmQ6IHJnYmEoMTgwLDc5LDI1NSwwLjAzKTsgfQogIC51cGxvYWQtem9uZS5oYXMtaW1hZ2UgeyBwYWRkaW5nOiA4cHg7IH0KICAudXBsb2FkLWljb24geyB3aWR0aDogNDBweDsgaGVpZ2h0OiA0MHB4OyBib3JkZXI6IDEuNXB4IGRhc2hlZCB2YXIoLS1ib3JkZXIyKTsgYm9yZGVyLXJhZGl1czogMTBweDsgZGlzcGxheTogZmxleDsgYWxpZ24taXRlbXM6IGNlbnRlcjsganVzdGlmeS1jb250ZW50OiBjZW50ZXI7IGNvbG9yOiB2YXIoLS10ZXh0Myk7IGZvbnQtc2l6ZTogMThweDsgdHJhbnNpdGlvbjogYWxsIDAuMnM7IH0KICAudXBsb2FkLXpvbmU6aG92ZXIgLnVwbG9hZC1pY29uIHsgYm9yZGVyLWNvbG9yOiB2YXIoLS1hY2NlbnQ0KTsgY29sb3I6IHZhcigtLWFjY2VudDQpOyB9CiAgLnVwbG9hZC16b25lIHAgeyBmb250LXNpemU6IDEycHg7IGNvbG9yOiB2YXIoLS10ZXh0Mik7IHRleHQtYWxpZ246IGNlbnRlcjsgbGluZS1oZWlnaHQ6IDEuNTsgfQogIC51cGxvYWQtem9uZSBzcGFuIHsgZm9udC1zaXplOiAxMXB4OyBjb2xvcjogdmFyKC0tdGV4dDMpOyBmb250LWZhbWlseTogJ0RNIE1vbm8nLCBtb25vc3BhY2U7IH0KICAucHJldmlldy1pbWcgeyB3aWR0aDogMTAwJTsgaGVpZ2h0OiAxNjRweDsgb2JqZWN0LWZpdDogY29udGFpbjsgYm9yZGVyLXJhZGl1czogOHB4OyBkaXNwbGF5OiBub25lOyBiYWNrZ3JvdW5kOiB2YXIoLS1zdXJmYWNlMik7IH0KICAuY2xlYXItYnRuIHsgZGlzcGxheTogbm9uZTsgcG9zaXRpb246IGFic29sdXRlOyB0b3A6IDhweDsgcmlnaHQ6IDhweDsgd2lkdGg6IDI0cHg7IGhlaWdodDogMjRweDsgYm9yZGVyLXJhZGl1czogNTAlOyBiYWNrZ3JvdW5kOiByZ2JhKDEwLDEwLDExLDAuOCk7IGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWJvcmRlcjIpOyBjb2xvcjogdmFyKC0tdGV4dDIpOyBmb250LXNpemU6IDEycHg7IGN1cnNvcjogcG9pbnRlcjsgYWxpZ24taXRlbXM6IGNlbnRlcjsganVzdGlmeS1jb250ZW50OiBjZW50ZXI7IHotaW5kZXg6IDEwOyB0cmFuc2l0aW9uOiBhbGwgMC4xNXM7IGJhY2tkcm9wLWZpbHRlcjogYmx1cig0cHgpOyB9CiAgLmNsZWFyLWJ0bjpob3ZlciB7IGJhY2tncm91bmQ6IHJnYmEoMjU1LDEwNyw1MywwLjkpOyBib3JkZXItY29sb3I6IHZhcigtLWFjY2VudDMpOyBjb2xvcjogI2ZmZjsgfQogIGlucHV0W3R5cGU9ImZpbGUiXSB7IGRpc3BsYXk6IG5vbmU7IH0KCiAgLyogUFJPTVBUIENBUkQgKi8KICAucHJvbXB0LWNhcmQgeyBiYWNrZ3JvdW5kOiB2YXIoLS1zdXJmYWNlKTsgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tYm9yZGVyKTsgYm9yZGVyLXJhZGl1czogMTRweDsgb3ZlcmZsb3c6IGhpZGRlbjsgbWFyZ2luLWJvdHRvbTogMTZweDsgfQogIC5wcm9tcHQtY2FyZC1oZWFkZXIgeyBwYWRkaW5nOiAxMnB4IDE2cHg7IGJvcmRlci1ib3R0b206IDFweCBzb2xpZCB2YXIoLS1ib3JkZXIpOyBmb250LWZhbWlseTogJ0RNIE1vbm8nLCBtb25vc3BhY2U7IGZvbnQtc2l6ZTogMTFweDsgY29sb3I6IHZhcigtLXRleHQyKTsgZGlzcGxheTogZmxleDsgYWxpZ24taXRlbXM6IGNlbnRlcjsgZ2FwOiA4cHg7IGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjsgfQogIC5wYXN0ZS1oaW50IHsgZm9udC1zaXplOiAxMHB4OyBjb2xvcjogdmFyKC0tdGV4dDMpOyB9CiAgdGV4dGFyZWEucHJvbXB0LWlucHV0IHsgd2lkdGg6IDEwMCU7IG1pbi1oZWlnaHQ6IDIwMHB4OyBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDsgYm9yZGVyOiBub25lOyBvdXRsaW5lOiBub25lOyBwYWRkaW5nOiAxNnB4OyBjb2xvcjogdmFyKC0tdGV4dCk7IGZvbnQtZmFtaWx5OiAnRE0gTW9ubycsIG1vbm9zcGFjZTsgZm9udC1zaXplOiAxMnB4OyBsaW5lLWhlaWdodDogMS43OyByZXNpemU6IHZlcnRpY2FsOyB9CiAgdGV4dGFyZWEucHJvbXB0LWlucHV0OjpwbGFjZWhvbGRlciB7IGNvbG9yOiB2YXIoLS10ZXh0Myk7IH0KCiAgLyogR0VORVJBVEUgQlROICovCiAgLmdlbmVyYXRlLWJ0biB7IHdpZHRoOiAxMDAlOyBoZWlnaHQ6IDUycHg7IGJhY2tncm91bmQ6IHZhcigtLWFjY2VudDQpOyBib3JkZXI6IG5vbmU7IGJvcmRlci1yYWRpdXM6IDEycHg7IGNvbG9yOiAjZmZmOyBmb250LWZhbWlseTogJ1N5bmUnLCBzYW5zLXNlcmlmOyBmb250LXNpemU6IDE1cHg7IGZvbnQtd2VpZ2h0OiA3MDA7IGN1cnNvcjogcG9pbnRlcjsgZGlzcGxheTogZmxleDsgYWxpZ24taXRlbXM6IGNlbnRlcjsganVzdGlmeS1jb250ZW50OiBjZW50ZXI7IGdhcDogMTBweDsgdHJhbnNpdGlvbjogYWxsIDAuMnM7IG1hcmdpbi1ib3R0b206IDMycHg7IH0KICAuZ2VuZXJhdGUtYnRuOmhvdmVyOm5vdCg6ZGlzYWJsZWQpIHsgYmFja2dyb3VuZDogI2M1NzBmZjsgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC0xcHgpOyB9CiAgLmdlbmVyYXRlLWJ0bjpkaXNhYmxlZCB7IGJhY2tncm91bmQ6IHZhcigtLXN1cmZhY2UyKTsgY29sb3I6IHZhcigtLXRleHQzKTsgY3Vyc29yOiBub3QtYWxsb3dlZDsgdHJhbnNmb3JtOiBub25lOyB9CiAgLmJ0bi1zcGlubmVyIHsgd2lkdGg6IDE4cHg7IGhlaWdodDogMThweDsgYm9yZGVyOiAycHggc29saWQgcmdiYSgyNTUsMjU1LDI1NSwwLjIpOyBib3JkZXItdG9wLWNvbG9yOiAjZmZmOyBib3JkZXItcmFkaXVzOiA1MCU7IGFuaW1hdGlvbjogc3BpbiAwLjdzIGxpbmVhciBpbmZpbml0ZTsgZGlzcGxheTogbm9uZTsgfQogIEBrZXlmcmFtZXMgc3BpbiB7IHRvIHsgdHJhbnNmb3JtOiByb3RhdGUoMzYwZGVnKTsgfSB9CgogIC8qIFNUQVRVUyAqLwogIC5zdGF0dXMtYmFyIHsgZGlzcGxheTogbm9uZTsgYWxpZ24taXRlbXM6IGNlbnRlcjsgZ2FwOiAxMHB4OyBwYWRkaW5nOiAxMnB4IDE2cHg7IGJhY2tncm91bmQ6IHJnYmEoMTgwLDc5LDI1NSwwLjA1KTsgYm9yZGVyOiAxcHggc29saWQgcmdiYSgxODAsNzksMjU1LDAuMik7IGJvcmRlci1yYWRpdXM6IDEwcHg7IG1hcmdpbi1ib3R0b206IDI0cHg7IGZvbnQtZmFtaWx5OiAnRE0gTW9ubycsIG1vbm9zcGFjZTsgZm9udC1zaXplOiAxMnB4OyBjb2xvcjogdmFyKC0tYWNjZW50NCk7IH0KICAuc3RhdHVzLWRvdCB7IHdpZHRoOiA4cHg7IGhlaWdodDogOHB4OyBib3JkZXItcmFkaXVzOiA1MCU7IGJhY2tncm91bmQ6IHZhcigtLWFjY2VudDQpOyBhbmltYXRpb246IHB1bHNlIDFzIGVhc2UgaW5maW5pdGU7IGZsZXgtc2hyaW5rOiAwOyB9CiAgQGtleWZyYW1lcyBwdWxzZSB7IDAlLDEwMCV7b3BhY2l0eToxO3RyYW5zZm9ybTpzY2FsZSgxKX0gNTAle29wYWNpdHk6LjU7dHJhbnNmb3JtOnNjYWxlKC44KX0gfQogIC5lcnJvci1iYXIgeyBkaXNwbGF5OiBub25lOyBhbGlnbi1pdGVtczogY2VudGVyOyBnYXA6IDEwcHg7IHBhZGRpbmc6IDEycHggMTZweDsgYmFja2dyb3VuZDogcmdiYSgyNTUsMTA3LDUzLDAuMDgpOyBib3JkZXI6IDFweCBzb2xpZCByZ2JhKDI1NSwxMDcsNTMsMC4yKTsgYm9yZGVyLXJhZGl1czogMTBweDsgbWFyZ2luLWJvdHRvbTogMjRweDsgZm9udC1mYW1pbHk6ICdETSBNb25vJywgbW9ub3NwYWNlOyBmb250LXNpemU6IDEycHg7IGNvbG9yOiB2YXIoLS1hY2NlbnQzKTsgfQoKICAvKiBPVVRQVVQgKi8KICAjb3V0cHV0IHsgZGlzcGxheTogbm9uZTsgfQogIC5vdXRwdXQtY2FyZCB7IGJhY2tncm91bmQ6IHZhcigtLWNhcmQpOyBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1ib3JkZXIpOyBib3JkZXItcmFkaXVzOiAxNnB4OyBvdmVyZmxvdzogaGlkZGVuOyBhbmltYXRpb246IGZhZGVVcCAwLjRzIGVhc2UgZm9yd2FyZHM7IH0KICBAa2V5ZnJhbWVzIGZhZGVVcCB7IGZyb217b3BhY2l0eTowO3RyYW5zZm9ybTp0cmFuc2xhdGVZKDEycHgpfSB0b3tvcGFjaXR5OjE7dHJhbnNmb3JtOnRyYW5zbGF0ZVkoMCl9IH0KICAub3V0cHV0LWhlYWRlciB7IHBhZGRpbmc6IDE0cHggMThweDsgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkIHZhcigtLWJvcmRlcik7IGRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IGdhcDogMTJweDsgfQogIC5vdXRwdXQtYmFkZ2UgeyBmb250LWZhbWlseTogJ0RNIE1vbm8nLCBtb25vc3BhY2U7IGZvbnQtc2l6ZTogMTFweDsgY29sb3I6IHZhcigtLWFjY2VudDIpOyBiYWNrZ3JvdW5kOiByZ2JhKDUwLDI1NSwxMjYsMC4xKTsgYm9yZGVyOiAxcHggc29saWQgcmdiYSg1MCwyNTUsMTI2LDAuMik7IHBhZGRpbmc6IDNweCAxMHB4OyBib3JkZXItcmFkaXVzOiAyMHB4OyB9CiAgLm91dHB1dC1hY3Rpb25zIHsgbWFyZ2luLWxlZnQ6IGF1dG87IGRpc3BsYXk6IGZsZXg7IGdhcDogMTBweDsgfQogIC5hY3Rpb24tYnRuIHsgZGlzcGxheTogZmxleDsgYWxpZ24taXRlbXM6IGNlbnRlcjsgZ2FwOiA2cHg7IHBhZGRpbmc6IDdweCAxNHB4OyBib3JkZXItcmFkaXVzOiA4cHg7IGZvbnQtZmFtaWx5OiAnRE0gTW9ubycsIG1vbm9zcGFjZTsgZm9udC1zaXplOiAxMXB4OyBjdXJzb3I6IHBvaW50ZXI7IHRyYW5zaXRpb246IGFsbCAwLjJzOyBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1ib3JkZXIyKTsgYmFja2dyb3VuZDogdmFyKC0tc3VyZmFjZTIpOyBjb2xvcjogdmFyKC0tdGV4dDIpOyB9CiAgLmFjdGlvbi1idG46aG92ZXIgeyBiYWNrZ3JvdW5kOiByZ2JhKDE4MCw3OSwyNTUsMC4xKTsgYm9yZGVyLWNvbG9yOiByZ2JhKDE4MCw3OSwyNTUsMC4zKTsgY29sb3I6IHZhcigtLWFjY2VudDQpOyB9CiAgLmFjdGlvbi1idG4uZG93bmxvYWQgeyBiYWNrZ3JvdW5kOiByZ2JhKDUwLDI1NSwxMjYsMC4xKTsgYm9yZGVyLWNvbG9yOiByZ2JhKDUwLDI1NSwxMjYsMC4zKTsgY29sb3I6IHZhcigtLWFjY2VudDIpOyB9CiAgLmFjdGlvbi1idG4uZG93bmxvYWQ6aG92ZXIgeyBiYWNrZ3JvdW5kOiByZ2JhKDUwLDI1NSwxMjYsMC4yKTsgfQogIC5vdXRwdXQtaW1hZ2Utd3JhcCB7IHBhZGRpbmc6IDE2cHg7IGRpc3BsYXk6IGZsZXg7IGp1c3RpZnktY29udGVudDogY2VudGVyOyBiYWNrZ3JvdW5kOiB2YXIoLS1zdXJmYWNlMik7IH0KICAjZ2VuZXJhdGVkLWltYWdlIHsgbWF4LXdpZHRoOiAxMDAlOyBtYXgtaGVpZ2h0OiA3MHZoOyBib3JkZXItcmFkaXVzOiA4cHg7IGRpc3BsYXk6IGJsb2NrOyB9CiAgLm91dHB1dC1tZXRhIHsgcGFkZGluZzogMTJweCAxOHB4OyBmb250LWZhbWlseTogJ0RNIE1vbm8nLCBtb25vc3BhY2U7IGZvbnQtc2l6ZTogMTFweDsgY29sb3I6IHZhcigtLXRleHQzKTsgYm9yZGVyLXRvcDogMXB4IHNvbGlkIHZhcigtLWJvcmRlcik7IGRpc3BsYXk6IGZsZXg7IGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjsgfQoKICBAbWVkaWEgKG1heC13aWR0aDogNjQwcHgpIHsKICAgIC51cGxvYWQtZ3JpZCB7IGdyaWQtdGVtcGxhdGUtY29sdW1uczogMWZyOyB9CiAgfQo8L3N0eWxlPgo8L2hlYWQ+Cjxib2R5Pgo8ZGl2IGNsYXNzPSJ3cmFwIj4KCiAgPGhlYWRlcj4KICAgIDxkaXYgY2xhc3M9ImxvZ28tbWFyayI+4pymPC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJoZWFkZXItdGV4dCI+CiAgICAgIDxoMT5BZFN0YWNrIEltYWdlIEdlbmVyYXRvcjwvaDE+CiAgICAgIDxwPndpcmVmcmFtZSArIHByb2R1aXQgKyBwcm9tcHQg4oaSIGNyw6lhdGl2ZSBHZW1pbmk8L3A+CiAgICA8L2Rpdj4KICAgIDxkaXYgY2xhc3M9ImJhZGdlIj5nZW1pbmktMy1wcm8taW1hZ2UtcHJldmlldyDCtyBOYW5vIEJhbmFuYSBQcm88L2Rpdj4KICA8L2hlYWRlcj4KCgoKICA8IS0tIElOUFVUUyAtLT4KICA8ZGl2IGNsYXNzPSJzZWN0aW9uLWxhYmVsIj4wMSDigJQgSU1BR0VTIERFIFLDiUbDiVJFTkNFPC9kaXY+CiAgPGRpdiBjbGFzcz0idXBsb2FkLWdyaWQiPgoKICAgIDwhLS0gV2lyZWZyYW1lIC0tPgogICAgPGRpdiBjbGFzcz0idXBsb2FkLWNhcmQiIG9uY2xpY2s9InRyaWdnZXJVcGxvYWQoJ3dpcmVmcmFtZS1pbnB1dCcsIGV2ZW50KSI+CiAgICAgIDxkaXYgY2xhc3M9InVwbG9hZC1jYXJkLWhlYWRlciI+CiAgICAgICAgPGRpdiBjbGFzcz0iZG90IHB1cnBsZSI+PC9kaXY+CiAgICAgICAgV2lyZWZyYW1lIENUIChUZW1wbGF0ZSBzdHJ1Y3R1cmVsKQogICAgICA8L2Rpdj4KICAgICAgPGRpdiBjbGFzcz0idXBsb2FkLXpvbmUiIGlkPSJ6b25lLXdpcmVmcmFtZSI+CiAgICAgICAgPGJ1dHRvbiBjbGFzcz0iY2xlYXItYnRuIiBpZD0iY2xlYXItd2lyZWZyYW1lIj7inJU8L2J1dHRvbj4KICAgICAgICA8ZGl2IGNsYXNzPSJ1cGxvYWQtaWNvbiI+4oqePC9kaXY+CiAgICAgICAgPHA+SW1wb3J0ZSBsZSB3aXJlZnJhbWU8YnI+ZHUgQ1Qgc8OpbGVjdGlvbm7DqTwvcD4KICAgICAgICA8c3Bhbj5KUEcgwrcgUE5HIMK3IFdFQlA8L3NwYW4+CiAgICAgICAgPGltZyBjbGFzcz0icHJldmlldy1pbWciIGlkPSJwcmV2aWV3LXdpcmVmcmFtZSIgYWx0PSIiPgogICAgICA8L2Rpdj4KICAgICAgPGlucHV0IHR5cGU9ImZpbGUiIGlkPSJ3aXJlZnJhbWUtaW5wdXQiIGFjY2VwdD0iaW1hZ2UvKiI+CiAgICA8L2Rpdj4KCiAgICA8IS0tIFByb2R1aXQgLS0+CiAgICA8ZGl2IGNsYXNzPSJ1cGxvYWQtY2FyZCIgb25jbGljaz0idHJpZ2dlclVwbG9hZCgncHJvZHVjdC1pbnB1dCcsIGV2ZW50KSI+CiAgICAgIDxkaXYgY2xhc3M9InVwbG9hZC1jYXJkLWhlYWRlciI+CiAgICAgICAgPGRpdiBjbGFzcz0iZG90IGJsdWUiPjwvZGl2PgogICAgICAgIFBob3RvIHByb2R1aXQgKFLDqWbDqXJlbmNlIGZpZMOpbGl0w6kpCiAgICAgIDwvZGl2PgogICAgICA8ZGl2IGNsYXNzPSJ1cGxvYWQtem9uZSIgaWQ9InpvbmUtcHJvZHVjdCI+CiAgICAgICAgPGJ1dHRvbiBjbGFzcz0iY2xlYXItYnRuIiBpZD0iY2xlYXItcHJvZHVjdCI+4pyVPC9idXR0b24+CiAgICAgICAgPGRpdiBjbGFzcz0idXBsb2FkLWljb24iPis8L2Rpdj4KICAgICAgICA8cD5JbXBvcnRlIGxhIHBob3RvPGJyPmR1IHByb2R1aXQ8L3A+CiAgICAgICAgPHNwYW4+SlBHIMK3IFBORyDCtyBXRUJQPC9zcGFuPgogICAgICAgIDxpbWcgY2xhc3M9InByZXZpZXctaW1nIiBpZD0icHJldmlldy1wcm9kdWN0IiBhbHQ9IiI+CiAgICAgIDwvZGl2PgogICAgICA8aW5wdXQgdHlwZT0iZmlsZSIgaWQ9InByb2R1Y3QtaW5wdXQiIGFjY2VwdD0iaW1hZ2UvKiI+CiAgICA8L2Rpdj4KCiAgPC9kaXY+CgogIDwhLS0gUFJPTVBUIC0tPgogIDxkaXYgY2xhc3M9InNlY3Rpb24tbGFiZWwiPjAyIOKAlCBQUk9NUFQgR0VNSU5JPC9kaXY+CiAgPGRpdiBjbGFzcz0icHJvbXB0LWNhcmQiPgogICAgPGRpdiBjbGFzcz0icHJvbXB0LWNhcmQtaGVhZGVyIj4KICAgICAgPGRpdiBjbGFzcz0iZG90IGdyZWVuIj48L2Rpdj4KICAgICAgUHJvbXB0IGfDqW7DqXLDqSBwYXIgQWRTdGFjayBQcm9tcHQgRW5naW5lCiAgICAgIDxzcGFuIGNsYXNzPSJwYXN0ZS1oaW50Ij5Db2xsZSBsZSBwcm9tcHQgY29tcGxldCBpY2k8L3NwYW4+CiAgICA8L2Rpdj4KICAgIDx0ZXh0YXJlYSBjbGFzcz0icHJvbXB0LWlucHV0IiBpZD0icHJvbXB0LWlucHV0IiBwbGFjZWhvbGRlcj0iQ29sbGUgaWNpIGxlIHByb21wdCBjb21wbGV0IHNvcnRpIHBhciBsJ291dGlsIFByb21wdCBFbmdpbmUuLi4mIzEwOyYjMTA74pqg77iPIElNQUdFUyBGT1VSTklFUyYjMTA74pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSBJiMxMDtJTUFHRSAxIOKAlCBURU1QTEFURSBTVFJVQ1RVUkVMJiMxMDsuLi4iPjwvdGV4dGFyZWE+CiAgPC9kaXY+CgogIDwhLS0gR0VORVJBVEUgLS0+CiAgPGJ1dHRvbiBjbGFzcz0iZ2VuZXJhdGUtYnRuIiBpZD0iZ2VuLWJ0biIgb25jbGljaz0iZ2VuZXJhdGUoKSI+CiAgICA8ZGl2IGNsYXNzPSJidG4tc3Bpbm5lciIgaWQ9InNwaW5uZXIiPjwvZGl2PgogICAgPHNwYW4gaWQ9ImJ0bi1pY29uIj7inKY8L3NwYW4+CiAgICA8c3BhbiBpZD0iYnRuLXRleHQiPkfDqW7DqXJlciBsYSBjcsOpYXRpdmU8L3NwYW4+CiAgPC9idXR0b24+CgogIDxkaXYgY2xhc3M9InN0YXR1cy1iYXIiIGlkPSJzdGF0dXMtYmFyIj48ZGl2IGNsYXNzPSJzdGF0dXMtZG90Ij48L2Rpdj48c3BhbiBpZD0ic3RhdHVzLXRleHQiPkVudm9pIMOgIEdlbWluaS4uLjwvc3Bhbj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJlcnJvci1iYXIiIGlkPSJlcnJvci1iYXIiPuKaoCA8c3BhbiBpZD0iZXJyb3ItdGV4dCI+PC9zcGFuPjwvZGl2PgoKICA8IS0tIE9VVFBVVCAtLT4KICA8ZGl2IGlkPSJvdXRwdXQiPgogICAgPGRpdiBjbGFzcz0ic2VjdGlvbi1sYWJlbCI+MDMg4oCUIENSw4lBVElWRSBHw4lOw4lSw4lFPC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJvdXRwdXQtY2FyZCI+CiAgICAgIDxkaXYgY2xhc3M9Im91dHB1dC1oZWFkZXIiPgogICAgICAgIDxzcGFuIGNsYXNzPSJvdXRwdXQtYmFkZ2UiPuKckyBHw6luw6lyw6k8L3NwYW4+CiAgICAgICAgPHNwYW4gc3R5bGU9ImZvbnQtZmFtaWx5OidETSBNb25vJyxtb25vc3BhY2U7Zm9udC1zaXplOjExcHg7Y29sb3I6dmFyKC0tdGV4dDIpIiBpZD0iZ2VuLXRpbWUiPjwvc3Bhbj4KICAgICAgICA8ZGl2IGNsYXNzPSJvdXRwdXQtYWN0aW9ucyI+CiAgICAgICAgICA8YnV0dG9uIGNsYXNzPSJhY3Rpb24tYnRuIiBvbmNsaWNrPSJyZWdlbmVyYXRlKCkiPuKGuyBSw6lnw6luw6lyZXI8L2J1dHRvbj4KICAgICAgICAgIDxidXR0b24gY2xhc3M9ImFjdGlvbi1idG4gZG93bmxvYWQiIGlkPSJkbC1idG4iIG9uY2xpY2s9ImRvd25sb2FkSW1hZ2UoKSI+4oaTIFTDqWzDqWNoYXJnZXI8L2J1dHRvbj4KICAgICAgICA8L2Rpdj4KICAgICAgPC9kaXY+CiAgICAgIDxkaXYgY2xhc3M9Im91dHB1dC1pbWFnZS13cmFwIj4KICAgICAgICA8aW1nIGlkPSJnZW5lcmF0ZWQtaW1hZ2UiIGFsdD0iQ3LDqWF0aXZlIGfDqW7DqXLDqWUiPgogICAgICA8L2Rpdj4KICAgICAgPGRpdiBjbGFzcz0ib3V0cHV0LW1ldGEiPgogICAgICAgIDxzcGFuIGlkPSJvdXRwdXQtbW9kZWwiPmdlbWluaS0yLjAtZmxhc2gtZXhwLWltYWdlLWdlbmVyYXRpb248L3NwYW4+CiAgICAgICAgPHNwYW4gaWQ9Im91dHB1dC1zaXplIj48L3NwYW4+CiAgICAgIDwvZGl2PgogICAgPC9kaXY+CiAgPC9kaXY+Cgo8L2Rpdj4KCjxzY3JpcHQ+Ci8vIOKUgOKUgCBTVEFURSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIAKCmNvbnN0IHN0YXRlID0gewogIHdpcmVmcmFtZTogeyBiYXNlNjQ6IG51bGwsIG1pbWU6IG51bGwgfSwKICBwcm9kdWN0OiAgIHsgYmFzZTY0OiBudWxsLCBtaW1lOiBudWxsIH0sCiAgaW1hZ2VEYXRhOiBudWxsLAogIGltYWdlTWltZTogbnVsbCwKICBnZW5TdGFydDogIG51bGwKfTsKCi8vIOKUgOKUgCBBUEkgS0VZIENIRUNLIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgAoKLy8g4pSA4pSAIFVQTE9BRCBIQU5ETElORyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIAKZnVuY3Rpb24gdHJpZ2dlclVwbG9hZChpbnB1dElkLCBlKSB7CiAgaWYgKGUudGFyZ2V0LmNsYXNzTGlzdC5jb250YWlucygnY2xlYXItYnRuJykpIHJldHVybjsKICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChpbnB1dElkKS5jbGljaygpOwp9CgpmdW5jdGlvbiBzZXR1cFVwbG9hZChpbnB1dElkLCB6b25lSWQsIHByZXZpZXdJZCwgY2xlYXJJZCwgc3RhdGVLZXkpIHsKICBjb25zdCBpbnB1dCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGlucHV0SWQpOwogIGNvbnN0IHpvbmUgID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoem9uZUlkKTsKICBjb25zdCBwcmV2aWV3ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQocHJldmlld0lkKTsKICBjb25zdCBjbGVhckJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGNsZWFySWQpOwoKICBpbnB1dC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCBmdW5jdGlvbihlKSB7CiAgICBjb25zdCBmaWxlID0gZS50YXJnZXQuZmlsZXNbMF07CiAgICBpZiAoIWZpbGUpIHJldHVybjsKICAgIGNvbnN0IHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7CiAgICByZWFkZXIub25sb2FkID0gZXYgPT4gewogICAgICBjb25zdCByZXN1bHQgPSBldi50YXJnZXQucmVzdWx0OwogICAgICBzdGF0ZVtzdGF0ZUtleV0uYmFzZTY0ID0gcmVzdWx0LnNwbGl0KCcsJylbMV07CiAgICAgIHN0YXRlW3N0YXRlS2V5XS5taW1lID0gZmlsZS50eXBlIHx8ICdpbWFnZS9qcGVnJzsKICAgICAgcHJldmlldy5zcmMgPSByZXN1bHQ7CiAgICAgIHByZXZpZXcuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7CiAgICAgIHpvbmUuY2xhc3NMaXN0LmFkZCgnaGFzLWltYWdlJyk7CiAgICAgIHpvbmUucXVlcnlTZWxlY3RvcigncCcpLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7CiAgICAgIHpvbmUucXVlcnlTZWxlY3Rvcignc3BhbicpLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7CiAgICAgIHpvbmUucXVlcnlTZWxlY3RvcignLnVwbG9hZC1pY29uJykuc3R5bGUuZGlzcGxheSA9ICdub25lJzsKICAgICAgY2xlYXJCdG4uc3R5bGUuZGlzcGxheSA9ICdmbGV4JzsKICAgIH07CiAgICByZWFkZXIucmVhZEFzRGF0YVVSTChmaWxlKTsKICB9KTsKCiAgY2xlYXJCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbihlKSB7CiAgICBlLnN0b3BQcm9wYWdhdGlvbigpOwogICAgc3RhdGVbc3RhdGVLZXldLmJhc2U2NCA9IG51bGw7CiAgICBzdGF0ZVtzdGF0ZUtleV0ubWltZSA9IG51bGw7CiAgICBwcmV2aWV3LnNyYyA9ICcnOwogICAgcHJldmlldy5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnOwogICAgem9uZS5jbGFzc0xpc3QucmVtb3ZlKCdoYXMtaW1hZ2UnKTsKICAgIHpvbmUucXVlcnlTZWxlY3RvcigncCcpLnN0eWxlLmRpc3BsYXkgPSAnJzsKICAgIHpvbmUucXVlcnlTZWxlY3Rvcignc3BhbicpLnN0eWxlLmRpc3BsYXkgPSAnJzsKICAgIHpvbmUucXVlcnlTZWxlY3RvcignLnVwbG9hZC1pY29uJykuc3R5bGUuZGlzcGxheSA9ICcnOwogICAgY2xlYXJCdG4uc3R5bGUuZGlzcGxheSA9ICdub25lJzsKICAgIGlucHV0LnZhbHVlID0gJyc7CiAgfSk7Cn0KCnNldHVwVXBsb2FkKCd3aXJlZnJhbWUtaW5wdXQnLCAnem9uZS13aXJlZnJhbWUnLCAncHJldmlldy13aXJlZnJhbWUnLCAnY2xlYXItd2lyZWZyYW1lJywgJ3dpcmVmcmFtZScpOwpzZXR1cFVwbG9hZCgncHJvZHVjdC1pbnB1dCcsICAgJ3pvbmUtcHJvZHVjdCcsICAgJ3ByZXZpZXctcHJvZHVjdCcsICAgJ2NsZWFyLXByb2R1Y3QnLCAgICdwcm9kdWN0Jyk7CgovLyDilIDilIAgR0VORVJBVEUg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSACmFzeW5jIGZ1bmN0aW9uIGdlbmVyYXRlKCkgewogIGNvbnN0IHByb21wdCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwcm9tcHQtaW5wdXQnKS52YWx1ZS50cmltKCk7CgogIGlmICghc3RhdGUud2lyZWZyYW1lLmJhc2U2NCkgeyBzaG93RXJyb3IoJ0ltcG9ydGUgbGUgd2lyZWZyYW1lIENULicpOyByZXR1cm47IH0KICBpZiAoIXN0YXRlLnByb2R1Y3QuYmFzZTY0KSAgIHsgc2hvd0Vycm9yKCdJbXBvcnRlIGxhIHBob3RvIHByb2R1aXQuJyk7IHJldHVybjsgfQogIGlmICghcHJvbXB0KSAgICAgICAgICAgICAgICAgeyBzaG93RXJyb3IoJ0NvbGxlIGxlIHByb21wdCBhdmFudCBkZSBnw6luw6lyZXIuJyk7IHJldHVybjsgfQoKICBzZXRMb2FkaW5nKHRydWUpOwogIGhpZGVFcnJvcigpOwogIHNldFN0YXR1cygnRW52b2kgw6AgVmVydGV4IEFJIOKAlCBOYW5vIEJhbmFuYSBQcm8uLi4nKTsKICBzdGF0ZS5nZW5TdGFydCA9IERhdGUubm93KCk7CgogIHRyeSB7CiAgICBjb25zdCBib2R5ID0gewogICAgICBjb250ZW50czogW3sKICAgICAgICBwYXJ0czogWwogICAgICAgICAgeyB0ZXh0OiBwcm9tcHQgfSwKICAgICAgICAgIHsgaW5saW5lX2RhdGE6IHsgbWltZV90eXBlOiBzdGF0ZS53aXJlZnJhbWUubWltZSwgZGF0YTogc3RhdGUud2lyZWZyYW1lLmJhc2U2NCB9IH0sCiAgICAgICAgICB7IGlubGluZV9kYXRhOiB7IG1pbWVfdHlwZTogc3RhdGUucHJvZHVjdC5taW1lLCAgIGRhdGE6IHN0YXRlLnByb2R1Y3QuYmFzZTY0ICAgfSB9CiAgICAgICAgXQogICAgICB9XQogICAgfTsKCiAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaCgnL2dlbmVyYXRlJywgewogICAgICBtZXRob2Q6ICdQT1NUJywKICAgICAgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0sCiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KGJvZHkpCiAgICB9KTsKCiAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzLmpzb24oKTsKICAgIGlmIChkYXRhLmVycm9yKSB0aHJvdyBuZXcgRXJyb3IoZGF0YS5lcnJvcik7CgogICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ291dHB1dC1tb2RlbCcpLnRleHRDb250ZW50ID0gZGF0YS5tb2RlbCArICcgwrcgVmVydGV4IEFJJzsKICAgIHN0YXRlLmltYWdlRGF0YSA9IGRhdGEuaW1hZ2VEYXRhOwogICAgc3RhdGUuaW1hZ2VNaW1lID0gZGF0YS5pbWFnZU1pbWU7CiAgICByZW5kZXJJbWFnZShzdGF0ZS5pbWFnZURhdGEsIHN0YXRlLmltYWdlTWltZSk7CiAgICBzZXRMb2FkaW5nKGZhbHNlKTsKICAgIGhpZGVTdGF0dXMoKTsKCiAgfSBjYXRjaChlcnIpIHsKICAgIHNldExvYWRpbmcoZmFsc2UpOwogICAgaGlkZVN0YXR1cygpOwogICAgc2hvd0Vycm9yKGVyci5tZXNzYWdlKTsKICAgIGNvbnNvbGUuZXJyb3IoZXJyKTsKICB9Cn0KCmZ1bmN0aW9uIHJlZ2VuZXJhdGUoKSB7CiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ291dHB1dCcpLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7CiAgZ2VuZXJhdGUoKTsKfQoKLy8g4pSA4pSAIFJFTkRFUiBJTUFHRSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIAKZnVuY3Rpb24gcmVuZGVySW1hZ2UoYmFzZTY0LCBtaW1lKSB7CiAgY29uc3QgZWxhcHNlZCA9ICgoRGF0ZS5ub3coKSAtIHN0YXRlLmdlblN0YXJ0KSAvIDEwMDApLnRvRml4ZWQoMSk7CiAgY29uc3QgaW1nID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dlbmVyYXRlZC1pbWFnZScpOwogIGNvbnN0IHNyYyA9IGBkYXRhOiR7bWltZX07YmFzZTY0LCR7YmFzZTY0fWA7CiAgaW1nLnNyYyA9IHNyYzsKICBpbWcub25sb2FkID0gKCkgPT4gewogICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ291dHB1dC1zaXplJykudGV4dENvbnRlbnQgPQogICAgICBgJHtpbWcubmF0dXJhbFdpZHRofcOXJHtpbWcubmF0dXJhbEhlaWdodH1weGA7CiAgfTsKICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2VuLXRpbWUnKS50ZXh0Q29udGVudCA9IGAke2VsYXBzZWR9c2A7CiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ291dHB1dCcpLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snOwogIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdvdXRwdXQnKS5zY3JvbGxJbnRvVmlldyh7IGJlaGF2aW9yOiAnc21vb3RoJywgYmxvY2s6ICdzdGFydCcgfSk7Cn0KCi8vIOKUgOKUgCBET1dOTE9BRCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIAKZnVuY3Rpb24gZG93bmxvYWRJbWFnZSgpIHsKICBpZiAoIXN0YXRlLmltYWdlRGF0YSkgcmV0dXJuOwogIGNvbnN0IGV4dCA9IHN0YXRlLmltYWdlTWltZT8uaW5jbHVkZXMoJ3BuZycpID8gJ3BuZycgOiAnanBnJzsKICBjb25zdCBhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpOwogIGEuaHJlZiA9IGBkYXRhOiR7c3RhdGUuaW1hZ2VNaW1lfTtiYXNlNjQsJHtzdGF0ZS5pbWFnZURhdGF9YDsKICBhLmRvd25sb2FkID0gYGFkc3RhY2tfY3JlYXRpdmVfJHtEYXRlLm5vdygpfS4ke2V4dH1gOwogIGEuY2xpY2soKTsKfQoKLy8g4pSA4pSAIFVJIEhFTFBFUlMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSACmZ1bmN0aW9uIHNldExvYWRpbmcob24pIHsKICBjb25zdCBidG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2VuLWJ0bicpOwogIGJ0bi5kaXNhYmxlZCA9IG9uOwogIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzcGlubmVyJykuc3R5bGUuZGlzcGxheSA9IG9uID8gJ2Jsb2NrJyA6ICdub25lJzsKICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLWljb24nKS5zdHlsZS5kaXNwbGF5ID0gb24gPyAnbm9uZScgOiAnYmxvY2snOwogIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4tdGV4dCcpLnRleHRDb250ZW50ID0gb24gPyAnR8OpbsOpcmF0aW9uIGVuIGNvdXJzLi4uJyA6ICdHw6luw6lyZXIgbGEgY3LDqWF0aXZlJzsKfQpmdW5jdGlvbiBzZXRTdGF0dXMobXNnKSB7CiAgY29uc3QgYiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzdGF0dXMtYmFyJyk7CiAgYi5zdHlsZS5kaXNwbGF5ID0gJ2ZsZXgnOwogIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzdGF0dXMtdGV4dCcpLnRleHRDb250ZW50ID0gbXNnOwp9CmZ1bmN0aW9uIGhpZGVTdGF0dXMoKSB7IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzdGF0dXMtYmFyJykuc3R5bGUuZGlzcGxheSA9ICdub25lJzsgfQpmdW5jdGlvbiBzaG93RXJyb3IobXNnKSB7CiAgY29uc3QgYiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdlcnJvci1iYXInKTsKICBiLnN0eWxlLmRpc3BsYXkgPSAnZmxleCc7CiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Vycm9yLXRleHQnKS50ZXh0Q29udGVudCA9IG1zZzsKfQpmdW5jdGlvbiBoaWRlRXJyb3IoKSB7IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdlcnJvci1iYXInKS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnOyB9Cjwvc2NyaXB0Pgo8L2JvZHk+CjwvaHRtbD4K';
// ────────────────────────────────────────────────────────────
// MODE TEST : Sonnet 4.6 → Gemini 2.5 Pro (texte + multimodal)
// ────────────────────────────────────────────────────────────
async function callGeminiPro(systemPrompt, contentBlocks, maxOutputTokens, options = {}) {
  // VAGUE 1 (fondations serveur) — thinkingBudget et temperature configurables par appelant.
  // Cause profonde corrigée : avant ce fix, aucun thinkingConfig n'était envoyé à Gemini 2.5 Pro.
  // Sur du "dynamic thinking" par défaut, le modèle peut sauter les chaînes de raisonnement silencieuses
  // demandées par les compétences (décodage CT étape A→G, compréhension persona/produit/angles avant écriture).
  // Défaut permissif (8192) appliqué à TOUT appelant qui ne précise rien — les endpoints critiques
  // (/creative-prod, /analyste-synthese) forcent explicitement une valeur plus haute à l'appel (voir plus bas).
  const { modele = MODELES.raisonnement, temperature = 0.7, thinkingBudget = 8192, logLabel = 'Gemini 2.5 Pro', timeoutMs = 90000, typeAppel = 'texte_gemini' } = options;
  const token = await getToken();
  const parts = (contentBlocks || []).map(b => {
    if (b.type === 'image' && b.source) {
      return { inlineData: { mimeType: b.source.media_type || 'image/jpeg', data: b.source.data } };
    }
    if (b.type === 'text' || typeof b.text === 'string') {
      return { text: b.text || '' };
    }
    return null;
  }).filter(Boolean);

  const generationConfig = { temperature, maxOutputTokens: maxOutputTokens || 8000 };
  // thinkingBudget=null désactive explicitement le forçage (comportement dynamique natif de Gemini) —
  // utile si un futur appelant veut délibérément revenir au comportement par défaut de l'API.
  if (thinkingBudget !== null) {
    Object.assign(generationConfig, reflexion(modele, thinkingBudget));
  }

  const geminiBody = {
    contents: [{ role: 'user', parts }],
    systemInstruction: { parts: [{ text: systemPrompt || '' }] },
    generationConfig
  };

  // Cause profonde corrigée (commande entière plantée sans aucune image sur une simple erreur
  // 429 "Resource exhausted" — transitoire par nature) : cette fonction appelait vertexRequest
  // brut, sans aucun réessai, alors que vertexRequestAvecReessai existe déjà et gère précisément
  // ce cas (4 tentatives, attente croissante sur limite de débit détectée). callGeminiPro est
  // le point d'entrée partagé de l'Analyste, du Copywriter et de la Créative — ce seul
  // changement protège les trois d'un coup.
  const data = await vertexRequestAvecReessai(token, modele, geminiBody, timeoutMs, typeAppel);
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  const cand = data.candidates?.[0];
  // Cause profonde corrigée (texte dupliqué/tronqué au milieu d'une phrase dans les Ad Copies) :
  // avec thinkingConfig activé, Gemini peut renvoyer plusieurs "parts" dans le même candidat — le
  // brouillon de raisonnement interne (part.thought === true) ET la réponse finale. Les joindre
  // toutes sans distinction concatène le brouillon (souvent une quasi-répétition du texte final)
  // avec la réponse elle-même. On ne garde désormais que les parts qui ne sont PAS du thinking.
  const text = (cand?.content?.parts || []).filter(p => !p.thought).map(p => p.text).filter(Boolean).join('\n');

  // ── Log diagnostic (Vague 1.3) — visibilité sur le raisonnement réel de Gemini, absente jusqu'ici ──
  const finishReason = cand?.finishReason || 'inconnu';
  const usage = data.usageMetadata || {};
  console.log(`   [${logLabel}] finishReason=${finishReason} · tokens prompt=${usage.promptTokenCount ?? '?'} thinking=${usage.thoughtsTokenCount ?? 0} output=${usage.candidatesTokenCount ?? '?'} total=${usage.totalTokenCount ?? '?'}`);
  if (finishReason === 'MAX_TOKENS') {
    console.log(`   ⚠️  [${logLabel}] Réponse tronquée par maxOutputTokens (${maxOutputTokens || 8000}) — le prompt final est probablement incomplet, envisager d'augmenter la limite`);
  }

  if (!text) throw new Error('Gemini 2.5 Pro : réponse vide');
  return text;
}

const HTML_CONTENT = Buffer.from(HTML_B64, 'base64').toString('utf-8');

// ══════════════════════════════════════════════════════════════════════════
// CHARIOW INTEGRATION — Checkout + Pulses (webhooks)
// ══════════════════════════════════════════════════════════════════════════

const CHARIOW_KEY = process.env.CHARIOW_KEY || '';
const SUPABASE_URL_INT = process.env.SUPABASE_URL || 'https://mifljhsusidgzelnswma.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
// Nécessaire pour /admin/impersonate : vérifier un token utilisateur (auth/v1/user) et
// finaliser un magiclink (auth/v1/verify) se font avec la clé anon, jamais la service key.
const SUPABASE_ANON_KEY_INT = process.env.SUPABASE_ANON_KEY || '';

// MAJ pricing (oct. 2026, nouvelle grille : voir OFFERS) : tarifs en FCFA (price_fcfa = prix MENSUEL du forfait, y compris pour le
// cycle trimestriel — c'est ce que Chariow facture chaque mois de la période, comme avant), volumes
// 6 / 12 / 24 créatives par semaine. L'ancien paiement d'essai (First Payment prd_ywk7ik14 + Completion
// prd_c0ga3snp) est retiré : ces deux produits ne sont plus reconnus par le webhook.
// Factures PDF / emails de confirmation / colonne montant_fcfa : les valeurs sont maintenant bien en FCFA.
const PLAN_MAP = {
  'prd_ljowq8':   { plan: 'starter', cycle: 'monthly',   credits_per_week: 6,  price_fcfa: 180000, prix_img: 7500 },
  'prd_wdya3v9h': { plan: 'starter', cycle: 'quarterly', credits_per_week: 6,  price_fcfa: 120000, prix_img: 5000 },
  'prd_34w031':   { plan: 'pro',     cycle: 'monthly',   credits_per_week: 12, price_fcfa: 330000, prix_img: 6875 },
  'prd_lnp4ax0b': { plan: 'pro',     cycle: 'quarterly', credits_per_week: 12, price_fcfa: 205000, prix_img: 4271 },
  'prd_9fi79y':   { plan: 'scale',   cycle: 'monthly',   credits_per_week: 24, price_fcfa: 600000, prix_img: 6250 },
  'prd_dn4fb72l': { plan: 'scale',   cycle: 'quarterly', credits_per_week: 24, price_fcfa: 345000, prix_img: 3594 },
};

// 'discovery' : libellé conservé uniquement pour d'anciens comptes déjà abonnés (offre retirée de la vente).
const PLAN_LABELS = { discovery: 'Discovery', starter: 'PERF+', pro: 'GROWTH', scale: 'SCALE' };

// ── Séquence email de conversion J1/J5/J12/J21 ─────────────────────────────
const SEQUENCE_PRICES = { starter: { price: OFFERS.starter.monthly.price, prixImg: OFFERS.starter.monthly.prixImg } }; // PERF+ (id interne starter) mensuel en FCFA, référence pour les prix cités dans les emails

// Convertit un prix FCFA vers la devise de la personne (détectée et mémorisée côté AdBoard).
// Taux récupéré à chaque envoi — jamais de taux périmé, contrairement à un taux figé au moment de l'inscription.
async function formatPriceForCurrency(fcfa, currency) {
  if (!currency || currency === 'XOF') return fcfa.toLocaleString('fr-FR') + ' FCFA';
  try {
    const rates = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/xof.json').then(r => r.json());
    const rate = rates.xof?.[currency.toLowerCase()];
    if (!rate) return fcfa.toLocaleString('fr-FR') + ' FCFA';
    // Arrondi commercial à la hausse (même règle que la page de vente et AdBoard) : le chiffre le plus rond, 3 % de hausse maximum.
    const brut = fcfa * rate * 1.035;
    const base = Math.pow(10, Math.floor(Math.log10(brut)));
    let val = Math.round(brut);
    for (const pas of [1, 0.5, 0.25, 0.1, 0.05, 0.025, 0.01]) { const st = base * pas; const c = Math.ceil(brut / st - 1e-9) * st; if (c / brut - 1 <= 0.03 || pas === 0.01) { val = Math.round(c); break; } }
    return new Intl.NumberFormat(undefined, { style:'currency', currency, maximumFractionDigits:0 }).format(val);
  } catch(e) {
    return fcfa.toLocaleString('fr-FR') + ' FCFA';
  }
}

// Remplace les {{variable}} par leur valeur réelle — utilisé pour tous les templates
// stockés en base (emails + notifications), maintenant modifiables depuis le CRM.
function interpoler(texte, variables) {
  return (texte || '').replace(/\{\{(\w+)\}\}/g, (_, cle) => (variables[cle] ?? ''));
}

async function chargerTemplate(cle) {
  try {
    const r = await fetch(`${SUPABASE_URL_INT}/rest/v1/templates?cle=eq.${cle}&select=*`, {
      headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
    });
    const rows = await r.json();
    return rows?.[0] || null;
  } catch(e) { return null; }
}

async function renderSequenceEmail(key, { firstName='', productName='', productPays='', currency='XOF' } = {}) {
  const prixLocal = await formatPriceForCurrency(SEQUENCE_PRICES.starter.price, currency);
  const prixParImage = await formatPriceForCurrency(SEQUENCE_PRICES.starter.prixImg, currency);
  const wrap = (body) => `<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#222;font-size:15px;line-height:1.65;">${body}</div>`;

  const tpl = await chargerTemplate(`email_${key}`);
  if (!tpl) return null;

  const variables = { firstName, productName, productPays, prixLocal, prixParImage };
  return {
    subject: interpoler(tpl.sujet, variables),
    html: wrap(interpoler(tpl.contenu, variables)),
  };
}

// Injecte des UTM sur tous les liens du site pointant vers adstackofficial.com — sans ça,
// même un clic suivi de clic → achat ne peut jamais être relié à "vient de cet email précis".
// N'importe où le lien a déjà des paramètres (?...), les UTM s'ajoutent avec & plutôt que
// de casser l'URL existante.
function injecterUtmDansHtml(html, emailKey) {
  return html.replace(
    /href="(https?:\/\/(?:www\.)?adstackofficial\.com[^"]*)"/g,
    (match, url) => {
      const separateur = url.includes('?') ? '&' : '?';
      return `href="${url}${separateur}utm_source=email&utm_medium=email&utm_campaign=${encodeURIComponent(emailKey)}"`;
    }
  );
}

async function sendSequenceEmail(email, key, ctx, userId) {
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) return false;
  const tpl = await renderSequenceEmail(key, ctx);
  if (!tpl) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'AdStack <contact@adstackofficial.com>',
        to: [email],
        reply_to: 'amarbiranediaw@gmail.com',
        subject: tpl.subject,
        html: injecterUtmDansHtml(tpl.html, key),
        // Tags lus par /webhook/resend pour relier chaque ouverture/clic à cet email précis et
        // à cet utilisateur précis — sans ça, un événement reçu ne dit rien de qui ni de quoi.
        tags: [{ name: 'email_key', value: key }, ...(userId ? [{ name: 'user_id', value: userId }] : [])],
      })
    });
    return r.ok;
  } catch(e) {
    console.error('[Sequence] Erreur envoi:', e.message);
    return false;
  }
}

async function markSequenceSent(userId, emailKey) {
  await fetch(`${SUPABASE_URL_INT}/rest/v1/email_sequence_log`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Prefer': 'resolution=ignore-duplicates',
    },
    body: JSON.stringify({ user_id: userId, email_key: emailKey })
  });
}

async function wasSequenceSent(userId, emailKey) {
  const r = await fetch(
    `${SUPABASE_URL_INT}/rest/v1/email_sequence_log?user_id=eq.${userId}&email_key=eq.${emailKey}&limit=1`,
    { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
  );
  const rows = await r.json();
  return Array.isArray(rows) && rows.length > 0;
}

// ── Web Push (notifications navigateur) ────────────────────────────────────
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:contact@adstackofficial.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// Envoie une notification push à TOUTES les subscriptions d'un utilisateur
async function sendPushToUser(userId, { title, body, url = '/adboard' }) {
  if (!process.env.VAPID_PRIVATE_KEY) { console.warn('[Push] VAPID non configuré'); return; }
  try {
    const r = await fetch(`${SUPABASE_URL_INT}/rest/v1/push_subscriptions?user_id=eq.${userId}`, {
      headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
    });
    const subs = await r.json();
    if (!Array.isArray(subs) || subs.length === 0) {
      console.warn(`[Push] Aucune souscription trouvée pour user ${userId} — rien envoyé`);
      return;
    }
    console.log(`[Push] ${subs.length} souscription(s) trouvée(s) pour user ${userId}, envoi en cours...`);

    const payload = JSON.stringify({ title, body, url });
    await Promise.all(subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        console.log(`[Push] ✅ Envoyé avec succès à l'endpoint ...${sub.endpoint.slice(-20)}`);
      } catch(e) {
        if (e.statusCode === 404 || e.statusCode === 410) {
          console.warn(`[Push] Souscription expirée (${e.statusCode}), suppression...`);
          fetch(`${SUPABASE_URL_INT}/rest/v1/push_subscriptions?id=eq.${sub.id}`, {
            method: 'DELETE',
            headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
          }).catch(()=>{});
        } else {
          console.error('[Push] Erreur envoi:', e.statusCode, e.message);
        }
      }
    }));
  } catch(e) {
    console.error('[Push] Erreur sendPushToUser:', e.message);
  }
}

// Écrit une entrée persistante dans la section Notifications d'AdBoard (indépendant du push)
async function writeInAppNotification(userId, message, type = 'info') {
  try {
    await fetch(`${SUPABASE_URL_INT}/rest/v1/notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ user_id: userId, message, type, read: false })
    });
  } catch(e) { console.error('[InAppNotif] Erreur:', e.message); }
}

// Combine push + trace persistante — à utiliser pour tout évènement asynchrone/externe important
async function notifyUserBoth(userId, { title, body, url = '/adboard', type = 'info' }) {
  await Promise.all([
    sendPushToUser(userId, { title, body, url }),
    writeInAppNotification(userId, `${title} — ${body}`, type),
  ]);
}

// Génère une facture PDF en mémoire (Buffer)
// Formatage de nombre pour le PDF — jamais toLocaleString('fr-FR'), dont l'espace insécable
// n'est pas correctement rendue par la police par défaut de PDFKit (affichée comme un symbole
// cassé). Point comme séparateur de milliers, à la place — lisible et sans risque de rendu.
function formatFCFA(n) {
  return Math.round(n).toLocaleString('en-US').replace(/,/g, '.');
}

function generateInvoicePDF({ invoiceNumber, customerEmail, customerName, plan, cycle, creditsPerWeek, totalCredits, isPack, prixImg, priceFcfa, paymentDate, expiresAt }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const cycleLabel = isPack ? 'Achat unique' : (cycle === 'quarterly' ? 'Abonnement trimestriel' : 'Abonnement mensuel');
      const weeksInPeriod = Math.round((expiresAt.getTime() - paymentDate.getTime()) / (7*24*60*60*1000));
      const totalImages = isPack ? (totalCredits || 0) : weeksInPeriod * (creditsPerWeek || 0);

      // Header
      doc.fontSize(22).fillColor('#5B8DEF').font('Helvetica-Bold').text('AdStack', 50, 50);
      doc.fontSize(10).fillColor('#666666').font('Helvetica').text('Agence de créatives Meta Ads', 50, 78);

      doc.fontSize(18).fillColor('#111111').font('Helvetica-Bold').text('FACTURE', 400, 50, { align: 'right' });
      doc.fontSize(10).fillColor('#666666').font('Helvetica').text(`N° ${invoiceNumber}`, 400, 75, { align: 'right' });
      doc.text(`Date : ${paymentDate.toLocaleDateString('fr-FR')}`, 400, 90, { align: 'right' });

      doc.moveTo(50, 120).lineTo(545, 120).strokeColor('#E5E5E5').stroke();

      // Client info
      doc.fontSize(11).fillColor('#111111').font('Helvetica-Bold').text('Facturé à :', 50, 140);
      doc.fontSize(10).fillColor('#333333').font('Helvetica').text(customerName || customerEmail, 50, 158);
      doc.text(customerEmail, 50, 173);

      // Table header
      const tableTop = 210;
      doc.fontSize(10).fillColor('#666666').font('Helvetica-Bold');
      doc.text('Description', 50, tableTop);
      doc.text('Période', 320, tableTop);
      doc.text('Montant', 470, tableTop, { align: 'right' });
      doc.moveTo(50, tableTop + 18).lineTo(545, tableTop + 18).strokeColor('#E5E5E5').stroke();

      // Table row
      const rowY = tableTop + 32;
      doc.fontSize(11).fillColor('#111111').font('Helvetica-Bold').text(PLAN_LABELS[plan] || plan, 50, rowY);
      doc.fontSize(9).fillColor('#888888').font('Helvetica').text(isPack ? `${cycleLabel} — sans engagement` : `${cycleLabel} — livraisons hebdomadaires`, 50, rowY + 15);
      doc.fontSize(10).fillColor('#333333').text(
        `${paymentDate.toLocaleDateString('fr-FR')} → ${expiresAt.toLocaleDateString('fr-FR')}`, 320, rowY
      );
      doc.fontSize(11).fillColor('#111111').font('Helvetica-Bold').text(
        `${formatFCFA(priceFcfa)} FCFA`, 470, rowY, { align: 'right' }
      );

      // Détail : ce que couvre cet achat/abonnement
      const detailTop = rowY + 45;
      doc.moveTo(50, detailTop - 8).lineTo(545, detailTop - 8).strokeColor('#F0F0F0').stroke();
      doc.fontSize(9).fillColor('#666666').font('Helvetica-Bold').text(isPack ? 'Ce que comprend cet achat :' : 'Ce que couvre cet abonnement :', 50, detailTop);
      const detailLines = isPack ? [
        `${totalImages} images publicitaires incluses (angles et concepts variés)`,
        `Utilisables librement jusqu'à expiration, sur 1 produit`,
        prixImg ? `Prix moyen par créative : ${formatFCFA(prixImg)} FCFA` : null,
        'Analyse de marché (cibles, concurrents, tendances)',
      ].filter(Boolean) : [
        `${creditsPerWeek || 0} images publicitaires livrées chaque semaine`,
        `Soit environ ${weeksInPeriod} semaine${weeksInPeriod>1?'s':''} sur cette période — ${totalImages} images au total`,
        prixImg ? `Prix moyen par créative : ${formatFCFA(prixImg)} FCFA` : null,
        'Données marché hebdomadaires (cibles, concurrents, tendances)',
      ].filter(Boolean);
      doc.fontSize(9).fillColor('#444444').font('Helvetica');
      detailLines.forEach((line, i) => {
        doc.text(`•  ${line}`, 50, detailTop + 16 + (i * 14));
      });

      const afterDetailY = detailTop + 16 + (detailLines.length * 14) + 12;
      doc.moveTo(50, afterDetailY).lineTo(545, afterDetailY).strokeColor('#E5E5E5').stroke();

      // Total
      doc.fontSize(13).fillColor('#5B8DEF').font('Helvetica-Bold').text(
        `Total payé : ${formatFCFA(priceFcfa)} FCFA`, 320, afterDetailY + 15, { align: 'right', width: 225 }
      );

      // Footer
      doc.fontSize(9).fillColor('#999999').font('Helvetica').text(
        'Merci de votre confiance. Pour toute question, contactez-nous via WhatsApp ou AdBoard.',
        50, 700, { align: 'center', width: 495 }
      );
      doc.fontSize(8).fillColor('#BBBBBB').text('AdStack — Dakar, Sénégal', 50, 715, { align: 'center', width: 495 });

      doc.end();
    } catch(e) { reject(e); }
  });
}

// Envoie un email via Resend avec la facture en pièce jointe
async function sendPaymentConfirmationEmail({ email, name, plan, cycle, creditsPerWeek, totalCredits, prixImg, priceFcfa, paymentDate, expiresAt, isPack }) {
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) { console.warn('[Email] RESEND_API_KEY manquante — email non envoyé'); return; }

  const invoiceNumber = `ADS-${paymentDate.getFullYear()}${String(paymentDate.getMonth()+1).padStart(2,'0')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  let pdfBuffer;
  try {
    pdfBuffer = await generateInvoicePDF({ invoiceNumber, customerEmail: email, customerName: name, plan, cycle, creditsPerWeek, totalCredits, isPack, prixImg, priceFcfa, paymentDate, expiresAt });
  } catch(e) {
    console.error('[Invoice] Erreur génération PDF:', e.message);
  }

  const planLabel = PLAN_LABELS[plan] || plan;
  const cycleLabel = isPack ? 'achat unique' : (cycle === 'quarterly' ? 'trimestriel' : 'mensuel');
  const ligneImages = isPack
    ? `<p style="margin:4px 0;"><strong>Images incluses :</strong> ${totalCredits || 0} au total (utilisables librement jusqu'à expiration)</p>`
    : `<p style="margin:4px 0;"><strong>Images livrées :</strong> ${creditsPerWeek || 0} / semaine</p>`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;">
      <h2 style="color:#5B8DEF;">Paiement confirmé ✅</h2>
      <p>Bonjour${name ? ' ' + name : ''},</p>
      <p>Merci pour ${isPack ? 'ton achat' : 'ton abonnement'} <strong>${planLabel}</strong> (${cycleLabel}) ! Ton paiement a bien été reçu.</p>
      <div style="background:#F5F8FF;border-radius:10px;padding:16px 20px;margin:20px 0;">
        <p style="margin:4px 0;"><strong>Offre :</strong> ${planLabel} — ${cycleLabel}</p>
        ${ligneImages}
        <p style="margin:4px 0;"><strong>Montant :</strong> ${formatFCFA(priceFcfa)} FCFA</p>
        <p style="margin:4px 0;"><strong>Valide jusqu'au :</strong> ${expiresAt.toLocaleDateString('fr-FR')}</p>
      </div>
      <p>Ta facture détaillée est jointe à cet email. Tu peux dès maintenant demander tes premiers visuels depuis <a href="https://adstackofficial.com/adboard/products">AdBoard</a>.</p>
      <p style="color:#999;font-size:12px;margin-top:30px;">AdStack — Dakar, Sénégal</p>
    </div>
  `;

  const payload = {
    from: 'AdStack <factures@adstackofficial.com>',
    to: [email],
    subject: `✅ Paiement confirmé — Abonnement ${planLabel}`,
    html,
  };
  if (pdfBuffer) {
    payload.attachments = [{
      filename: `Facture_AdStack_${invoiceNumber}.pdf`,
      content: pdfBuffer.toString('base64'),
    }];
  }

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) {
      const errText = await r.text();
      console.error('[Email] Échec envoi Resend:', r.status, errText.slice(0,200));
    } else {
      console.log(`[Email] ✅ Confirmation envoyée à ${email}`);
    }
  } catch(e) {
    console.error('[Email] Erreur envoi:', e.message);
  }
}

// Email de bienvenue — ton personnel, du fondateur, envoyé à la toute première connexion
async function sendWelcomeEmail({ email, name }) {
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) { console.warn('[Email] RESEND_API_KEY manquante — welcome email non envoyé'); return; }

  const firstName = name ? name.split(' ')[0] : '';
  const tpl = await chargerTemplate('email_welcome');
  if (!tpl) { console.warn('[Email] Template email_welcome introuvable en base — welcome email non envoyé'); return; }

  const html = `<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#222;font-size:15px;line-height:1.65;">${interpoler(tpl.contenu, { firstName })}</div>`;
  const subject = interpoler(tpl.sujet, { firstName });

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'AdStack <contact@adstackofficial.com>',
        to: [email],
        reply_to: 'amarbiranediaw@gmail.com',
        subject,
        html,
      })
    });
    if (!r.ok) {
      const errText = await r.text();
      console.error('[Email] Échec welcome email:', r.status, errText.slice(0,200));
    } else {
      console.log(`[Email] ✅ Welcome email envoyé à ${email}`);
    }
  } catch(e) {
    console.error('[Email] Erreur welcome email:', e.message);
  }
}

// Email à l'admin (toi) — nouvelle demande, annulation, ou pending 12h écoulées. Volontairement
// séparé des emails clients (sendPaymentConfirmationEmail, sendWelcomeEmail) : contenu 100%
// opérationnel, pas besoin de validation de copywriting, juste de l'information utile vite lue.
const ADMIN_EMAIL = process.env.ADMIN_NOTIF_EMAIL || '';
async function notifierAdmin(sujet, html) {
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) { console.warn('[Admin Email] RESEND_API_KEY manquante — email non envoyé'); return; }
  if (!ADMIN_EMAIL) { console.warn('[Admin Email] ADMIN_NOTIF_EMAIL manquante — email non envoyé'); return; }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'AdStack <contact@adstackofficial.com>',
        to: [ADMIN_EMAIL],
        subject: sujet,
        html: `<div style="font-family:-apple-system,Arial,sans-serif;max-width:520px;margin:0 auto;color:#222;font-size:14px;line-height:1.6;">${html}</div>`,
      })
    });
    if (!r.ok) {
      const errText = await r.text();
      console.error('[Admin Email] Échec envoi:', r.status, errText.slice(0,200));
    } else {
      console.log(`[Admin Email] ✅ "${sujet}" envoyé`);
    }
  } catch(e) {
    console.error('[Admin Email] Erreur envoi:', e.message);
  }
}

// Email client — livrables prêts, en complément du push déjà existant (au cas où il ne soit
// pas activé ou pas vu). Lit le template depuis la table `templates` (éditable dans le CRM,
// section Templates → Livraison) plutôt qu'un texte en dur — modifiable sans redéploiement.
async function sendDeliverablesReadyEmail({ email, produit }) {
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) { console.warn('[Email] RESEND_API_KEY manquante — email livrables non envoyé'); return; }
  const tpl = await chargerTemplate('email_livrables_prets');
  if (!tpl) { console.warn('[Email] Template email_livrables_prets introuvable en base — email non envoyé'); return; }

  const variables = { produit, lien: 'https://www.adstackofficial.com/adboard/gallery' };
  const html = `<div style="font-family:-apple-system,Arial,sans-serif;max-width:520px;margin:0 auto;color:#222;font-size:15px;line-height:1.65;">${interpoler(tpl.contenu, variables)}</div>`;
  const subject = interpoler(tpl.sujet, variables);

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'AdStack <contact@adstackofficial.com>',
        to: [email],
        subject,
        html,
      })
    });
    if (!r.ok) {
      const errText = await r.text();
      console.error('[Email] Échec email livrables:', r.status, errText.slice(0,200));
    } else {
      console.log(`[Email] ✅ Email livrables envoyé à ${email}`);
    }
  } catch(e) {
    console.error('[Email] Erreur email livrables:', e.message);
  }
}


async function activateSubscription(userId, planInfo, email, name, phone) {
  const { plan, cycle, credits_per_week: creditsPerWeek, price_fcfa: priceFcfa, prix_img: prixImg, type, total_credits: totalCreditsAchat } = planInfo;
  const isPack = type === 'pack';
  const now = new Date();
  // Durée : mensuel = 30 jours, trimestriel = 91 jours (le cycle long est passé d'annuel à trimestriel,
  // même logique de remise). Plus de pack ni de passerelle First Payment → Starter.
  const dureeJours = cycle === 'quarterly' ? 91 : 30;
  const expiresAt = new Date(now.getTime() + dureeJours * 24 * 60 * 60 * 1000);
  const totalCredits = totalCreditsAchat;

  const payload = {
    user_id: userId,
    plan: plan,
    cycle: cycle,
    active: true,
    started_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  };
  if (phone) payload.telephone_whatsapp = phone;
  if (isPack) {
    payload.type = 'pack';
    payload.total_credits = totalCredits;
    payload.credits_per_week = 0; // jamais utilisé en mode pack, mais gardé à 0 par sécurité si du code ancien le lit encore
  } else {
    payload.type = 'subscription';
    payload.credits_per_week = creditsPerWeek;
  }
  const r = await fetch(`${SUPABASE_URL_INT}/rest/v1/subscriptions?on_conflict=user_id`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Prefer': 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(payload)
  });
  // Cause profonde corrigée (achat confirmé par notification mais jamais reflété dans l'app) :
  // le code affichait "✅ Pack activé" inconditionnellement, sans jamais vérifier que Supabase
  // avait réellement accepté la requête. Si l'upsert échouait (ex : contrainte unique manquante
  // sur user_id, requise pour que on_conflict fonctionne), l'erreur restait invisible et le log
  // trompeur affirmait un succès qui n'avait jamais eu lieu.
  if (!r.ok) {
    const errText = await r.text();
    console.error(`[Chariow] ❌ ÉCHEC activation ${isPack ? 'pack' : 'abonnement'} pour ${userId} → ${plan}:`, r.status, errText.slice(0, 500));
    return; // ne pas continuer (email, push, etc.) sur un état non confirmé en base
  }
  const data = await r.json();
  console.log(`[Chariow] ✅ ${isPack ? 'Pack activé' : 'Abonnement activé'}: ${userId} → ${plan} (${cycle}, expire le ${expiresAt.toISOString()})`);

  // Log permanent de CE paiement précis — jamais écrasé, contrairement à "subscriptions" qui ne
  // garde que l'état courant. Nécessaire pour calculer LTV et fréquence d'achat par client.
  if (priceFcfa) {
    const commission = Math.round(priceFcfa * 0.15);
    try {
      const rTx = await fetch(`${SUPABASE_URL_INT}/rest/v1/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          user_id: userId, email: email || null, nom: name || null,
          telephone: phone || null,
          plan, cycle,
          montant_fcfa: priceFcfa,
          commission_chariow_fcfa: commission,
          montant_net_fcfa: priceFcfa - commission,
        })
      });
      // Cause profonde corrigée (section Transactions du CRM toujours vide malgré des achats
      // réels) : le succès n'était jamais vérifié — une erreur Supabase (colonne manquante,
      // contrainte, etc.) restait totalement invisible.
      if (!rTx.ok) {
        const errTx = await rTx.text();
        console.error('[Transactions] ❌ ÉCHEC écriture:', rTx.status, errTx.slice(0, 500));
      } else {
        console.log(`[Transactions] ✅ Loguée : ${plan} (${cycle}) — ${priceFcfa} FCFA`);
      }
    } catch(e) { console.error('[Transactions] Erreur log:', e.message); }
  }

  // Envoi email + facture (non bloquant, ne casse pas l'activation si ça échoue)
  if (email && priceFcfa) {
    sendPaymentConfirmationEmail({ email, name, plan, cycle, creditsPerWeek, totalCredits, prixImg, priceFcfa, paymentDate: now, expiresAt, isPack }).catch(e => {
      console.error('[Email] Échec non bloquant:', e.message);
    });
  }
  // Notification push + trace persistante — confirmation abonnement
  notifyUserBoth(userId, {
    title: '✅ Abonnement confirmé',
    body: `Ton plan ${PLAN_LABELS[plan] || plan} est actif. Tu peux demander tes visuels dès maintenant.`,
    url: '/adboard/products',
    type: 'payment',
  }).catch(()=>{});

  return data;
}

// Trouver un user Supabase par email
// Traite l'attribution CRM au moment d'un achat confirmé — marque automatiquement le prospect
// correspondant comme "acheteur" et enregistre quel message (démo/J+3/J+10/J+21) l'a converti.
// Ne fait rien si l'utilisateur n'a pas d'attribution attachée (ex: compte créé avant cette
// fonctionnalité, ou arrivé par un autre canal que nos liens traqués).
async function traiterAttributionCRM(userId) {
  try {
    const r = await fetch(`${SUPABASE_URL_INT}/auth/v1/admin/users/${userId}`, {
      headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
    });
    if (!r.ok) { console.warn('[Attribution CRM] Utilisateur introuvable:', userId); return; }
    const user = await r.json();
    const prospectId = user?.user_metadata?.crm_prospect_id;
    const campagne   = user?.user_metadata?.crm_last_campaign;

    // Écriture générique, indépendante de l'existence d'un prospect CRM — couvre les canaux sans
    // prospect identifiable (ex: statut WhatsApp, campagne='statut_whatsapp'). N'interfère pas
    // avec le comptage jc/p.j_plus_achat utilisé par le dashboard pour pitch/démo/J+3/J+10/J+21,
    // qui reste la source pour ces campagnes-là ; sert uniquement les nouvelles campagnes non
    // rattachées à un prospect.
    if (campagne) {
      fetch(`${SUPABASE_URL_INT}/rest/v1/funnel_events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, Prefer: 'return=minimal' },
        body: JSON.stringify({ type: 'achat', campagne, source: 'chariow', prospect_id: prospectId || null, user_id: userId })
      }).catch(e => console.error('[Attribution CRM] Échec écriture achat funnel_events:', e.message));
    }

    if (!prospectId) {
      console.log('[Attribution CRM] Aucun prospect CRM rattaché — achat non lié à un prospect (campagne enregistrée séparément si présente)');
      return;
    }

    const pRes = await fetch(`${SUPABASE_URL_INT}/rest/v1/prospects?id=eq.${prospectId}&select=id,notes,statut`, {
      headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
    });
    const prospects = await pRes.json();
    const prospect = prospects?.[0];
    if (!prospect) { console.warn('[Attribution CRM] Prospect introuvable:', prospectId); return; }

    let notes = {};
    try { notes = JSON.parse(prospect.notes || '{}'); } catch(e) {}
    notes.conversion_campagne = campagne || 'inconnue';
    notes.conversion_date = new Date().toISOString();

    await fetch(`${SUPABASE_URL_INT}/rest/v1/prospects?id=eq.${prospectId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ statut: 'acheteur', notes: JSON.stringify(notes) })
    });
    console.log(`[Attribution CRM] ✅ Prospect ${prospectId} marqué acheteur — converti via "${campagne}"`);
  } catch(e) {
    console.error('[Attribution CRM] Erreur:', e.message);
  }
}

// ── Accès administrateur au CRM : soit la clé du prospecteur (scripts du PC), soit la session Supabase de l'administrateur.
// La session est vérifiée auprès de Supabase à chaque appel (jamais décodée à la main) et doit appartenir à l'email admin.
const CRM_ADMIN_EMAIL = (process.env.CRM_ADMIN_EMAIL || 'thefirstquality01@gmail.com').toLowerCase();
async function crmAdminOk(req) {
  if (req.headers['x-api-key'] === 'adstack2024xProspectionKey99') return true;
  const tok = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
  if (!tok) return false;
  try {
    const r = await fetch(`${SUPABASE_URL_INT}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY_INT, Authorization: `Bearer ${tok}` } });
    if (!r.ok) return false;
    const me = await r.json();
    return (me.email || '').toLowerCase() === CRM_ADMIN_EMAIL;
  } catch (_) { return false; }
}


// ── Choix automatique d'UN CT (interface de test de l'agent Creative Image) ──
// L'agent voit TOUTE la galerie (image + nom + description + balises de chaque CT) et reçoit les mêmes entrées que la création :
// brief, photo produit, synthèse complète, consigne d'angle / niveau de conscience, assets réels du client.
const SELECTION_CT_SYSTEME = `Tu es le directeur artistique d'AdStack. Pour UNE créative publicitaire image Meta Ads, tu choisis UN SEUL Creative Template (CT) dans la galerie complète qui t'est montrée : chaque CT est une image de référence accompagnée de son identifiant, de son nom, de sa description et de ses balises.

Tu reçois tout ce que l'agent de création recevra : le brief client, la photo du produit, la synthèse complète de l'analyste de marché, la consigne d'angle et de niveau de conscience de CETTE créative, et les assets réels du client.

RÈGLE ABSOLUE — NIVEAU DE CONSCIENCE : le niveau de conscience de la créative est imposé et vérifié par le code. Une créative Most Aware se fait UNIQUEMENT avec un CT balisé Most Aware ; une créative Product Aware UNIQUEMENT avec un CT balisé Product Aware ; une créative Solution Aware UNIQUEMENT avec un CT balisé Solution Aware. Les CT qui te sont montrés ont déjà été filtrés en conséquence : ne choisis jamais un CT dont la balise contredit le niveau demandé. (Si un message précise qu'aucun CT n'est balisé à ce niveau, choisis alors la structure la plus proche du niveau demandé et dis-le dans ta raison.)

Méthode :
1. Comprends d'abord le produit, la cible, l'angle imposé et le niveau de conscience de cette créative.
2. Regarde réellement les images de la galerie. Les balises et descriptions peuvent être absentes ou incomplètes ; quand elles existent, elles sont une donnée pré-établie fiable (la conscience balisée surtout) et priment sur un jugement visuel refait de zéro.
3. Évalue chaque CT dans cet ordre de priorité strict (un niveau supérieur l'emporte toujours sur un niveau inférieur) :
   - NICHE : le CT est-il de la niche du produit ou d'une niche visuellement et conceptuellement proche ?
   - PRODUIT PRÉCIS : comment le produit y est introduit visuellement, et si c'est compatible avec CE produit (forme, usage, taille) et réalisable avec les assets réels du client (aspects photo, kit ou cadeaux, avis, logo, prix affichable).
   - ANGLE : le fond de l'angle imposé.
   - NIVEAU DE CONSCIENCE : Solution Aware = transformation (situation actuelle vers situation désirée) ou comparaison entre types de solutions, produit peu ou pas visible ; Product Aware = confiance envers ce produit précis, produit visible et central, jamais de prix ni d'offre ; Most Aware = structure promotionnelle, prix affiché, offre ou pack, urgence, appel à l'action direct.
   - TON : le registre du CT face au quadrant EPIC de l'angle (émotionnel, pratique, identitaire, critique).
4. Écarte tout CT impossible à réaliser avec les assets fournis ou qui contredit une contrainte du brief.
5. Départage les finalistes sur le visuel : le CT qui rendra la créative la plus convaincante pour cette cible précise.

Le choix doit résulter de ton propre raisonnement sur ces données, jamais d'un choix par défaut ni de l'ordre de la liste.

FORMAT : réponds UNIQUEMENT par un objet JSON sur une seule ligne, sans markdown ni backticks : {"id":"<identifiant exact du CT>","raison":"<2 à 4 phrases en français : pourquoi ce CT, et ce qui a fait écarter les finalistes>"}`;

// Niveau de conscience : valeurs balisées 'solution' | 'product' | 'most' (ou « Most Aware »…)
function niveauCT(v) {
  const t = String(v || '').toLowerCase();
  if (t.includes('most')) return 'most';
  if (t.includes('product')) return 'product';
  if (t.includes('solution')) return 'solution';
  if (t.includes('problem')) return 'problem';
  return '';
}
const NIVEAU_LIBELLE = { solution: 'Solution Aware', product: 'Product Aware', most: 'Most Aware', problem: 'Problem Aware' };
function construireSelectionCT(b) {
  const cts = Array.isArray(b.cts) ? b.cts : [];
  const parts = [];
  parts.push({ type: 'text', text: 'BRIEF CLIENT :\n' + String(b.briefTexte || '(non fourni)').slice(0, 12000) });
  if (b.productBase64) {
    parts.push({ type: 'text', text: 'PHOTO DU PRODUIT :' });
    parts.push({ type: 'image', source: { type: 'base64', media_type: b.productMime || 'image/jpeg', data: b.productBase64 } });
  }
  parts.push({ type: 'text', text: 'SYNTHÈSE COMPLÈTE DE L\'ANALYSTE DE MARCHÉ :\n' + String(b.synthese || '(non fournie)') });
  if (b.angleInstruction) parts.push({ type: 'text', text: 'CONSIGNE D\'ANGLE ET DE NIVEAU DE CONSCIENCE DE CETTE CRÉATIVE :\n' + b.angleInstruction });
  if (b.niveauTexte) parts.push({ type: 'text', text: b.niveauTexte });
  if (b.assets && String(b.assets).trim()) parts.push({ type: 'text', text: 'ASSETS RÉELS DU CLIENT :\n' + String(b.assets).slice(0, 2500) });
  if (Array.isArray(b.excludeIds) && b.excludeIds.length) parts.push({ type: 'text', text: 'CT déjà utilisés au lot précédent pour ce produit (à éviter) : ' + b.excludeIds.join(', ') });
  parts.push({ type: 'text', text: '━━━ GALERIE COMPLÈTE : ' + cts.length + ' CT ━━━' });
  cts.forEach((ct, i) => {
    let ligne = 'CT ' + (i + 1) + ' — ID : ' + ct.id + ' — « ' + (ct.name || ct.id) + ' »' + (ct.meta ? ' — ' + ct.meta : '');
    if (ct.niche) ligne += ' [niche : ' + ct.niche + ']';
    if (ct.awareness && ct.awareness.length) ligne += ' [conscience balisée : ' + ct.awareness.join('/') + ']';
    if (ct.styleTags && ct.styleTags.length) ligne += ' [style : ' + ct.styleTags.join(', ') + ']';
    parts.push({ type: 'text', text: ligne });
    if (ct.b64) parts.push({ type: 'image', source: { type: 'base64', media_type: ct.mime || 'image/jpeg', data: ct.b64 } });
  });
  parts.push({ type: 'text', text: 'Choisis maintenant LE CT pour cette créative. Réponds uniquement avec le JSON demandé.' });
  return parts;
}

function lireChoixCT(raw, cts) {
  const texte = String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  const ids = new Set((cts || []).map(c => c.id));
  let id = null, raison = '';
  try {
    const d = texte.indexOf('{'), f = texte.lastIndexOf('}');
    if (d !== -1 && f > d) { const j = JSON.parse(texte.slice(d, f + 1)); id = j.id; raison = j.raison || ''; }
  } catch (_) {}
  if (!id || !ids.has(id)) { const m = [...texte.matchAll(/ct_[a-zA-Z0-9_]+/g)].map(x => x[0]).find(x => ids.has(x)); if (m) id = m; }
  if (!id || !ids.has(id)) throw new Error('Choix de CT illisible ou hors galerie : ' + texte.slice(0, 300));
  return { id, raison: String(raison).trim() };
}

async function findUserByEmail(email) {
  if (!email) return null;
  // ⚠️ L'API Admin Supabase ignore silencieusement ?email=... et renvoie TOUS les utilisateurs.
  // On doit donc filtrer nous-mêmes, sinon on récupère un utilisateur au hasard (bug confirmé, cf. supabase/supabase#29832).
  const r = await fetch(`${SUPABASE_URL_INT}/auth/v1/admin/users?per_page=1000`, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    }
  });
  const data = await r.json();
  const users = data?.users || [];
  const normalizedTarget = email.trim().toLowerCase();
  const match = users.find(u => u.email?.trim().toLowerCase() === normalizedTarget);
  return match || null;
}

// ── HTTP Server ────────────────────────────────
const server = http.createServer(async (req, res) => {
  // CORS — Cause profonde corrigée (save-deliverables bloqué à 100% depuis
  // www.adstackofficial.com, "Access-Control-Allow-Origin must not be the wildcard '*' when
  // the request's credentials mode is 'include'") : un wildcard statique est rejeté par le
  // navigateur dès qu'une requête est considérée "credentialed" — peu importe la raison exacte
  // (cookies déjà présents pour ce domaine, comportement Chrome récent, etc.), la requête
  // n'atteignait jamais le serveur, bloquée en amont. Autosave semblait tourner sans erreur
  // (aucun log serveur, puisque rien n'arrivait jamais) pendant que la base gardait
  // éternellement le tout premier contenu sauvegardé avec succès — exactement le symptôme
  // "toujours le batch du lancement 1" remonté. Reflet dynamique de l'origine exacte de la
  // requête à la place — reste ouvert à n'importe quel domaine (comportement identique au
  // wildcard pour la sécurité), mais compatible avec les requêtes credentialed.
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');
  // Cause profonde corrigée ("Failed to fetch" sur la suppression d'une carte démo dans
  // Factory) : DELETE n'était pas dans la liste des méthodes autorisées — le navigateur
  // rejette la requête au niveau CORS avant même qu'elle atteigne le serveur, quel que soit
  // l'état du serveur (endormi ou non). PATCH ajouté aussi par précaution, déjà utilisé
  // ailleurs (CRM, AdBoard) et sujet au même risque.
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, DELETE, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, ngrok-skip-browser-warning, Authorization, X-Api-Key');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // GET / → redirect vers le site web systeme.io
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    res.writeHead(302, { 'Location': 'https://thefirstquality01.systeme.io/' });
    res.end();
    return;
  }

  // GET /health — Usine server status
  if (req.method === 'GET' && req.url === '/modeles') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(etatModeles(), null, 1));
    return;
  }
  if (req.method === 'GET' && req.url === '/couts') {
    const lignes = Object.entries(_COUTS_AGENTS).map(([agent, r]) => ({ agent, appels: r.appels, total_usd: Math.round(r.usd * 1000) / 1000, productions: r.productions, derniere_production_usd: Math.round(r.derniere_usd * 1000) / 1000, moyenne_par_production_usd: r.productions ? Math.round(r.usd / r.productions * 1000) / 1000 : null, tokens_entree: r.tok_in, tokens_sortie_et_reflexion: r.tok_out, recherches_google: r.recherches }));
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ depuis_demarrage: true, plafond_hypothese_usd: COUT_MAX_HYPOTHESE, tarifs: TARIFS, agents: lignes, total_usd: Math.round(lignes.reduce((n, l) => n + l.total_usd, 0) * 1000) / 1000, note: 'Estimation à partir des tokens et recherches comptés ; ScrapeCreators et vidéo (ElevenLabs/Veo du service vidéo) non inclus. Remis à zéro à chaque redémarrage du serveur.' }));
    return;
  }
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, version: 'v5.72-analyste-budget', balayage: typeof decideBalayage === 'function', scrapecreators_cle: !!SC_KEY }));
    return;
  }

  // GET /master-creative — serve MASTER_CREATIVE.md from server directory
  if (req.method === 'GET' && (req.url === '/master-creative' || req.url === '/master-creative.md')) {
    const candidates = [
      path.join(__dirname, 'MASTER_CREATIVE.md'),
      path.join(__dirname, '..', 'MASTER_CREATIVE.md')
    ];
    const found = candidates.find(p => fs.existsSync(p));
    if (found) {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(fs.readFileSync(found, 'utf8'));
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('MASTER_CREATIVE.md not found');
    }
    return;
  }

  // GET /factory → AdStack Usine platform
  // Cherche tout fichier adstack_usine_v0*.html dans le dossier (peu importe le suffixe)
  if (req.method === 'GET' && (req.url === '/factory' || req.url === '/factory/')) {
    let usineFile = null;
    try {
      const files = fs.readdirSync(__dirname);
      const matches = files.filter(f => /^adstack_usine_v0.*\.html$/i.test(f));
      if (matches.length > 0) {
        matches.sort((a, b) => {
          const sa = fs.statSync(path.join(__dirname, a)).mtimeMs;
          const sb = fs.statSync(path.join(__dirname, b)).mtimeMs;
          return sb - sa;
        });
        usineFile = path.join(__dirname, matches[0]);
        console.log(`→ Serving: ${matches[0]}`);
      }
    } catch(e) {
      console.error('readdirSync error:', e.message);
    }

    if (usineFile && fs.existsSync(usineFile)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(usineFile));
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(HTML_CONTENT);
    }
    return;
  }

  // ── POST /save-mindmap — save personalized mindmap HTML (+ OG preview image/meta), return permanent URL ──
  if (req.method === 'POST' && req.url === '/save-mindmap') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { html, productName, marque, ogTitle, score } = JSON.parse(body);
        if (!html || typeof html !== 'string') throw new Error('html field required');
        if (html.length > 50_000_000) throw new Error('HTML too large (max 50MB)');

        // Slug: marque + produit + id court → ex: adstack-the-anti-diabetique-kp3x
        const marqueSlug = slugify(marque || 'adstack');
        const produitSlug = slugify(productName || 'demo');
        const id = randomId(6);
        const filename = `${marqueSlug}-${produitSlug}-${id}`;
        const filepath = path.join(MINDMAPS_DIR, `${filename}.html`);
        const url = `${PUBLIC_URL}/demo/${filename}`;

        let finalHtml = html;

        // ── Image OG (miniature WhatsApp/réseaux) — teaser généré server-side, style mindmap ──
        try {
          const svg = buildTeaserSvg({ marque: marque || productName, score });
          const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
          const imgFilename = `${filename}.png`;

          // Sauvegarder en local (fallback)
          fs.writeFileSync(path.join(MINDMAPS_DIR, imgFilename), png);

          // ── Upload vers Supabase Storage (URL permanente, indépendante du serveur) ──
          let ogImageUrl = `${PUBLIC_URL}/demo/${imgFilename}`; // fallback local
          try {
            // Cause profonde corrigée (egress/quota Supabase qui grimpe en continu) : ce bloc
            // écrivait CHAQUE nouvelle démo sur l'ancien projet, celui qu'on garde en lecture
            // seule pour l'historique — jamais celui qu'on utilise activement. Chaque démo créée
            // depuis la migration continuait donc de gonfler un projet déjà proche de sa limite,
            // au lieu du nouveau. Bascule vers SUPABASE_URL_INT (projet actif), clé service
            // cohérente avec le reste du fichier plutôt que l'ancienne clé anonyme codée en dur.
            const SB_URL = SUPABASE_URL_INT;
            const sbHeaders = { 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'apikey': SUPABASE_SERVICE_KEY };
            const sbHostname = new URL(SUPABASE_URL_INT).hostname;

            // Créer le bucket s'il n'existe pas
            await new Promise((res) => {
              const body = JSON.stringify({ id: 'demos', name: 'demos', public: true });
              const r = https.request({
                hostname: sbHostname,
                path: '/storage/v1/bucket',
                method: 'POST',
                headers: { ...sbHeaders, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
              }, resp => { resp.on('data', ()=>{}); resp.on('end', res); });
              r.on('error', res); r.write(body); r.end();
            });

            // Upload du PNG
            const uploadRes = await new Promise((resolve, reject) => {
              const r = https.request({
                hostname: sbHostname,
                path: `/storage/v1/object/demos/${imgFilename}`,
                method: 'POST',
                headers: { ...sbHeaders, 'Content-Type': 'image/png', 'Content-Length': png.length, 'x-upsert': 'true' }
              }, resp => {
                let d = '';
                resp.on('data', c => d += c);
                resp.on('end', () => resolve({ status: resp.statusCode, body: d }));
              });
              r.on('error', reject); r.write(png); r.end();
            });

            if (uploadRes.status === 200 || uploadRes.status === 201) {
              // Cause profonde corrigée (grosse part de l'egress Supabase) : ogImageUrl était
              // réécrite ici pour pointer DIRECTEMENT vers Supabase — chaque partage WhatsApp/
              // réseaux du lien de démo déclenchait alors une requête directe à Supabase pour
              // l'aperçu, sans jamais passer par le cache local de Render. Reste maintenant sur
              // l'URL Render (déjà écrite en local juste avant ce bloc) — Supabase ne sert plus
              // que de sauvegarde de secours, lue uniquement si le disque local a été effacé
              // (voir /demo/:slug.ext, qui a maintenant son propre repli Supabase avec cache).
              console.log(`   → OG image sauvegardée sur Supabase (secours) : ${SB_URL}/storage/v1/object/public/demos/${imgFilename}`);
            } else {
              console.log(`   ⚠️  Supabase upload échoué (${uploadRes.status}) : ${uploadRes.body.substring(0,100)}`);
            }
          } catch(sbErr) {
            console.log(`   ⚠️  Supabase upload erreur : ${sbErr.message}`);
          }

          const escAttr = (s) => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
          const ogTitleStr = ogTitle || (marque ? `${marque} — Démo AdStack` : (productName || 'AdStack'));
          const ogDescStr  = `Analyse de marché, persona cible et créatives Meta Ads sur-mesure. Score potentiel : ${score}/100.`;
          const metaTags = `
    <meta property="og:type" content="website">
    <meta property="og:title" content="${escAttr(ogTitleStr)}">
    <meta property="og:description" content="${escAttr(ogDescStr)}">
    <meta property="og:image" content="${ogImageUrl}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:type" content="image/png">
    <meta property="og:url" content="${url}">
    <meta property="og:site_name" content="AdStack">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escAttr(ogTitleStr)}">
    <meta name="twitter:description" content="${escAttr(ogDescStr)}">
    <meta name="twitter:image" content="${ogImageUrl}">
    <meta name="description" content="${escAttr(ogDescStr)}">
    <script>
      // Redirect humains vers AdBoard — seulement si PAS dans un iframe
      (function(){
        if (window.self !== window.top) return; // dans un iframe = ne pas redirect
        var ua = navigator.userAgent || '';
        var isBot = /WhatsApp|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Googlebot|Slackbot|Discordbot/i.test(ua);
        if (!isBot) {
          window.location.replace('/adboard?demo=${filename}');
        }
      })();
    </script>
`;

          if (/<head[^>]*>/i.test(finalHtml)) {
            finalHtml = finalHtml.replace(/<head[^>]*>/i, (m) => m + metaTags);
          } else {
            finalHtml = metaTags + finalHtml;
          }
          console.log(`   → OG teaser généré : ${imgFilename} (${(png.length/1024).toFixed(1)}KB, score ${score})`);
        } catch (e) {
          console.log('   ⚠️  Génération teaser OG échouée (mindmap sauvée sans miniature) :', e.message);
        }

        fs.writeFileSync(filepath, finalHtml, 'utf-8');

        // ── Upload HTML vers Supabase Storage — survit aux redéploiements du serveur (disque Render éphémère) ──
        try {
          // Même correctif que le bloc image OG juste au-dessus — voir son commentaire pour la
          // cause profonde (egress qui grimpait en continu sur l'ancien projet, plus utilisé).
          const SB_URL = SUPABASE_URL_INT;
          const sbHeaders = { 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'apikey': SUPABASE_SERVICE_KEY };
          const sbHostname = new URL(SUPABASE_URL_INT).hostname;
          const htmlBuffer = Buffer.from(finalHtml, 'utf-8');

          // Créer le bucket s'il n'existe pas (idempotent, indépendant du bloc image OG plus haut)
          await new Promise((res) => {
            const bBody = JSON.stringify({ id: 'demos', name: 'demos', public: true });
            const r = https.request({
              hostname: sbHostname,
              path: '/storage/v1/bucket',
              method: 'POST',
              headers: { ...sbHeaders, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bBody) }
            }, resp => { resp.on('data', ()=>{}); resp.on('end', res); });
            r.on('error', res); r.write(bBody); r.end();
          });

          const uploadRes = await new Promise((resolve, reject) => {
            const r = https.request({
              hostname: sbHostname,
              path: `/storage/v1/object/demos/${filename}.html`,
              method: 'POST',
              headers: { ...sbHeaders, 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': htmlBuffer.length, 'x-upsert': 'true' }
            }, resp => {
              let d = '';
              resp.on('data', c => d += c);
              resp.on('end', () => resolve({ status: resp.statusCode, body: d }));
            });
            r.on('error', reject); r.write(htmlBuffer); r.end();
          });

          if (uploadRes.status === 200 || uploadRes.status === 201) {
            console.log(`   → HTML sauvegardé sur Supabase (survit aux redéploiements) : ${filename}.html`);
          } else {
            console.log(`   ⚠️  Upload HTML Supabase échoué (${uploadRes.status}) : ${uploadRes.body.substring(0,100)}`);
          }
        } catch(sbErr) {
          console.log(`   ⚠️  Upload HTML Supabase erreur : ${sbErr.message}`);
        }

        console.log(`✓ Mindmap saved: ${filename}.html (${(finalHtml.length/1024).toFixed(1)}KB)`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ url, slug: filename }));
      } catch(e) {
        console.error('save-mindmap error:', e.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ── GET /demo/:slug(.ext) — serve a saved mindmap or its OG preview image ──
  if (req.method === 'GET' && req.url.startsWith('/demo/')) {
    console.log(`[/demo/] Requête reçue : ${req.url}`);
    // Cause profonde corrigée (miniatures fixes introuvables, "Not found" alors qu'elles
    // existent bien) : ce filtre retirait les underscores — "adstack_thumb_main.png" devenait
    // "adstackthumbmain.png", que ni le disque local ni Supabase ne pouvaient jamais trouver.
    // Les slugs de démos (UUID/tirets) n'étaient jamais affectés, d'où un bug invisible jusqu'ici.
    const raw = req.url.slice(6).split('?')[0].replace(/[^a-zA-Z0-9_\-.]/g, '');
    const ext = path.extname(raw).toLowerCase();
    const contentTypes = { '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.webp':'image/webp' };

    if (ext && contentTypes[ext]) {
      // Image OG (miniature WhatsApp/réseaux)
      const filepath = path.join(MINDMAPS_DIR, raw);
      console.log(`[/demo/] Nom nettoyé : "${raw}" · Chemin local vérifié : ${filepath}`);
      if (fs.existsSync(filepath)) {
        console.log(`[/demo/] ✓ Trouvé sur le disque local`);
        res.writeHead(200, { 'Content-Type': contentTypes[ext], 'Cache-Control': 'public, max-age=86400' });
        res.end(fs.readFileSync(filepath));
        return;
      }
      // Cause profonde corrigée : cette image n'avait AUCUN repli Supabase — elle 404ait dès que
      // le disque local était vide (chaque redéploiement), même si le fichier existait bien sur
      // Supabase. Ajouté ici le même mécanisme que pour le HTML : récupération + réécriture en
      // cache local, pour ne plus jamais retélécharger le même fichier à chaque requête.
      // Repli vers le projet ACTIF (pas l'ancien) — ces fichiers y existent aussi depuis la
      // migration complète du bucket. Reste possible que ça échoue quand même si le quota
      // d'egress est partagé au niveau de l'organisation entière (les deux projets dans le même
      // pot commun) plutôt que par projet — à vérifier si le 402 persiste malgré ce changement.
      const supabaseImgUrl = `${SUPABASE_URL_INT}/storage/v1/object/public/demos/${raw}`;
      console.log(`[/demo/] ✗ Absent du disque local — tentative Supabase : ${supabaseImgUrl}`);
      https.get(supabaseImgUrl, sbRes => {
        console.log(`[/demo/] Réponse Supabase : HTTP ${sbRes.statusCode}`);
        if (sbRes.statusCode === 200) {
          let chunks = [];
          sbRes.on('data', c => chunks.push(c));
          sbRes.on('end', () => {
            const buf = Buffer.concat(chunks);
            try { fs.writeFileSync(filepath, buf); } catch(eCache) { console.warn('[Demo] Réécriture cache image locale échouée :', eCache.message); }
            res.writeHead(200, { 'Content-Type': contentTypes[ext], 'Cache-Control': 'public, max-age=86400' });
            res.end(buf);
          });
        } else {
          res.writeHead(404); res.end('Not found');
        }
      }).on('error', (eReq) => { console.log(`[/demo/] ✗ Erreur requête Supabase : ${eReq.message}`); res.writeHead(404); res.end('Not found'); });
      return;
    }

    // Mindmap HTML (slug sans extension)
    const slug = raw.replace(/\.[^.]*$/, '');
    const filepath = path.join(MINDMAPS_DIR, `${slug}.html`);
    if (fs.existsSync(filepath)) {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600'
      });
      res.end(fs.readFileSync(filepath));
      return;
    }

    // ── Fallback Supabase — le fichier local a disparu (redéploiement du serveur = disque effacé) ──
    // Cause probable d'une grosse partie de l'egress Supabase : ce repli ne réécrivait jamais le
    // fichier récupéré sur le disque local. Chaque requête suivante (potentiellement des dizaines
    // par démo, vu la fréquence des redéploiements sur ce projet) retéléchargeait les mêmes 300+
    // Ko depuis Supabase, encore et encore, plutôt qu'une seule fois jusqu'au prochain déploiement.
    const notFoundHtml = '<h1 style="font-family:sans-serif;color:#999;text-align:center;padding:80px;">Mindmap introuvable ou expirée</h1>';
    const supabaseHtmlUrl = `${SUPABASE_URL_INT}/storage/v1/object/public/demos/${slug}.html`;
    https.get(supabaseHtmlUrl, sbRes => {
      if (sbRes.statusCode === 200) {
        let chunks = [];
        sbRes.on('data', c => chunks.push(c));
        sbRes.on('end', () => {
          const buf = Buffer.concat(chunks);
          try { fs.writeFileSync(filepath, buf); } catch(eCache) { console.warn('[Demo] Réécriture cache locale échouée :', eCache.message); }
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=3600'
          });
          res.end(buf);
        });
      } else {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(notFoundHtml);
      }
    }).on('error', () => {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(notFoundHtml);
    });
    return;
  }

  // ── Prospection auto — relais vers le wrapper local (PC via tunnel Cloudflare) ──
  const PROSPECTOR_URL = 'https://prospector.adstackofficial.com';
  const PROSPECTOR_KEY = 'adstack2024xProspectionKey99';

  function relayToProspector(path, method, res) {
    console.log(`[Prospector Relay] ${method} ${path} → ${PROSPECTOR_URL}${path}`);
    const target = new URL(PROSPECTOR_URL + path);
    const options = {
      hostname: target.hostname,
      path: target.pathname + target.search,   // .search inclus — sinon ?since=X est perdu
      method,
      headers: { 'X-Api-Key': PROSPECTOR_KEY }
    };
    const r = https.request(options, pRes => {
      let body = '';
      pRes.on('data', c => body += c);
      pRes.on('end', () => {
        console.log(`[Prospector Relay] Réponse ${pRes.statusCode} : ${body.slice(0, 150)}`);
        res.writeHead(pRes.statusCode || 200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
        });
        res.end(body || '{}');
      });
    });
    r.on('error', (e) => {
      console.log(`[Prospector Relay] ⚠️  Erreur réseau : ${e.message}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ running: false, error: 'PC hors ligne ou tunnel arrêté : ' + e.message }));
    });
    r.setTimeout(15000, () => {
      console.log('[Prospector Relay] ⚠️  Timeout — PC probablement hors ligne');
      r.destroy(new Error('Timeout — PC probablement hors ligne'));
    });
    r.end();
  }

  if (req.url.startsWith('/prospector/') && ['/prospector/start','/prospector/stop','/prospector/status'].some(r => req.url.startsWith(r)) && !(await crmAdminOk(req))) {
    res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'unauthorized' })); return;
  }
  if (req.method === 'POST' && req.url.startsWith('/prospector/start')) {
    relayToProspector(req.url, 'POST', res);
    return;
  }
  if (req.method === 'POST' && req.url.startsWith('/prospector/stop')) {
    relayToProspector(req.url, 'POST', res);
    return;
  }
  if (req.method === 'GET' && req.url.startsWith('/prospector/status')) {
    relayToProspector(req.url, 'GET', res);
    return;
  }

  // Generate endpoint
  if (req.method === 'POST' && req.url === '/generate') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const reqBody = JSON.parse(body);
        console.log('→ Getting token...');
        const token = await getToken();
        console.log('✓ Token OK');

        console.log(`→ Calling ${MODEL}...`);
        const vertexBody = {
          contents: [{ role: 'user', parts: reqBody.contents[0].parts }],
          generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
        };
        const data = await vertexRequest(token, MODEL, vertexBody);

        if (data.error) throw new Error(data.error.message);

        const parts = data.candidates?.[0]?.content?.parts || [];
        const img = parts.find(p => (p.inlineData || p.inline_data)?.mimeType?.startsWith('image/') || (p.inlineData || p.inline_data)?.mime_type?.startsWith('image/'));
        if (!img) throw new Error('Pas d\'image dans la réponse Vertex AI.');

        const d = img.inlineData || img.inline_data;
        console.log(`✓ Image reçue — ${MODEL}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ model: MODEL, imageData: d.data, imageMime: d.mimeType || d.mime_type }));
      } catch(e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }


  // ── Text Generation endpoint (Prompt Engine) ──
  if (req.method === 'POST' && req.url === '/generate-text') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const reqBody = JSON.parse(body);
        console.log('→ Getting token (text gen)...');
        const token = await getToken();
        console.log('✓ Token OK');

        const model = reqBody.model || MODELES.utilitaire;
        console.log(`→ Calling ${model} (text)...`);
        // Aucun thinkingConfig n'était fixé ici — ce endpoint générique sert notamment à tester
        // des agents directement, donc reçoit potentiellement des prompts complexes de skill
        // complète. Défaut raisonnable fixé, personnalisable par l'appelant via reqBody.
        const vertexBody = {
          system_instruction: { parts: [{ text: reqBody.system }] },
          contents: [{ role: 'user', parts: reqBody.parts }],
          generationConfig: {
            temperature: reqBody.temperature !== undefined ? reqBody.temperature : 0.7,
            maxOutputTokens: reqBody.maxOutputTokens || reqBody.maxTokens || 32000,
            ...reflexion(MODELES.utilitaire, reqBody.thinkingBudget !== undefined ? reqBody.thinkingBudget : 8192)
          }
        };

        const data = await vertexRequest(token, model, vertexBody);
        if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (!text) throw new Error('Pas de texte dans la réponse Vertex AI.');

        console.log('✓ Texte reçu — gemini-2.5-flash');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ text }));
      } catch(e) {
        console.error('✗ Erreur text gen:', e.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ── Fetch + extraction IA d'une page produit (pré-remplissage formulaire AdBoard) ──
  // N'invente jamais : si la page n'est pas une fiche produit exploitable, ou si un champ
  // n'est pas explicitement présent, on renvoie null pour ce champ plutôt que de deviner.
  if (req.method === 'POST' && req.url === '/fetch-product-info') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { url } = JSON.parse(body);
        if (!url || !/^https?:\/\//.test(url)) throw new Error('URL invalide');
        console.log(`→ Fetch fiche produit: ${url}`);
        // avecImages=true — récupère aussi les URLs d'images de la page (galerie/carrousel),
        // en plus du texte habituel. Voir fetchPageText pour l'extraction elle-même.
        const [paquetBrut, shop, rendu] = await Promise.all([
          fetchPageText(url, 0, true).catch(e => { console.log(`   [fiche-auto] page non lisible : ${e.message}`); return null; }),
          enrichirShopify(url),
          fetchPageRendue(url, { tempsMax: 40000, clics: 5, maxAvis: 30 }).catch(() => null),
        ]);
        // v5.56 — version affichée par un vrai navigateur : texte complet (avis, FAQ…) + images/logo/couleurs du DOM final.
        let paquetRendu = null;
        if (rendu && rendu.html) { try { paquetRendu = await fetchPageText(rendu.urlFinale || url, 0, true, rendu.html); } catch (e) { paquetRendu = null; } }
        const brutLong = paquetBrut ? paquetBrut.text.length : 0;
        const choisi = (paquetRendu && paquetRendu.text.length >= Math.max(200, brutLong * 0.6)) ? paquetRendu : paquetBrut;
        const autre = choisi === paquetRendu ? paquetBrut : paquetRendu;
        const fusion = choisi ? {
          ...choisi,
          images: [...(choisi.images || []), ...((autre && autre.images) || [])],
          logo: choisi.logo || (autre && autre.logo) || null,
          couleurs: (choisi.couleurs && choisi.couleurs.length) ? choisi.couleurs : ((autre && autre.couleurs) || []),
          extras: { ...(choisi.extras || {}), avis: [...new Set([...((choisi.extras && choisi.extras.avis) || []), ...((autre && autre.extras && autre.extras.avis) || [])])].slice(0, 15), note: (choisi.extras && choisi.extras.note) || (autre && autre.extras && autre.extras.note) || null, bandeau: (choisi.extras && choisi.extras.bandeau) || (autre && autre.extras && autre.extras.bandeau) || '' },
          urlFinale: (paquetBrut && paquetBrut.urlFinale) || (rendu && rendu.urlFinale) || url,
        } : null;
        const paquet = fusion || { text: '', images: [], logo: null, couleurs: [], extras: { avis: [], note: null, bandeau: '', description: '' } };
        if (!paquetBrut && !(shop && shop.produit)) throw new Error('Page illisible');
        // v5.55 — redirection de langue / de pays : beaucoup de boutiques (Shopify Markets) renvoient vers /en-us/, /fr-fr/… d'après la
        // localisation DU SERVEUR (Render, États-Unis), pas celle du client. On le détecte pour ne pas prendre ce marché pour le sien.
        const locDe = (u) => { try { const m = new URL(u).pathname.match(/^\/([a-z]{2}(?:-[a-z]{2})?)(?=\/)/i); return m ? m[1].toLowerCase() : ''; } catch (e) { return ''; } };
        const locOrigine = locDe(url), locFinale = locDe(paquet.urlFinale || url);
        const redirectionLocale = !!(locFinale && locFinale !== locOrigine);
        const extras = paquet.extras || { avis: [], note: null, bandeau: '', description: '' };
        // v5.52 — le texte envoyé à Gemini = données officielles Shopify + bandeau + note/avis balisés + politiques + texte de la page.
        const blocs = [];
        if (shop && shop.produit) {
          const p = shop.produit;
          blocs.push(`DONNÉES OFFICIELLES DU PRODUIT (fichier de la boutique) :\nTitre : ${p.titre}\n${p.prix != null ? `Prix : ${p.prix}${p.ancien_prix && p.ancien_prix > p.prix ? ` (ancien prix ${p.ancien_prix})` : ''}\n` : ''}${p.variantes.length ? `Formules / variantes : ${p.variantes.join(' · ')}\n` : ''}Description : ${p.description}`);
        }
        if (rendu && rendu.avis && rendu.avis.length) {
          let tot = 0; const cartes = [];
          for (const a of rendu.avis) { if (tot + a.length > 30000) break; cartes.push(a); tot += a.length; }
          blocs.push('AVIS CLIENTS AFFICHÉS DANS LE NAVIGATEUR (chargés par JavaScript ; chaque bloc = une carte d\'avis exacte : nom, note, date, titre, texte) :\n' + cartes.map(a => '---\n' + a).join('\n'));
        }
        if (extras.bandeau) blocs.push(`BANDEAU D'ANNONCE DU SITE : ${extras.bandeau}`);
        if (extras.note) blocs.push(`NOTE MOYENNE AFFICHÉE : ${extras.note.valeur}/5${extras.note.nombre ? ` sur ${extras.note.nombre} avis` : ''}`);
        if (extras.avis.length) blocs.push('AVIS CLIENTS BALISÉS SUR LA PAGE :\n' + extras.avis.map(a => '- ' + a).join('\n'));
        if (shop && shop.remboursement) blocs.push(`POLITIQUE DE RETOUR / REMBOURSEMENT (page officielle de la boutique) :\n${shop.remboursement}`);
        if (shop && shop.livraison) blocs.push(`POLITIQUE DE LIVRAISON (page officielle de la boutique) :\n${shop.livraison}`);
        if (redirectionLocale) blocs.unshift(`NOTE TECHNIQUE IMPORTANTE : l'adresse collée par le client (${url}) a été redirigée automatiquement vers une version locale « /${locFinale}/ » choisie d'après la localisation du serveur d'AdStack (États-Unis), PAS d'après le client. Le marché réel du client est donc incertain : cherche ses indices dans l'adresse d'origine (langue du nom du produit et des paramètres, par exemple « Couleur=Noir&Taille=S » est du français) et dans le nom de domaine. Pour « pays » et pour la langue des champs, privilégie ces indices d'origine sur la devise et la langue de la version redirigée ; si le doute reste réel, renvoie pays à null.`);
        const pageText = (blocs.length ? blocs.join('\n\n') + '\n\nTEXTE DE LA PAGE (suite) :\n' : '') + paquet.text;
        // images : celles du fichier boutique d'abord (galerie complète), puis celles de la page, sans doublon
        const cleImg = (u) => { try { const x = new URL(u); return x.origin + x.pathname.replace(/_(\d+x\d*|\d*x\d+)(?=\.)/, ''); } catch (e) { return u; } };
        const vuesImg = new Set();
        const images = [...((shop && shop.produit && shop.produit.images) || []), ...(paquet.images || [])].filter(u => { const c = cleImg(u); if (vuesImg.has(c)) return false; vuesImg.add(c); return true; }).slice(0, 12);
        const logoPage = paquet.logo || null;
        const candidatsCouleurs = paquet.couleurs || [];
        if (!pageText || pageText.length < 80) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, data: null, reason: 'page_vide' }));
          return;
        }

        const extractPrompt = `Tu reçois le texte brut d'une page web (URL : ${url}) — et, quand elles ont pu être téléchargées, des images candidates numérotées de la page — et le nom de produit qu'on y cherche apparaît généralement dans le slug de cette URL. Détermine si c'est une fiche produit e-commerce, et si oui, extrais UNIQUEMENT les informations explicitement présentes — n'invente rien, ne déduis rien qui ne soit pas écrit noir sur blanc. Seuls trois champs échappent à cette règle et suivent leurs propres consignes données plus bas : « cible », « couleurs » et « images ».\n\nLANGUE : les systèmes AdStack servent n'importe quel marché du monde (États-Unis, Inde, Japon, Brésil, Afrique…). Détermine la langue du MARCHÉ à partir de la page (langue du texte de vente, devise, pays de livraison) et remplis TOUS les champs textuels (nom, prix, pays, utilité, promo, garantie, livraison_paiement, cible) dans cette langue de marché, jamais en français par défaut : une page américaine donne des champs en anglais, une page japonaise en japonais. Chiffres, devises et durées inchangés. « avis » reste mot pour mot, dans la langue d'origine. Seule une page en français donne des champs en français. Le texte peut commencer par des blocs « DONNÉES OFFICIELLES », « POLITIQUE DE RETOUR », « POLITIQUE DE LIVRAISON », « AVIS BALISÉS », « AVIS CLIENTS AFFICHÉS DANS LE NAVIGATEUR » (pour les avis, recopie uniquement le TEXTE de l'avis, titre compris s'il y en a un, sans nom, date ni mentions « Verified Buyer » ; ajoute le prénom entre parenthèses) : ce sont des sources fiables de CETTE page, à utiliser pour garantie, livraison et avis.

ATTENTION — désambiguïsation importante : beaucoup de fiches produit affichent aussi, plus loin sur la page, un tableau comparatif ou une liste "produits similaires/vous aimerez aussi/fréquemment achetés ensemble" listant D'AUTRES produits avec leurs propres noms et prix. N'extrais JAMAIS les infos de ces autres produits. Le VRAI produit de cette page est celui qui : (1) correspond au slug de l'URL ci-dessus, (2) apparaît le premier dans le texte, généralement juste avant ou après un bouton "Ajouter au panier"/"Acheter", (3) est répété plusieurs fois dans la page (titre, description détaillée, FAQ) — pas une simple mention isolée dans une liste comparative.

Réponds en JSON strict, uniquement l'objet, aucun texte autour, aucun bloc markdown :
{"nom":"nom du produit ou null","prix":"le prix COMPLET du produit, AVEC sa devise. S'il n'y a qu'un seul prix, donne-le simplement (ex: '13 900 FCFA'). S'il y a PLUSIEURS paliers/formules (ex: 1 mois / 2 mois / 3 mois, ou 1 unité / pack de 3 / pack de 5), liste-les TOUS, séparés par ' · ', chacun avec son propre prix et sa remise si affichée (ex: '19 000 FCFA (1 mois) · 36 100 FCFA (2 mois, -5%) · 51 300 FCFA (3 mois, -10%)') — jamais un seul prix choisi arbitrairement parmi plusieurs, jamais un nombre seul sans devise, null si aucun prix identifiable","pays":"pays/marché de vente : explicitement mentionné, OU clairement déductible de la devise et des zones de livraison affichées (ex : « $ » + « free US shipping » → United States ; FCFA + livraison à Dakar → Sénégal), écrit dans la langue du marché ; plusieurs possibles séparés par virgule ; null si rien ne permet de le dire","utilite":"à quoi sert le produit, en une phrase de deux lignes maximum, basée sur la description de la page, ou null","promo":"offre promotionnelle GÉNÉRALE, distincte des paliers de prix ci-dessus — seuil de livraison gratuite, BOGO (achetez-en X recevez-en Y), cadeau offert, code promo affiché, etc. (ex: 'Livraison gratuite dès 50 000 FCFA', '2 achetés = 1 offert') — jamais une remise déjà comptée dans un palier de prix, null si aucune","garantie":"garantie ou politique de retour / remboursement / échange EXPLICITEMENT écrite sur la page, recopiée fidèlement et brièvement (ex: 'Satisfait ou remboursé 30 jours'), null si la page n'en dit rien","livraison_paiement":"modes de paiement et conditions de livraison EXPLICITEMENT écrits sur la page (ex: 'Paiement à la livraison. Livraison en 48 h à Dakar'), recopiés fidèlement et brièvement, null si la page n'en dit rien","avis":["jusqu'à 15 avis clients ÉCRITS sur la page de CE produit, recopiés MOT POUR MOT tels qu'affichés (aucune reformulation, aucune correction, aucune invention, jamais un avis d'un autre produit), chacun suivi du prénom entre parenthèses s'il est affiché ; liste vide [] si la page ne contient aucun avis écrit"],"cible":"UNE seule phrase de 35 mots maximum décrivant à qui s'adresse ce produit, selon ces règles : (1) décris une SITUATION VÉCUE et une tension psychologique précise — un comportement observable, un réflexe ou une phrase que la personne se dit, ce contre quoi elle se bat concrètement — jamais une fiche démographique ; (2) n'indique ni métier, ni âge exact, ni tranche d'âge serrée : la démographie reste LARGE, la netteté vient du comportement et de la situation ; (3) la personne doit pouvoir s'offrir ce produit à ce prix et acheter en ligne ; (4) jamais générique : pas de « femmes actives de 30 à 45 ans stressées » — la phrase ne doit pas pouvoir être copiée telle quelle dans la publicité d'un concurrent direct ; (5) appuie-toi sur ce que la page et le marché de vente laissent réellement entendre, sans inventer de chiffre ni de fait ; (6) aucun mot technique (persona, angle, funnel, cible, awareness). null si la page ne permet pas de la déduire","couleurs":["2 ou 3 couleurs de la marque, au format #rrggbb, choisies UNIQUEMENT dans la liste de couleurs candidates fournie plus bas (copie-les exactement) ; liste vide [] si aucune liste n'est fournie ou si tu n'es pas sûr"],"images":[{"i":0,"type":"produit|autre_produit|inutile","aspect":"face|cote|dos|forme|prepare|en_main|detail|kit|autre","q":1}],"principale":0,"confiance":"haute|moyenne|basse"}

RÈGLES « images » (seulement si des images numérotées te sont fournies, sinon renvoie "images":[] et "principale":null) : pour CHAQUE image fournie, indique son numéro « i », son « type » et son « aspect ». « type » : « produit » = le produit de CETTE page lui-même — son pot, sachet, flacon, boîte ou tube COMPTE comme le produit (il n'y a plus de catégorie emballage) ; seul, en main, en situation d'usage, sous plusieurs angles ; « autre_produit » = un produit DIFFÉRENT (vente croisée, collection, comparatif) ; « inutile » = bannière, icône, logo, moyen de paiement, tableau, capture de texte, infographie de textes, photo sans le produit, visuel de réassurance. Au moindre doute entre « produit » et « autre_produit », choisis « autre_produit ». « aspect » (uniquement pour type « produit ») : « face » = le produit vu de face, étiquette principale visible ; « cote » = de côté ou en trois-quarts ; « dos » = l'arrière (étiquette arrière, composition, valeurs nutritionnelles) ; « forme » = le produit lui-même sorti de son contenant (poudre, gélule, capsule, comprimé, crème, texture, aliment) ; « prepare » = le produit préparé, servi ou en cours d'usage (tasse prête à boire, shaker, plat) ; « en_main » = tenu ou porté par une personne ; « detail » = gros plan sur un détail (matière, bouchon, ingrédient) ; « kit » = le kit, le pack ou les cadeaux vendus ou offerts avec le produit (produits complémentaires, accessoires) ; « autre » sinon. « q » = note de 1 à 5 de la qualité de la photo (nette, bien cadrée, produit bien visible, sans texte superposé) ; UN SEUL EXEMPLAIRE PAR ASPECT sera gardé (la meilleure note), donc note honnêtement. Une image qui est une infographie ou une bannière pleine de texte (étapes de préparation, arguments, avis, comparatif) est « inutile », sauf une vraie étiquette arrière photographiée (dos). « principale » = le numéro de la meilleure image pour représenter le produit (nette, bien cadrée, produit bien visible, idéalement de face sur fond simple), ou null.

Si la page n'est pas une fiche produit exploitable (site général, accueil, blog, catégorie...), tous les champs à null et confiance:"basse".

${candidatsCouleurs.length ? `COULEURS CANDIDATES (pour le champ « couleurs », choisis uniquement parmi elles) : ${candidatsCouleurs.join(', ')}\n\n` : ''}TEXTE DE LA PAGE :
${pageText}`;

        // v5.49 — images candidates téléchargées en parallèle (7 s max chacune, 1,5 Mo max) pour que Gemini les REGARDE
        // dans le même appel que le texte. Échec de téléchargement = image simplement non jugée, jamais bloquant.
        const candidatsImages = images.slice(0, 12);
        const telechargees = await Promise.all(candidatsImages.map(u => telechargerImagePourTri(u)));
        const envoyees = [];
        let totalOctets = 0;
        telechargees.forEach((d, idx) => {
          if (!d) return;
          const taille = d.data.length * 0.75;
          if (totalOctets + taille > 9000000) return;
          totalOctets += taille;
          envoyees.push({ url: candidatsImages[idx], mimeType: d.mimeType, data: d.data });
        });
        const partsRequete = [{ text: extractPrompt }];
        envoyees.forEach((im, k) => { partsRequete.push({ text: `IMAGE ${k} :` }); partsRequete.push({ inlineData: { mimeType: im.mimeType, data: im.data } }); });
        console.log(`   [fiche-auto] ${envoyees.length}/${candidatsImages.length} image(s) transmises à Gemini · ${candidatsCouleurs.length} couleur(s) candidate(s)`);

        const token = await getToken();
        // Même trou que select-cts/name-ct (voir ailleurs dans ce fichier) : aucun thinkingConfig
        // fixé, sur une sortie très courte (500 tokens) — risque de troncature identique.
        // Tâche d'extraction pure, aucun bénéfice à réfléchir dessus.
        const vertexBody = {
          system_instruction: { parts: [{ text: 'Tu extrais des données structurées depuis du texte web brut. Tu ne réponds qu\'en JSON strict, jamais de texte autour.' }] },
          contents: [{ role: 'user', parts: partsRequete }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 8000, ...reflexion(MODELES.fiche, 0) }
        };
        // Corrigé pour utiliser le retry existant (vertexRequestAvecReessai) — cet appel pouvait
        // échouer sec sur une simple limite de débit transitoire, comme observé en pratique.
        const data = await vertexRequestAvecReessai(token, MODELES.fiche, vertexBody, 90000, 'fetch_product_info');
        if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
        let raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        raw = raw.replace(/```json\s*|\s*```/g, '').trim();

        let parsed;
        try { parsed = JSON.parse(raw); }
        catch(e) { throw new Error('Réponse IA non-JSON : ' + raw.slice(0,200)); }

        if (!parsed || parsed.confiance === 'basse') {
          console.log('✓ Fiche produit : confiance basse, rien renvoyé');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, data: null, reason: 'confiance_basse' }));
          return;
        }

        const cleaned = {};
        ['nom','prix','pays','utilite','promo'].forEach(k => {
          if (parsed[k] && String(parsed[k]).toLowerCase() !== 'null') cleaned[k] = String(parsed[k]).trim();
        });
        // v5.48 — garanties / livraison / avis / logo. Garde-fous anti-invention : un champ n'est renvoyé que si la
        // page contient réellement le vocabulaire correspondant ; un avis n'est gardé que s'il apparaît mot pour mot
        // dans le texte de la page (comparaison insensible à la casse, aux espaces et à la ponctuation).
        const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, '');
        const texteNorm = norm(pageText);
        const brut = (v) => (v && String(v).toLowerCase() !== 'null') ? String(v).trim() : '';
        // v5.52 — garde-fou valable dans toutes les langues : vocabulaire (fr/en/es/pt/de/it/tr…) OU un nombre cité qui figure vraiment
        // dans la page OU page en écriture non latine (japonais, hindi, arabe, russe…) où le vocabulaire ne peut pas être testé.
        const pnorm = pageText.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const nonLatine = (pageText.match(/[\u0400-\u04FF\u0590-\u06FF\u0900-\u0DFF\u0E00-\u0E7F\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/g) || []).length > 200;
        const vraiDansPage = (v, reMots) => reMots.test(pnorm) || nonLatine || (String(v).match(/\d+/g) || []).some(n => pageText.includes(n));
        const g = brut(parsed.garantie);
        if (g && vraiDansPage(g, /rembours|garanti|retour|echange|satisfait|refund|guarant|warrant|return|exchange|money.?back|satisf|risk.?free|reembols|devoluc|devolu|ruckgabe|umtausch|reso\b|rimbors|iade|geld.?terug|retour/i)) cleaned.garantie = g.slice(0, 240);
        const lp = brut(parsed.livraison_paiement);
        if (lp && vraiDansPage(lp, /livraison|livr[ée]|paiement|payer|cash|expedi|shipping|delivery|deliver|ship\b|ships\b|payment|checkout|\bcod\b|envio|entrega|pago|pagamento|versand|lieferung|zahlung|spedizione|consegna|pagamento|kargo|teslimat|verzending|bezorg/i)) cleaned.livraison_paiement = lp.slice(0, 300);
        if (Array.isArray(parsed.avis)) {
          const vus = new Set();
          const avisOk = [];
          for (const a of parsed.avis) {
            const t = brut(a);
            if (t.length < 15 || t.length > 500) continue;
            // retire un éventuel « (Prénom) » final avant de chercher le texte dans la page
            const sansAuteur = t.replace(/\s*\([^)]{1,40}\)\s*$/, '');
            const n = norm(sansAuteur);
            if (n.length < 12 || !texteNorm.includes(n) || vus.has(n)) continue;
            vus.add(n); avisOk.push(t);
            if (avisOk.length >= 15) break;
          }
          if (avisOk.length) cleaned.avis = avisOk;
        }
        // v5.52 — avis de secours : si Gemini n'en a gardé aucun, on reprend ceux balisés dans la page (vrais, non reformulés).
        if (!cleaned.avis && extras.avis.length) cleaned.avis = extras.avis.slice(0, 15);
        if (logoPage) cleaned.logo = logoPage;
        // Cible : une phrase, jamais un pavé ; un mot-clé technique = écartée.
        const ci = brut(parsed.cible).replace(/\s+/g, ' ');
        if (ci && ci.length >= 12 && !/\b(persona|funnel|awareness|angle marketing)\b/i.test(ci)) cleaned.cible = ci.slice(0, 300);
        // Couleurs : uniquement des candidates réellement présentes sur la page ; 2 ou 3, jamais une seule (le formulaire exige 2 ou 3).
        if (Array.isArray(parsed.couleurs) && candidatsCouleurs.length) {
          const ok = [];
          for (const c of parsed.couleurs) {
            const h = String(c || '').trim().toLowerCase();
            if (candidatsCouleurs.includes(h) && !ok.includes(h)) ok.push(h);
          }
          if (ok.length >= 2) cleaned.couleurs = ok.slice(0, 3);
        }
        // Tri des images : « produit » (principale en tête), avec l'aspect de chacune (face, côté, dos, forme, préparé…). Le reste est écarté.
        let imagesFinales = images, aspects = {}, triFait = false;
        const ASPECTS_OK = ['face','cote','dos','forme','prepare','en_main','detail','kit','autre'];
        if (envoyees.length && Array.isArray(parsed.images) && parsed.images.length) {
          const verdict = {}, asp = {}, note = {};
          parsed.images.forEach(e => { if (e && Number.isInteger(e.i) && e.i >= 0 && e.i < envoyees.length && typeof e.type === 'string') { verdict[e.i] = e.type.toLowerCase(); note[e.i] = Number(e.q) || 3; asp[e.i] = ASPECTS_OK.includes(String(e.aspect || '').toLowerCase()) ? String(e.aspect).toLowerCase() : 'autre'; } });
          if (Object.keys(verdict).length) {
            let produits = envoyees.map((im, k) => k).filter(k => verdict[k] === 'produit' || verdict[k] === 'emballage');
            if (Number.isInteger(parsed.principale) && produits.includes(parsed.principale)) produits = [parsed.principale, ...produits.filter(k => k !== parsed.principale)];
            // v5.53 — un seul exemplaire par aspect : la principale garde le sien, pour les autres la meilleure note l'emporte (à égalité, la première).
            const parAspect = {};
            produits.forEach((k, rang) => {
              const a = asp[k] || 'autre';
              const score = (k === parsed.principale ? 100 : (note[k] || 3)) - rang * 0.01;
              if (!parAspect[a] || score > parAspect[a].score) parAspect[a] = { k, score };
            });
            const gardes = new Set(Object.values(parAspect).map(x => x.k));
            produits = produits.filter(k => gardes.has(k));
            if (produits.length) {
              imagesFinales = produits.map(k => envoyees[k].url);
              produits.forEach(k => { aspects[envoyees[k].url] = asp[k] || 'autre'; });
              triFait = true;
            }
          }
        }

        console.log(`✓ Fiche produit extraite (confiance: ${parsed.confiance}) — champs: ${Object.keys(cleaned).join(', ') || 'aucun'} · ${images.length} image(s)${cleaned.avis ? ` · ${cleaned.avis.length} avis` : ''}${cleaned.logo ? ' · logo' : ''}${cleaned.cible ? ' · cible' : ''}${cleaned.couleurs ? ' · couleurs' : ''} · images: ${triFait ? `${imagesFinales.length} produit (triées ; aspects : ${Object.values(aspects).join('/')})` : `${imagesFinales.length} (non triées)`}${shop ? ' · shopify' : ''}${rendu ? ' · navigateur' : ''}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, data: cleaned, confiance: parsed.confiance, images: imagesFinales, aspects, images_emballage: [], tri_images: triFait, redirection_locale: redirectionLocale ? locFinale : null }));
      } catch(e) {
        console.error('✗ Erreur fetch-product-info:', e.message);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, data: null, error: e.message }));
      }
    });
    return;
  }

  // ── URL Fetcher endpoint (Synthesis Tool) ─────
  if (req.method === 'POST' && req.url === '/fetch-url') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { url } = JSON.parse(body);
        if (!url || !url.startsWith('http')) throw new Error('URL invalide');
        console.log(`→ Fetching URL: ${url}`);
        const text = await fetchPageText(url);
        console.log(`✓ URL fetched — ${text.length} chars`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ text }));
      } catch(e) {
        console.error('✗ Fetch URL error:', e.message);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ text: '', error: e.message }));
      }
    });
    return;
  }

  // ── Synthesis endpoint (Gemini + Google Search grounding) ──
  if (req.method === 'POST' && req.url === '/synthesize') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const reqBody = JSON.parse(body);
        // Détecter si c'est l'appel Stratège (1ère synthèse) ou un agent secondaire (Mindmap)
        // L'agent Mindmap envoie enrichWithSearch:false OU son prompt contient SYNTHÈSE COMPLÈTE
        const isSecondaryAgent = reqBody.enrichWithSearch === false
          || (reqBody.parts || []).some(p => typeof p.text === 'string' && p.text.includes('SYNTHÈSE COMPLÈTE'));
        const enrichWithSearch = !isSecondaryAgent;
        console.log('→ Getting token (synthesis)...');
        const token = await getToken();
        console.log('✓ Token OK');

        // Extraire l'URL depuis les parts et la fetcher côté serveur (Stratège uniquement)
        const _partsText = (reqBody.parts || []).map(p => p.text || '').join(' ');
        const _urlMatchSynth = enrichWithSearch ? _partsText.match(/https?:\/\/[^\s\n"]+/) : null;
        const _synthUrl = _urlMatchSynth ? _urlMatchSynth[0].replace(/[.,;)]+$/, '') : '';
        let _pageInsert = '';
        if (_synthUrl) {
          console.log(`\n→ [DEMO Stratège] Fetch page produit : ${_synthUrl}`);
          try {
            const _pageHtml = await fetchRawHtml(_synthUrl);
            const _pageText = _pageHtml
              .replace(/<script[\s\S]*?<\/script>/gi, '')
              .replace(/<style[\s\S]*?<\/style>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s{3,}/g, '\n')
              .slice(0, 5000);
            if (_pageText.length > 100) {
              _pageInsert = `\n\n### PAGE PRODUIT OFFICIELLE (${_synthUrl}) :\n${_pageText}\n`;
              console.log(`   ✓ ${_pageText.length} chars extraits`);
            }
          } catch(e) {
            _pageInsert = `\n\n### PAGE PRODUIT (${_synthUrl}) :\nURL fournie mais non accessible. Utilise Google Search pour trouver le contenu de cette page.\n`;
            console.log(`   ✗ fetch échoué : ${e.message}`);
          }
        }
        // Injecter dans le dernier part texte
        let _lastTextIdx = -1;
        (reqBody.parts || []).forEach((p, i) => { if (typeof p.text === 'string') _lastTextIdx = i; });
        const _enrichedParts = (reqBody.parts || []).map((p, i) =>
          i === _lastTextIdx ? { ...p, text: p.text + _pageInsert } : p
        );

        console.log(enrichWithSearch ? '→ Calling gemini-2.5-flash + Google Search grounding...' : '→ Calling gemini-2.5-flash (pas de Search — agent secondaire)...');
        const vertexBody = {
          system_instruction: { parts: [{ text: reqBody.system }] },
          contents: [{ role: 'user', parts: _enrichedParts }],
          // Cause profonde corrigée : aucun thinkingConfig n'était fixé ici — la réflexion (thinking)
          // partageait le même budget que maxOutputTokens et pouvait le consommer en entier avec le
          // grounding Google Search, tronquant la vraie synthèse avant qu'elle ne soit écrite.
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 16000,
            ...reflexion(MODELES.demo, 4096)
          }
        };
        if (enrichWithSearch) {
          vertexBody.tools = [{ googleSearch: {} }];
        }

        const data = await vertexRequestAvecReessai(token, MODELES.demo, vertexBody, 150000, 'demo_stratege_synthese');
        if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

        const cand = data.candidates?.[0];
        // Cause profonde corrigée : ne garder que les parts finales, jamais une part "thought": true —
        // filet de sécurité si l'API renvoie un jour le raisonnement interne comme part[0].
        const text = (cand?.content?.parts || [])
          .filter(p => !p.thought && typeof p.text === 'string')
          .map(p => p.text)
          .join('\n')
          .trim();
        if (!text) throw new Error('Pas de texte dans la réponse');

        const finishReason = cand?.finishReason || 'inconnu';
        const usage = data.usageMetadata || {};
        console.log(`   [Stratège Démo] finishReason=${finishReason} · tokens prompt=${usage.promptTokenCount ?? '?'} thinking=${usage.thoughtsTokenCount ?? 0} output=${usage.candidatesTokenCount ?? '?'} total=${usage.totalTokenCount ?? '?'}`);
        if (finishReason === 'MAX_TOKENS') {
          throw new Error(`Synthèse tronquée par maxOutputTokens (finishReason=MAX_TOKENS, ${text.length} chars produits au lieu de 9000-12000) — le budget de réflexion a probablement consommé l'essentiel du budget de sortie. Relance la génération ; si ça se reproduit, augmente encore maxOutputTokens ou réduis thinkingBudget dans /synthesize.`);
        }

        // Cause profonde corrigée : la consigne de longueur dans le prompt (9000-12000) n'était
        // qu'une instruction — rien ne l'imposait réellement, le modèle pouvait l'ignorer (constaté :
        // 18768 puis 21000 chars). Fix réel, au niveau du code : si la synthèse dépasse le plafond,
        // un second appel Gemini la condense explicitement avant de la renvoyer, sans jamais
        // supprimer d'information — seulement le remplissage/les répétitions.
        let finalText = text;
        if (enrichWithSearch && finalText.length > 13000) {
          console.log(`   ⚠️  [Stratège Démo] Synthèse trop longue (${finalText.length} chars, cible 9000-12000) — compression automatique en cours...`);
          try {
            const compressBody = {
              system_instruction: { parts: [{ text:
                "Tu reçois une synthèse marketing structurée en sections S0 à S7. Ta seule tâche : la CONDENSER pour qu'elle fasse entre 9000 et 12000 caractères, jamais plus, jamais moins de 9000. Règles strictes : garde EXACTEMENT les mêmes sections (S0 à S7), garde CHAQUE information factuelle et chaque donnée déjà présente (chiffres, noms, verbatims, couleurs), ne supprime aucun élément que la structure d'origine exige. Coupe uniquement : les répétitions, les reformulations multiples de la même idée, les phrases de transition superflues, les détails redondants entre sections. Réponds uniquement avec la synthèse condensée, sans commentaire, sans préambule, en commençant directement par 'S0'."
              }]},
              contents: [{ role: 'user', parts: [{ text: finalText }] }],
              generationConfig: { temperature: 0.3, maxOutputTokens: 8000, ...reflexion(MODELES.demo, 1024) }
            };
            const compressData = await vertexRequestAvecReessai(token, MODELES.demo, compressBody, 90000, 'demo_stratege_compression');
            const compressCand = compressData.candidates?.[0];
            const compressedText = (compressCand?.content?.parts || [])
              .filter(p => !p.thought && typeof p.text === 'string')
              .map(p => p.text).join('\n').trim();
            if (compressedText && compressedText.length >= 7000 && compressedText.length < finalText.length) {
              console.log(`   ✓ [Stratège Démo] Compression réussie : ${finalText.length} → ${compressedText.length} chars`);
              finalText = compressedText;
            } else {
              console.log(`   ⚠️  [Stratège Démo] Compression ignorée (résultat invalide ou pas plus court) — synthèse originale conservée (${finalText.length} chars)`);
            }
          } catch(eCompress) {
            console.log(`   ⚠️  [Stratège Démo] Compression échouée (${eCompress.message}) — synthèse originale conservée (${finalText.length} chars)`);
          }
        }

        if (enrichWithSearch && finalText.length < 8000) {
          console.log(`   ⚠️  [Stratège Démo] Synthèse anormalement courte (${finalText.length} chars, attendu 9000-12000) — à vérifier manuellement, ce n'est pas forcément une troncature.`);
        }

        console.log(enrichWithSearch ? `✓ Synthèse générée — ${finalText.length} chars` : `✓ Réponse Gemini — ${finalText.length} chars`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ text: finalText }));
      } catch(e) {
        console.error('✗ Synthesis error:', e.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ═══════════════════════════════════════════════════════════════════
  // CRM SÉCURISÉ — prospects/demos ne passent plus jamais par la clé anon
  // exposée côté navigateur. Ces 3 endpoints utilisent SUPABASE_SERVICE_KEY
  // (jamais envoyée au client) et remplacent les appels directs Supabase
  // que l'Usine faisait auparavant depuis le navigateur.
  // ═══════════════════════════════════════════════════════════════════

  // ── Réservation d'appel depuis le formulaire du site ──
  // Avant : la page de vente lisait et modifiait la table des prospects avec la clé publique, ce qui obligeait à laisser
  // cette table ouverte à tout le monde. Maintenant tout passe par ici (clé service) : la page n'a plus aucun accès direct.
  // Les champs de la fiche sont construits ICI à partir de valeurs validées — jamais copiés tels quels depuis la page.
  if (req.method === 'POST' && req.url === '/reserver-appel') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 20000) req.destroy(); });
    req.on('end', async () => {
      const rep = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
      try {
        const d = JSON.parse(body || '{}');
        const txt = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
        const digits = String(d.digits || '').replace(/\D/g, '');
        const slot = Number(d.slot);
        if (digits.length < 9 || digits.length > 15) return rep(400, { ok: false, error: 'numéro invalide' });
        if (!Number.isFinite(slot) || slot < Date.now() - 60000 || slot > Date.now() + 14 * 86400000) return rep(400, { ok: false, error: 'créneau invalide' });
        const nom = txt(d.nom, 120), marque = txt(d.marque, 120), marche = txt(d.marche, 60), lien = txt(d.lien, 300);
        if (nom.length < 2 || !marche || lien.length < 4) return rep(400, { ok: false, error: 'champs manquants' });
        const now = new Date().toISOString();
        const infos = { appel_reserve: true, appel_reserve_at: now, appel_programme_at: new Date(slot).toISOString(), source: 'formulaire_site', form_nom: nom, form_marche: marche, form_ca_objectif: txt(d.ca, 80), form_budget_pub: txt(d.bud, 80), appel_meet_ok: true, form_boutique: lien };
        const H = { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' };
        const lu = await fetch(`${SUPABASE_URL_INT}/rest/v1/prospects?lien_wa=ilike.*${digits}*&select=id,statut,notes&limit=1`, { headers: H });
        if (!lu.ok) return rep(502, { ok: false, error: 'lecture ' + lu.status });
        const ex = (await lu.json())[0];
        if (ex) {
          let n = {}; try { n = JSON.parse(ex.notes || '{}') || {}; } catch (_) { n = { texte_ancien: ex.notes || '' }; }
          ['appel_fait', 'appel_fait_at', 'appel_via', 'pas_interesse', 'pas_interesse_at', 'closing_etat', 'closing_at'].forEach(k => { delete n[k]; });
          Object.assign(n, infos);
          const upd = { notes: JSON.stringify(n) };
          if (ex.statut === 'a_contacter' || ex.statut === 'archive') upd.statut = 'en_suivi';
          const pr = await fetch(`${SUPABASE_URL_INT}/rest/v1/prospects?id=eq.${ex.id}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(upd) });
          if (!pr.ok) return rep(502, { ok: false, error: 'maj ' + pr.status });
        } else {
          const ins = await fetch(`${SUPABASE_URL_INT}/rest/v1/prospects`, { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ nom_marque: marque || nom, produit: '', pays: marche, lien_wa: 'https://wa.me/' + digits, page_produit: lien, statut: 'en_suivi', score: 0, date_collecte: now.slice(0, 10), notes: JSON.stringify(infos) }) });
          if (!ins.ok) return rep(502, { ok: false, error: 'insertion ' + ins.status });
        }
        const chk = await fetch(`${SUPABASE_URL_INT}/rest/v1/prospects?lien_wa=ilike.*${digits}*&select=id&limit=1`, { headers: H });
        const ok = chk.ok && (await chk.json()).length > 0;
        return rep(ok ? 200 : 502, { ok });
      } catch (e) { console.error('/reserver-appel:', e.message); return rep(500, { ok: false, error: 'erreur' }); }
    });
    return;
  }

  // ── Insertion prospect depuis le prospecteur (contournement temporaire) ──
  // Le rôle anon est bloqué par un bug apparent côté PostgREST (policy/GRANT corrects,
  // confirmés par test SQL direct, mais l'API rejette quand même en 42501 — signalé à
  // Supabase). En attendant leur réponse, le prospecteur passe par ici avec la clé
  // service, qui contourne RLS entièrement. À repasser en direct anon une fois le bug
  // Supabase résolu, si on veut revenir à l'architecture d'origine.
  if (req.method === 'POST' && req.url === '/prospector/save-lead') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const r = await fetch(`${SUPABASE_URL_INT}/rest/v1/prospects`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal,resolution=ignore-duplicates'
          },
          body: JSON.stringify(payload)
        });
        if (!r.ok) {
          const errText = await r.text();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, status: r.status, error: errText }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch(e) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  // ── Lecture des démos en attente (jointure prospects) ──
  if (req.method === 'GET' && req.url === '/crm/demos-en-attente') {
    try {
      const r = await fetch(`${SUPABASE_URL_INT}/rest/v1/demos?statut=eq.en_attente&order=created_at.asc&select=*,prospects(nom_marque,produit,pays,page_produit,notes)`, {
        headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
      });
      const data = await r.json();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ── Marquer une démo comme livrée + écrire le lien dans les notes du prospect ──
  if (req.method === 'POST' && req.url === '/crm/sync-demo-delivered') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { prospect_id, demo_id, lien_demo, produit } = JSON.parse(body);
        if (!prospect_id || !demo_id || !lien_demo) throw new Error('prospect_id, demo_id et lien_demo requis');

        const SB_H_S = { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' };

        // 1. Écrire lien_demo dans prospects.notes
        const pRes  = await fetch(`${SUPABASE_URL_INT}/rest/v1/prospects?id=eq.${prospect_id}&select=notes`, { headers: SB_H_S });
        const pRows = await pRes.json();
        const pNotes = (() => { try { return JSON.parse((pRows[0]||{}).notes||'{}'); } catch(e) { return {}; } })();
        pNotes.lien_demo = lien_demo;
        pNotes.produit_demo = produit || '';
        await fetch(`${SUPABASE_URL_INT}/rest/v1/prospects?id=eq.${prospect_id}`, {
          method:'PATCH', headers:{...SB_H_S,'Prefer':'return=minimal'},
          body: JSON.stringify({ notes: JSON.stringify(pNotes) })
        });

        // 2. Passer le demo en "livré"
        await fetch(`${SUPABASE_URL_INT}/rest/v1/demos?id=eq.${demo_id}`, {
          method:'PATCH', headers:{...SB_H_S,'Prefer':'return=minimal'},
          body: JSON.stringify({ statut:'livre', lien_demo, delivered_at: new Date().toISOString() })
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch(e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ── Supprimer une démo de la file d'attente ──
  if (req.method === 'DELETE' && req.url.startsWith('/crm/demos/')) {
    const id = req.url.split('/')[3];
    try {
      if (!id) throw new Error('id manquant');
      await fetch(`${SUPABASE_URL_INT}/rest/v1/demos?id=eq.${id}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Prefer': 'return=minimal' }
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }


  // ── Copywriter : Claude Sonnet 4.6 text-only (sans image, sans grounding) ──
  if (req.method === 'POST' && req.url === '/copywriter') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const reqBody = JSON.parse(body);
        const { system, parts, maxOutputTokens, isTest } = reqBody;

        console.log('\n' + '═'.repeat(60));
        console.log('✍️  COPYWRITER — Ad Copy 3 angles × (5 hooks + AIDA)');
        console.log('═'.repeat(60));

        // Conversion format Gemini-like (parts: [{text}]) → format blocs (callGeminiPro accepte les deux)
        const claudeContent = (parts || []).map(p => {
          if (typeof p.text === 'string') return { type: 'text', text: p.text };
          return p;
        });

        console.log('→ Gemini 2.5 Pro (mode test) — génération des Ad Copy...');
        const text = await callGeminiPro(system, claudeContent, maxOutputTokens || 8000, {
          modele: MODELES.copywriter, temperature: 0.4, logLabel: 'Copywriter',
          typeAppel: isTest ? 'copywriter_test' : 'copywriter_prod'
        });

        console.log(`✓ Ad Copy générés — ${text.length} chars`);
        console.log('═'.repeat(60) + '\n');

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ text }));
      } catch(e) {
        console.error('✗ Copywriter error:', e.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }


  // ── Analyste de Marché : recherche multi-sources + synthèse Gemini 2.5 Pro (Sonnet 4.6 non connecté actuellement) ──
  if (req.method === 'POST' && req.url === '/analyste-synthese') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const reqBody = JSON.parse(body);
        const { system, parts, maxOutputTokens, brief, isTest } = reqBody;
        const { marque = '', produit = '', pays = '', lien_page_produit = '' } = brief || {};
        const { productId = null, nbAngles = 0, forcerBalayage = false } = reqBody;
        const _suiviCout = nouveauSuiviCout();
        let _dec = { reutiliser: false, raison: 'décision indisponible' };
        try { _dec = await decideBalayage({ productId, isTest, nbAngles, brief, forcer: forcerBalayage }); }
        catch (e) { console.log('   ⚠ décision de balayage impossible, nouveau balayage par prudence :', e.message); }
        const _reutiliser = !!_dec.reutiliser;
        const _statsBalayage = { reutilise: _reutiliser, raison: _dec.raison };

        console.log('\n' + '═'.repeat(60));
        console.log(`🔍 ANALYSTE DE MARCHÉ — ${marque} / ${produit} (${pays})`);
        console.log('═'.repeat(60));

        let donneesBrutes = '';
        let _planBalayage = null, _scPromise = null;
        const _compteurSC = { n: 0, credits: 0 };
        console.log(`\n   → Balayage : ${_reutiliser ? 'RÉUTILISATION de l\'hypothèse stockée — ' : 'NOUVEAU BALAYAGE — '}${_dec.raison}`);
        if (_reutiliser) {
          donneesBrutes += `### BALAYAGE DE MARCHÉ NON REFAIT (hypothèse stockée réutilisée)\nLe marché a déjà été balayé en profondeur pour ce produit (${_dec.raison}). Aucune nouvelle donnée de marché n'a été collectée pour cette commande : travaille à partir de l'HYPOTHÈSE EXISTANTE fournie plus haut (stock d'angles en réserve inclus). Seules les variables du brief actuel (prix, offre, garantie, livraison) et la page produit ci-dessous sont à jour.\n\n`;
        } else {
        console.log('\n[0/4] Plan de balayage (point de départ : le problème, pas la marque)...');
        _planBalayage = await planBalayage(brief, produit, marque, pays);
        console.log(`   → problème : ${_planBalayage.probleme}`);
        console.log(`   → alternatives : ${_planBalayage.alternatives.join(' | ') || 'n/a'} · concurrents : ${_planBalayage.concurrents.join(' | ') || 'n/a'}`);
        if (!SC_KEY) console.log('   ⚠ SOCIAL_MEDIA_SCRAPING_API absente : ScrapeCreators ignoré');
        else _scPromise = balayageScrapeCreators(_planBalayage, pays, _compteurSC).catch(e => ({ texte: '', stats: { erreurs: [e.message] } }));

        // ── SOURCE 1/5 — Gemini 2.5 Flash + Google Search grounding ──
        console.log('\n[1/4] Gemini Search grounding (recherche multi-source enrichie)...');
        try {
          const token = await getToken();
          const _marchesBrief = Array.isArray(brief && brief.marches) ? brief.marches.filter(Boolean) : [];
          const _blocMulti = _marchesBrief.length > 1
            ? `\n\n⚠️ MODE MULTI-MARCHÉ : ce produit est vendu sur ${_marchesBrief.join(', ')} avec UNE SEULE campagne. Cherche pour CHAQUE pays (au moins le prix local, les concurrents présents et la perception de la catégorie, 2 requêtes par pays), puis ramène ce qui est COMMUN à ces pays. Signale clairement ce qui n'existe que dans un seul pays (concurrent local, usage propre à un pays) : il sera écarté de l'analyse, jamais présenté comme valable partout.`
            : '';
      const researchPrompt = `Tu es un analyste de marché senior. Tu mènes une recherche APPROFONDIE et MULTI-SOURCE sur le produit "${produit}" de la marque "${marque}" vendu en ${pays}.${_blocMulti}

${blocProblemePourRecherche(_planBalayage)}OBJECTIF : ramener un MAXIMUM de DATA RÉELLE et de VERBATIMS clients authentiques — pas de paraphrase, pas de généralités. Cite les sources URL précises trouvées et les extraits textuels exacts (entre guillemets quand c\'est un verbatim).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DOMAINES À EXPLORER EN PRIORITÉ (utilise site: dans tes recherches Google)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   • ${TARGET_DOMAINS_HINT}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PLAN DE RECHERCHE (effectue PLUSIEURS requêtes Google distinctes pour couvrir chaque axe)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

0. PAGE PRODUIT OFFICIELLE : ${lien_page_produit ? `accède à cette URL et extrais son contenu exact (prix, ingrédients, descriptions, avis) : ${lien_page_produit}` : '(non fourni)'}
1. VÉRIFICATION RAPIDE DU NOM EXACT : "${produit}"${marque ? ` "${marque}"` : ''} + avis OU reviews (pays ${pays}) — UNE seule requête ici, pas plus. La grande majorité des produits e-commerce que tu analyses sont des marques neuves, créées récemment par le client — ça ne renvoie presque toujours rien, et c'est normal, pas un échec. Ne LES INSISTE PAS. L'essentiel du volume de recherche doit porter sur les points suivants (catégorie/problème), qui ont une vraie chance de ramener de la donnée réelle.
2. AVIS CATÉGORIE : "${produit}" + verbatims/témoignages (élargis à la catégorie produit, francophone)
3. REDDIT : "${produit}" reddit OR sous-reddits liés (ex : r/Skincareaddiction, r/Nutrition, r/Senegal, r/CoteDIvoire)
4. TRUSTPILOT : ${marque ? `recherche avis sur "${marque}" + ` : 'recherche avis sur '}2-3 concurrents directs identifiés — pour chaque concurrent, cherche spécifiquement CE QUI REVIENT dans les avis positifs (pourquoi les gens ont acheté, ce qu'ils apprécient) ET dans les avis négatifs (pourquoi ils regrettent, ce qui les a fait hésiter avant d'acheter)
5. ALIEXPRESS / AMAZON : reviews sur produits équivalents de la catégorie — extraits 1★ ET 5★, en notant explicitement la RAISON derrière chaque type d'avis (1★ = objection ou déception réelle, 5★ = déclencheur d'achat réel)
6. X/TWITTER : ${marque ? `mentions "${marque}" + ` : 'mentions '}hashtags liés à la catégorie + pays ${pays}
7. PRIX LOCAL ET CONCURRENTS : prix observés en ${pays} (devise locale) sur Jumia, sites locaux, groupes Facebook
8. CONTEXTE CULTUREL PAYS : comment cette catégorie de produit est perçue/consommée dans ${pays}
9. TAILLE ET CROISSANCE DU MARCHÉ : cherche des données chiffrées sur la taille de ce marché dans ${pays} ou en Afrique francophone (nombre de personnes concernées, volume de ventes estimé, valeur en FCFA/USD si trouvable), et des signaux de tendance (recherches Google Trends, articles sectoriels, croissance du e-commerce dans cette catégorie). Si aucun chiffre fiable n'est trouvé, écris explicitement [AUCUNE DONNÉE DE TAILLE DE MARCHÉ TROUVÉE] plutôt que d'estimer.
10. SCEPTICISME DU MARCHÉ : sur les sites de concurrents et d'alternatives à ce produit (pas seulement la marque du client), cherche explicitement POURQUOI les gens achètent ce type de produit et POURQUOI ils ne l'achètent pas ou le regrettent — objections récurrentes (prix, doute sur l'efficacité, peur d'un effet indésirable, déception passée avec un produit similaire), et raisons d'achat récurrentes (recommandation, urgence d'un problème, réassurance trouvée quelque part). Cite les formulations réelles trouvées, pas une reformulation générique.

RÈGLE ANTI-DOUBLON : avant chaque nouvelle requête, vérifie que tu n'as pas déjà posé une requête identique ou quasi identique (même mots, même ordre) plus tôt dans cette recherche. Reformule ou passe au point suivant plutôt que de répéter — chaque requête doit apporter un angle réellement nouveau.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ GARDE-FOU CRITIQUE — NE JAMAIS MÉLANGER PRODUIT EXACT ET CATÉGORIE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Les étapes 1 à 6 élargissent volontairement aux avis de la CATÉGORIE (produits similaires,
pas forcément identiques) pour collecter des verbatims et du contexte. C'est voulu. MAIS deux
informations ne doivent JAMAIS venir de cette recherche élargie, UNIQUEMENT de la page produit
officielle (étape 0) :
- LE PRIX : toujours dans la devise locale exacte vue sur la page produit officielle (${pays}).
  Ne JAMAIS reporter un prix vu sur AliExpress/Amazon (souvent en USD) comme étant le prix du
  produit — ces sites servent uniquement à trouver des avis sur des produits comparables, jamais
  à déterminer le prix. Si le prix n'est pas visible sur la page produit officielle, écris
  explicitement [PRIX NON TROUVÉ SUR LA PAGE OFFICIELLE] plutôt que d'utiliser un prix externe.
- LE PROBLÈME PRINCIPAL RÉSOLU : uniquement ce qui est écrit sur la page produit officielle
  elle-même (titre, description, bénéfices annoncés). Ne JAMAIS déduire ou emprunter le problème
  résolu depuis un avis trouvé sur un produit similaire de la catégorie — un produit "brûleur de
  graisse" et un produit "anti-douleur" peuvent apparaître dans les mêmes recherches élargies
  sans être le même produit ni résoudre le même problème.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMAT DE TON OUTPUT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Organise en sections (## AVIS PRODUIT, ## VERBATIMS REDDIT, ## VERBATIMS TRUSTPILOT, ## VERBATIMS ALIEXPRESS/AMAZON, ## VERBATIMS X-TWITTER, ## PRIX LOCAL ET CONCURRENTS, ## CONTEXTE CULTUREL, ## TAILLE ET CROISSANCE DU MARCHÉ, ## SCEPTICISME DU MARCHÉ).

Pour chaque verbatim ramené : cite la phrase exacte entre guillemets + l'URL de la source + (si possible) le pseudo de l'auteur. Si une section retourne ZÉRO résultat exploitable, écris explicitement [AUCUN VERBATIM TROUVÉ] pour cette section — ne fabrique rien.

Cible : 1500-3000 mots de DATA BRUTE. Pas de synthèse, pas d'interprétation — c\'est le rôle de l'analyste qui te suit, pas le tien.`;
          // Cause profonde corrigée (scraping parfois pauvre/générique sur certains produits) :
          // aucun thinkingConfig n'était fixé sur cette étape précise — la plus critique du
          // pipeline Analyste selon Amar lui-même ("le 20/80, l'unfair advantage"). Sur un
          // objectif de sortie dense (1500-3000 mots) avec seulement 8000 tokens de budget
          // total, une réflexion non bornée pouvait consommer une part significative de ce
          // budget avant même d'écrire la donnée brute — moins de marge pour vraiment tout
          // organiser (avis, verbatims, prix concurrents, etc.), donc un rendu plus pauvre sur
          // les produits où il y a le plus à trier. Borné ici (pas à zéro : organiser des
          // résultats de recherche multi-sources en catégories avec citations exactes demande
          // un vrai raisonnement), avec une marge de sortie large en dessous.
          const geminiBody = {
            contents: [{ role: 'user', parts: [{ text: researchPrompt }] }],
            tools: [{ googleSearch: {} }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 8000, ...reflexion(MODELES.scraping, 2048) }
          };
          const data = await vertexRequest(token, MODELES.scraping, geminiBody, 150000, isTest ? 'analyste_grounding_test' : 'analyste_grounding_prod');
          if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

          const cand = data.candidates?.[0];
          const text = (cand?.content?.parts || []).filter(p => !p.thought).map(p => p.text).filter(Boolean).join('\n');
          const queries = cand?.groundingMetadata?.webSearchQueries || [];
          const sources = (cand?.groundingMetadata?.groundingChunks || [])
            .map(c => c.web?.uri).filter(Boolean);

          console.log(`   → ${queries.length} requête(s) Google distincte(s) effectuée(s) par Gemini`);
          queries.slice(0, 10).forEach(q => console.log(`      • ${q}`));
          console.log(`   → ${sources.length} source(s) web ramenée(s)`);
          sources.slice(0, 8).forEach(s => console.log(`      • ${s}`));

          if (text) {
            donneesBrutes += `### SOURCE — RECHERCHE GEMINI GROUNDING (multi-source enrichie)\nRequêtes effectuées : ${queries.join(' | ') || 'n/a'}\nSources URL : ${sources.slice(0,10).join(' | ') || 'n/a'}\n\n${text}\n`;
            console.log(`   ✓ ${text.length} chars de data brute récupérée`);
          } else {
            console.log('   ✗ aucune donnée retournée par Gemini');
          }
        } catch (e) {
          console.log('   ✗ erreur Gemini :', e.message);
        }

        // ── v5.71 — APPROFONDISSEMENT : 3 recherches ciblées en parallèle (alternatives/concurrents, vie réelle de la cible, signaux précoces) ──
        try {
          const _pb = (_planBalayage && _planBalayage.probleme) || produit;
          const _alts = (_planBalayage && _planBalayage.alternatives || []).join(' ; ') || 'à identifier toi-même';
          const _concs = (_planBalayage && _planBalayage.concurrents || []).join(' ; ') || 'à identifier toi-même';
          const _entete = `Tu es un analyste de marché senior. Produit : "${produit}"${marque ? ` (marque "${marque}")` : ''}, vendu en ${pays}. Problème que le produit résout : ${_pb}. Alternatives déjà repérées : ${_alts}. Concurrents déjà repérés : ${_concs}.\nRÈGLES : recherche réellement (plusieurs requêtes Google distinctes, pas de doublon). Cite entre guillemets les phrases exactes trouvées + URL. Ce qui n'est pas trouvé s'écrit [NON TROUVÉ] — ne fabrique jamais. Ce qui est une déduction s'écrit [DÉDUIT]. Donnée brute uniquement, sans synthèse. Écris en français, sois exhaustif et concret (noms propres, prix, lieux, objets, phrases).\n\n`;
          const _passes = [
            { nom: 'alternatives', prompt: _entete + `MISSION : FICHES DÉTAILLÉES des ALTERNATIVES et des CONCURRENTS (8 à 12 fiches). Pour CHAQUE alternative ou concurrent (produits, marques, remèdes traditionnels, habitudes comme le café/le thé, médecin/pharmacien, ne rien faire…) : nom exact ; prix réel en devise locale et par jour d'usage ; où on l'achète (quels lieux, quels sites, quels vendeurs) ; la promesse exacte et les mots qu'il emploie ; formats de pub et rituels d'usage ; ce que les gens en disent de bien (verbatims) ; ce que les gens en disent de mal (verbatims) ; ses faiblesses structurelles ; la raison précise pour laquelle un utilisateur l'abandonne ou le garde malgré tout. Cherche aussi : quelles publicités ces concurrents diffusent en ce moment (Meta Ad Library / TikTok) et avec quels angles ; quel angle AUCUN concurrent n'occupe (territoires libres).` },
            { nom: 'vie_cible', prompt: _entete + `MISSION : LA VIE RÉELLE DE LA CIBLE du produit en ${pays}, de façon ultra-concrète. Cherche des forums, groupes, vidéos, articles, témoignages, commentaires. Ramène : (1) le profil réel des gens qui ont ce problème (métiers, âges, situation familiale, revenus) avec exemples de personnes réelles qui témoignent ; (2) leur ENTOURAGE : conjoint(e), enfants, parents, collègues, voisins, amis, belle-famille, patron, pharmacien, médecin, marabout/guérisseur, influenceur suivi — pour chaque type de personne : comment elle parle du problème, ce qu'elle conseille, comment elle réagit, quel rôle elle joue dans l'achat ; (3) les LIEUX réels de leur journée (type de logement, quartier-type, transport, lieu de travail, marché, pharmacie, salle, église/mosquée…) avec lumière, bruits, objets visibles ; (4) les OBJETS et marques réellement utilisés au quotidien (téléphone, vêtements, boissons, repas, produits déjà achetés) ; (5) expressions, proverbes, mots d'argot et façons exactes de parler du problème dans la langue locale ; (6) horaires et rythme d'une journée type, avec les moments où le problème frappe le plus.` },
            { nom: 'signaux', prompt: _entete + `MISSION : SIGNAUX PRÉCOCES (6 à 12 insights que les concurrents n'ont pas encore exploités). Cherche : tendances récentes qui montent (hashtags, sons, formats TikTok/Instagram/YouTube liés au problème), nouveaux comportements de la cible, changements de contexte (prix, loi, saison, événements, usages mobile money/WhatsApp), conversations récentes (3 derniers mois) dans les commentaires et forums où les gens expriment une frustration pour laquelle aucune marque ne répond encore, nouveaux entrants ou produits étrangers en train d'arriver, et croyances qui changent. Pour chaque signal : la preuve (phrase exacte + URL + date si visible), pourquoi c'est encore peu exploité, combien de temps l'avance peut durer.` }
          ];
          if (_suiviCout.usd > COUT_MAX_HYPOTHESE * 0.45) throw new Error(`budget déjà à ${_suiviCout.usd.toFixed(2)} $ avant l'approfondissement : étape sautée`);
          console.log(`\n[1bis] Approfondissement (alternatives · vie de la cible · signaux précoces) — 3 recherches en parallèle... (coût estimé jusqu'ici : ${_suiviCout.usd.toFixed(2)} $)`);
          const _tokenB = await getToken();
          const _res = await Promise.all(_passes.map(async (ps) => {
            try {
              const d = await vertexRequest(_tokenB, MODELES.scraping, {
                contents: [{ role: 'user', parts: [{ text: ps.prompt }] }],
                tools: [{ googleSearch: {} }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 14000, ...reflexion(MODELES.scraping, 2048) }
              }, 170000, isTest ? 'analyste_approfondi_test' : 'analyste_approfondi_prod');
              if (d.error) throw new Error(d.error.message || JSON.stringify(d.error));
              const c = d.candidates && d.candidates[0];
              const t = ((c && c.content && c.content.parts) || []).filter(x => !x.thought).map(x => x.text).filter(Boolean).join('\n');
              const q = (c && c.groundingMetadata && c.groundingMetadata.webSearchQueries) || [];
              console.log(`   ✓ ${ps.nom} : ${t.length} car., ${q.length} requête(s)`);
              return { nom: ps.nom, t, q };
            } catch (e) { console.log(`   ✗ ${ps.nom} ignoré : ${e.message}`); return null; }
          }));
          const _titres = { alternatives: 'FICHES ALTERNATIVES ET CONCURRENTS (approfondi)', vie_cible: 'VIE RÉELLE DE LA CIBLE : ENTOURAGE, LIEUX, OBJETS, LANGAGE (approfondi)', signaux: 'SIGNAUX PRÉCOCES : CE QUE LES CONCURRENTS N\'ONT PAS ENCORE EXPLOITÉ (approfondi)' };
          for (const r of _res) if (r && r.t) donneesBrutes += `\n### SOURCE — ${_titres[r.nom]}\nRequêtes : ${r.q.join(' | ') || 'n/a'}\n\n${r.t}\n`;
        } catch (e) { console.log('   ✗ approfondissement ignoré :', e.message); }

        // Terme de catégorie/problème dérivé une seule fois, partagé par Trends ET YouTube
        // ci-dessous — évite un second appel Gemini redondant pour le même besoin.
        let termeCategorieDerivee = produit;
        try {
          const tokenCat = await getToken();
          const catBody = {
            contents: [{ role: 'user', parts: [{ text: `Produit : "${produit}"${marque ? ` (marque : ${marque})` : ''}. En 2-4 mots maximum, donne UNIQUEMENT la catégorie générique ou le problème que ce produit résout — jamais le nom de marque, jamais le nom de produit exact, jamais un thème/motif visuel du produit (ex: un t-shirt à motif voiture reste un t-shirt, pas une voiture). Réponds uniquement ces 2-4 mots, rien d'autre, pas de ponctuation finale. Exemple : pour "Vitalina Energy" (complément énergisant), réponds "complément énergisant" ou "fatigue chronique".` }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 30, ...reflexion(MODELES.tendances, 0) }
          };
          const catData = await vertexRequest(tokenCat, MODELES.tendances, catBody, 15000, 'trends_categorie');
          const catTerme = catData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (catTerme && catTerme.length > 2 && catTerme.length < 60) { termeCategorieDerivee = catTerme; console.log(`   → terme de catégorie dérivé (partagé Trends/YouTube) : "${termeCategorieDerivee}"`); }
        } catch(eCat) { console.log('   ✗ dérivation catégorie échouée, repli sur le nom exact :', eCat.message); }

        // ── SOURCE 2/5 — Google Trends (requêtes associées) ──
        console.log('\n[2/4] Google Trends...');
        try {
          // Cause profonde corrigée (quasi toujours 0 requête associée trouvée) : interroger le
          // NOM DE MARQUE exact du produit — une marque neuve n'a structurellement aucun volume
          // de recherche, Trends ne peut rien renvoyer.
          const geo = PAYS_TO_GEO[pays] || '';
          const googleTrends = require('google-trends-api');
          const _termes = [...new Set([termeCategorieDerivee, (_planBalayage && _planBalayage.probleme) || '', ...(_planBalayage && _planBalayage.alternatives || []).slice(0, 2), ...(_planBalayage && _planBalayage.formulations || []).slice(0, 1)].map(x => String(x || '').trim().slice(0, 60)).filter(x => x.length > 2))].slice(0, 5);
          let _nTr = 0;
          for (const termeTrends of _termes) {
            for (const g of (geo ? [geo, ''] : [''])) {
              try {
                const raw = await googleTrends.relatedQueries({ keyword: termeTrends, geo: g, hl: 'fr' });
                const j = JSON.parse(raw);
                const lists = j?.default?.rankedList || [];
                const top = (lists[0]?.rankedKeyword || []).slice(0, 10).map(k => k.query);
                const montee = (lists[1]?.rankedKeyword || []).slice(0, 10).map(k => `${k.query}${k.formattedValue ? ' (' + k.formattedValue + ')' : ''}`);
                console.log(`   → "${termeTrends}" geo=${g || 'monde'} : ${top.length} requête(s) associée(s), ${montee.length} en hausse`);
                if (top.length || montee.length) {
                  _nTr++;
                  donneesBrutes += `### SOURCE — GOOGLE TRENDS ("${termeTrends}", ${g || 'monde'})\nRequêtes associées : ${top.join(', ') || 'aucune'}\nRequêtes en forte hausse (signal précoce) : ${montee.join(', ') || 'aucune'}\n\n`;
                  break;
                }
              } catch (eT) { console.log(`   ✗ Trends "${termeTrends}" :`, String(eT.message).slice(0, 80)); }
            }
          }
          if (!_nTr) console.log('   ✗ aucune requête associée trouvée');
        } catch (e) {
          const hint = e.message.includes('Cannot find module') ? ' — exécute : npm install google-trends-api' : '';
          console.log('   ✗ erreur Trends :', e.message + hint);
        }

        // ── SOURCE 3/5 — YouTube (recherche + commentaires) ──
        console.log('\n[3/4] YouTube Data API...');
        try {
          // Cause profonde corrigée (vidéos hors-sujet — ex: contenu sur des voitures Mercedes
          // AMG réelles pour un produit "T-SHIRT MERCEDES AMG - RACEMODE") : chercher le nom
          // exact du produit laisse des termes de marque à fort volume (ici "Mercedes AMG")
          // dominer la pertinence YouTube, qui n'a aucun moyen de savoir qu'il s'agit d'un
          // vêtement et non d'une voiture. Le terme de catégorie dérivé plus haut sert de
          // requête principale — bien plus fiable pour rester sur la vraie nature du produit.
          const _pbYT = (_planBalayage && _planBalayage.probleme) || termeCategorieDerivee;
          const _altsYT = (_planBalayage && _planBalayage.alternatives || []).slice(0, 2);
          const _reqsYT = [...new Set([`${termeCategorieDerivee} avis test`, `${_pbYT}`, ...(_planBalayage && _planBalayage.formulations || []).slice(0, 2), ..._altsYT.map(a => `${a} avis`)])].slice(0, 5);
          const _vus = new Set(); let videos = [];
          for (const ytQuery of _reqsYT) {
            try {
              const sU = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=4&relevanceLanguage=fr&q=${encodeURIComponent(ytQuery)}&key=${YOUTUBE_API_KEY}`;
              const sD = await httpsGetJson(sU);
              if (sD.error) throw new Error(sD.error.message);
              for (const v of (sD.items || [])) if (v.id && v.id.videoId && !_vus.has(v.id.videoId)) { _vus.add(v.id.videoId); videos.push({ ...v, _req: ytQuery }); }
              console.log(`   → "${ytQuery}" : ${(sD.items || []).length} vidéo(s)`);
            } catch (e) { console.log(`   ✗ requête YouTube "${ytQuery}" :`, e.message); }
          }
          videos = videos.slice(0, 10);
          videos.forEach(v => console.log(`      • ${v.snippet.title}`));
          const ytQuery = _reqsYT.join(' | ');

          let allComments = [], _okVid = 0;
          for (const v of videos) {
            if (_okVid >= 6) break;
            try {
              const cUrl = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&order=relevance&maxResults=40&videoId=${v.id.videoId}&key=${YOUTUBE_API_KEY}`;
              const cData = await httpsGetJson(cUrl);
              if (cData.error) throw new Error(cData.error.message);
              const comments = (cData.items || []).map(c => c.snippet.topLevelComment.snippet.textOriginal).filter(t => t && t.length > 25);
              if (comments.length) { _okVid++; allComments.push(...comments.map(t => ({ t, v: v.snippet.title }))); }
            } catch (e) {
              console.log(`      ✗ commentaires indisponibles (${v.snippet.title.slice(0,40)}...) :`, String(e.message).slice(0, 60));
            }
          }
          console.log(`   → ${allComments.length} commentaire(s) récupéré(s) sur ${_okVid} vidéo(s)`);
          if (videos.length) donneesBrutes += `### SOURCE — YOUTUBE (vidéos du sujet : ${videos.map(v => `"${v.snippet.title}" (${v.snippet.channelTitle})`).join(' ; ').slice(0, 1800)})\n\n`;
          if (allComments.length) {
            donneesBrutes += `### SOURCE — YOUTUBE (commentaires, ${_okVid} vidéo(s))\n` +
              allComments.slice(0, 120).map(c => `- [${c.v.slice(0, 50)}] "${c.t.replace(/\n/g, ' ').slice(0, 300)}"`).join('\n') + '\n\n';
          }
        } catch (e) {
          console.log('   ✗ erreur YouTube :', e.message);
        }

        // Cause profonde corrigée (Jumia ne renvoie jamais de produit) : ce scraping HTTP direct
        // recevait systématiquement une page de challenge Cloudflare ("Just a moment..."), jamais
        // la vraie page produit — vérifié sur le HTML brut reçu. Un simple appel HTTP ne peut
        // jamais passer cette protection ; il faudrait un vrai navigateur avec JS, complexe et
        // coûteux pour ce que ça rapportait. Retiré entièrement — les prix Jumia restent demandés
        // au point 7 du plan de recherche de la Source 1 (Gemini Search), qui passe par
        // l'infrastructure Google et n'est pas bloquée de la même façon.

        // ── SOURCE 5/5 — Google Custom Search ──
        // Retirée : Custom Search JSON API fermée aux nouveaux projets GCP (et arrêt total prévu 01/2027).
        // Son intention (recherche sur sites ciblés) est repliée dans le prompt de la Source 1 (TARGET_DOMAINS_HINT).
        console.log('\n[Note] Google Custom Search et Jumia (scraping HTTP direct) retirés — repliés dans la Source 1 (Gemini Search).');

        // ── SOURCE 5 — ScrapeCreators (Reddit, TikTok, pubs Meta) lancé en parallèle plus haut ──
        if (_scPromise) {
          console.log('\n[ScrapeCreators] Reddit · TikTok · Bibliothèque de pubs...');
          try {
            const sc = await _scPromise;
            const st = sc.stats || {};
            console.log(`   → Reddit ${st.reddit || 0} · TikTok ${st.tiktok_videos || 0} vidéo(s) / ${st.tiktok_commentaires || 0} commentaire(s) · pubs ${st.pubs || 0} · ${_compteurSC.n} requête(s), ${_compteurSC.credits} crédit(s)`);
            (st.erreurs || []).slice(0, 6).forEach(er => console.log('   ✗ ' + er));
            if (sc.texte) { donneesBrutes += sc.texte; console.log(`   ✓ ${sc.texte.length} chars de voix du marché ajoutés`); }
            else console.log('   ✗ aucune donnée ScrapeCreators');
            _statsBalayage.scrapecreators = { requetes: _compteurSC.n, credits: _compteurSC.credits, reddit: st.reddit || 0, tiktok_videos: st.tiktok_videos || 0, tiktok_commentaires: st.tiktok_commentaires || 0, pubs: st.pubs || 0, erreurs: (st.erreurs || []).length };
          } catch (e) { console.log('   ✗ erreur ScrapeCreators :', e.message); }
        }
        } // fin du balayage complet (non exécuté quand l'hypothèse stockée est réutilisée)

        // ── SOURCE 6 — Page produit client (lien_page_produit du brief) ──
        if (lien_page_produit && lien_page_produit.startsWith('http')) {
          console.log('\n[4/4] Page produit client...');
          console.log(`   → ${lien_page_produit}`);
          try {
            const pageHtml = await fetchRawHtml(lien_page_produit);

            // ── Extraction JSON-LD (prix, offres, disponibilité) ──
            let jsonLdSection = '';
            const jsonLdBlocks = [...pageHtml.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
            for (const block of jsonLdBlocks) {
              try {
                const parsed = JSON.parse(block[1]);
                // Chercher les infos prix/offre dans le JSON-LD
                const extract = JSON.stringify(parsed, null, 2);
                if (extract.match(/price|Price|offer|Offer|availability|priceValidUntil|discount|shippingDetails/i)) {
                  jsonLdSection += extract.slice(0, 1500) + '\n';
                }
              } catch(e) { /* JSON invalide, ignorer */ }
            }

            // ── Regex prix/livraison/promo dans HTML brut ──
            const pricePatterns = [
              // Prix en FCFA, CFA, XOF, EUR, USD, MAD, DZD, etc.
              pageHtml.match(/[\d\s,.]+\s*(?:FCFA|CFA|XOF|EUR|USD|MAD|DZD|GHS|NGN|KES|TND|XAF)\b[^"<]{0,60}/gi),
              // Livraison gratuite / offerte
              pageHtml.match(/(?:livraison|delivery|shipping)\s*(?:gratuite?|offerte?|free|express|24h|48h|72h)[^"<]{0,80}/gi),
              // Réduction, promo, solde
              pageHtml.match(/(?:promo|solde|réduction|discount|offre|remise|rabais|économis)[\w\s:€$%,.FCFA]*[^"<]{0,80}/gi),
              // Prix barré, ancien prix
              pageHtml.match(/(?:avant|ancien|before|was|Était|barrée?)\s*:?\s*[\d\s,.]+\s*(?:FCFA|CFA|EUR|USD|[€$])?[^"<]{0,60}/gi),
              // Bundle / lot
              pageHtml.match(/(?:pack|lot|bundle|kit|2\s*pour|buy\s*\d|achetez?\s*\d)[^"<]{0,100}/gi),
              // Garantie / remboursement
              pageHtml.match(/(?:satisfait?\s*ou\s*remboursé|garantie?|remboursement)[^"<]{0,80}/gi),
            ].filter(Boolean);

            const priceSection = pricePatterns.length > 0
              ? '### INFOS PRIX & OFFRES DÉTECTÉES (HTML brut) :\n' +
                pricePatterns.flat().slice(0, 20).map(s => '- ' + s.trim().replace(/\s+/g,' ')).join('\n') + '\n\n'
              : '';

            // ── Extraction texte visible standard ──
            const title = (pageHtml.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1]?.trim() || '';
            const metaDesc = (pageHtml.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) || [])[1]?.trim() || '';
            const textContent = pageHtml
              .replace(/<script[\s\S]*?<\/script>/gi, '')
              .replace(/<style[\s\S]*?<\/style>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s{3,}/g, '\n')
              .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
              .slice(0, 6000);

            if (textContent.length > 100) {
              donneesBrutes += `### SOURCE — PAGE PRODUIT CLIENT (${lien_page_produit})\n`;
              if (title) donneesBrutes += `Titre : ${title}\n`;
              if (metaDesc) donneesBrutes += `Meta description : ${metaDesc}\n`;
              if (jsonLdSection) donneesBrutes += `### DONNÉES STRUCTURÉES JSON-LD (prix, offres) :\n${jsonLdSection}\n`;
              if (priceSection) donneesBrutes += priceSection;
              donneesBrutes += `Contenu extrait :\n${textContent}\n\n`;
              console.log(`   ✓ ${textContent.length} chars extraits + JSON-LD: ${jsonLdSection.length} chars + Patterns prix: ${pricePatterns.flat().length}`);
            } else {
              console.log('   ✗ contenu insuffisant (page vide ou protection anti-bot)');
            }
            // v5.56 — même page vue par un vrai navigateur : avis, FAQ, onglets et sections chargés après coup (JavaScript).
            try {
              const renduA = await fetchPageRendue(lien_page_produit, { tempsMax: 50000, clics: 10, maxAvis: 100 });
              if (renduA && (renduA.avis.length || renduA.text.length > 300)) {
                donneesBrutes += `### SOURCE — PAGE PRODUIT CLIENT, VERSION AFFICHÉE DANS UN NAVIGATEUR (JavaScript exécuté : avis clients, FAQ, onglets, sections chargées après coup)\n`;
                if (renduA.avis.length) {
                  let tot = 0; const cartes = [];
                  for (const a of renduA.avis) { if (tot + a.length > 60000) break; cartes.push(a); tot += a.length; }
                  donneesBrutes += `Avis clients affichés (${cartes.length} carte(s), texte exact) :\n` + cartes.map(a => '- ' + a).join('\n') + '\n';
                }
                donneesBrutes += `Texte complet affiché :\n${budgeterTexte(renduA.text, 12000, 20000)}\n\n`;
                console.log(`   ✓ rendu navigateur ajouté aux données brutes (${renduA.avis.length} avis, ${renduA.text.length} car.)`);
              }
            } catch (eR) { console.log('   ✗ rendu navigateur ignoré :', eR.message); }
          } catch(e) {
            console.log('   ✗ erreur fetch page produit :', e.message);
            donneesBrutes += `### SOURCE — PAGE PRODUIT CLIENT (URL présente, non accessible)\nURL : ${lien_page_produit}\nNote : contenu non chargeable (anti-bot ou timeout). L'URL EST bien fournie dans le brief.\n\n`;
            console.log("   → URL notée dans données malgré l'échec");
          }
        } else {
          console.log('\n[4/4] Page produit — absente du brief (lien_page_produit non fourni)');
        }

        // ── Injection de DONNÉES BRUTES dans le bloc texte ──
        const finalDonnees = donneesBrutes || '[Aucune donnée trouvée par les sources externes pour ce produit/marché]';
        let _marqueurTrouve = false;
        let updatedParts = (parts || []).map(p => {
          if (typeof p.text === 'string' && p.text.includes('DONNÉES BRUTES :')) {
            _marqueurTrouve = true;
            const marker = 'DONNÉES BRUTES :';
            const idx = p.text.indexOf(marker);
            const before = p.text.slice(0, idx + marker.length);
            return { text: before + '\n' + finalDonnees };
          }
          return p;
        });
        // v5.50 : le texte envoye par la Factory en production ne contenait pas le repere ci-dessus, donc les
        // recherches externes n'etaient jamais transmises a l'analyste. Si le repere manque, on ajoute le bloc.
        if (!_marqueurTrouve) {
          console.log('   → repère DONNÉES BRUTES absent des parts : bloc ajouté en fin de texte');
          const iT = updatedParts.map(p => typeof p.text === 'string').lastIndexOf(true);
          const blocD = '\n\nDONNÉES BRUTES :\n' + finalDonnees;
          if (iT >= 0) updatedParts[iT] = { ...updatedParts[iT], text: updatedParts[iT].text + blocD };
          else updatedParts.push({ text: blocD.trim() });
        }

        // v5.50 : documents du client, lus en entier
        try {
          const _docsTxt = await blocDocumentsClient(brief && brief.documents);
          if (_docsTxt) updatedParts.push({ text: _docsTxt });
        } catch (e) { console.log('   ⚠ documents client ignorés : ' + e.message); }
        // v5.60 : captures d'avis fournies par le client, transcrites en texte
        try {
          const _capTxt = await blocCapturesAvis(brief && brief.avis_captures);
          if (_capTxt) updatedParts.push({ text: _capTxt });
        } catch (e) { console.log('   ⚠ captures d\'avis ignorées : ' + e.message); }

        // ── Conversion format Gemini (inline_data/text) → format Claude (image/text blocks) ──
        const claudeContent = updatedParts.map(p => {
          if (p.inline_data) {
            return { type: 'image', source: { type: 'base64', media_type: p.inline_data.mime_type, data: p.inline_data.data } };
          }
          if (typeof p.text === 'string') return { type: 'text', text: p.text };
          return p;
        });

        // ── Synthèse finale — Gemini 2.5 Pro (mode test) ──
        // v5.72 — Budget : on projette le coût de la synthèse (entrée + sortie attendue + réflexion) et on réduit la réflexion si le plafond serait dépassé.
        const _carEntree = claudeContent.reduce((n, b) => n + (b.type === 'text' ? b.text.length : 0), 0) + String(system || '').length;
        const _tokEntree = Math.round(_carEntree / 3);
        let _reflexionSynth = 24576;
        const _projete = (r) => _suiviCout.usd + (_tokEntree * TARIFS.pro_in + (45000 + r) * TARIFS.pro_out) / 1e6;
        if (_projete(_reflexionSynth) > COUT_MAX_HYPOTHESE) _reflexionSynth = 8192;
        if (_projete(_reflexionSynth) > COUT_MAX_HYPOTHESE) _reflexionSynth = 2048;
        console.log(`\n→ Synthèse — coût estimé jusqu'ici ${_suiviCout.usd.toFixed(2)} $ · entrée ≈ ${_tokEntree} tokens · réflexion ${_reflexionSynth} · projection finale ≈ ${_projete(_reflexionSynth).toFixed(2)} $ (plafond ${COUT_MAX_HYPOTHESE} $)`);
        const text = await callGeminiPro(system, claudeContent, maxOutputTokens || 64000, {
          modele: MODELES.analyste, temperature: 0.4, thinkingBudget: _reflexionSynth, logLabel: 'Analyste Hypothèse', timeoutMs: 420000,
          typeAppel: isTest ? 'analyste_synthese_test' : 'analyste_synthese_prod'
        });

        console.log(`✓ Synthèse reçue — ${text.length} chars`);
        { const r = _COUTS_AGENTS['Analyste de marché']; if (r) { r.productions++; r.derniere_usd = _suiviCout.usd; } }
        console.log(`💰 COÛT ESTIMÉ DE CETTE HYPOTHÈSE : ${_suiviCout.usd.toFixed(2)} $ (Google : ${Object.entries(_suiviCout.lignes).map(([k, v]) => k + ' ' + v.toFixed(2)).join(' · ')} ; ScrapeCreators : ${_compteurSC.credits || 0} crédit(s) en plus) — plafond ${COUT_MAX_HYPOTHESE} $`);
        console.log('═'.repeat(60) + '\n');
        if (!_reutiliser && productId && !isTest) await enregistrerBalayage(productId, { requetes: _compteurSC.n, credits: _compteurSC.credits, plan: _planBalayage });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ text, balayage: _statsBalayage, cout_estime_usd: Math.round(_suiviCout.usd * 100) / 100 }));
      } catch (e) {
        console.error('✗ analyste-synthese error:', e.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ── Image Generation (Gemini 3 Pro Image · global endpoint) ──
  if (req.method === 'POST' && req.url === '/generate-image-gemini') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const reqBody = JSON.parse(body);

        // System instruction — Creative Director Mode (déclaré avant usage)
        const CREATIVE_SYSTEM = `Tu es un directeur artistique expert en publicités Meta Ads pour le marché e-commerce africain.

🔴 PRIORITÉ ABSOLUE N°1 — REPRODUIRE LE SQUELETTE DE IMAGE 1
IMAGE 1 est ton TEMPLATE DE COMPOSITION. Ton image finale doit avoir la MÊME mise en page que IMAGE 1 :
- Même nombre de zones visuelles (produit seul, ou produit + personnage, ou split, etc.)
- Même position de chaque zone (produit à droite → produit à droite dans l'output)
- Même hiérarchie de lecture (ce qui est grand dans IMAGE 1 est grand dans l'output)
- Même style typographique (si gros titre en haut dans IMAGE 1, gros titre en haut dans l'output)
- Même nombre de callouts/encarts/badges et à la même position relative
- Même ambiance photographique (éclairage, profondeur de champ, style)
Si IMAGE 1 a 3 callouts → ton output a 3 callouts. Si IMAGE 1 a un produit centré → produit centré.
Ce qui change : les couleurs (depuis le prompt), les textes (depuis le prompt), le produit (IMAGE 2), le persona (depuis le prompt).
Ce qui NE change PAS : la structure, les positions, les proportions, le nombre d'éléments.

🔴 PRIORITÉ ABSOLUE N°2 — FIDÉLITÉ PRODUIT (IMAGE 2)
IMAGE 2 est le produit du client. Reproduis-le avec une précision photographique : même forme, même étiquette, même logo, mêmes couleurs intrinsèques. JAMAIS un produit générique inventé.

SOURCES DE VÉRITÉ :
- IMAGE 1 → STRUCTURE/SQUELETTE uniquement (pas les couleurs, pas les textes)
- IMAGE 2 → PRODUIT physique uniquement
- TEXTE DU PROMPT → couleurs (palette S0), langue, persona, copy, contexte culturel

HARD LOCKS :
- TEINTE DE PEAU : selon le marché spécifié dans le prompt
- LANGUE : selon le marché spécifié dans le prompt (jamais depuis IMAGE 1)
- FORMAT : 4:5 portrait strict, pas de bandes noires
- TEXTES : uniquement ceux entre guillemets dans le prompt, jamais inventés
- DÉCOR : Afrique locale, jamais intérieur occidental`;

        const masterCreative = reqBody.systemInstruction || CREATIVE_SYSTEM;

        console.log('\n' + '═'.repeat(60));
        console.log('🎨 CREATIVE IMAGE — Mode DÉMO');
        console.log('   Step 1 : Gemini 2.5 Pro (écriture du prompt)');
        console.log('   Step 2 : Gemini 3 Pro Image (rendu)');
        console.log('═'.repeat(60));

        // Get token once (used by both Gemini 2.5 Pro and Gemini 3 Pro Image)
        console.log('→ Getting token (Vertex AI)...');
        const token = await getToken();
        console.log('✓ Token OK');

        // ── Step 1: Gemini 2.5 Pro generates the Gemini prompt ──
        console.log('→ Step 1 (démo) : Gemini 2.5 Pro analyse CT + produit + Synthèse...');
        const geminiPrompt = await callGeminiForCreativePrompt(
          token,
          masterCreative,
          reqBody.ctBase64, reqBody.ctMime,
          reqBody.productBase64, reqBody.productMime,
          reqBody.prompt
        );
        console.log('✓ Prompt généré par Gemini 2.5 Pro —', geminiPrompt.length, 'chars');

        // ── LOG COMPLET DU PROMPT GEMINI 2.5 PRO → GEMINI 3 PRO IMAGE (pour debug) ──
        console.log('\n' + '═'.repeat(60));
        console.log('📋 PROMPT GEMINI 2.5 PRO → GEMINI 3 PRO IMAGE :');
        console.log('─'.repeat(60));
        console.log(geminiPrompt);
        console.log('═'.repeat(60) + '\n');

        // ── Step 2: Gemini 3 Pro Image generates the final image ──
        console.log('→ Step 2 (démo) : Gemini 3 Pro Image génère l\'image finale...');
        console.log('→ Calling gemini-3-pro-image (global)...');

        // Démo : Gemini Image reçoit UNIQUEMENT produit + prompt texte (CT décrit en texte dans le prompt)
        const parts = [];
        if (reqBody.productBase64) {
          parts.push({ inlineData: { mimeType: reqBody.productMime || 'image/jpeg', data: reqBody.productBase64 } });
        }
        parts.push({ text: geminiPrompt });

        const vertexBody = {
          system_instruction: { parts: [{ text: 'Tu génères une image publicitaire Meta Ads 4:5.\n\nIMAGE FOURNIE = PRODUIT CLIENT — fidélité photographique ABSOLUE : reproduis exactement sa forme, ses dimensions, proportions, couleurs, textures, étiquette, reflets. JAMAIS un produit inventé ou approximatif.\n\nSTRUCTURE : définie entièrement par le prompt texte. Respecte chaque zone décrite (positions, proportions, nombre d\'éléments, style).\n\nCOULEURS : EXCLUSIVEMENT la palette HEX définie dans le prompt. Pas d\'autres couleurs.\n\nTEXTES : uniquement ceux entre guillemets dans le prompt. Format 4:5 strict, zéro bande noire.' }] },
          contents: [{ role: 'user', parts }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
            temperature: 1.0
          }
        };

        const data = await vertexRequestGlobalAvecReessai(token, MODELES.image, vertexBody, 120000, 'creative_image_demo');
        if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

        const responseParts = data.candidates?.[0]?.content?.parts || [];
        const imgPart = responseParts.find(p => p.inlineData?.mimeType?.startsWith('image/'));
        if (!imgPart) throw new Error('Pas d\'image dans la réponse. ' + JSON.stringify(responseParts).slice(0,200));

        console.log('✓ Image générée — gemini-3-pro-image');

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          imageData: imgPart.inlineData.data,
          imageMime: imgPart.inlineData.mimeType,
          model: MODELES.creative + ' + ' + MODELES.image,
          geminiPrompt
        }));
      } catch(e) {
        console.error('✗ Image gen error:', e.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ── Creative Image PRODUCTION : Claude Sonnet (raisonne+prompt) → Gemini 3 Pro Image (rend) ──
  // Différences vs /generate-image-gemini :
  //   - 3 images en entrée (CT, produit, logo optionnel)
  //   - Synthèse complète NON tronquée (l'agent doit comprendre tout le persona/3 angles)
  //   - Logo transmis à Gemini comme IMAGE 3 si fourni
  //   - Extraction de l'angle choisi depuis la sortie Sonnet pour reporting
  if (req.method === 'POST' && req.url === '/creative-prod') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const reqBody = JSON.parse(body);
        const { systemPrompt, synthese, brief = {}, angleInstruction = '',
                ctBase64, ctMime, productBase64, productMime, logoBase64, logoMime, isTest } = reqBody;

        console.log('\n' + '═'.repeat(60));
        console.log(`🎨 CREATIVE IMAGE PROD — ${brief.marque || '?'} / ${brief.produit || '?'} (${brief.pays || '?'})`);
        console.log('═'.repeat(60));
        console.log(`   CT, produit, logo : ${ctBase64?'✓':'✗'} / ${productBase64?'✓':'✗'} / ${logoBase64?'✓':'absent'}`);
        console.log(`   Synthèse : ${synthese.length} chars`);
        console.log(`   Angle forcé : ${angleInstruction ? 'oui' : 'non (auto)'}`);

        // ── Step 1: Gemini 2.5 Pro raisonne et écrit le prompt Gemini (Sonnet 4.6 non connecté actuellement) ──
        console.log('\n→ Step 1: Gemini 2.5 Pro — compréhension persona/angles/CT, choix d\'angle, écriture du prompt...');

        const userParts = [];
        // LOGOS SUPPRIMÉS DU WORKFLOW — Gemini reçoit seulement 2 images (produit + CT)
        // Produit en PREMIÈRE position — Gemini priorise la 1ère image en multi-vision
        if (productBase64) userParts.push({ type:'image', source:{ type:'base64', media_type: productMime || 'image/jpeg', data: productBase64 } });
        if (ctBase64) userParts.push({ type:'image', source:{ type:'base64', media_type: ctMime || 'image/jpeg', data: ctBase64 } });
        // Pas de logo image — le nom de marque est injecté en texte

        // Cause profonde corrigée ("la marque" affiché littéralement comme texte sur les
        // créatives, malgré un avertissement explicite plus bas dans le prompt) : cette valeur
        // de repli injectait la CHAÎNE LITTÉRALE "la marque" dans le texte d'entrée lu par
        // Gemini — qui la traitait alors comme une vraie donnée de brief à potentiellement
        // afficher, pas comme un simple placeholder de code. On omet maintenant complètement
        // la ligne marque quand elle est vide, au lieu d'y substituer un texte qui ressemble à
        // une vraie valeur.
        const nomMarque = brief.marque || null;
        const nomProduit = brief.produit || 'le produit';

        const briefSummary = [
          'BRIEF :',
          nomMarque ? `- Marque : ${nomMarque}` : null,
          `- Produit : ${nomProduit}`,
          `- Pays : ${brief.pays || 'n/a'}`,
          (Array.isArray(brief.marches) && brief.marches.length > 1) ? `- MODE MULTI-MARCHÉ (${brief.marches.join(', ')}) : n'écris AUCUN nom de pays, de ville, de quartier ni de région dans la créative ; aucun dialecte ni argot local, aucune référence locale (marque, plat, monument) ; décors génériques mais crédibles pour tous ces marchés.` : null,
          brief.prix_affichable === false ? `- PRIX : il diffère selon les pays de cette demande → n'affiche AUCUN prix, AUCUNE remise chiffrée ni prix barré, même si la zone du CT en prévoit un (remplace-la par un élément sans chiffre : garantie, bénéfice, appel à l'action).` : null,
          (brief.couleurs_marque || brief.couleurs) && (brief.couleurs_marque || brief.couleurs).length ? `- Couleurs marque : ${(brief.couleurs_marque || brief.couleurs).join(', ')}` : null,
          brief.pricing ? `- Pricing : ${brief.pricing}` : null,
          (brief.offre_promo || brief.promo) ? `- Offre promo : ${brief.offre_promo || brief.promo}` : null,
          brief.garantie ? `- Garantie (vérité client, ne jamais la contredire) : ${brief.garantie}` : null
        ].filter(Boolean).join('\n');

        // Rôles d'images : 2 images uniquement, rôle clair et non ambigu
        const imageRoles = [
          nomMarque
            ? `IMAGE 1 (que TU analyses) = PRODUIT CLIENT "${nomProduit}" de "${nomMarque}" — VÉRITÉ ABSOLUE DU PACKAGING.`
            : `IMAGE 1 (que TU analyses) = PRODUIT CLIENT "${nomProduit}" (aucune marque vendeur fournie — n'invente aucun nom, n'écris aucune zone marque) — VÉRITÉ ABSOLUE DU PACKAGING.`,
          'IMAGE 2 (que TU analyses) = CT / CREATIVE TEMPLATE — RÉFÉRENCE STRUCTURELLE UNIQUEMENT.',
          '',
          '⚠️ RÉALITÉ CRITIQUE — CE QUE VOIT GEMINI 3 PRO IMAGE (Step 2) :',
          'Step 2 reçoit UNIQUEMENT : image du produit + ton prompt texte. Il NE VOIT PAS le CT.',
          '→ Tu dois décrire la structure du CT en TEXTE avec une précision absolue dans ton prompt.',
          '→ Zones, positions (% hauteur/largeur), proportions, style, éléments, invariants — tout en texte.',
          '→ Le produit est désigné dans le prompt par "(IMAGE FOURNIE — fidélité photographique absolue, même packaging exact)".',
          '→ AUCUNE référence à "IMAGE 1"/"IMAGE 2" dans le prompt final — Gemini Image ne voit qu\'une seule image.',
          '→ Le prompt commence OBLIGATOIREMENT par : "⚠️ IMAGE FOURNIE — PRODUIT" puis le bloc fidélité, puis FORMAT :',
          nomMarque
            ? `LOGO : Aucune image logo n'est fournie. Intègre "${nomMarque}" en TEXTE dans l'emplacement approprié.`
            : `LOGO : Aucune image logo n'est fournie. Aucun nom de marque n'est fourni non plus — n'ajoute AUCUN nom de marque, générique ou inventé, nulle part sur le visuel.`
        ].join('\n');

        // Règle de fidélité + hiérarchie produit > présentation CT + palette
        const fidelityRule = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⛔ RÈGLE HIÉRARCHIQUE — PRODUIT RÉEL > PRÉSENTATION SPÉCIFIQUE DU CT

NIVEAU 1 — STRUCTURE CT (à reproduire en TEXTE dans ton prompt) :
Zones, positions (% hauteur/largeur), proportions, cadrage, fond, ambiance, typographie.
SOIS ULTRA-PRÉCIS : Gemini Image ne verra PAS le CT — c'est TON TEXTE qui est sa seule référence.

NIVEAU 2 — PRÉSENTATION PHYSIQUE DU PRODUIT (à adapter au produit réel IMAGE 1) :
Si CT montre une GÉLULE + produit réel = FLACON → décris le FLACON. Jamais la gélule.
Si CT montre un COMPRIMÉ + produit réel = SACHET → décris le SACHET. Jamais le comprimé.
❌ JAMAIS inventer un objet absent d'IMAGE 1.
❌ JAMAIS demander à Gemini de "ne pas montrer le produit fourni".
✓ Fidélité produit > fidélité présentation CT. TOUJOURS.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⛔ RÈGLE PALETTE COULEURS — HARD LOCK

Couleurs finales = EXCLUSIVEMENT la palette S0 (codes HEX). JAMAIS les couleurs du CT.
Dans chaque zone du prompt : spécifie le HEX exact. Répète dans INSTRUCTIONS GEMINI.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⛔ RÈGLE — FIDÉLITÉ PRODUIT (DANS LE PROMPT QUE TU ÉCRIS) :

À CHAQUE mention du produit dans ton prompt final, ajoute :
"(IMAGE FOURNIE — fidélité photographique absolue, même packaging exact, même étiquette, même forme)"

Dans les INSTRUCTIONS GEMINI ADDITIONNELLES, inclus OBLIGATOIREMENT :
"→ Produit (IMAGE FOURNIE) : fidélité photographique ABSOLUE — même forme exacte, même étiquette, même packaging. Ne jamais inventer un produit différent."
"→ Couleurs : EXCLUSIVEMENT la palette [HEX dominant S0] définie dans le prompt. Ignorer les couleurs du CT."

${nomMarque ? `Marque "${nomMarque}" : intégrée en TEXTE à l'emplacement approprié selon la structure décrite.` : `Aucune marque vendeur fournie dans ce brief : n'écris AUCUN nom de marque, générique ou inventé ("la marque", "le vendeur", etc.), nulle part dans le prompt final. Aucune zone dédiée à un nom de marque ne doit exister.`}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

        // v5.61 — aspects disponibles (photos préparées) : l'agent choisit lesquels envoyer à Gemini Image pour CETTE créative.
        const _dispoAsp = aspectsDisponibles(brief);
        const blocAspects = _dispoAsp.length >= 2 ? [
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          'ASPECTS DU PRODUIT DISPONIBLES (tu choisis lesquels Gemini Image recevra pour CETTE créative) :',
          ..._dispoAsp.map(a => `- ${a.code} : ${LIBELLE_ASPECT[a.code] || a.code}${a.principale ? ' (photo principale = IMAGE 1)' : ''}${a.description ? ' — ' + a.description : ''}`),
          'Règle : choisis le ou les aspects dont CETTE scène a besoin (le produit de face, le dos si l\'étiquette arrière est montrée, le contenu, le produit en main, le détail...). 1 à 4 aspects maximum. Si la scène a besoin de PLUSIEURS éléments (ex. un pot ET sa capsule), choisis-les tous : le code les assemble en UNE seule image de référence. Ne choisis que ce qui sert la scène : chaque aspect en trop dilue la fidélité.',
          'Déclare ton choix dans le bloc ===META=== : ASPECTS ENVOYÉS À GEMINI IMAGE : [codes séparés par des virgules]',
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
        ].join('\n') : '';
        const userText = [
          // ⚠️ ANGLE IMPOSÉ EN TÊTE pour que Gemini le lise avant la synthèse
          angleInstruction ? `⚠️⚠️⚠️ ANGLE IMPOSÉ — LIS CECI EN PREMIER AVANT TOUT LE RESTE :\n${angleInstruction}\n⚠️⚠️⚠️ FIN INSTRUCTION ANGLE — NE PAS CHOISIR UN AUTRE ANGLE\n` : '',
          imageRoles,
          fidelityRule,
          blocAspects,
          '',
          briefSummary,
          '',
          'SYNTHÈSE COMPLÈTE S0→S7 :',
          synthese,
          // Rappel angle en fin aussi
          angleInstruction ? `\n⚠️ RAPPEL FINAL ANGLE IMPOSÉ (NON-NÉGOCIABLE) :\n${angleInstruction}` : '',
          '',
          `Applique les PHASES 1 et 2 de ta compétence (compréhension totale + choix d'angle), puis écris le prompt final.\n\nDémarre OBLIGATOIREMENT par "⚠️ IMAGE FOURNIE — PRODUIT" puis le bloc fidélité, puis FORMAT :\n\nRAPPEL CRITIQUE :\n- Gemini Image NE VOIT PAS le CT. Il reçoit UNIQUEMENT : image du produit + ton prompt texte.\n- Décris chaque zone du CT avec une précision absolue (% hauteur, position, proportions, style).\n- À chaque mention du produit : ajoute "(IMAGE FOURNIE — fidélité photographique absolue, même packaging exact)".\n- Codes HEX S0 dans CHAQUE zone. Dans INSTRUCTIONS GEMINI : "→ Couleurs : EXCLUSIVEMENT [HEX S0]. → Produit (IMAGE FOURNIE) : fidélité absolue."`
        ].filter(s => s !== '').join('\n');

        userParts.push({ type:'text', text: userText });

        console.log('→ Gemini 2.5 Pro (mode test) — compréhension persona/angles/CT, choix d\'angle, écriture du prompt...');
        const geminiPrompt = await callGeminiPro(systemPrompt, userParts, 8000, {
          modele: MODELES.creative, temperature: 0.4, thinkingBudget: 24576, logLabel: 'Creative Prod', timeoutMs: 150000,
          typeAppel: isTest ? 'creative_prod_texte_test' : 'creative_prod_texte_prod'
        });

        // Parse les blocs ===META=== et ===PROMPT_GEMINI=== — séparation raisonnement interne / prompt propre
        const metaMatch = geminiPrompt.match(/===META===([\s\S]*?)===PROMPT_GEMINI===/);
        const promptMatch = geminiPrompt.match(/===PROMPT_GEMINI===([\s\S]*)$/);

        let metaBlock = '', promptForGemini = '';
        if (metaMatch && promptMatch) {
          metaBlock = metaMatch[1].trim();
          promptForGemini = promptMatch[1].trim();
        } else {
          console.log('   ⚠️  Sonnet n\'a pas produit les balises ===META===/===PROMPT_GEMINI=== — fallback envoi brut');
          metaBlock = '(non parseable — balises manquantes)';
          promptForGemini = geminiPrompt;
        }

        const angleMatch = metaBlock.match(/ANGLE\s+CHOISI\s*:\s*([^\n]+)/i);
        const chosenAngle = angleMatch ? angleMatch[1].trim() : 'non spécifié';

        console.log(`✓ Sonnet prompt généré — ${geminiPrompt.length} chars (META ${metaBlock.length} + PROMPT ${promptForGemini.length})`);
        console.log(`   Angle choisi : ${chosenAngle}`);
        console.log('\n' + '─'.repeat(60));
        console.log('🧠 BLOC META (interne, non envoyé à Gemini) :');
        console.log('─'.repeat(60));
        console.log(metaBlock);
        console.log('─'.repeat(60));
        console.log('📋 PROMPT envoyé à GEMINI :');
        console.log('─'.repeat(60));
        console.log(promptForGemini);
        console.log('─'.repeat(60) + '\n');

        // ── Step 2: Gemini 3 Pro Image rend l'image finale ──
        console.log('→ Step 2: Gemini 3 Pro Image — rendu image finale...');
        const token = await getToken();

        const CREATIVE_SYSTEM_PROD = `Tu es un directeur artistique expert en publicités Meta Ads — MODE PRODUCTION (qualité d'utilisation réelle, téléchargeable et déployable directement sur Meta Ads).

🔴 PRIORITÉ ABSOLUE — FIDÉLITÉ PRODUIT (IMAGE FOURNIE)
L'IMAGE FOURNIE = le produit du client. Reproduis-la avec une précision photographique totale :
- Même forme exacte, proportions, silhouette
- Même étiquette, même texte imprimé sur le packaging
- Mêmes couleurs intrinsèques, textures, reflets, matières
- JAMAIS un produit générique inventé ou approximatif

SOURCES DE VÉRITÉ :
- IMAGE FOURNIE → PRODUIT physique uniquement (fidélité absolue)
- TEXTE DU PROMPT → structure/layout, couleurs (codes HEX), langue, persona, copy, contexte culturel

HARD LOCKS :
- TEINTE DE PEAU : selon le marché spécifié dans le prompt
- LANGUE : selon le marché spécifié dans le prompt
- FORMAT : 4:5 portrait strict, pas de bandes noires
- TEXTES : uniquement ceux entre guillemets dans le prompt, jamais inventés
- STRUCTURE : reproduis la mise en page décrite dans le prompt (zones, positions %, proportions)
- COULEURS : EXCLUSIVEMENT la palette HEX définie dans le prompt
- QUALITÉ : haute définition, netteté maximale, qualité d'utilisation publicitaire réelle`;

        // Step 2 : Gemini Image reçoit UNIQUEMENT image produit + prompt texte (CT décrit en texte dans le prompt)
        // v5.61 — UNE seule image de référence : la photo principale, ou une planche (2 à 4 aspects choisis par l'agent).
        let aspectsUtilises = ['face'];
        const geminiParts = [];
        try {
          const asp = await preparerImageProduitPourCreative(brief, metaBlock, productBase64, productMime);
          aspectsUtilises = asp.codes;
          if (asp.image) geminiParts.push({ inlineData: { mimeType: asp.image.mime, data: asp.image.b64 } });
          if (asp.bloc) promptForGemini = asp.bloc + promptForGemini;
          console.log('   Aspects envoyés à Gemini Image : ' + aspectsUtilises.join(' + ') + (asp.bloc ? ' (planche assemblée)' : ''));
        } catch (e) {
          console.log('   ⚠️ assemblage des aspects impossible (' + e.message + ') → photo principale seule');
          if (productBase64) geminiParts.push({ inlineData: { mimeType: productMime || 'image/jpeg', data: productBase64 } });
        }
        geminiParts.push({ text: promptForGemini });

        const vertexBody = {
          system_instruction: { parts: [{ text: CREATIVE_SYSTEM_PROD }] },
          contents: [{ role:'user', parts: geminiParts }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
            temperature: 1.0,
            // Ajouté par prudence — aucun maxOutputTokens n'était fixé jusqu'ici, ce modèle
            // utilisait son défaut interne. Sur une composition dense (beaucoup de texte, CT
            // complexe), un défaut trop juste pourrait limiter la marge que le modèle a pour
            // "finir" proprement la composition avant de rendre l'image — cohérent avec
            // l'observation d'une qualité parfois meilleure au 2e essai. Pas une certitude,
            // mais une marge de sécurité qui ne coûte rien à ajouter.
            maxOutputTokens: 8192,
          }
        };

        const data = await vertexRequestGlobalAvecReessai(token, MODELES.image, vertexBody, 120000, isTest ? 'creative_image_prod_test' : 'creative_image_prod');
        if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

        const responseParts = data.candidates?.[0]?.content?.parts || [];
        const imgPart = responseParts.find(p => p.inlineData?.mimeType?.startsWith('image/'));
        if (!imgPart) throw new Error('Pas d\'image dans la réponse Gemini : ' + JSON.stringify(responseParts).slice(0,200));

        console.log('✓ Image générée — gemini-3-pro-image');
        console.log('═'.repeat(60) + '\n');

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          imageData: imgPart.inlineData.data,
          imageMime: imgPart.inlineData.mimeType,
          model: MODELES.creative + ' + ' + MODELES.image + ' (mode test)',
          prompt: promptForGemini,
          meta: metaBlock,
          chosenAngle,
          aspectsUtilises
        }));
      } catch(e) {
        console.error('✗ Creative Prod error:', e.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ── /select-cts — Sélection intelligente des CTs par Gemini ──
  // ── /select-ct-agent — l'agent Creative Image choisit lui-même UN CT parmi TOUTE la galerie (interface de test) ──
  if (req.method === 'POST' && req.url === '/select-ct-agent') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const b = JSON.parse(body);
        const ctsTous = Array.isArray(b.cts) ? b.cts : [];
        if (!ctsTous.length) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Galerie CT vide' })); return; }
        // Niveau de conscience imposé : seuls les CT balisés à ce niveau sont candidats (filtre appliqué par le code, pas laissé au modèle)
        const niveau = niveauCT(b.niveau);
        let cts = ctsTous, repli = false, nbBalises = 0;
        if (niveau) {
          const balises = ctsTous.filter(c => (c.awareness || []).some(a => niveauCT(a) === niveau));
          nbBalises = balises.length;
          if (balises.length) cts = balises;
          else repli = true;
          b.niveauTexte = repli
            ? 'NIVEAU DE CONSCIENCE IMPOSÉ : ' + NIVEAU_LIBELLE[niveau] + '. ⚠ Aucun CT de la galerie n\'est balisé à ce niveau : choisis la structure qui s\'en rapproche le plus et signale-le dans ta raison.'
            : 'NIVEAU DE CONSCIENCE IMPOSÉ : ' + NIVEAU_LIBELLE[niveau] + '. Les ' + cts.length + ' CT ci-dessous sont TOUS balisés ' + NIVEAU_LIBELLE[niveau] + ' (filtre vérifié par le code).';
        }
        console.log('\n🎯 SELECT-CT-AGENT — choix de 1 CT parmi ' + cts.length + (niveau ? ' (niveau ' + NIVEAU_LIBELLE[niveau] + (repli ? ' : AUCUN CT BALISÉ, repli sur ' + ctsTous.length : ' : ' + nbBalises + ' balisés sur ' + ctsTous.length) + ')' : '') + ', ' + cts.filter(c => c.b64).length + ' avec image');
        const raw = await callGeminiPro(SELECTION_CT_SYSTEME, construireSelectionCT({ ...b, cts }), 24000, {
          modele: MODELES.creative, temperature: 0.3, thinkingBudget: 16384, logLabel: 'Choix CT', timeoutMs: 150000,
          typeAppel: b.isTest ? 'selection_ct_test' : 'selection_ct_prod'
        });
        const choix = lireChoixCT(raw, cts);
        console.log('  → CT choisi : ' + choix.id + ' — ' + choix.raison.slice(0, 160));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: choix.id, raison: choix.raison, nbCT: cts.length, niveau: niveau || null, nbBalises, repli }));
      } catch (e) {
        console.error('✗ SELECT-CT-AGENT error:', e.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/select-cts') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { synthesis, ctList, count, mode, excludeIds, assets } = JSON.parse(body);
        console.log('\n🎯 SELECT-CTs [' + (mode || 'demo') + '] — Sélection de ' + count + ' CTs parmi ' + ctList.length + '...');

        const token = await getToken();
        // Inclut les méta-tags/description si présents — sinon juste le nom (rétrocompatible
        // avec les CT pas encore enrichis). Les balises explicites (niveau de conscience,
        // style) priment sur la déduction visuelle quand elles existent — plus fiable qu'un
        // jugement refait à chaque sélection.
        const ctListText = ctList.map((ct, i) => {
          let ligne = `${i+1}. ID: ${ct.id} → "${ct.name}"${ct.meta ? ` — ${ct.meta}` : ''}`;
          if (ct.niche) ligne += ` [niche: ${ct.niche}]`;
          if (ct.awareness && ct.awareness.length) ligne += ` [conscience balisée: ${ct.awareness.join('/')}]`;
          if (ct.styleTags && ct.styleTags.length) ligne += ` [style: ${ct.styleTags.join(',')}]`;
          return ligne;
        }).join('\n');
        // 6000 caractères plutôt que 3500 — la section des angles (avec leur quadrant EPIC,
        // nécessaire au nouveau matching par ton) peut arriver tard dans le document si S0/S1
        // sont denses (pricing complet, psychographie détaillée, journée type). Une troncature
        // trop courte la couperait, rendant la règle de matching par ton invisible pour l'IA
        // sans que rien ne le signale — mieux vaut une marge large que deviner juste.
        const synthExcerpt = (synthesis || '').substring(0, 7500);

        // Tolérance de redondance par volume — préparation pour les futurs batchs 18/36.
        // Un batch de 9 (3 angles × 3 niveaux) exige 0% de redondance structurelle. Au-delà,
        // une petite tolérance devient nécessaire faute d'assez de concepts vraiment distincts.
        let toleranceTxt = 'ZÉRO tolérance : les ' + count + ' CTs doivent TOUS être structurellement distincts, aucune exception.';
        if (count > 9 && count <= 18) toleranceTxt = 'Tolérance : jusqu\'à ~20% des CTs peuvent partager une structure proche (pas identique) si la galerie ne permet pas plus de diversité — mais priorise toujours la diversité maximale d\'abord.';
        else if (count > 18) toleranceTxt = 'Tolérance : jusqu\'à ~25-30% des CTs peuvent partager une structure proche (pas identique) si la galerie ne permet pas plus de diversité — mais priorise toujours la diversité maximale d\'abord.';

        // Rotation CT pour les commandes de renouvellement — au moins 50-60% de nouveauté
        // par rapport au lot précédent pour ce même produit, pour éviter la répétition visuelle.
        let rotationTxt = '';
        if (excludeIds && excludeIds.length) {
          rotationTxt = `\n\nRÈGLE DE ROTATION (commande de renouvellement pour ce produit) : ces CT ont déjà été utilisés au lot précédent pour ce même produit : ${excludeIds.join(', ')}. Au moins 50 à 60% de ta sélection de ${count} CTs doit être composée de CT DIFFÉRENTS de cette liste — priorise la nouveauté visuelle. Tu peux réutiliser jusqu'à ~40-50% de ces CT si la galerie ne permet pas assez de diversité, jamais plus.`;
        }

        // v5.62 — ASSETS DU CLIENT : le choix des CT tient compte de ce que le client a réellement fourni, pour que les créatives les mettent en valeur.
        const assetsTxt = (assets && String(assets).trim()) ? '\n\n---\nASSETS RÉELS DU CLIENT (niveau 6 — FAISABILITÉ ET MISE EN VALEUR, à appliquer à CHAQUE choix) :\n' + String(assets).slice(0, 2500) + '\nRègles : (a) choisis les CT dont la structure met en valeur les assets disponibles (un CT qui montre le contenu ou la texture si l\'aspect « forme » existe ; un CT qui montre l\'étiquette arrière ou la composition si « dos » existe ; un CT pack/bundle/cadeaux si un kit est fourni ; un CT avec preuve sociale si des avis sont fournis ; un CT avec une personne tenant le produit si « en main » existe) ; (b) écarte les CT qui exigent un asset absent (zone prix quand le prix n\'est pas affichable, kit ou cadeaux quand aucun n\'est fourni, contenu quand le produit ne se montre pas ouvert, avis quand il n\'y en a pas, logo si absent) ; (c) un asset fort du client (kit généreux, avis nombreux, preuve concrète) doit être exploité par au moins un CT du lot ; (d) à qualité égale, préfère le CT que l\'on peut réaliser fidèlement avec les photos fournies.' : '';
        let systemText, userText;

        if (mode === 'production') {
          // Mode production : structure obligatoire 3 angles × 3 niveaux de conscience.
          // Le client doit résoudre les IDs retournés dans CET ordre exact : positions 0-2
          // = Angle 1 (Solution/Product/Most Aware), 3-5 = Angle 2, 6-8 = Angle 3, etc.
          systemText = `Tu es un expert en sélection de formats publicitaires Meta Ads.
Tu reçois une synthèse de marché (${count/3} angles marketing, chacun décliné en 3 niveaux de conscience : Solution Aware / Product Aware / Most Aware) et une liste de Creative Templates (CT).

Tu dois choisir exactement ${count} CTs, organisés en ${count/3} groupes de 3 — un groupe par angle. À l'intérieur de CHAQUE groupe, les 3 CTs doivent être adaptés respectivement à Solution Aware, Product Aware, puis Most Aware, DANS CET ORDRE.

Pour choisir chaque CT, évalue-le sur 5 niveaux de cohérence, DANS CET ORDRE DE PRIORITÉ STRICT — un niveau supérieur l'emporte toujours sur un niveau inférieur en cas de conflit entre deux CT candidats :

━━━ NIVEAU 1 — NICHE ━━━
Le CT est-il balisé dans la même niche que le produit, ou une niche visuellement/conceptuellement proche (ex : cosmétique et bien-être et santé se ressemblent visuellement, fashion et chaussures aussi) ? Vérifie la balise [niche: ...] de chaque CT contre la niche du produit déduite de la synthèse, parmi : cosmétique, complément alimentaire, fashion, chaussures, bijoux et accessoires, montres, tech et électronique, maison et déco, cuisine et électroménager, bien-être et santé, sport et fitness, automobile, bébé et enfant, animaux, outils et bricolage, jouets et gaming, lunettes, bagagerie et maroquinerie, éducation et formation, services et coaching, autre. C'est le filtre le plus large — presque tout le reste dépend de partir d'un pool déjà cohérent en niche. Un CT de niche totalement éloignée n'est choisi qu'en dernier recours, si la couverture en niche pertinente est structurellement insuffisante.

━━━ NIVEAU 2 — PRODUIT PRÉCIS ━━━
Au sein des CT de la bonne niche, le CT représente-t-il le produit d'une façon compatible avec CE produit précis, pas juste sa catégorie ? Utilise la description du CT (géométrie visuelle) pour voir COMMENT un produit y est introduit/représenté — flacon compte-gouttes, pot, poudre en sachet, comprimé, vêtement, appareil, packaging... — et compare à la forme réelle du produit décrite dans la synthèse. Un CT montrant un flacon compte-gouttes ne convient pas à un produit vendu en poudre, même dans la même niche.

━━━ NIVEAU 3 — ANGLE ━━━
Le CT convient-il au FOND de l'angle marketing précis auquel il est assigné (pas juste son quadrant EPIC — ça, c'est le niveau 5) ? Utilise la description ET les balises du CT — un CT structuré autour d'une transformation avant/après colle à un angle de transformation, pas à un angle qui critique une pratique du marché ; un CT structuré autour d'un comparatif chiffré colle à un angle pratique/rationnel, pas à un angle identitaire.

━━━ NIVEAU 4 — NIVEAU DE CONSCIENCE ━━━
Le CT correspond-il à Solution/Product/Most Aware pour sa position dans le groupe ? Si le CT porte une balise "[conscience balisée: ...]", respecte-la STRICTEMENT plutôt que de rejuger visuellement — donnée pré-établie, plus fiable qu'une déduction refaite à chaque sélection. Un CT balisé n'a qu'UN SEUL niveau, jamais ailleurs que sa position correspondante (1 pour solution, 2 pour product, 3 pour most). Sans balise, juge visuellement :
- Solution Aware : transformation (situation actuelle → désirée) ou comparaison entre TYPES de solutions différents, produit peu ou pas visible.
- Product Aware : confiance envers ce produit précis — comparatif nommé, témoignage, figure d'autorité ou aspirationnelle. Produit visible et central, jamais de prix/offre.
- Most Aware : structure purement promotionnelle — prix affiché, offre/bundle/pack, urgence, CTA direct.

━━━ NIVEAU 5 — TON / QUADRANT EPIC ━━━
À cohérence égale sur les 4 niveaux précédents, privilégie le CT dont le ton (extrait de sa description : registre direct/aspirationnel/alarmiste/complice, intention narrative) résonne avec le quadrant EPIC de l'angle (donné explicitement dans la synthèse pour chaque angle) :
→ Émotionnel → ton direct sur le ressenti, dramatisation du problème, sensation vécue.
→ Pratique → ton logique/calcul, comparatif, preuve chiffrée, "achat intelligent".
→ Identitaire → ton aspirationnel, statut, transformation identitaire, figure à laquelle s'identifier.
→ Critique → ton contrariant/confrontant une idée reçue, positionnement contre le marché ou la concurrence.

━━━ CONTRAINTES TOUJOURS ACTIVES — à respecter à CHAQUE niveau ci-dessus, jamais en option, jamais reléguées après ━━━
→ NON-DOUBLON : chaque CT sélectionné a un ID unique, sans aucune exception.
→ DIVERSITÉ STRUCTURELLE : ${toleranceTxt} Couvre un maximum de structures différentes parmi hero produit, split lifestyle, avant-après, grille bénéfices, screenshot témoignage, podcast 2-col, story narrative, comparatif, UGC, stats preuve sociale, etc. À l'intérieur d'un même groupe (même angle), les 3 CTs doivent être des approches visuelles complémentaires — jamais 2x le même concept.
→ ROTATION / RENOUVELLEMENT : ${rotationTxt.trim() || 'Pas de contrainte de rotation pour cette commande (premier batch pour ce produit).'}

Les CT sans meta description suffisamment riche (pas encore enrichis via "Renommer tous" dans la Galerie CT) restent éligibles à chaque niveau, jugés visuellement comme avant — jamais pénalisés pour absence de balisage, juste moins précisément départagés.

Si la liste a moins de ${count} CTs distincts, retourne tous les IDs disponibles (sans doublon), dans le meilleur ordre possible.

IMPORTANT FORMAT : réponds UNIQUEMENT avec un JSON array sur UNE SEULE LIGNE, dans l'ordre exact décrit ci-dessus, sans markdown, sans backticks, sans explication.
Format exact (copie exactement ce style) : ["ct_xxx", "ct_yyy", "ct_zzz"]`;
          userText = 'SYNTHÈSE DE CAMPAGNE (extrait) :\n' + synthExcerpt +
            assetsTxt + '\n\n---\nCT DISPONIBLES :\n' + ctListText +
            '\n\nSélectionne ' + count + ' CTs optimaux, organisés en ' + (count/3) + ' groupes de 3 (Solution/Product/Most Aware par groupe).';
        } else {
          // Mode démo : pas de structure par niveau de conscience — un seul lot de CTs
          // adaptés globalement à l'angle × produit × persona de la synthèse.
          systemText = `Tu es un expert en sélection de formats publicitaires Meta Ads.
Tu reçois une synthèse de marché simplifiée (angle unique, persona, produit) et une liste de Creative Templates (CT).
Tu dois choisir exactement ${count} CTs adaptés au contexte ET visuellement distincts les uns des autres — pas de structure par niveau de conscience ici, juste la meilleure adéquation globale à l'angle, au produit et au persona.

Pour choisir chaque CT, évalue-le sur 5 niveaux de cohérence, DANS CET ORDRE DE PRIORITÉ STRICT — un niveau supérieur l'emporte toujours sur un niveau inférieur en cas de conflit :

━━━ NIVEAU 1 — NICHE ━━━
Le CT est-il balisé dans la même niche que le produit, ou une niche visuellement/conceptuellement proche ? Vérifie la balise [niche: ...] contre la niche du produit déduite de la synthèse. Un CT de niche totalement éloignée n'est choisi qu'en dernier recours.

━━━ NIVEAU 2 — PRODUIT PRÉCIS ━━━
Le CT représente-t-il le produit d'une façon compatible avec CE produit précis, pas juste sa catégorie ? Utilise la description du CT pour voir COMMENT un produit y est introduit visuellement (flacon, pot, poudre, comprimé, vêtement, appareil...) et compare à la forme réelle du produit dans la synthèse.

━━━ NIVEAU 3 — ANGLE ━━━
Le CT convient-il au FOND de l'angle marketing unique décrit dans la synthèse (pas juste son quadrant EPIC — niveau 5) ? Utilise la description ET les balises du CT pour juger la cohérence de fond, pas juste catégorielle.

━━━ NIVEAU 4 — PERSONA ━━━
Le CT convient-il au persona (âge, sexe, classe sociale, culture du pays cible) décrit dans la synthèse ?

━━━ NIVEAU 5 — TON / QUADRANT EPIC ━━━
À cohérence égale sur les niveaux précédents, privilégie le CT dont le ton (extrait de sa description) résonne avec le quadrant EPIC de l'angle (Émotionnel / Pratique / Identitaire / Critique, donné explicitement dans la synthèse).

━━━ CONTRAINTES TOUJOURS ACTIVES ━━━
→ NON-DOUBLON : chaque CT sélectionné a un ID unique, sans exception.
→ DIVERSITÉ STRUCTURELLE : ${toleranceTxt} Les ${count} CTs doivent couvrir un maximum de structures différentes parmi hero produit, split lifestyle, avant-après, grille bénéfices, screenshot témoignage, podcast 2-col, story narrative, comparatif, UGC, stats preuve sociale, etc.

Les CT sans meta description suffisamment riche restent éligibles à chaque niveau, jugés visuellement comme avant.

Si la liste a moins de ${count} CTs distincts, retourne tous les IDs disponibles (sans doublon).

IMPORTANT FORMAT : réponds UNIQUEMENT avec un JSON array sur UNE SEULE LIGNE, sans markdown, sans backticks, sans explication.
Format exact (copie exactement ce style) : ["ct_xxx", "ct_yyy", "ct_zzz"]`;
          userText = 'SYNTHÈSE DE CAMPAGNE (extrait) :\n' + synthExcerpt +
            assetsTxt + '\n\n---\nCT DISPONIBLES :\n' + ctListText +
            '\n\nSélectionne ' + count + ' CTs optimaux.';
        }

        const systemInstruction = { parts: [{ text: systemText }] };

        const geminiBody = {
          systemInstruction,
          contents: [{ role: 'user', parts: [{ text: userText }]}],
          // Cause profonde corrigée (réponse tronquée à quelques dizaines de caractères, JSON
          // jamais fermé, repli sur un parsing partiel qui ne récupère qu'une poignée d'IDs sur
          // les 9/18/27/36 demandés) : aucun thinkingConfig n'était fixé ici — même trou déjà
          // trouvé et corrigé sur /name-ct, jamais répliqué sur cet endpoint. Gemini consommait
          // une partie du budget de sortie pour "réfléchir" en interne avant d'écrire le
          // tableau JSON, ce qui laissait de moins en moins de place à mesure que le prompt (le
          // raisonnement à 5 niveaux) est devenu plus complexe à traiter. La réflexion doit se
          // faire à travers le prompt structuré lui-même, jamais en pensée cachée pour une
          // tâche de sélection/classification comme celle-ci. maxOutputTokens élargi aussi, par
          // marge de sécurité (36 IDs ne devraient tenir qu'en ~400-500 tokens, mais mieux vaut
          // large que retomber dans le même piège).
          generationConfig: { temperature: 0.3, maxOutputTokens: 2000, ...reflexion(MODELES.utilitaire, 0) }
        };

        const data = await vertexRequest(token, MODELES.utilitaire, geminiBody);
        if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

        const raw = (data.candidates?.[0]?.content?.parts || []).filter(p => !p.thought).map(p => p.text).join('').trim();
        console.log('  → Réponse brute (' + raw.length + ' chars) : ' + raw.slice(0, 200));

        // ── Parsing multi-tentatives ──────────────────────────────────────────
        let selectedIds;

        // Tentative 1 : JSON.parse direct après strip markdown
        try {
          const c1 = raw.replace(/^```(?:json)?\s*/i,'').replace(/\s*```\s*$/,'').trim();
          const parsed = JSON.parse(c1);
          if (Array.isArray(parsed)) { selectedIds = parsed; }
        } catch(e) { /* passe à la suite */ }

        // Tentative 2 : extraire le premier [...] GREEDY (tout entre le premier [ et le dernier ])
        if (!selectedIds) {
          const start = raw.indexOf('[');
          const end   = raw.lastIndexOf(']');
          if (start !== -1 && end !== -1 && end > start) {
            try {
              const slice = raw.slice(start, end + 1).replace(/,\s*]/g, ']');
              const parsed = JSON.parse(slice);
              if (Array.isArray(parsed)) { selectedIds = parsed; }
            } catch(e) { /* passe à la suite */ }
          }
        }

        // Tentative 3 : extraire les IDs individuellement via regex (fallback ultime)
        if (!selectedIds) {
          const ids = [...raw.matchAll(/"(ct_[a-zA-Z0-9_]+)"/g)].map(m => m[1]);
          if (ids.length > 0) {
            selectedIds = ids;
            console.log('  → Parsing fallback : IDs extraits un par un (' + ids.length + ')');
          }
        }

        if (!selectedIds || !Array.isArray(selectedIds) || selectedIds.length === 0) {
          throw new Error('JSON array non trouvé dans : ' + raw.slice(0, 400));
        }

        // Dédupliquer et valider
        const seen = new Set();
        const validIds = selectedIds.filter(id => {
          const ct = ctList.find(c => c.id === id);
          if (!ct || seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        const names = validIds.map(id => { const ct = ctList.find(c => c.id === id); return ct ? ct.name : id; }).join(' · ');
        console.log(`  → ${validIds.length} CTs (${selectedIds.length - validIds.length} doublons supprimés) : ${names}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ selectedIds: validIds }));
      } catch(e) {
        console.error('✗ SELECT-CTs error:', e.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ── /name-ct — Nommage automatique CT par Gemini Vision ──
  if (req.method === 'POST' && req.url === '/name-ct') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { b64, mime } = JSON.parse(body);
        console.log('\n🖼  NAME-CT — Gemini Vision nommage CT...');

        const token = await getToken();

        const systemInstruction = { parts: [{ text: `Tu es un expert en analyse créative publicitaire Meta Ads.
Tu génères des noms de Creative Templates (CT) utilisés par des agents IA pour choisir le bon format selon le contexte.
Le nom doit permettre à un agent de comprendre la structure, l'ambiance et les éléments SANS voir l'image.

FORMAT OBLIGATOIRE :
"[Structure] [palette] — [éléments avec position/taille/fonction]"

RÈGLES DE NOMMAGE :

1. STRUCTURE (commence toujours par ça) :
   - "Split 2-col" = deux colonnes côte à côte
   - "Stack vertical" = blocs empilés de haut en bas
   - "Hero centré" = produit ou visage dominant au centre
   - "Plein-cadre produit" = produit occupe toute l'image
   - "Avant-Après split" = comparaison gauche/droite
   - "Grille 2x2" ou "3 vignettes" = mosaïque de photos

2. PALETTE (juste après la structure, en 1-2 mots évocateurs) :
   - "crème/lavande", "noir dramatique", "blanc épuré", "vert forêt", "or/brun chaud"
   - Nomme la couleur dominante + la couleur d'accent

3. SÉPARATEUR — puis liste des éléments clés

4. ÉLÉMENTS (chaque élément = type + qualificatif + position) :
   - "prix trial XL gauche" (pas juste "prix")
   - "témoignage 5★ centré" (pas juste "testimonial")
   - "3 pills bénéfices blanc" (nb + forme + couleur)
   - "produit aérosol droite" (type exact + position)
   - "headline bold violet haut" (style + couleur + position)
   - "CTA bouton arrondi bas" (type + forme + position)

5. SÉPARATEURS entre éléments :
   - "+" entre éléments de la même zone
   - "/" entre la zone gauche et la zone droite (pour les splits 2-col)

6. INTERDIT :
   - Noms génériques : "Comparatif produit", "Hero produit", "UGC", "Témoignage"
   - Troncatures : jamais couper un mot à mi-chemin
   - Dépasser 100 caractères

EXEMPLES PARFAITS (modèle à suivre) :
"Split 2-col crème/lavande — prix trial XL gauche + témoignage 5★ + 3 pills bénéfices / produit aérosol droite"
"Avant-Après split blanc/gris — peau terne avant + peau lumineuse après + avant-après texte pont centre"
"Stack vertical noir/or — headline shock haut + 3 visuels résultats + CTA bouton doré bas"
"Hero centré fond sable — portrait femme 35s plein cadre + badge prix coin haut droit + 5★ bas"
"Plein-cadre produit vert/blanc — flacon centré grand format + liste 4 bénéfices gauche + marque haut"
"Grille 3 vignettes blanc — 3 photos usage quotidien + légende sous chaque + CTA bas centre"

Après le nom, sur les lignes 2 à 4 (TROIS lignes, jamais moins, jamais plus, jamais fusionnées), donne une description précise et UNIQUE à ce CT — jamais une formule générique qui pourrait s'appliquer à un autre CT de la galerie. Le but : qu'un agent qui lit cette description PLUS TARD, sans revoir l'image, puisse reconstruire mentalement le visuel exact — sa géométrie, son placement, son ton de copywriting — comme s'il le voyait. Une fois lue et mémorisée, cette description doit suffire ; il ne doit jamais avoir besoin de revoir l'image pour se rappeler ce qu'est ce CT.
Ligne 2 — GÉOMÉTRIE VISUELLE : où se trouve chaque élément exactement (zones, proportions, superposition), dans quel ordre l'œil les rencontre, quelle taille relative chaque élément occupe.
Ligne 3 — TON ET INTENTION DU COPYWRITING visible sur ce CT (s'il y a du texte) : registre (direct, aspirationnel, alarmiste, complice...), à qui il semble s'adresser, quelle émotion ou action il pousse à ressentir/faire. S'il n'y a pas de texte visible sur le CT, décris à la place l'intention narrative pure du visuel (quelle histoire il raconte sans mots).
Ligne 4 — CE QUI REND CE CT DIFFÉRENT de tout autre CT à structure proche dans une galerie de plusieurs centaines : le détail précis, la combinaison ou le choix qui ne se confondrait avec aucun autre.

Sur la ligne 5, indique le mécanisme psychologique principal que ce CT semble utiliser pour convaincre — en 3-6 mots maximum, parmi (ou proche de) : preuve sociale, comparaison concurrentielle, aspiration lifestyle, urgence/offre, autorité/expertise, transformation avant-après, dramatisation du problème, réassurance/garantie.

Sur la ligne 6, indique UN SEUL niveau de conscience — celui pour lequel ce CT est structurellement le plus évident, parmi : solution, product, most. Jamais deux valeurs à la fois : si un CT semble à cheval entre deux niveaux, choisis celui qui domine le plus clairement sa structure. Base-toi sur des marqueurs STRUCTURELS OBSERVABLES dans le CT, pas une impression générale :

→ "most" : la structure met en avant un PRIX, une OFFRE (bundle/pack/prix barré), ou une URGENCE de façon visible et centrale — ton agressif et promotionnel assumé. Exemples de marqueurs : prix affiché, badge "-X%"/"OFFRE", CTA direct type "Commander maintenant", compte à rebours.
→ "product" : la structure sert à construire la CONFIANCE ENVERS CE PRODUIT PRÉCIS — comparaison à des produits concurrents nommés, avis/témoignage client, figure d'autorité (expert, professionnel du domaine) qui recommande ou utilise le produit, ou une figure aspirationnelle (athlète, influenceur, célébrité — la personne que la cible aimerait devenir) tenant/utilisant le produit. Le produit est visible et central, mais SANS prix ni offre mise en avant.
→ "solution" : la structure parle de TRANSFORMATION (situation actuelle → situation désirée, avant/après un mode de vie plutôt qu'un avant/après produit) ou compare des TYPES DE SOLUTIONS DIFFÉRENTS entre eux (pas des produits concurrents du même type — des approches différentes, ex : "le café vs la volonté vs une vraie solution"). Le produit est peu visible ou intégré à une routine/un quotidien, jamais mis en avant seul comme héros de l'image.

Réponds avec UNE SEULE valeur, sans autre texte (ex : "product" ou "solution" ou "most").

Sur la ligne 7, ajoute 1 à 3 balises de style/émotion pertinentes séparées par une virgule, parmi (ou proche de) : luxe, humour, presse, urgence, chaleureux, minimaliste, audacieux, scientifique, communautaire, aspirationnel — ou tout autre mot précis si aucun de ceux-là ne convient vraiment. Pas de dièse, juste les mots séparés par virgule.

Sur la ligne 8, indique la NICHE GLOBALE de ce CT — pas le produit exact représenté, mais la grande catégorie mainstream à laquelle son style visuel et sa structure conviennent le mieux, UNE SEULE valeur, choisie strictement dans cette liste :
cosmétique, complément alimentaire, fashion, chaussures, bijoux et accessoires, montres, tech et électronique, maison et déco, cuisine et électroménager, bien-être et santé, sport et fitness, automobile, bébé et enfant, animaux, outils et bricolage, jouets et gaming, lunettes, bagagerie et maroquinerie, éducation et formation, services et coaching, autre
Choisis "autre" seulement si aucune des 20 catégories précédentes ne convient vraiment — ne force jamais un CT dans une niche qui ne lui va pas juste pour éviter "autre". Un CT peut très bien convenir à plusieurs niches proches (ex : cosmétique et bien-être) — dans ce cas choisis celle qui domine le plus clairement sa structure visuelle, pas un compromis vague.` }] };

        const geminiBody = {
          systemInstruction,
          contents: [{ role: 'user', parts: [
            { inlineData: { mimeType: mime || 'image/jpeg', data: b64 } },
            { text: 'Génère le nom précis de ce Creative Template (ligne 1), sa description unique en 3 lignes — géométrie visuelle, ton du copywriting, ce qui le rend distinct (lignes 2-4) —, son mécanisme psychologique principal (ligne 5), ses niveaux de conscience compatibles (ligne 6), ses balises de style/émotion (ligne 7), puis sa niche globale (ligne 8). Sois très descriptif et spécifique, en particulier sur les lignes 2 à 4 — c\'est ce qui permettra de reconnaître ce CT sans jamais revoir l\'image.' }
          ]}],
          // Cause profonde corrigée (meta/awareness/style toujours vides, nom parfois tronqué
          // en plein mot) : aucun thinkingConfig n'était fixé — Gemini consommait une partie du
          // budget de sortie (500 tokens) pour "réfléchir" en interne avant de répondre, ne
          // laissant presque rien pour écrire les 4 lignes demandées. Tâche de classification
          // simple, la réflexion n'apporte rien ici — désactivée, comme pour les autres appels
          // légers du même type dans ce fichier (Quality Check Photo, filtres langue, etc.).
          generationConfig: { temperature: 0.2, maxOutputTokens: 800, ...reflexion(MODELES.utilitaire, 0) }
        };

        const data = await vertexRequest(token, MODELES.utilitaire, geminiBody);
        if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

        const raw = (data.candidates?.[0]?.content?.parts || []).filter(p => !p.thought).map(p => p.text).join('').trim();
        const lignes = raw.split('\n').map(l => l.trim()).filter(Boolean);
        const clean = (lignes[0] || '').replace(/^["'«»\-]|["'«»]$/g, '').substring(0, 70);
        // Meta description enrichie : 3 lignes (géométrie / ton copywriting / distinction),
        // jointes en un seul champ texte — plus la formule courte à 3-6 mots d'avant.
        const meta = [lignes[1], lignes[2], lignes[3]].filter(Boolean).join(' ').substring(0, 500);
        // lignes[4] = mécanisme psychologique (ligne 5 du prompt) — jamais exploité comme champ
        // séparé pour l'instant, mais DOIT être compté dans l'index, sinon tout ce qui suit
        // décale d'un cran (bug réel détecté : conscience vide, "product" retrouvé dans style,
        // vraie niche jamais lue, "autre" par défaut à la place).
        const AWARENESS_VALIDES = ['solution', 'product', 'most'];
        const awareness = (lignes[5] || '').toLowerCase().split(',').map(s => s.trim()).filter(s => AWARENESS_VALIDES.includes(s));
        const styleTags = (lignes[6] || '').split(',').map(s => s.trim().toLowerCase().replace(/^#/, '')).filter(Boolean).slice(0, 3);
        const NICHES_VALIDES = ['cosmétique', 'complément alimentaire', 'fashion', 'chaussures', 'bijoux et accessoires', 'montres', 'tech et électronique', 'maison et déco', 'cuisine et électroménager', 'bien-être et santé', 'sport et fitness', 'automobile', 'bébé et enfant', 'animaux', 'outils et bricolage', 'jouets et gaming', 'lunettes', 'bagagerie et maroquinerie', 'éducation et formation', 'services et coaching', 'autre'];
        const nicheRaw = (lignes[7] || '').toLowerCase().trim();
        const niche = NICHES_VALIDES.includes(nicheRaw) ? nicheRaw : 'autre';
        console.log('  → "' + clean + '" · méta: ' + meta.substring(0,80) + '... · conscience: ' + awareness.join('/') + ' · style: ' + styleTags.join(',') + ' · niche: ' + niche);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ name: clean, meta: meta, awareness: awareness, styleTags: styleTags, niche: niche }));
      } catch(e) {
        console.error('✗ NAME-CT error:', e.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ── /name-ct-video — Nom, méta-description et balises d'un CT VIDÉO (texte), par Gemini ──
  if (req.method === 'POST' && req.url === '/name-ct-video') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { texte } = JSON.parse(body);
        if (!texte || String(texte).length < 200) { res.writeHead(400, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'texte du CT vidéo requis (200 caractères minimum)' })); }
        console.log('\n🎬 NAME-CT-VIDEO — nommage d\'un CT vidéo (' + String(texte).length + ' caractères)...');
        const token = await getToken();
        const consigne = 'Tu lis un CT VIDÉO (modèle de publicité vidéo utilisé par un agent créatif pour choisir la bonne structure selon le produit et la synthèse du marché). '
          + 'Réponds UNIQUEMENT en JSON valide, sans texte autour, avec ces clés : '
          + '"name" (nom court et précis, 70 caractères maximum : la structure + le mécanisme, jamais un nom générique), '
          + '"meta" (3 phrases, 500 caractères maximum : 1) la structure narrative et le rythme, 2) le mécanisme de persuasion et le ton, 3) les produits, marchés et situations pour lesquels ce CT est le plus adapté ET ceux pour lesquels il ne l\'est pas), '
          + '"awareness" (liste parmi "problem", "solution", "product", "most" ; une seule valeur de préférence), '
          + '"styleTags" (1 à 3 balises courtes en minuscules : humour, urgence, chaleureux, luxe, scientifique, communautaire, audacieux...), '
          + '"niche" (UNE catégorie large : cosmétique, complément alimentaire, fashion, chaussures, bijoux et accessoires, montres, tech et électronique, maison et déco, cuisine et électroménager, bien-être et santé, sport et fitness, automobile, bébé et enfant, animaux, alimentation, jouets et jeux, outils et bricolage, voyage et bagages, bureau et papeterie, services, ou "autre" seulement si rien ne convient). '
          + 'Ne recopie jamais de phrases du CT, décris-le. Si une information manque dans le CT, ne l\'invente pas.\n\n=== CT_VIDEO ===\n' + String(texte).slice(0, 40000);
        const data = await vertexRequest(token, MODELES.utilitaire, {
          contents: [{ role: 'user', parts: [{ text: consigne }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1200, responseMimeType: 'application/json', ...reflexion(MODELES.utilitaire, 0) }
        });
        if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
        const raw = (data.candidates?.[0]?.content?.parts || []).filter(p => !p.thought).map(p => p.text).join('').trim().replace(/^```(?:json)?|```$/g, '').trim();
        let j; try { j = JSON.parse(raw); } catch (e) { throw new Error('Réponse illisible : ' + raw.slice(0, 120)); }
        const AW = ['problem', 'solution', 'product', 'most'];
        const out = {
          name: String(j.name || '').replace(/^["'«»\-]|["'«»]$/g, '').slice(0, 70),
          meta: String(j.meta || '').slice(0, 500),
          awareness: (Array.isArray(j.awareness) ? j.awareness : []).map(x => String(x).toLowerCase().trim()).filter(x => AW.includes(x)).slice(0, 3),
          styleTags: (Array.isArray(j.styleTags) ? j.styleTags : []).map(x => String(x).toLowerCase().replace(/^#/, '').trim()).filter(Boolean).slice(0, 3),
          niche: String(j.niche || 'autre').toLowerCase().trim().slice(0, 40)
        };
        console.log('  → "' + out.name + '" · ' + out.awareness.join('/') + ' · ' + out.styleTags.join(',') + ' · ' + out.niche);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(out));
      } catch (e) {
        console.error('✗ NAME-CT-VIDEO error:', e.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ── /gen-messages : génère les messages relance via Gemini 2.5 Pro ──────────
  if (req.method === 'POST' && req.url === '/gen-messages') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { prompt } = JSON.parse(body);
        if (!prompt) { res.writeHead(400); res.end(JSON.stringify({ error: 'prompt requis' })); return; }
        const token = await getToken();
        // Aucun thinkingConfig n'était fixé ici — repli sur le défaut natif de Gemini, non
        // borné. Fixé explicitement, cohérent avec le reste du fichier.
        const data = await vertexRequest(token, MODELES.raisonnement, {
          contents: [{ role:'user', parts:[{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 4000, temperature: 0.3, ...reflexion(MODELES.raisonnement, 1024) }
        });
        const text = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
        console.log(`→ /gen-messages → ${text.length} chars`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ text }));
      } catch(e) {
        console.error('/gen-messages error:', e.message);
        res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ── /generate-persona-portrait : génère + upload le portrait réaliste du persona,
  // appelé par la Factory une fois le persona connu (nom/âge/rôle/ville/journée type) ──
  if (req.method === 'POST' && req.url === '/generate-persona-portrait') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { persona } = JSON.parse(body);
        if (!persona?.nom) { res.writeHead(400); res.end(JSON.stringify({ error: 'persona.nom requis' })); return; }
        const { base64, mime } = await genererPortraitPersona(persona);
        // Cause profonde corrigée (upload échoue en HTTP 400 pour tout prénom accentué) —
        // même correctif qu'en tâche de fond, voir genererEtSauvegarderPortraitEnTacheDeFond.
        const nomAsciiTest = (persona.nom || 'persona').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const slug = nomAsciiTest.toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g,'_').slice(0, 30);
        const filename = `${slug}_${Date.now()}`;
        const url = await uploadPortraitPersona(base64, mime, filename);
        console.log(`→ /generate-persona-portrait → ${persona.nom} → ${url}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ url }));
      } catch(e) {
        console.error('/generate-persona-portrait error:', e.message);
        res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ── /fill-demo-msg : remplit le template WA depuis les données de la mindmap ────────────
  if (req.method === 'POST' && req.url === '/fill-demo-msg') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { lien_demo, pays_code, tpl } = JSON.parse(body);
        if (!lien_demo || !tpl) { res.writeHead(400); res.end(JSON.stringify({ error: 'lien_demo et tpl requis' })); return; }

        const slug = lien_demo.split('/').pop().split('?')[0].replace('.html','');
        const filepath = path.join(MINDMAPS_DIR, slug + '.html');

        // Cause profonde corrigée : ce endpoint ne lisait QUE le disque local (éphémère,
        // effacé à chaque redéploiement Render) — jamais le fallback Supabase déjà utilisé
        // par /demo/:slug pour ce même problème. Résultat : après un redéploiement, toute
        // mindmap générée avant devenait "introuvable" ici et le message retombait sur les
        // anciennes données du prospect (produit/marque/pays périmés), silencieusement.
        let html;
        if (fs.existsSync(filepath)) {
          html = fs.readFileSync(filepath, 'utf8');
        } else {
          try {
            html = await new Promise((resolve, reject) => {
              https.get(`${SUPABASE_URL_INT}/storage/v1/object/public/demos/${slug}.html`, sbRes => {
                if (sbRes.statusCode !== 200) { reject(new Error(`Supabase HTTP ${sbRes.statusCode}`)); return; }
                let chunks = [];
                sbRes.on('data', c => chunks.push(c));
                sbRes.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
              }).on('error', reject);
            });
          } catch(eFallback) {
            res.writeHead(404); res.end(JSON.stringify({ error: `Mindmap introuvable (disque local ET Supabase) : ${slug}.html — ${eFallback.message}` }));
            return;
          }
        }

        // Extraction directe des valeurs depuis le HTML généré (les placeholders ont été remplacés)
        const extractBetween = (str, before, after) => {
          const rx = new RegExp(before + '([\\s\\S]*?)' + after);
          const m = str.match(rx);
          return m ? m[1].trim() : '';
        };

        // {PRODUIT} → <div class="prod">VALEUR</div>
        const produit = extractBetween(html, '<div class="prod">', '</div>') || '';
        // {MARQUE} → <div class="sub">MARQUE · PAYS</div>
        const subLine = extractBetween(html, '<div class="sub">', '</div>') || '';
        const marque  = subLine.split('·')[0].trim() || '';
        // {PAYS} → dans le même sub ou depuis pays_code passé en paramètre
        const paysRaw = (subLine.split('·')[1] || pays_code || '').trim();

        // Mapping code pays → adjectif
        const PAYS_ADJ = {
          'CI':'ivoirien','SN':'sénégalais','CM':'camerounais','NG':'nigérian',
          'TG':'togolais','BJ':'béninois','ML':'malien','BF':'burkinabè',
          'GN':'guinéen','CD':'congolais','CG':'congolais','GH':'ghanéen',
          'TD':'tchadien','MG':'malgache','MR':'mauritanien','GA':'gabonais'
        };
        const code = paysRaw.toUpperCase().replace(/[^A-Z]/g,'').substring(0,2);
        const paysAdj = PAYS_ADJ[code] || PAYS_ADJ[pays_code?.toUpperCase()] || paysRaw || '';

        // Niche : appel Gemini uniquement si la template la demande VRAIMENT — cause profonde
        // corrigée d'un vrai gaspillage (et d'une confusion pour Amvr en lisant les logs) :
        // cet appel se faisait avant INCONDITIONNELLEMENT, même quand [Niche] avait été retiré
        // de la template. Le principe reste "template flexible, on ne cherche que ce qui est
        // vraiment demandé dedans" — pas de travail caché sur une variable non présente.
        let niche = '';
        if (/\[Niche\]/i.test(tpl || '')) {
          try {
            const token = await getToken();
            const nicheData = await vertexRequest(token, MODELES.utilitaire, {
              contents: [{ role:'user', parts:[{ text: `Grande catégorie marketing 1-2 mots max pour: "${produit || slug}". Exemples: cosmétiques, santé, mode, beauté, nutrition. UNIQUEMENT la catégorie, rien d'autre.` }] }],
              generationConfig: { maxOutputTokens: 50, temperature: 0, ...reflexion(MODELES.utilitaire, 0) }
            }, 90000, 'remplissage_message_demo');
            niche = (nicheData.candidates?.[0]?.content?.parts?.[0]?.text || '').trim().split('\n')[0].replace(/['"«».,]/g,'');
          } catch(e) { niche = produit.split(' ')[0] || ''; }
        }

        // Remplissage local du template — 100% fiable, zéro hallucination
        // Astérisques autour de [lien_demo] retirées avant insertion : une URL entourée de
        // *...* (gras WhatsApp) sans espace de séparation perturbe l'auto-détection de lien —
        // même cause identifiée côté relances du CRM (caractères parasites, lien tronqué).
        const message = (tpl || '')
          .replace(/\[Niche\]/gi, niche)
          .replace(/\[Pays(?:[^\]]*)\]/gi, paysAdj)
          .replace(/\*?\[lien_demo\]\*?/gi, lien_demo)
          .replace(/\[Produit\]/gi, produit || '[Produit]')
          .replace(/\[nom marque\]/gi, marque || '')
          .replace(/\\n/g, '\n');

        console.log(`→ /fill-demo-msg slug:"${slug}" → produit:"${produit}" marque:"${marque}" pays:"${paysAdj}" niche:"${niche}" → ${message.length} chars`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message }));
      } catch(e) {
        console.error('/fill-demo-msg error:', e.message);
        res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ── /niche : détection niche produit pour le CRM ─────────────────────────
  if (req.method === 'GET' && req.url.startsWith('/niche')) {
    try {
      const urlParams = new URL(req.url, 'http://localhost').searchParams;
      const produit = (urlParams.get('produit') || '').trim();
      if (!produit) { res.writeHead(400); res.end(JSON.stringify({ error: 'produit manquant' })); return; }
      const token = await getToken();
      const data = await vertexRequest(token, MODELES.utilitaire, {
        contents: [{ role:'user', parts:[{ text:'Grande catégorie marketing en 1-2 mots pour ce produit: "'+produit+'". Exemples: "cosmétiques", "santé", "mode", "nutrition", "bien-être". La catégorie la plus large possible. Réponds UNIQUEMENT avec la catégorie.' }] }],
        generationConfig: { maxOutputTokens: 50, temperature: 0, ...reflexion(MODELES.utilitaire, 0) }
      });
      const niche = (data.candidates?.[0]?.content?.parts?.[0]?.text || produit).trim().replace(/['"«»]/g,'').split('\n')[0].substring(0,30);
      console.log(`→ /niche "${produit}" → "${niche}"`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ niche }));
    } catch(e) {
      res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

// GET /push-vapid-key — donne la clé publique VAPID au client
  if (req.method === 'GET' && req.url === '/push-vapid-key') {
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({ key: process.env.VAPID_PUBLIC_KEY || '' }));
    return;
  }

// POST /push-subscribe — enregistre une souscription push pour un utilisateur OU un visiteur anonyme
  if (req.method === 'POST' && req.url === '/push-subscribe') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', async () => {
      try {
        const { user_id, anon_id, subscription } = JSON.parse(body);
        if ((!user_id && !anon_id) || !subscription?.endpoint) {
          console.warn('[Push] /push-subscribe: payload invalide', { user_id, anon_id, hasEndpoint: !!subscription?.endpoint });
          res.writeHead(400); res.end('{}'); return;
        }
        const insertRes = await fetch(`${SUPABASE_URL_INT}/rest/v1/push_subscriptions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Prefer': 'resolution=merge-duplicates',
          },
          body: JSON.stringify({
            user_id: user_id || null,
            anon_id: user_id ? null : anon_id,
            endpoint: subscription.endpoint,
            p256dh: subscription.keys?.p256dh,
            auth: subscription.keys?.auth,
          })
        });
        if (!insertRes.ok) {
          const errText = await insertRes.text();
          console.error(`[Push] /push-subscribe: échec insertion Supabase (${insertRes.status}):`, errText.slice(0,300));
          res.writeHead(500); res.end(JSON.stringify({ error: 'insert_failed' }));
          return;
        }
        console.log(`[Push] ✅ Souscription enregistrée pour ${user_id ? 'user '+user_id : 'anon '+anon_id}`);
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ ok: true }));
      } catch(e) {
        console.error('[Push] /push-subscribe: exception', e.message);
        res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

// POST /push-merge-anon — relie une souscription anonyme au vrai compte, une fois connecté
  if (req.method === 'POST' && req.url === '/push-merge-anon') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', async () => {
      try {
        const { anon_id, user_id } = JSON.parse(body);
        if (!anon_id || !user_id) { res.writeHead(400); res.end('{}'); return; }
        const r = await fetch(`${SUPABASE_URL_INT}/rest/v1/push_subscriptions?anon_id=eq.${anon_id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({ user_id, anon_id: null })
        });
        console.log(`[Push] Fusion anon→user : ${anon_id} → ${user_id} (${r.ok ? 'ok' : 'échec ' + r.status})`);
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ ok: r.ok }));
      } catch(e) {
        console.error('[Push] /push-merge-anon: exception', e.message);
        res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

// POST /push-test — envoie une notification de test à l'utilisateur qui clique "Tester"
  if (req.method === 'POST' && req.url === '/push-test') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', async () => {
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: true }));
      try {
        const { user_id } = JSON.parse(body);
        if (!user_id) return;
        await sendPushToUser(user_id, {
          title: '🔔 Ça marche !',
          body: 'Tes notifications AdBoard sont bien activées.',
          url: '/adboard/notifications'
        });
      } catch(e) { console.error('[Push] Erreur test:', e.message); }
    });
    return;
  }

// POST /track-event — tracking léger pour déclencheurs contextuels (ex: vu la page Tarifs)
  if (req.method === 'POST' && req.url === '/track-event') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', async () => {
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: true }));
      try {
        const { user_id, event_key } = JSON.parse(body);
        if (!user_id || !event_key) return;
        await fetch(`${SUPABASE_URL_INT}/rest/v1/user_events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
          body: JSON.stringify({ user_id, event_key })
        });
      } catch(e) { console.error('[Track] Erreur:', e.message); }
    });
    return;
  }

// POST /x-conversion — envoie l'événement Purchase à l'API Conversions X (Twitter),
// en complément du pixel navigateur (twq), pour ne pas dépendre des bloqueurs de pub / ITP.
  if (req.method === 'POST' && req.url === '/x-conversion') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', async () => {
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: true }));
      try {
        const { email, value, plan_name, conversion_id } = JSON.parse(body);
        const X_PIXEL_TOKEN = process.env.X_PIXEL_TOKEN || '';
        const X_PURCHASE_EVENT_ID = process.env.X_PURCHASE_EVENT_ID || '';
        if (!email || !X_PIXEL_TOKEN || !X_PURCHASE_EVENT_ID) {
          if (!X_PIXEL_TOKEN) console.warn('[X CAPI] X_PIXEL_TOKEN non configuré');
          if (!X_PURCHASE_EVENT_ID) console.warn('[X CAPI] X_PURCHASE_EVENT_ID non configuré');
          return;
        }
        const hashedEmail = crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
        const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
        const userAgent = req.headers['user-agent'] || '';
        await fetch(`https://ads-api.x.com/12/measurement/conversions/rf8c2`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Pixel-Token': X_PIXEL_TOKEN,
          },
          body: JSON.stringify({
            conversions: [{
              conversion_time: new Date().toISOString(),
              event_id: X_PURCHASE_EVENT_ID,
              conversion_id: conversion_id || undefined,
              identifiers: [{ hashed_email: hashedEmail, ip_address: ip, user_agent: userAgent }],
            }]
          })
        });
      } catch(e) { console.error('[X CAPI] Erreur:', e.message); }
    });
    return;
  }

// POST /webhook/brief — reçoit un ticket de commande depuis AdBoard
  if (req.method === 'POST' && req.url === '/webhook/brief') {

    let body = '';
    req.on('data', d => body += d);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const briefs = await loadBriefs();
        // v5.60 — marchés : le serveur garde la liste et re-vérifie la compatibilité (langue, apparence des personnages).
        // Un marché incompatible avec le groupe principal est écarté et signalé, jamais mélangé dans la même production.
        const _lstM = (Array.isArray(data.product.marches) && data.product.marches.length ? data.product.marches : String(data.product.pays || '').split(/[,;/|\n]+/)).map(x => String(x).trim()).filter(Boolean);
        const _am = analyserMarches(_lstM);
        const _retenus = _am.retenus.length ? _am.retenus : _lstM;
        const _pppBrut = (data.product.prix_par_pays && typeof data.product.prix_par_pays === 'object') ? data.product.prix_par_pays : {};
        const _ppp = {}; _retenus.forEach(m => { const v = String(_pppBrut[m] || '').trim(); if (v) _ppp[m] = v.slice(0, 160); });
        if (_am.ecartes.length) console.log('[Brief] ⚠ marchés incompatibles écartés : ' + _am.ecartes.map(e => e.nom + ' (' + e.raison + ')').join(' ; '));
        const brief = {
          id: data.brief_id || `brief_${Date.now()}`,
          created_at: new Date().toISOString(),
          status: 'pending', // pending | in_production | done
          client: {
            user_id: data.user_id,
            email: data.user_email,
            plan: data.plan || 'starter',
          },
          product: {
            id: data.product.id,
            nom: data.product.nom,
            pricing: data.product.pricing,
            pays: _retenus.length ? _retenus.join(', ') : data.product.pays,
            marches: _retenus,
            marches_ecartes: _am.ecartes,
            prix_par_pays: _ppp,
            prix_affichable: prixAffichable(_retenus, _ppp, data.product.pricing),
            promo_ponctuelle: !!data.product.promo_ponctuelle,
            promo: data.product.promo || '',
            cible: data.product.cible,
            utilite: data.product.utilite,
            couleurs: [data.product.couleur1, data.product.couleur2, data.product.couleur3].filter(Boolean),
            photo_url: data.product.photo_url,
            photo_base64: data.product.photo_base64 || null,
            lien_page_produit: data.product.lien_page_produit || null,
            marque: data.product.marque || null,
            // v5.48 — carrousel complet (lu plus bas par Factory mais jamais conservé jusqu'ici) et infos de
            // personnalisation de la fiche produit AdBoard v7.0. Toutes facultatives : absentes = jamais inventées.
            galerie_images: Array.isArray(data.product.galerie_images) ? data.product.galerie_images : [],
            logo_url: data.product.logo_url || null,
            galerie_aspects: (data.product.galerie_aspects && typeof data.product.galerie_aspects === 'object') ? data.product.galerie_aspects : {},
            packaging_images: Array.isArray(data.product.packaging_images) ? data.product.packaging_images : [], // anciens briefs seulement
            avis_captures: Array.isArray(data.product.avis_captures) ? data.product.avis_captures : [],
            avis_textes: Array.isArray(data.product.avis_textes) ? data.product.avis_textes : [],
            garantie: data.product.garantie || '',
            livraison_paiement: data.product.livraison_paiement || '',
            notes: data.product.notes || '',
            cible_auto: !!data.product.cible_auto,
            documents: Array.isArray(data.product.documents) ? data.product.documents.filter(d => d && d.url).slice(0, 5).map(d => ({ name: String(d.name || 'document'), url: d.url })) : [],
          },
          quantity: data.quantity || 6,
          history: data.history || { angles_used: [], personas_used: [], batches_count: 0 },
          photo_nobg: null,
        };
        // v5.64 — le navigateur renvoie le brief jusqu'à 3 fois quand la réponse tarde (timeout de 15 s) : un brief déjà enregistré
        // est acquitté sans rien refaire (ni e-mail, ni push, ni photos), et on n'enregistre plus que CE brief (et non toute la liste).
        if (briefs.some(b0 => b0.id === brief.id)) {
          console.log(`[Brief] ↩ doublon ignoré : ${brief.id}`);
          res.writeHead(200, {'Content-Type':'application/json'});
          res.end(JSON.stringify({ ok: true, id: brief.id, doublon: true }));
          return;
        }
        briefs.unshift(brief);
        await saveBriefs([brief]);
        console.log(`[Brief] ✅ Reçu: ${brief.id} — ${brief.product.nom} (${brief.quantity} images)`);
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ ok: true, id: brief.id }));
        // Notification push — confirmation de la demande
        if (brief.client.user_id) {
          sendPushToUser(brief.client.user_id, {
            title: '📦 Demande reçue',
            body: `Tes ${brief.quantity} visuels pour ${brief.product.nom} sont en cours — livraison sous 24h.`,
            url: '/adboard/tracking'
          }).catch(()=>{});
        }
        // Notification admin #1 — nouvelle demande initiée, pour savoir qu'il faut produire.
        notifierAdmin(
          `📦 Nouvelle demande — ${brief.product.nom}`,
          `<p><strong>${brief.quantity} images</strong> pour <strong>${brief.product.nom}</strong> (${brief.product.pays || 'pays non renseigné'}).</p>
           <p>Client : ${brief.client.email || 'email non renseigné'} — Plan ${brief.client.plan}</p>
           <p style="color:#888;font-size:12px">Reçue le ${new Date(brief.created_at).toLocaleString('fr-FR')} — id ${brief.id}</p>`
        ).catch(()=>{});
        // v5.65 — plus de préparation des photos à la réception : elle ne se fait qu'au lancement de la production (/commandes/:id/start).
      } catch(e) {
        console.error('[Brief] Erreur:', e);
        res.writeHead(400); res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

// GET /commandes — liste des tickets pour la vue Factory
  if (req.method === 'GET' && req.url === '/commandes') {

    const briefs = await loadBriefs();
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify(briefs));
    return;
  }

// POST /commandes/:id/start — marquer en production
  if (req.method === 'POST' && req.url.match(/^\/commandes\/[^/]+\/start$/)) {

    const id = req.url.split('/')[2];
    const briefs = await loadBriefs();
    const idx = briefs.findIndex(b => b.id === id);
    if (idx >= 0) {
      briefs[idx].status = 'in_production';
      briefs[idx].started_at = new Date().toISOString();

      // ── Pipeline photo produit — se déclenche à chaque "Lancer"/"Relancer" tant que le fond
      // n'a jamais été retiré pour cette commande. Volontairement SYNCHRONE (le clic attend la
      // fin du pipeline) : si on répondait tout de suite en laissant tourner en arrière-plan,
      // Factory pourrait charger la photo AVANT que le nettoyage soit prêt — exactement le
      // risque qu'on veut éviter.
      //
      // Ordre exact voulu :
      // 1. Fond déjà retiré ? → rien à faire, on garde tel quel.
      // 2. Sinon, qualité de la photo originale : bonne → nettoyage direct.
      // 3. Qualité mauvaise → recherche d'une meilleure photo du MÊME produit ailleurs sur le
      //    web (recherche par image, pas par mots-clés — garantit le même produit exact).
      //    Trouvée et validée → nettoyage de CELLE-LÀ. Rien de trouvé → on nettoie quand même
      //    l'originale plutôt que de bloquer la production.
      // v5.61 — les photos du produit sont préparées aspect par aspect (voir preparerPhotosProduit). Plus de recherche
      // d'une « meilleure » image sur le web, plus de choix dans le carrousel. Déjà prêtes (lancées à la réception du
      // brief) → rien à attendre ; sinon on attend au plus 85 s pour rester sous la limite de temps de Render.
      if (!Array.isArray(briefs[idx].product?.photos_produit)) {
        console.log(`[Photos] commande ${id} : préparation en cours, attente...`);
        await Promise.race([preparationPhotosCommande(id), new Promise(r => setTimeout(r, 85000))]);
        const frais = await loadBriefs();
        const f = frais.find(b => b.id === id);
        if (f) {
          briefs[idx].product = f.product;
          if (f.photo_nobg) briefs[idx].photo_nobg = f.photo_nobg;
        }
      }

      await saveBriefs([briefs[idx]]);
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: true, brief: briefs[idx] }));
    } else {
      res.writeHead(404); res.end(JSON.stringify({ error: 'Brief not found' }));
    }
    return;
  }

  // POST /commandes/:id/generation-started — marque le VRAI démarrage de la génération (appelé
  // depuis prodv2Launch, au moment où les appels API partent réellement), distinct de /start qui
  // se déclenche dès l'OUVERTURE du ticket dans Factory (même sans jamais cliquer "Lancer").
  // Cause profonde corrigée : le contrôle "commande active ailleurs" se basait sur /start, donc un
  // ticket simplement ouvert puis abandonné bloquait indéfiniment tout renouvellement futur sur ce
  // produit, alors qu'aucune génération n'avait jamais réellement tourné.
  if (req.method === 'POST' && req.url.match(/^\/commandes\/[^/]+\/generation-started$/)) {
    const id = req.url.split('/')[2];
    const briefs = await loadBriefs();
    const idx = briefs.findIndex(b => b.id === id);
    if (idx >= 0) {
      briefs[idx].generation_started_at = new Date().toISOString();
      // Cause profonde corrigée (client reçoit une créative du MAUVAIS batch après "Relancer
      // la production") : "Relancer" réutilise le même ticket (même commandeId), et jusqu'ici
      // pushed_creative_indices restait tel quel — donc pour un batch d'origine à 8/9 envoyées,
      // le nouveau batch se voyait sauter ses 8 premières créatives (crues déjà envoyées, alors
      // qu'elles n'ont RIEN à voir avec le batch précédent) et seul l'index encore "manquant"
      // partait — avec le contenu du NOUVEAU batch dedans, dans un slot pensé pour l'ancien.
      // Reset systématique ici : un vrai démarrage de génération veut toujours dire table rase
      // pour le suivi d'envoi, qu'il s'agisse d'un premier lancement (déjà vide, sans effet) ou
      // d'une relance (c'est justement là que ça compte).
      briefs[idx].pushed_creative_indices = [];
      briefs[idx].batch_deja_cree = false;
      // Compteur de génération — incrémenté à chaque vrai démarrage (1 si jamais généré avant).
      // Sert à construire des id de créatives garantis différents d'une relance à l'autre (voir
      // pushDeliverablesToProduct) : sans ça, un id reconstruit comme `${ticketId}_${i}` retombe
      // EXACTEMENT sur le même id qu'au batch précédent pour le même index — si ce batch avait
      // déjà été livré au client, le nouveau contenu à cet index est silencieusement bloqué (vu
      // comme "déjà là"), jamais réellement uploadé. La remise à zéro de pushed_creative_indices
      // seule ne suffit pas à couvrir ce cas précis.
      briefs[idx].generation_version = (briefs[idx].generation_version || 0) + 1;

      // Nettoyage immédiat du produit OFFICIEL du ticket, dès la relance — pas besoin d'attendre
      // l'envoi pour ce cas précis, connu dès maintenant (contrairement à un compte test, qui
      // n'est choisi qu'au moment d'envoyer — voir le filet de sécurité identique dans
      // pushDeliverablesToProduct, qui reste nécessaire pour CE cas-là). Purement une question
      // de rapidité de confirmation visuelle, pas une nécessité technique — même logique de
      // filtrage par version que le nettoyage à l'envoi, dupliquée volontairement plutôt que
      // partagée, pour ne jamais faire dépendre l'un de l'autre.
      const productIdOfficiel = briefs[idx].product?.id;
      if (productIdOfficiel) {
        try {
          const prRes = await fetch(`${SUPABASE_URL_INT}/rest/v1/products?id=eq.${productIdOfficiel}&select=creatives`, {
            headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
          });
          const prRows = await prRes.json();
          const creativesActuelles = prRows?.[0]?.creatives || [];
          const regexVersionTicket = new RegExp(`^${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_g(\\d+)_`);
          const nettoyees = creativesActuelles.filter(c => {
            const m = c.id && c.id.match(regexVersionTicket);
            return !m || parseInt(m[1], 10) >= briefs[idx].generation_version;
          });
          if (nettoyees.length !== creativesActuelles.length) {
            await fetch(`${SUPABASE_URL_INT}/rest/v1/products?id=eq.${productIdOfficiel}`, {
              method: 'PATCH',
              headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
              body: JSON.stringify({ creatives: nettoyees })
            });
            console.log(`[Relance] ${creativesActuelles.length - nettoyees.length} créative(s) d'une version antérieure retirée(s) immédiatement pour le ticket ${id}`);
          }
        } catch(eClean) {
          console.error('[Relance] Nettoyage immédiat échoué (le filet à l\'envoi prendra le relais) :', eClean.message);
        }
      }
      await saveBriefs([briefs[idx]]);
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: true }));
    } else {
      res.writeHead(404); res.end(JSON.stringify({ error: 'Brief not found' }));
    }
    return;
  }

// POST /create-checkout — crée une session Chariow et retourne l'URL
if (req.method === 'POST' && req.url === '/create-checkout') {
  let body = '';
  req.on('data', d => body += d);
  req.on('end', async () => {
    try {
      const { product_id, email, user_id, plan } = JSON.parse(body);
      if (!CHARIOW_KEY) { res.writeHead(500); res.end(JSON.stringify({error:'CHARIOW_KEY manquante'})); return; }
      const r = await fetch('https://api.chariow.com/v1/checkout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${CHARIOW_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id,
          email,
          custom_metadata: { user_id, plan, source: 'adboard' }
        })
      });
      const data = await r.json();
      if (data?.data?.step === 'payment') {
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ checkout_url: data.data.payment.checkout_url }));
      } else if (data?.data?.step === 'completed') {
        // Produit déjà acheté ou gratuit → activer directement
        if (user_id && plan) {
          const planInfo = PLAN_MAP[product_id] || { plan, cycle: 'monthly', credits_per_week: ({ starter: 6, pro: 12, scale: 24 })[plan] || 6, price_fcfa: 0, prix_img: 0 };
          await activateSubscription(user_id, planInfo, email);
        }
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ checkout_url: null, already_active: true }));
      } else {
        console.error('[Checkout]', JSON.stringify(data));
        res.writeHead(400); res.end(JSON.stringify({ error: data?.message || 'Erreur Chariow', raw: data }));
      }
    } catch(e) {
      console.error('[Checkout]', e);
      res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
    }
  });
  return;
}

// POST /webhook/chariow — reçoit les Pulses Chariow (vente confirmée)
if (req.method === 'POST' && req.url === '/webhook/chariow') {
  let body = '';
  req.on('data', d => body += d);
  req.on('end', async () => {
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({ ok: true }));
    try {
      const pulse = JSON.parse(body);
      console.log('[Pulse] Reçu (payload complet):', JSON.stringify(pulse));
      // Structure réelle Chariow : product/customer/store au même niveau que sale, pas imbriqués dedans
      const sale = pulse?.sale || {};
      const product = pulse?.product || {};
      const customer = pulse?.customer || {};
      // custom_fields est un tableau [{name, value}], pas un objet plat
      const customFields = {};
      (sale?.custom_fields || []).forEach(f => { if (f?.name) customFields[f.name] = f.value; });
      const userId = customFields.user_id;
      const productId = product?.id;
      const email = customer?.email;
      // Chariow n'a pas un nom de champ 100% garanti pour le téléphone selon les intégrations —
      // on essaie les variantes les plus courantes. Si aucune ne matche, on log le payload
      // complet juste au-dessus (voir console) pour identifier le bon champ à ajouter ici.
      const phone = customer?.phone || customer?.telephone || customer?.whatsapp
        || customer?.phone_number || customer?.tel || null;
      if (!phone) console.warn('[Pulse] ⚠️ Aucun champ téléphone reconnu dans customer — vérifier le payload complet loggé ci-dessus pour trouver le bon nom de champ.');
      const planInfo = PLAN_MAP[productId];
      if (!planInfo) { console.warn('[Pulse] Produit inconnu:', productId); return; }
      // Si on a le user_id → activer directement
      if (userId) {
        console.log(`[Pulse] user_id trouvé directement dans custom_fields: ${userId}`);
        await activateSubscription(userId, planInfo, email, customer?.name, phone);
        await traiterAttributionCRM(userId);
        return;
      }
      // Sinon chercher par email — chemin de secours, ne devrait quasi jamais arriver pour un achat AdBoard normal
      console.warn(`[Pulse] ⚠️ Aucun user_id dans custom_fields — fallback recherche par email: "${email}"`);
      if (email) {
        const user = await findUserByEmail(email);
        if (user) {
          console.log(`[Pulse] Fallback email: match trouvé → user_id=${user.id} pour email="${email}"`);
          await activateSubscription(user.id, planInfo, email, user.user_metadata?.full_name || customer?.name, phone);
          await traiterAttributionCRM(user.id);
        } else {
          console.warn(`[Pulse] User introuvable pour email: ${email} — sauvegarde en attente pour rattrapage automatique`);
          // Cause profonde corrigée (paiement confirmé mais jamais activé) : ce cas se
          // contentait d'un console.warn — rien n'était conservé nulle part, donc même si le
          // client s'inscrivait ensuite avec le même email, rien ne reliait automatiquement son
          // paiement à son compte. Voir /cron/check-pending qui retente périodiquement.
          try {
            await fetch(`${SUPABASE_URL_INT}/rest/v1/pending_activations`, {
              method: 'POST',
              headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
              body: JSON.stringify({ email, name: customer?.name || null, telephone: phone || null, plan_id: productId, sale_id: sale?.id || null })
            });
          } catch(ePending) {
            console.error('[Pulse] Échec sauvegarde pending_activations :', ePending.message);
            await notifierAdmin('⚠️ Paiement reçu mais non activé, ET sauvegarde échouée', `<p>Email: ${email}<br>Produit: ${productId}<br>Vente: ${sale?.id}<br>Erreur: ${ePending.message}</p><p><strong>Action manuelle requise.</strong></p>`);
          }
        }
      }
    } catch(e) { console.error('[Pulse] Erreur:', e); }
  });
  return;
}

// GET /cron/check-pending — déclenché toutes les 30-60 min par un cron externe (cron-job.org).
// Détecte les demandes encore "pending" depuis plus de 12h et jamais encore signalées — pour
// savoir que la production peut démarrer, sans avoir à surveiller Factory en continu.
if (req.method === 'GET' && req.url.startsWith('/cron/check-pending')) {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const key = urlObj.searchParams.get('key');
  if (key !== process.env.SEQUENCE_CRON_SECRET) {
    res.writeHead(403); res.end(JSON.stringify({ error: 'Clé invalide' })); return;
  }
  res.writeHead(200, {'Content-Type':'application/json'});
  res.end(JSON.stringify({ ok: true, message: 'Vérification pending en cours' }));

  try {
    const briefs = await loadBriefs();
    const seuil = Date.now() - 12 * 60 * 60 * 1000;
    const aAlerter = briefs.filter(b =>
      b.status === 'pending' && !b.pending_alert_sent && new Date(b.created_at).getTime() <= seuil
    );
    for (const b of aAlerter) {
      await notifierAdmin(
        `⏰ Pending 12h écoulées — ${b.product?.nom || 'produit'}`,
        `<p><strong>${b.product?.nom || 'Produit'}</strong> — les 12h de pending sont passées, le client ne peut plus annuler. La production peut démarrer.</p>
         <p>Client : ${b.client?.email || 'email non renseigné'} — ${b.quantity} images</p>
         <p><a href="https://www.adstackofficial.com/factory.html" style="color:#5B8DEF;">Ouvrir Factory pour lancer la production →</a></p>
         <p style="color:#888;font-size:12px">Reçue le ${new Date(b.created_at).toLocaleString('fr-FR')} — id ${b.id}</p>`
      );
      b.pending_alert_sent = true;
      await saveBriefs([b]);
    }

    // ── Rappel 18h — livraison prévue à 24h, marge de 6h pour ne jamais oublier d'envoyer ──
    const seuil18h = Date.now() - 18 * 60 * 60 * 1000;
    const aRappeler = briefs.filter(b =>
      b.status !== 'done' && b.status !== 'cancelled' && b.status !== 'probleme_agence' &&
      !b.delivery_reminder_sent && new Date(b.created_at).getTime() <= seuil18h
    );
    for (const b of aRappeler) {
      await notifierAdmin(
        `📬 18h écoulées — envoie les livrables pour ${b.product?.nom || 'produit'}`,
        `<p><strong>${b.product?.nom || 'Produit'}</strong> — 18h se sont écoulées depuis la demande. Encore 6h avant l'échéance des 24h — envoie les livrables au client.</p>
         <p>Client : ${b.client?.email || 'email non renseigné'} — ${b.quantity} images</p>
         <p><a href="https://www.adstackofficial.com/factory.html" style="color:#5B8DEF;">Ouvrir Factory pour envoyer les livrables →</a></p>
         <p style="color:#888;font-size:12px">Reçue le ${new Date(b.created_at).toLocaleString('fr-FR')} — id ${b.id}</p>`
      );
      b.delivery_reminder_sent = true;
      await saveBriefs([b]);
    }
    console.log(`[Pending Check] ${aRappeler.length} rappel(s) 18h envoyé(s)`);
    console.log(`[Pending Check] ${aAlerter.length} demande(s) signalée(s)`);

    // ── Relance proactive "marquez vos Top Performer" — 7 à 10 jours après une livraison,
    // si aucune créative de CE lot précis n'est encore marquée, jamais relancé deux fois pour
    // le même lot. Fenêtre bornée (pas juste un seuil "≥7j") : passé 10 jours sans être passé
    // dans une exécution du cron, on abandonne plutôt que d'envoyer un rappel tardif et hors
    // contexte — mieux vaut un rappel manqué qu'un rappel qui arrive 3 semaines après coup.
    let relancesEnvoyees = 0;
    try {
      const prodRes = await fetch(`${SUPABASE_URL_INT}/rest/v1/products?select=id,user_id,deliveries,creatives&deliveries=not.is.null`, {
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
      });
      const produits = await prodRes.json();
      const J7 = 7 * 24*60*60*1000, J10 = 10 * 24*60*60*1000;
      for (const p of produits) {
        if (!p.user_id || !Array.isArray(p.deliveries) || !p.deliveries.length) continue;
        const creativesTopPerformer = new Set((p.creatives||[]).filter(c => c.topPerformer).map(c => c.week));
        let modifie = false;
        for (const d of p.deliveries) {
          if (!d.created_at || d.topPerformerReminderSent) continue;
          if (creativesTopPerformer.has(d.semaine)) continue; // déjà une marquée sur ce lot, pas besoin de relancer
          const age = Date.now() - new Date(d.created_at).getTime();
          if (age < J7 || age > J10) continue;
          await sendPushToUser(p.user_id, {
            title: 'Une créative qui sort du lot ?',
            body: `Vos visuels du batch ${d.semaine || ''} tournent depuis une semaine — marquez celles qui performent et ajoutez vos chiffres (ROAS, CPA…), ça affine vos prochains batches.`,
            url: '/adboard/gallery'
          });
          d.topPerformerReminderSent = true;
          modifie = true;
          relancesEnvoyees++;
        }
        if (modifie) {
          await fetch(`${SUPABASE_URL_INT}/rest/v1/products?id=eq.${p.id}`, {
            method: 'PATCH',
            headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
            body: JSON.stringify({ deliveries: p.deliveries })
          });
        }
      }
      console.log(`[Pending Check] ${relancesEnvoyees} relance(s) Top Performer envoyée(s)`);
    } catch(eTP) {
      console.error('[Pending Check] Relance Top Performer échouée:', eTP.message);
    }

    // ── Rattrapage des paiements en attente d'activation (voir /webhook/chariow) — un client
    // qui a payé avant d'avoir un compte AdBoard (ou avec un email différent au moment du
    // paiement) reste ici jusqu'à ce qu'un compte avec le même email apparaisse. Retenté à
    // chaque passage du cron plutôt qu'une seule fois — le client peut s'inscrire des heures
    // ou des jours après son paiement.
    let activationsRattrapees = 0;
    try {
      const pendRes = await fetch(`${SUPABASE_URL_INT}/rest/v1/pending_activations?resolved_at=is.null&select=*`, {
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
      });
      const pendings = await pendRes.json();
      for (const pend of pendings) {
        const planInfo = PLAN_MAP[pend.plan_id];
        if (!planInfo) continue; // produit inconnu, rien à faire, reste en attente
        const user = await findUserByEmail(pend.email);
        if (!user) continue; // toujours pas de compte avec cet email — on retentera au prochain passage
        await activateSubscription(user.id, planInfo, pend.email, user.user_metadata?.full_name || pend.name, pend.telephone);
        await traiterAttributionCRM(user.id);
        await fetch(`${SUPABASE_URL_INT}/rest/v1/pending_activations?id=eq.${pend.id}`, {
          method: 'PATCH',
          headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ resolved_at: new Date().toISOString(), resolved_user_id: user.id })
        });
        activationsRattrapees++;
        await notifierAdmin('✅ Activation rattrapée automatiquement', `<p>${pend.email} vient de créer son compte — abonnement activé rétroactivement (paiement du ${new Date(pend.created_at).toLocaleDateString('fr-FR')}).</p>`);
      }
      console.log(`[Pending Check] ${activationsRattrapees} activation(s) en attente rattrapée(s)`);
    } catch(ePend) {
      console.error('[Pending Check] Rattrapage activations échoué:', ePend.message);
    }
  } catch(e) {
    console.error('[Pending Check] Erreur:', e.message);
  }
  return;
}


// GET /cron/clarity-snapshot — déclenché 1x/jour par un cron externe (cron-job.org).
// Récupère les métriques comportementales AdBoard (clics de rage, clics morts, etc.)
// depuis l'API officielle de Microsoft Clarity, et les accumule dans notre propre table —
// l'API de Clarity ne garde que 3 jours glissants, donc on doit stocker nous-mêmes l'historique.
if (req.method === 'GET' && req.url.startsWith('/cron/clarity-snapshot')) {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const key = urlObj.searchParams.get('key');
  if (key !== process.env.SEQUENCE_CRON_SECRET) {
    res.writeHead(403); res.end(JSON.stringify({ error: 'Clé invalide' })); return;
  }
  res.writeHead(200, {'Content-Type':'application/json'});
  res.end(JSON.stringify({ ok: true, message: 'Récupération Clarity en cours' }));

  try {
    if (!process.env.CLARITY_API_TOKEN) {
      console.warn('[Clarity] CLARITY_API_TOKEN manquant — snapshot ignoré');
      return;
    }
    const r = await fetch('https://www.clarity.ms/export-data/api/v1/project-live-insights?numOfDays=1&dimension1=URL', {
      headers: { 'Authorization': `Bearer ${process.env.CLARITY_API_TOKEN}`, 'Content-Type': 'application/json' }
    });
    if (!r.ok) {
      console.warn(`[Clarity] Échec API (${r.status}) — snapshot ignoré`);
      return;
    }
    const data = await r.json();

    // La réponse groupe par nom de métrique, chaque groupe contenant un tableau par page.
    // Noms de champs confirmés par une capture de la vraie réponse brute (voir logs du
    // 2026-08-08) — les précédents ("Dead Click Count" avec espace, "distantUserCount",
    // "averageEngagementTime", etc.) ne correspondaient à RIEN de ce que Clarity renvoie
    // réellement, d'où les métriques à 0 malgré des données existantes.
    const parPage = {};
    (data || []).forEach(bloc => {
      const nomMetrique = bloc.metricName;
      (bloc.information || []).forEach(info => {
        const url = info.Url || 'session sans page identifiée';
        if (!parPage[url]) parPage[url] = { url };
        // subTotal = nombre réel d'incidents (pas sessionsCount, qui compte les sessions
        // observées, ni sessionsWithMetricPercentage, qui est un taux).
        if (nomMetrique === 'DeadClickCount')    parPage[url].dead_click_count    = parseInt(info.subTotal || 0);
        if (nomMetrique === 'RageClickCount')    parPage[url].rage_click_count    = parseInt(info.subTotal || 0);
        if (nomMetrique === 'QuickbackClick')    parPage[url].quickback_click     = parseInt(info.subTotal || 0);
        if (nomMetrique === 'ExcessiveScroll')   parPage[url].excessive_scroll    = parseInt(info.subTotal || 0);
        if (nomMetrique === 'Traffic') {
          parPage[url].traffic_sessions  = parseInt(info.totalSessionCount || 0);
          parPage[url].visiteurs_uniques = parseInt(info.distinctUserCount || 0);
        }
        if (nomMetrique === 'ScrollDepth')     parPage[url].scroll_depth      = parseFloat(info.averageScrollDepth || 0);
        if (nomMetrique === 'EngagementTime')  parPage[url].engagement_time   = parseFloat(info.activeTime || info.totalTime || 0);
      });
    });

    const lignes = Object.values(parPage).map(page => ({
      // Cause profonde corrigée (PGRST102 "All object keys must match") : chaque page ne
      // recevait un champ QUE si Clarity avait vraiment renvoyé cette métrique pour elle (ex:
      // une page sans aucun rage click n'avait tout simplement pas la clé rage_click_count) —
      // des objets aux formes différentes dans un même lot, que Supabase refuse en bloc.
      // Normalisation ici : les mêmes clés partout, 0 par défaut plutôt qu'une absence.
      url: page.url,
      dead_click_count: page.dead_click_count ?? 0,
      rage_click_count: page.rage_click_count ?? 0,
      quickback_click: page.quickback_click ?? 0,
      excessive_scroll: page.excessive_scroll ?? 0,
      traffic_sessions: page.traffic_sessions ?? 0,
      visiteurs_uniques: page.visiteurs_uniques ?? 0,
      scroll_depth: page.scroll_depth ?? 0,
      engagement_time: page.engagement_time ?? 0,
    }));
    if (lignes.length) {
      const rInsert = await fetch(`${SUPABASE_URL_INT}/rest/v1/clarity_snapshots`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(lignes)
      });
      // Cause profonde corrigée (plus aucune donnée dans Comportement Utilisateur depuis le
      // dernier fix) : cette écriture ne vérifiait jamais son propre succès — si Supabase la
      // refusait (colonne introuvable après le changement de noms de champs, contrainte, etc.),
      // le log affichait quand même "✅ enregistré" alors que rien n'était jamais écrit.
      if (!rInsert.ok) {
        const errText = await rInsert.text();
        console.error(`[Clarity] ❌ ÉCHEC insertion snapshot — statut ${rInsert.status}:`, errText.slice(0,500));
      } else {
        console.log(`[Clarity] ✅ Snapshot enregistré — ${lignes.length} page(s)`);
      }
    } else {
      console.log('[Clarity] Snapshot vide (aucune donnée retournée)');
    }
  } catch(e) {
    console.error('[Clarity] Erreur snapshot:', e.message);
  }
  return;
}


if (req.method === 'GET' && req.url.startsWith('/cron/email-sequence')) {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const key = urlObj.searchParams.get('key');
  if (key !== process.env.SEQUENCE_CRON_SECRET) {
    res.writeHead(403); res.end(JSON.stringify({ error: 'Clé invalide' })); return;
  }
  res.writeHead(200, {'Content-Type':'application/json'});
  res.end(JSON.stringify({ ok: true, message: 'Séquence en cours de traitement' }));

  try {
    // 1. Récupérer tous les users (Supabase Admin API)
    const usersRes = await fetch(`${SUPABASE_URL_INT}/auth/v1/admin/users?per_page=1000`, {
      headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
    });
    const usersData = await usersRes.json();
    const users = usersData?.users || [];

    // 2. Récupérer tous les abonnements actifs pour exclure les convertis
    const subsRes = await fetch(`${SUPABASE_URL_INT}/rest/v1/subscriptions?select=user_id,active,plan,expires_at`, {
      headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
    });
    const subs = await subsRes.json();
    const convertedUserIds = new Set((subs || []).filter(s => s.active).map(s => s.user_id));

    // Rappel de renouvellement — 3 jours avant expiration, 1x max par cycle
    for (const sub of (subs || [])) {
      if (!sub.active || !sub.expires_at) continue;
      const daysLeft = (new Date(sub.expires_at).getTime() - Date.now()) / (24*60*60*1000);
      if (daysLeft > 0 && daysLeft <= 3) {
        const reminderKey = `renewal_${sub.expires_at.slice(0,10)}`;
        const already = await wasSequenceSent(sub.user_id, reminderKey);
        if (!already) {
          await notifyUserBoth(sub.user_id, {
            title: '⏳ Ton abonnement expire bientôt',
            body: `Ton plan ${PLAN_LABELS[sub.plan] || sub.plan} expire dans ${Math.ceil(daysLeft)} jour(s). Renouvelle pour ne pas perdre tes livraisons.`,
            url: '/adboard/offers',
            type: 'warning',
          });
          await markSequenceSent(sub.user_id, reminderKey);
        }
      }
    }

    const DAY_MS = 24 * 60 * 60 * 1000;
    const SEQUENCE_STEPS = [
      { day: 1,  key: null }, // spécial : dépend du nb de produits (géré séparément)
      { day: 5,  key: 'j5_vision' },
      { day: 12, key: 'j12_offer' },
      { day: 21, key: 'j21_breakup' },
    ];

    let sentCount = 0;

    for (const user of users) {
      if (!user.email || convertedUserIds.has(user.id)) continue; // déjà converti → on arrête tout
      const ageMs = Date.now() - new Date(user.created_at).getTime();
      const ageDays = ageMs / DAY_MS;
      const firstName = user.user_metadata?.full_name?.split(' ')[0] || '';
      const userCurrency = user.user_metadata?.currency || 'XOF';

      // J1 — variante selon présence de produit (fenêtre 0.5 à 2 jours pour tolérance du cron quotidien)
      if (ageDays >= 0.5 && ageDays < 2) {
        const alreadySent = await wasSequenceSent(user.id, 'j1_no_product') || await wasSequenceSent(user.id, 'j1_has_product');
        if (!alreadySent) {
          const prodRes = await fetch(`${SUPABASE_URL_INT}/rest/v1/products?user_id=eq.${user.id}&select=nom,pays&limit=1`, {
            headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
          });
          const prods = await prodRes.json();
          const hasProduct = Array.isArray(prods) && prods.length > 0;
          const emailKey = hasProduct ? 'j1_has_product' : 'j1_no_product';
          const ok = await sendSequenceEmail(user.email, emailKey, { firstName, productName: hasProduct ? prods[0].nom : '', productPays: hasProduct ? prods[0].pays : '', currency: userCurrency }, user.id);
          if (ok) { await markSequenceSent(user.id, emailKey); sentCount++; }
        }
      }

      // J5, J12, J21 — fenêtre ±0.5 jour autour du jour cible
      for (const step of SEQUENCE_STEPS) {
        if (!step.key) continue;
        if (ageDays >= step.day - 0.5 && ageDays < step.day + 0.5) {
          const alreadySent = await wasSequenceSent(user.id, step.key);
          if (!alreadySent) {
            const ok = await sendSequenceEmail(user.email, step.key, { firstName, currency: userCurrency }, user.id);
            if (ok) { await markSequenceSent(user.id, step.key); sentCount++; }
          }
        }
      }

      // ── Nudges push contextuels — répétés chaque jour (rotation de 10 accroches) tant que l'action n'est pas faite ──
      if (ageDays >= 2) {
        const todayKey = new Date().toISOString().slice(0,10); // YYYY-MM-DD

        const chargerVariantes = async (prefixe) => {
          try {
            const r = await fetch(`${SUPABASE_URL_INT}/rest/v1/templates?cle=like.push_${prefixe}_*&select=titre,contenu,cle&order=cle.asc`, {
              headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
            });
            return await r.json();
          } catch(e) { return []; }
        };

        const prodRes2 = await fetch(`${SUPABASE_URL_INT}/rest/v1/products?user_id=eq.${user.id}&select=id,nom`, {
          headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
        });
        const userProducts = await prodRes2.json();
        const hasAnyProduct = Array.isArray(userProducts) && userProducts.length > 0;

        if (!hasAnyProduct) {
          const dailyKey = `push_no_product_${todayKey}`;
          if (!(await wasSequenceSent(user.id, dailyKey))) {
            const countRes = await fetch(`${SUPABASE_URL_INT}/rest/v1/email_sequence_log?user_id=eq.${user.id}&email_key=like.push_no_product_*&select=id`, {
              headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
            });
            const sentSoFar = (await countRes.json())?.length || 0;
            const variantes = await chargerVariantes('catalogue_vide');
            if (variantes.length) {
              const v = variantes[sentSoFar % variantes.length];
              await sendPushToUser(user.id, {
                title: interpoler(v.titre, {}),
                body: interpoler(v.contenu, {}),
                url: '/adboard/products'
              });
              await markSequenceSent(user.id, dailyKey);
              sentCount++;
            }
          }
        } else {
          // A un produit — vérifie s'il a un abonnement actif (pas juste une demande faite ou non)
          const subRes = await fetch(`${SUPABASE_URL_INT}/rest/v1/subscriptions?user_id=eq.${user.id}&active=eq.true&select=id&limit=1`, {
            headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
          });
          const hasActiveSub = (await subRes.json())?.length > 0;
          if (!hasActiveSub) {
            const dailyKey = `push_no_plan_${todayKey}`;
            if (!(await wasSequenceSent(user.id, dailyKey))) {
              const countRes = await fetch(`${SUPABASE_URL_INT}/rest/v1/email_sequence_log?user_id=eq.${user.id}&email_key=like.push_no_plan_*&select=id`, {
                headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
              });
              const sentSoFar = (await countRes.json())?.length || 0;
              const variantes = await chargerVariantes('pret_visuels');
              if (variantes.length) {
                const v = variantes[sentSoFar % variantes.length];
                const vars = { nom: userProducts[0].nom };
                await sendPushToUser(user.id, {
                  title: interpoler(v.titre, vars),
                  body: interpoler(v.contenu, vars),
                  url: '/adboard/offers'
                });
                await markSequenceSent(user.id, dailyKey);
                sentCount++;
              }
            }
          }
        }

        // Vu Tarifs sans payer — au moins 20h après la visite, 1 seule fois
        const pushSawPricing = await wasSequenceSent(user.id, 'push_saw_pricing');
        if (!pushSawPricing) {
          const evRes = await fetch(`${SUPABASE_URL_INT}/rest/v1/user_events?user_id=eq.${user.id}&event_key=eq.viewed_pricing&order=created_at.asc&limit=1`, {
            headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
          });
          const events = await evRes.json();
          if (Array.isArray(events) && events.length > 0) {
            const hoursSinceView = (Date.now() - new Date(events[0].created_at).getTime()) / (60*60*1000);
            if (hoursSinceView >= 20) {
              await sendPushToUser(user.id, {
                title: '💬 Des questions sur nos offres ?',
                body: 'Ava peut y répondre directement sur AdBoard, ou lance-toi avec PERF+.',
                url: '/adboard/offers'
              });
              await markSequenceSent(user.id, 'push_saw_pricing');
              sentCount++;
            }
          }
        }
      }

      // Relance mensuelle après J21 — rotation social proof / nouveauté / check-in, coupure à 180 jours
      if (ageDays >= 51 && ageDays < 180) {
        const monthNumber = Math.floor((ageDays - 21) / 30); // 1, 2, 3, 4...
        const monthlyKey = `monthly_${monthNumber}`;
        const ROTATION = ['monthly_social_proof', 'monthly_novelty', 'monthly_checkin'];
        const templateKey = ROTATION[(monthNumber - 1) % ROTATION.length];
        // Fenêtre ±1 jour autour du jalon mensuel (21 + 30*n)
        const targetDay = 21 + 30 * monthNumber;
        if (ageDays >= targetDay - 1 && ageDays < targetDay + 1) {
          const alreadySent = await wasSequenceSent(user.id, monthlyKey);
          if (!alreadySent) {
            const ok = await sendSequenceEmail(user.email, templateKey, { firstName, currency: userCurrency }, user.id);
            if (ok) { await markSequenceSent(user.id, monthlyKey); sentCount++; }
          }
        }
      }
    }

    // ── Rappel de renouvellement — chaque jour à partir de J-5 avant expiration ──
    try {
      const subsRes = await fetch(`${SUPABASE_URL_INT}/rest/v1/subscriptions?active=eq.true&select=user_id,plan,expires_at,started_at`, {
        headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
      });
      const activeSubs = await subsRes.json();
      const todayKey = new Date().toISOString().slice(0,10);
      if (Array.isArray(activeSubs)) {
        for (const sub of activeSubs) {
          if (!sub.expires_at) continue;
          const daysLeft = Math.ceil((new Date(sub.expires_at).getTime() - Date.now()) / DAY_MS);
          if (daysLeft < 0 || daysLeft > 5) continue; // fenêtre J-5 à J0 uniquement
          const dailyKey = `renewal_reminder_${todayKey}`;
          if (await wasSequenceSent(sub.user_id, dailyKey)) continue;
          const planLabelR = PLAN_LABELS[sub.plan] || sub.plan;
          const body = daysLeft === 0
            ? `Ton forfait ${planLabelR} expire aujourd'hui — renouvelle pour ne pas perdre tes images de la semaine.`
            : `Ton forfait ${planLabelR} expire dans ${daysLeft} jour${daysLeft>1?'s':''} — pense à renouveler.`;
          await notifyUserBoth(sub.user_id, {
            title: daysLeft === 0 ? '⏰ Ton forfait expire aujourd\'hui' : '⏰ Ton forfait expire bientôt',
            body,
            url: '/adboard/offers',
            type: 'warning',
          });
          await markSequenceSent(sub.user_id, dailyKey);
          sentCount++;
        }
      }
    } catch(e) {
      console.error('[Sequence] Erreur rappel renouvellement:', e.message);
    }

    console.log(`[Sequence] ✅ Traitement quotidien terminé — ${sentCount} email(s) envoyé(s)`);
  } catch(e) {
    console.error('[Sequence] Erreur cron:', e.message);
  }
  return;
}

// GET /check-subscription/:userId — vérifie si un user a un abonnement actif
// POST /send-welcome-email — envoie l'email de bienvenue (appelé côté client à la 1ère connexion)
if (req.method === 'POST' && req.url === '/send-welcome-email') {
  let body = '';
  req.on('data', d => body += d);
  req.on('end', () => {
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({ ok: true }));
    try {
      const { email, name } = JSON.parse(body);
      if (email) sendWelcomeEmail({ email, name }).catch(e => console.error('[Email] Welcome non bloquant:', e.message));
    } catch(e) { console.error('[Welcome] Erreur parsing:', e.message); }
  });
  return;
}

if (req.method === 'GET' && req.url.startsWith('/check-subscription/')) {
  const userId = req.url.split('/')[2];
  try {
    const r = await fetch(`${SUPABASE_URL_INT}/rest/v1/subscriptions?user_id=eq.${userId}&active=eq.true&limit=1`, {
      headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
    });
    const rows = await r.json();
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({ subscription: rows?.[0] || null }));
  } catch(e) {
    res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
  }
  return;
}


// POST /chat — Ava AI Assistant
if (req.method === 'POST' && req.url === '/chat') {
  let body = '';
  req.on('data', d => body += d);
  req.on('end', async () => {
    try {
      const { message, history=[], context={}, session_id } = JSON.parse(body);
      const GEMINI_KEY = process.env.GEMINI_API_KEY || '';

      // Build system prompt with user context
      const { user, subscription, products=[], credits={}, section='', language='fr' } = context;
      const userName = user?.name?.split(' ')[0] || '';
      const planLabel = subscription?.plan ? `${subscription.plan.charAt(0).toUpperCase()+subscription.plan.slice(1)}` : 'aucun';
      const prodList = products.map(p => `- ${p.nom} (${p.pays}, ${p.pricing})`).join('\n') || 'Aucun produit créé';
      const creditsInfo = subscription?.active ? `${credits.available||0} créatives disponibles cette semaine` : 'pas encore abonné';

      const msgCount = history.length;
      const hasSubscription = subscription?.active;
      const isConnected = !!user;
      const planActive = subscription?.plan || 'none';
      const isPackClient = subscription?.type === 'pack';
      // A déjà transigé au moins une fois, même si l'abonnement actuel est expiré/inactif — la
      // ligne `subscription` existe dès la 1ère activation et n'est jamais supprimée. C'est ce
      // qui distingue un ancien client d'un tout nouveau visiteur, pas juste `hasSubscription`.
      const everTransacted = !!subscription;

      // ── Situation calculée en code, pas laissée à l'appréciation du modèle ──
      // C'est la cause profonde des incohérences passées : donner des faits épars et
      // laisser le modèle deviner la bonne action le fait retomber sur ses réflexes
      // génériques de "chatbot de vente" (proposer un plan) même quand ce n'est pas pertinent.
      let situationAction;
      if (!isConnected) {
        situationAction = "Pas encore connecté → priorité : proposer de se connecter avec Google (bouton login).";
      } else if (!hasSubscription && !everTransacted) {
        situationAction = "Jamais transigé, aucune offre active → proposer le plan adapté à son besoin (PERF+ / GROWTH / SCALE), avec le bouton checkout correspondant.";
      } else if (!hasSubscription && everTransacted) {
        situationAction = "Déjà transigé au moins une fois (abonnement actuel expiré/inactif) → proposer un plan (PERF+/GROWTH/SCALE selon son besoin) pour reprendre, avec le bouton checkout correspondant.";
      } else if (products.length === 0) {
        situationAction = `${isPackClient ? 'Ancien pack' : 'Abonné actif'} mais AUCUN produit créé → dire d'aller créer un produit (bouton openProductForm). C'est la seule étape qui manque avant de pouvoir demander des créatives. Ne JAMAIS proposer un plan, il en a déjà un actif.`;
      } else if ((credits.available||0) >= 6) {
        situationAction = `${isPackClient ? 'Ancien pack' : 'Abonné actif'}, ${products.length} produit(s) créé(s), ${credits.available} créatives DISPONIBLES MAINTENANT → dire d'aller sur "Mes Produits" et cliquer "Demander une production" sur le produit concerné, livraison sous 24h. NE JAMAIS proposer un plan ni un renouvellement, il en a déjà des images disponibles.`;
      } else if (isPackClient) {
        situationAction = `Ancien pack ponctuel (offre retirée de la vente) dont toutes les créatives sont utilisées (0 disponible) → ce pack n'inclut JAMAIS de nouvelles créatives automatiquement. Proposer un abonnement (Starter en priorité, bouton checkout:starter) pour continuer à recevoir des créatives chaque semaine. NE JAMAIS dire d'attendre un renouvellement automatique — ça n'existe pas pour ce pack.`;
      } else {
        situationAction = `Abonné actif, ${products.length} produit(s) créé(s), mais créatives de la semaine épuisées (0 disponible) → c'est normal et temporaire (l'abonnement lui-même reste actif, ce n'est qu'une pause hebdomadaire). Dire que les prochaines créatives arrivent à la prochaine livraison hebdomadaire${credits.nextCreditDate ? ' (' + new Date(credits.nextCreditDate).toLocaleDateString('fr-FR',{day:'numeric',month:'long'}) + ')' : ''}. NE JAMAIS proposer de reprendre un plan ou de "renouveler" — l'abonnement n'a pas expiré, c'est juste le cycle hebdomadaire normal.`;
      }

      const { currency='XOF', currencyRate=1 } = context;
      const userMarket = [...new Set(products.map(p => p.pays).filter(Boolean))].join(', ') || 'non précisé';
      const today = new Date().toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

      // ── Résumé du contenu réel par produit — nécessaire pour qu'Ava puisse répondre à des
      // questions factuelles ("combien de créatives j'ai", "quels angles pour ce produit") sans
      // jamais voir les images elles-mêmes (juste les comptages et les textes déjà écrits). ──
      // Dates de livraison ajoutées — sans ça, impossible de répondre à toute question contenant
      // "récemment", "cette semaine", "mon dernier batch", etc. (question réelle remontée, restée
      // sans réponse utilisable faute de cette info). Résumé des données marché ajouté aussi —
      // demande explicite (positionnement, taille de marché, concurrence par produit), absent
      // du contexte jusqu'ici alors que déjà disponible sur chaque produit (p.marche).
      const contentSummary = products.map(p => {
        const nbCreatives = (p.creatives || []).length;
        const angleSource = (p.marche?.angles?.length ? p.marche.angles : null);
        let anglesTxt = 'aucun angle livré pour l\'instant';
        if (angleSource) {
          anglesTxt = angleSource.map((a,i) => `  ${i+1}. "${a.nom}" — ${a.formulation_simple || a.moteur || 'sans détail'}`).join('\n');
        } else if (p.deliveries?.length) {
          const allAngles = p.deliveries.flatMap(d => d.angles || []);
          anglesTxt = allAngles.map((a,i) => `  ${i+1}. "${a.nom}"`).join('\n');
        }
        const batchsTxt = (p.deliveries || []).length
          ? p.deliveries.map((d,i) => `  Batch ${i+1} — livré le ${d.date || '?'} (${(d.angles||[]).length} angle(s), ${(d.angles||[]).length*3} créative(s))`).join('\n')
          : '  aucun batch livré pour l\'instant';
        const pos = p.marche?.positionnement;
        const marcheTxt = pos
          ? `  Taille du marché : ${pos.taille_marche_personnes || 'non disponible'} · Croissance : ${pos.taux_croissance || 'non disponible'} · Concurrence : ${pos.concurrence || 'non disponible'}${pos.concurrents_directs?.length ? ' (concurrents directs : ' + pos.concurrents_directs.map(c=>c.nom).join(', ') + ')' : ''}`
          : '  aucune analyse de marché disponible pour l\'instant';
        return `PRODUIT "${p.nom}" :\n- ${nbCreatives} créative(s) au total dans la Galerie\n- Historique des batchs livrés :\n${batchsTxt}\n- Angles marketing livrés :\n${anglesTxt}\n- Données marché :\n${marcheTxt}`;
      }).join('\n\n');

      const SYSTEM = `Tu es Ava, l'assistante d'AdStack — le partenaire créatif conçu pour la croissance des vendeurs en ligne, pas juste une agence qui produit des créatives.

DATE DU JOUR : ${today}. Utilise toujours cette date comme référence — ne suppose jamais une autre année.

━━━━━━━━━━━━━━━
SITUATION ACTUELLE DE CETTE PERSONNE (calculée, fiable à 100% — ne la recalcule jamais toi-même)
${situationAction}
Dès qu'on te demande "comment avoir mes créatives / comment ça marche / je fais quoi maintenant", c'est CETTE ligne
qui donne la bonne réponse — pas une réponse générique sur les plans. Relis-la avant de répondre à ce type de question.
━━━━━━━━━━━━━━━

CONTENU RÉEL DÉJÀ LIVRÉ PAR PRODUIT (pour répondre aux questions factuelles — "combien de créatives j'ai",
"quels angles pour tel produit", etc.) :
${contentSummary || 'Aucun produit avec du contenu livré pour l\'instant.'}

⚠️ RÈGLE ABSOLUE SUR LES ANGLES MARKETING — À LIRE ATTENTIVEMENT :
Tu peux UNIQUEMENT parler des angles listés ci-dessus, EXACTEMENT tels qu'ils sont écrits — jamais en inventer, jamais en deviner un qui n'y est pas. Si une personne te demande "pourquoi vous avez choisi tel angle pour moi" ET que cet angle existe dans la liste ci-dessus : tu peux expliquer brièvement, simplement, en t'appuyant sur ce qui est écrit (le "moteur"/la formulation fournie) — comme un résumé factuel, pas une improvisation d'expert.
Si un produit n'a AUCUN angle livré pour l'instant ("aucun angle livré pour l'instant" ci-dessus) : ne dis JAMAIS "on va faire tel angle" ni ne propose de nom d'angle toi-même, comme si tu décidais ou anticipais un choix — ce n'est pas ton rôle, c'est l'équipe qui choisit les angles, et tu n'y as pas accès avant qu'ils soient réellement livrés. Dis simplement que les angles arriveront avec les prochaines créatives.

CONTEXTE UTILISATEUR (détails à l'appui de la situation ci-dessus)
- Statut : ${isConnected ? 'Connecté (' + user?.email + ')' : 'Non connecté'}
- Plan : ${hasSubscription ? planActive.toUpperCase() : 'Aucun abonnement'}
- Marché : ${userMarket}
- Produits : ${products.length > 0 ? products.map(p => p.nom + ' (' + p.pricing + ' · ' + p.pays + ')').join(' | ') : 'aucun'}
- Créatives restantes : ${creditsInfo}
- Devise : ${currency}
- Messages échangés : ${msgCount}

OFFRES (source unique OFFERS, toujours dans la devise de l'utilisateur)
${formatOffresPourPrompt(currency, currencyRate)}
Plan actif : ${hasSubscription ? planActive.toUpperCase() + ' — NE JAMAIS le reproposer' : 'AUCUN'}

FORMATS : on produit des VIDÉOS et des IMAGES (pas seulement des images). Chaque lot hebdomadaire = 2 vidéos + 4 images
(6 créatives), livré en 24h max. Quand on parle de ce qu'on livre, dis « créatives » (vidéos et images), jamais
« visuels » ni « images » tout court. Une vidéo ou une image, les deux sont pensées pour vendre sur Meta Ads.

CHOISIR L'OFFRE : UN SEUL CRITÈRE = L'OBJECTIF DE LA PERSONNE (performance, croissance ou expansion)
Ne demande PLUS le chiffre d'affaires visé ni le budget pub — ces critères n'existent plus.
Pose UNE seule question : « Ton objectif, c'est plutôt performer, grandir ou t'étendre ? » (reformule simplement).
- PERFORMANCE → PERF+. Elle veut un compte pub qui performe et de meilleurs résultats. PERF+ lui donne tout
  ce qu'il faut : 24 créatives/mois (vidéos + images), 1 produit par semaine, un lot qui s'améliore chaque semaine
  grâce à ce qui a marché. Garantie Performance en 45 jours.
- CROISSANCE → GROWTH. Elle veut aller plus vite, tester plus, trouver ses gagnants, sans gérer une équipe.
  GROWTH = 48 créatives/mois, jusqu'à 2 produits par semaine. Garantie Croissance en 45 jours.
- EXPANSION → SCALE. Elle est déjà sur un gros marché, OU elle veut attaquer plusieurs marchés en même temps
  (langues, cultures différentes) sans exploser ses coûts. SCALE = 96 créatives/mois, jusqu'à 4 produits par semaine.
  Garantie Scaling en 45 jours.
Si l'objectif n'est pas clair, pose la question de l'objectif avant de recommander. Si la personne le dit déjà,
recommande directement UNE offre (jamais les trois en vrac) et explique en une phrase pourquoi elle lui correspond.
Si elle hésite entre deux offres, tranche pour elle : « Pour ton objectif, je te conseille X. »
(Ces critères servent uniquement si la personne n'a pas d'abonnement actif, ou veut changer de plan.)

GARANTIE — « RÉSULTATS EN 45 JOURS OU REMBOURSÉ » (c'est la SEULE garantie, elle porte un nom selon l'offre : Performance pour PERF+, Croissance pour GROWTH, Scaling pour SCALE, ne parle plus de « livraison 24h ou remboursé »
ni de « satisfait ou remboursé »). Fonctionnement : le client publie les créatives livrées et investit en publicité avec
elles pendant 45 jours. S'il ne constate aucune amélioration de ses performances, il écrit sur WhatsApp avec des captures
de son compte publicitaire Meta (dépenses du mois + résultats : ROAS, coût par achat…). On vérifie, puis on le rembourse
l'intégralité de son paiement. Présente-la simplement, en 2 phrases, comme ce qui retire le risque.

TU ES
Ava. Tu parles comme une vraie personne — directe, chaleureuse. Prénom utilisé MAX 1 fois dans toute la conversation.

━━━━━━━━━━━━━━━
RÈGLE 0 — TON RÔLE, STRICT ET NON NÉGOCIABLE
Tu ne fais JAMAIS le travail toi-même. Tu ne proposes JAMAIS d'angles marketing, tu ne demandes JAMAIS les couleurs
d'un produit, tu ne demandes JAMAIS quel type de créative (avant/après, etc.) la personne veut, tu ne donnes JAMAIS
d'avis créatif ou d'analyse de marché. Ce travail est fait après la commande par notre équipe humaine — pas par toi.
Ton rôle se limite à : expliquer comment AdStack fonctionne, rassurer, rediriger vers la bonne action (créer un
produit, s'abonner, suivre une commande, voir la galerie). Si on te demande un avis créatif/marketing, réponds que
notre équipe s'en charge une fois la commande passée, et redirige vers l'action correspondante.

RÈGLE 1 — STYLE ET FORMAT (décide AVANT d'écrire) — TON BUT EST DE VENDRE, PAS D'INFORMER
→ Mots simples, ceux qu'on dit à l'oral. Pas de jargon.
→ 2-3 phrases COURTES maximum par message. Une idée par phrase. Phrases percutantes, qui donnent envie d'agir.
→ Jamais de gros paragraphe. Bullets seulement pour 2-3 éléments, 1 ligne chacun.
→ Chaque message pousse la personne vers l'étape suivante : une courte question ou un bouton, jamais les deux.
→ Une question vague ("dites-m'en plus", "qui êtes-vous") appelle une réponse de 2 phrases qui donne envie de
  creuser. Garde de la matière pour la suite.

RÈGLE 2 — CONCISION
Maximum d'info, minimum de mots.

RÈGLE 3 — GOOGLE SEARCH
Construis toujours la requête avec : marché de l'utilisateur (${userMarket}), catégorie produit, année en cours (${new Date().getFullYear()}). Jamais de données d'un autre pays que le sien.

RÈGLE 4 — BÉNÉFICES PAS FEATURES (dans le discours, jamais dans les faits — voir RÈGLE 0)
On est là pour la croissance de la personne, pas pour lui vendre des fichiers. Ne mets jamais en avant "analyse de
marché" ou "personas" comme argument de vente. Ce qui la convainc : performer, grandir ou s'étendre selon son
objectif. Le volume (ex : « 48 créatives par mois, vidéos et images ») se cite en une courte phrase, comme preuve.
❌ "36 images/semaine, avec analyse de marché et personas" → ✅ "On teste ce qui marche pour toi, chaque semaine,
et on garde ce qui convertit — c'est ça qui te fait grandir."
Désir profond : plus de ventes, moins de galère, liberté financière.

RÈGLE 5 — CTA
0 bouton avant le 4ème échange — SAUF si la personne exprime une intention d'achat CLAIRE et explicite dès le
début ("comment je commande", "comment ça se passe", "je veux payer", "comment on procède") : dans ce cas,
le throttle ne s'applique plus, propose le bouton checkout DIRECTEMENT, même au 1er message. Ce throttle sert à
ne pas bousculer un visiteur encore hésitant qui découvre l'offre — jamais à retenir un bouton que la personne
demande explicitement. En dehors de ce cas : 1 seul bouton par message, jamais 2 de suite.
Prospect chaud → bouton checkout DIRECT au message suivant.
[BTN:login] [BTN:openProductForm]
[BTN:checkout:starter] [BTN:checkout:pro] [BTN:checkout:scale]
[BTN:navigate:suivi] [BTN:navigate:galerie]
[BTN:whatsapp]
INTERDIT ABSOLU : n'écris JAMAIS un lien markdown ([texte](url)) ni une URL brute (chariow, mychariow, ou
autre) pour proposer un paiement — même trouvée via la recherche Google ou ailleurs dans le contexte. Un lien
direct saute le popup de paiement intégré (devise, code promo) et peut pointer vers une page obsolète. Le SEUL
moyen valide de proposer une action est le token [BTN:...] ci-dessus.
L'abonnement est mensuel uniquement (plus d'offre trimestrielle ni annuelle) : utilise toujours checkout.
Utilise [BTN:whatsapp] UNIQUEMENT dans ces cas précis : (1) la personne a payé mais n'arrive pas à se connecter
avec le bon compte (probable mauvais email utilisé au paiement — dis-lui d'abord d'essayer de se connecter avec
l'email utilisé pour payer, propose WhatsApp seulement si ça ne résout rien), (2) la personne exprime clairement
être bloquée ou frustrée après plusieurs échanges sans que tu puisses résoudre son problème. Jamais en premier
recours pour une question simple — WhatsApp est le dernier filet, pas un raccourci.

RÈGLE 6 — PAIEMENT SANS CONNEXION PRÉALABLE, ET COMMENT LE PRÉSENTER
Il n'est PAS nécessaire d'être connecté pour payer — le paiement s'ouvre directement, connecté ou non. La
connexion ne redevient utile qu'ensuite, pour créer un produit et suivre ses commandes. Si on te demande
"comment commander" alors que la personne n'est pas connectée : ne dis JAMAIS "connecte-toi d'abord" — vends
directement l'offre adaptée (bénéfices, pas features) et propose le bouton checkout correspondant tout de suite.

Juste avant ou juste après avoir proposé le bouton checkout à une personne chaude, résume en 2-3 phrases
courtes ce qui se passe concrètement après le paiement — ça rassure, une personne qui va payer veut savoir à
quoi s'attendre. Exemple de ton (adapte au contexte de la conversation, ne récite jamais mot pour mot) :
"Une fois le paiement fait, tu es redirigé directement sur la plateforme — tu te connectes, tu ajoutes ton
produit, tu demandes tes créatives, et notre équipe te livre du contenu qui performe sous 24h max."
Une touche d'enthousiasme sincère est bienvenue, avant ou après le paiement — pas dans chaque message, juste
au bon moment (ex: quand elle vient de choisir une offre, ou juste avant le bouton) : une phrase courte du
genre "hâte de voir tes ventes décoller" ou "on est chauds de bosser sur ton produit" — jamais forcé, jamais
répété, jamais au prix d'avoir l'air d'un vendeur trop pressé.

Langue : ${language === 'fr' ? 'français uniquement' : 'English only'}`

      // Google Grounding pour données marché en temps réel
      const contents = [
        ...history.slice(-6).map(m => ({ role: m.role, parts: [{ text: m.content }] })),
        { role: 'user', parts: [{ text: message }] }
      ];

      const vertexBody = {
        system_instruction: { parts: [{ text: SYSTEM }] },
        contents,
        // Cause profonde corrigée : la RÈGLE de recherche du prompt demandait à ce chatbot de
        // construire une recherche Google, mais aucun outil de recherche n'était réellement
        // déclaré ici — la consigne était invisible pour le modèle, incapable de chercher quoi
        // que ce soit en pratique. thinkingBudget:0 (avant) + grounding activé aurait reproduit
        // un bug déjà rencontré et corrigé ailleurs dans ce fichier (le budget de réflexion
        // partage le même total que la sortie — sans budget dédié, la vraie réponse peut être
        // tronquée avant même d'être écrite). maxOutputTokens élargi en conséquence.
        generationConfig: { maxOutputTokens: 900, temperature: 0.4, ...reflexion(MODELES.chat, 512) },
        tools: [{ googleSearch: {} }],
      };

      const CHAT_MODEL = MODELES.chat;
      let token;
      try { token = await getToken(); }
      catch(e) { throw new Error('Token Vertex AI impossible: ' + e.message); }
      console.log('[Ava] Appel Vertex AI model=gemini-2.5-flash contents.length=', contents.length);
      const geminiData = await vertexRequest(token, CHAT_MODEL, vertexBody, 25000);
      console.log('[Ava] Réponse Vertex AI:', JSON.stringify(geminiData).slice(0, 400));
      if (!geminiData?.candidates?.[0]) {
        console.error('[Ava] Gemini error:', JSON.stringify(geminiData).slice(0,300));
      }
      const reply = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "Désolée, je n'ai pas pu répondre. Réessaie dans un instant.";

      // Save to Supabase if service key available
      if (SUPABASE_SERVICE_KEY && session_id) {
        const saveMsg = async (role, content) => {
          const r = await fetch(`${SUPABASE_URL_INT}/rest/v1/chat_messages`, {
            method: 'POST',
            headers: { 'Content-Type':'application/json', apikey:SUPABASE_SERVICE_KEY, Authorization:`Bearer ${SUPABASE_SERVICE_KEY}` },
            body: JSON.stringify({ session_id, role, content })
          });
          // Cause profonde corrigée (aucune donnée du chatbot dans le CRM, aucune trace nulle
          // part) : l'erreur était avalée silencieusement (.catch(()=>{})) — impossible de
          // savoir si l'insertion échouait et pourquoi. On log maintenant le vrai code HTTP et
          // le corps de la réponse en cas d'échec.
          if (!r.ok) {
            const errText = await r.text().catch(()=>'(corps illisible)');
            console.error(`[Ava] chat_messages HTTP ${r.status} (${role}):`, errText.slice(0,300));
          }
        };
        saveMsg('user', message).catch(e => console.error('[Ava] chat_messages save error (user):', e.message));
        saveMsg('model', reply).catch(e => console.error('[Ava] chat_messages save error (model):', e.message));
      } else if (!SUPABASE_SERVICE_KEY) {
        console.error('[Ava] chat_messages non sauvegardé : SUPABASE_SERVICE_KEY absente côté serveur');
      } else if (!session_id) {
        console.error('[Ava] chat_messages non sauvegardé : aucun session_id reçu du client');
      }

      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ reply }));
    } catch(e) {
      console.error('[Ava] ERREUR COMPLÈTE:', e.message, e.stack?.slice(0,300));
      res.writeHead(500);
      res.end(JSON.stringify({ reply: "Une erreur s'est produite. Réessaie dans un instant.", error: e.message }));
    }
  });
  return;
}

// GET /chat/history/:sessionId — charger l'historique
if (req.method === 'GET' && req.url.startsWith('/chat/history/')) {
  const sessionId = req.url.split('/')[3];
  if (!SUPABASE_SERVICE_KEY || !sessionId) { res.writeHead(200); res.end('[]'); return; }
  try {
    const r = await fetch(`${SUPABASE_URL_INT}/rest/v1/chat_messages?session_id=eq.${sessionId}&order=created_at.asc&limit=30`, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
    });
    const rows = await r.json();
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify(rows||[]));
  } catch(e) { res.writeHead(200); res.end('[]'); }
  return;
}

// POST /chat-vente — chatbot de la page de vente (prospects, pas encore clients).
// Même moteur qu'Ava (Gemini via Vertex AI, jamais Claude), même table de persistance
// chat_messages (déjà lue par le CRM), mais prompt système différent : pas de logique
// d'abonnement/crédits puisqu'il n'y a pas encore de compte, à la place une présentation
// d'AdBoard et des offres — toutes deux sourcées sur OFFERS, jamais un prix recopié à la main.
if (req.method === 'POST' && req.url === '/chat-vente') {
  let body = '';
  req.on('data', d => body += d);
  req.on('end', async () => {
    try {
      const { message, history = [], context = {}, session_id } = JSON.parse(body);
      const { language = 'fr', currency = 'XOF', currencyRate = 1 } = context;
      const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const sessionId = session_id ? (String(session_id).startsWith('vente_') ? session_id : `vente_${session_id}`) : null;

      const venteTexte = await getVenteCopyLive();

      const SYSTEM = `Tu es Ava, l'assistante d'AdStack. Tu discutes ici avec un PROSPECT sur la page de vente publique
adstackofficial.com — cette personne n'a pas encore de compte AdBoard, ne la traite jamais comme une cliente existante.

DATE DU JOUR : ${today}. Utilise toujours cette date comme référence — ne suppose jamais une autre année.

━━━━━━━━━━━━━━━
CE QU'EST ADSTACK
Le partenaire créatif conçu pour la croissance des e-commerçants — pas juste une agence qui produit des créatives.
Chaque semaine, notre équipe trouve ce qui fonctionne pour la marque du prospect et l'améliore, pour le faire
sortir de la saturation et grandir durablement. Concrètement, ça veut dire : stratégie, production et
amélioration continue, chaque semaine, portées par une vraie équipe derrière lui.
Ne détaille jamais ça comme une liste de features ("analyse de marché + personas + angles + créatives") — c'est
un mécanisme qu'il découvre une fois client, pas un argument de vente. Ce qui vend, c'est le résultat : passer
un cap, se démarquer, ne plus deviner ce qui marche. Garantie : résultats en 45 jours
ou remboursé.
Reste volontairement vague sur qui on cible précisément (ne dis jamais "COD", "paiement à la livraison", ou
"Afrique francophone" comme si c'était notre positionnement officiel) — "on aide des e-commerçants à grandir"
suffit.
FORMATS : on produit des VIDÉOS et des IMAGES (pas seulement des images). Chaque lot hebdomadaire = 2 vidéos + 4 images
(6 créatives), livré en 24h max. Quand on parle de ce qu'on livre, dis « créatives » (vidéos et images), jamais
« visuels » ni « images » tout court. Une vidéo ou une image, les deux sont pensées pour vendre sur Meta Ads.

Ne dis jamais qu'on utilise de l'IA, un modèle, ou toute formulation technique — c'est toujours "notre équipe"
qui produit le travail, jamais "l'IA" ou "le système". Un visiteur qui demande explicitement comment ça marche
techniquement peut être redirigé vers "notre équipe créative", sans plus de détail.

CE QU'EST ADBOARD (l'espace client, accessible après souscription — ce qui se passe concrètement après le paiement)
- Connexion Google, aucun mot de passe à retenir.
- Mes Produits — où le client déclare ses produits et demande sa production.
- Galerie Créatives — tout ce qui a été livré, classé par produit et par angle.
- Ad Copies — les textes publicitaires qui accompagnent les créatives.
- Données Marché — ce qu'on a appris sur son marché et sa cible, pour chaque produit.
- Suivi Demande — statut en temps réel de chaque commande en cours.
- Nos Tarifs — gestion de l'abonnement et upgrade.

${venteTexte ? `━━━━━━━━━━━━━━━
COPYWRITING ACTUEL DE LA PAGE DE VENTE (lu en direct — c'est la source la plus à jour, elle peut
avoir changé récemment ; en cas de contradiction avec le reste de ce prompt, PRÉFÈRE cette version-ci) :
${venteTexte}
` : ''}
━━━━━━━━━━━━━━━
OFFRES (source unique OFFERS, toujours dans la devise du prospect) — CHACUNE POUR UN OBJECTIF DIFFÉRENT,
ne les présente jamais comme interchangeables :
${formatOffresPourPrompt(currency, currencyRate)}

CHOISIR L'OFFRE : UN SEUL CRITÈRE = L'OBJECTIF DE LA PERSONNE (performance, croissance ou expansion)
Ne demande PLUS le chiffre d'affaires visé ni le budget pub — ces critères n'existent plus.
Pose UNE seule question : « Ton objectif, c'est plutôt performer, grandir ou t'étendre ? » (reformule simplement).
- PERFORMANCE → PERF+. Elle veut un compte pub qui performe et de meilleurs résultats. PERF+ lui donne tout
  ce qu'il faut : 24 créatives/mois (vidéos + images), 1 produit par semaine, un lot qui s'améliore chaque semaine
  grâce à ce qui a marché. Garantie Performance en 45 jours.
- CROISSANCE → GROWTH. Elle veut aller plus vite, tester plus, trouver ses gagnants, sans gérer une équipe.
  GROWTH = 48 créatives/mois, jusqu'à 2 produits par semaine. Garantie Croissance en 45 jours.
- EXPANSION → SCALE. Elle est déjà sur un gros marché, OU elle veut attaquer plusieurs marchés en même temps
  (langues, cultures différentes) sans exploser ses coûts. SCALE = 96 créatives/mois, jusqu'à 4 produits par semaine.
  Garantie Scaling en 45 jours.
Si l'objectif n'est pas clair, pose la question de l'objectif avant de recommander. Si la personne le dit déjà,
recommande directement UNE offre (jamais les trois en vrac) et explique en une phrase pourquoi elle lui correspond.
Si elle hésite entre deux offres, tranche pour elle : « Pour ton objectif, je te conseille X. »

PAIEMENT ET GARANTIE
Wave, Orange Money, Moov Money, MTN MoMo, Djamo — paiement sécurisé via Chariow. Abonnement mensuel résiliable
à tout moment (pas d'engagement, abonnement mensuel uniquement). Garantie :
résultats en 45 jours ou remboursé.

GARANTIE — « RÉSULTATS EN 45 JOURS OU REMBOURSÉ » (c'est la SEULE garantie, elle porte un nom selon l'offre : Performance pour PERF+, Croissance pour GROWTH, Scaling pour SCALE, ne parle plus de « livraison 24h ou remboursé »
ni de « satisfait ou remboursé »). Fonctionnement : le client publie les créatives livrées et investit en publicité avec
elles pendant 45 jours. S'il ne constate aucune amélioration de ses performances, il écrit sur WhatsApp avec des captures
de son compte publicitaire Meta (dépenses du mois + résultats : ROAS, coût par achat…). On vérifie, puis on le rembourse
l'intégralité de son paiement. Présente-la simplement, en 2 phrases, comme ce qui retire le risque.

PROCESS DE LIVRAISON (à jour — ne JAMAIS mentionner WhatsApp, Google Drive, ou un "formulaire de brief" à
remplir, ce n'est plus le fonctionnement réel)
Abonnement en ligne → connexion Google sur AdBoard → import du produit dans le catalogue, demande de créatives en
2 clics → production → livraison directement dans AdBoard (Galerie Créatives, Ad Copies, Données Marché) sous
24h, avec suivi de production en temps réel → cycle hebdomadaire.

DÉMO — CONTRAIREMENT À UNE ANCIENNE CONSIGNE, NE JAMAIS NIER OU ÉVITER LE SUJET
Beaucoup de prospects arrivant sur cette page ont déjà reçu une démo personnalisée avant d'être relancés — si la
personne en parle, confirme-le naturellement, ne fais jamais comme si ça n'existait pas.

TU ES
Ava. Tu parles comme une vraie personne — directe, chaleureuse. Prénom jamais utilisé (tu ne le connais pas encore).

━━━━━━━━━━━━━━━
RÈGLE 0 — TA MISSION, DANS CET ORDRE, STRICT ET NON NÉGOCIABLE
Ton objectif n'est PAS de donner de l'information : c'est de VENDRE. Chaque échange doit rapprocher le prospect
du bon abonnement. Toutes les informations détaillées existent déjà sur la page de vente — ne ré-explique pas tout.
Ton rôle : humaniser et condenser tout ça pour un prospect confus, dans cet ordre précis —
1. Effacer la confusion et les peurs (comment ça marche, ce qui se passe après paiement, pourquoi c'est fiable).
2. Effacer les objections (prix, engagement, "est-ce que ça va vraiment marcher pour MON produit").
3. Convertir vers l'offre ADAPTÉE à ce prospect précis — pas la même pour tout le monde (voir OFFRES ci-dessus).
Tu ne fais JAMAIS le travail créatif toi-même (pas d'angle marketing, pas d'avis créatif) — c'est fait par notre
équipe après commande, jamais "l'IA", jamais "le système".

RÈGLE 1 — STYLE ET FORMAT (décide AVANT d'écrire) — TON BUT EST DE VENDRE, PAS D'INFORMER
→ Mots simples, ceux qu'on dit à l'oral. Pas de jargon.
→ 2-3 phrases COURTES maximum par message. Une idée par phrase. Phrases percutantes, qui donnent envie d'agir.
→ Jamais de gros paragraphe. Bullets seulement pour 2-3 éléments, 1 ligne chacun.
→ Chaque message pousse la personne vers l'étape suivante : une courte question ou un bouton, jamais les deux.
→ Une question vague ("dites-m'en plus", "qui êtes-vous") appelle une réponse de 2 phrases qui donne envie de
  creuser. Garde de la matière pour la suite.

RÈGLE 2 — CONCISION
Maximum d'info, minimum de mots. Jamais d'information superflue déjà visible sur la page — condense, ne répète pas.

RÈGLE 2bis — BÉNÉFICES PAS FEATURES
On est là pour la croissance du prospect, pas pour lui vendre des fichiers. N'argumente pas avec "analyse de
marché" ou "personas". Ce qui convainc : performer, grandir, s'étendre selon SON objectif. Le volume
(ex : « 24 créatives par mois, vidéos et images ») se cite en UNE courte phrase, comme preuve de l'offre
recommandée, jamais comme argument principal.
❌ "Tu reçois 16 images/mois avec analyse de marché" → ✅ "Chaque semaine, on te livre des vidéos et des images
testées, et on garde ce qui convertit. Ton compte pub performe mieux."

RÈGLE 3 — CTA
0 bouton avant le 3ème échange, SAUF si la personne demande clairement comment commander. 1 seul par message. Jamais 2 de suite.
[BTN:offres:Voir les offres] [BTN:checkout:starter:Démarrer avec PERF+ →] [BTN:checkout:pro:Démarrer avec GROWTH →]
[BTN:checkout:scale:Démarrer avec SCALE →]
INTERDIT ABSOLU : n'écris JAMAIS un lien markdown ([texte](url)) ni une URL brute (chariow, mychariow, ou
autre) pour proposer un paiement ou une offre — même si tu la retrouves via la recherche Google ou ailleurs
dans le contexte. Un lien direct saute le popup de paiement intégré à la page (devise, code promo, expérience
soignée) et peut pointer vers une page obsolète. Le SEUL moyen valide de proposer une action d'achat est le
token [BTN:...] ci-dessus — rien d'autre, jamais.
Prospect chaud (a déjà vu une démo, pose des questions de prix/délai précises) → bouton checkout DIRECT, sur
l'offre qui correspond à SON profil (voir OFFRES).

Langue : ${language === 'fr' ? 'français uniquement' : 'English only'}`;

      const contents = [
        ...history.slice(-6).map(m => ({ role: m.role, parts: [{ text: m.content }] })),
        { role: 'user', parts: [{ text: message }] }
      ];
      const vertexBody = {
        system_instruction: { parts: [{ text: SYSTEM }] },
        contents,
        // Cause profonde corrigée : la RÈGLE de recherche du prompt demandait à ce chatbot de
        // construire une recherche Google, mais aucun outil de recherche n'était réellement
        // déclaré ici — la consigne était invisible pour le modèle, incapable de chercher quoi
        // que ce soit en pratique. thinkingBudget:0 (avant) + grounding activé aurait reproduit
        // un bug déjà rencontré et corrigé ailleurs dans ce fichier (le budget de réflexion
        // partage le même total que la sortie — sans budget dédié, la vraie réponse peut être
        // tronquée avant même d'être écrite). maxOutputTokens élargi en conséquence.
        generationConfig: { maxOutputTokens: 900, temperature: 0.4, ...reflexion(MODELES.chat, 512) },
        tools: [{ googleSearch: {} }],
      };

      const CHAT_MODEL = MODELES.chat;
      let token;
      try { token = await getToken(); }
      catch(e) { throw new Error('Token Vertex AI impossible: ' + e.message); }
      console.log('[Ava-vente] Appel Vertex AI model=gemini-2.5-flash contents.length=', contents.length);
      const geminiData = await vertexRequest(token, CHAT_MODEL, vertexBody, 25000);
      if (!geminiData?.candidates?.[0]) {
        console.error('[Ava-vente] Gemini error:', JSON.stringify(geminiData).slice(0,300));
      }
      const reply = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "Désolée, je n'ai pas pu répondre. Réessaie dans un instant.";

      // Même persistance qu'Ava (AdBoard) — le CRM lit déjà chat_messages par session_id,
      // aucune modification CRM nécessaire. session_id préfixé "vente_" pour distinguer
      // les conversations prospects des conversations clients déjà connectés dans AdBoard.
      if (SUPABASE_SERVICE_KEY && sessionId) {
        const saveMsg = async (role, content) => {
          const r = await fetch(`${SUPABASE_URL_INT}/rest/v1/chat_messages`, {
            method: 'POST',
            headers: { 'Content-Type':'application/json', apikey:SUPABASE_SERVICE_KEY, Authorization:`Bearer ${SUPABASE_SERVICE_KEY}` },
            body: JSON.stringify({ session_id: sessionId, role, content })
          });
          if (!r.ok) {
            const errText = await r.text().catch(()=>'(corps illisible)');
            console.error(`[Ava-vente] chat_messages HTTP ${r.status} (${role}):`, errText.slice(0,300));
          }
        };
        saveMsg('user', message).catch(e => console.error('[Ava-vente] chat_messages save error (user):', e.message));
        saveMsg('model', reply).catch(e => console.error('[Ava-vente] chat_messages save error (model):', e.message));
      } else if (!SUPABASE_SERVICE_KEY) {
        console.error('[Ava-vente] chat_messages non sauvegardé : SUPABASE_SERVICE_KEY absente côté serveur');
      } else if (!sessionId) {
        console.error('[Ava-vente] chat_messages non sauvegardé : aucun session_id reçu du client');
      }

      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ reply }));
    } catch(e) {
      console.error('[Ava-vente] ERREUR COMPLÈTE:', e.message, e.stack?.slice(0,300));
      res.writeHead(500);
      res.end(JSON.stringify({ reply: "Une erreur s'est produite. Réessaie dans un instant.", error: e.message }));
    }
  });
  return;
}

// POST /commandes/:id/cancel — annulation depuis AdBoard
if (req.method === 'POST' && req.url.match(/^\/commandes\/[^/]+\/cancel$/)) {
  const id = req.url.split('/')[2];
  const briefs = await loadBriefs();
  const idx = briefs.findIndex(b => b.id === id);
  if (idx >= 0) {
    briefs[idx].status = 'cancelled';
    briefs[idx].cancelled_at = new Date().toISOString();
    await saveBriefs([briefs[idx]]);
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({ ok: true }));
    // Notification admin #2 — demande annulée pendant le pending.
    notifierAdmin(
      `❌ Demande annulée — ${briefs[idx].product?.nom || 'produit'}`,
      `<p><strong>${briefs[idx].product?.nom || 'Produit'}</strong> — annulée par le client avant production.</p>
       <p>Client : ${briefs[idx].client?.email || 'email non renseigné'}</p>
       <p style="color:#888;font-size:12px">Annulée le ${new Date(briefs[idx].cancelled_at).toLocaleString('fr-FR')} — id ${id}</p>`
    ).catch(()=>{});
  } else {
    res.writeHead(404); res.end(JSON.stringify({ error: 'Brief not found' }));
  }
  return;
}

// POST /commandes/:id/delete — suppression depuis Factory (backend) OU auto-annulation client
if (req.method === 'POST' && req.url.match(/^\/commandes\/[^/]+\/delete$/)) {
  const id = req.url.split('/')[2];
  let body = '';
  req.on('data', c => body += c);
  req.on('end', async () => {
    let source = null;
    try { source = JSON.parse(body || '{}').source || null; } catch(e) {}
    try {
      // Lire le ticket AVANT suppression — pour notifier le client et connaître son produit.
      const briefs = await loadBriefs();
      const brief = briefs.find(b => b.id === id);

      // Cause profonde corrigée (client recevant "un problème est survenu" malgré des livrables
      // déjà bien envoyés) : le statut vérifié plus bas venait de `commandes` (table de travail
      // interne), pas de `briefs` (celle qu'AdBoard/le client lit réellement) — si la sauvegarde
      // du statut "done" vers `commandes` avait échoué à cause d'un timeout (déjà observé
      // plusieurs fois sur cette table), `commandes.status` restait périmé alors que
      // `briefs.status`, lui, était correctement à 'done'. Lecture directe et fraîche de la
      // vraie source de vérité, indépendamment de ce que `commandes` pense être l'état actuel.
      let statutReelBriefs = brief?.status || null;
      try {
        const rStatut = await fetch(`${SUPABASE_URL_INT}/rest/v1/briefs?id=eq.${id}&select=status`, {
          headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
        });
        const rowsStatut = await rStatut.json();
        if (rowsStatut.length) statutReelBriefs = rowsStatut[0].status;
      } catch(e) { console.warn('[Delete] Lecture statut briefs échouée, repli sur commandes :', e.message); }

      await fetch(`${SUPABASE_URL_INT}/rest/v1/commandes?id=eq.${id}`, {
        method: 'DELETE',
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
      });

      // Cause profonde corrigée : le client recevait DEUX notifications à sa propre annulation —
      // la confirmation normale (déclenchée côté AdBoard) PUIS celle-ci ("un problème est survenu"),
      // pensée uniquement pour le cas où NOUS supprimons un ticket en backend sans que le client le
      // sache. Le client qui annule lui-même sait déjà pourquoi — on ne touche ni son statut
      // (déjà mis à 'cancelled' côté AdBoard) ni ne lui envoie cette notification dans ce cas.
      // Cause profonde corrigée (2e cas) : supprimer un ticket DÉJÀ LIVRÉ depuis Factory (simple
      // nettoyage, le client a déjà tout reçu) déclenchait quand même cette même notification
      // "un problème est survenu, refais une demande" — complètement fausse dans ce cas précis,
      // et ça écrasait à tort son statut 'done' par 'probleme_agence'.
      if (brief && source !== 'client_cancel' && statutReelBriefs !== 'done') {
        await fetch(`${SUPABASE_URL_INT}/rest/v1/briefs?id=eq.${id}`, {
          method: 'PATCH',
          headers: {
            apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json', Prefer: 'return=minimal'
          },
          body: JSON.stringify({ status: 'probleme_agence' })
        });
        const userId = brief.client?.user_id;
        if (userId) {
          await notifyUserBoth(userId, {
            title: '⚠️ Un souci est survenu avec ta commande',
            body: `On a rencontré un problème avec ta demande pour ${brief.product?.nom || 'ton produit'} — n'hésite pas à repasser une nouvelle demande, ou à nous contacter.`,
            url: '/adboard/tracking',
            type: 'brief',
          });
        }
      }

      // Notification admin — annulation du CLIENT lui-même, pendant la fenêtre des 12h.
      // Jusqu'ici la seule notification d'annulation branchée était celle du CRM (jamais
      // utilisée par le client) — la vraie annulation client, via ce endpoint-ci, ne
      // remontait donc jamais rien.
      if (brief && source === 'client_cancel') {
        notifierAdmin(
          `❌ Demande annulée par le client — ${brief.product?.nom || 'produit'}`,
          `<p><strong>${brief.product?.nom || 'Produit'}</strong> — annulée par le client lui-même, pendant la fenêtre des 12h.</p>
           <p>Client : ${brief.client?.email || 'email non renseigné'}</p>
           <p style="color:#888;font-size:12px">Reçue le ${new Date(brief.created_at).toLocaleString('fr-FR')} — id ${id}</p>`
        ).catch(()=>{});
      }

      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: true }));
    } catch(e) {
      res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
    }
  });
  return;
}

// GET /users/search?q=... — recherche par email (sous-chaîne), pour l'envoi manuel de livrables
// depuis la vue Production. Fonctionne même pour un compte sans forfait (juste email connecté).
if (req.method === 'GET' && req.url.startsWith('/users/search')) {
  try {
    const q = new URL(req.url, 'http://x').searchParams.get('q') || '';
    if (q.trim().length < 2) { res.writeHead(200,{'Content-Type':'application/json'}); res.end('[]'); return; }
    const r = await fetch(`${SUPABASE_URL_INT}/auth/v1/admin/users?per_page=1000`, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
    });
    const data = await r.json();
    const needle = q.trim().toLowerCase();
    const results = (data?.users || [])
      .filter(u => (u.email || '').toLowerCase().includes(needle))
      .slice(0, 20)
      .map(u => ({ id: u.id, email: u.email }));
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify(results));
  } catch(e) {
    res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
  }
  return;
}

// GET /products/:id/renewal-context — tout le contexte nécessaire à Factory pour décider :
// nouvelle commande ou renouvellement, même cible ou rotation, quels CT éviter, quels angles
// ne jamais répéter. Recalculé entièrement depuis `deliveries` (source de vérité chronologique)
// plutôt que depuis `marche.angles`, qui ne reflète plus que le dernier lot en mode remplacement.
if (req.method === 'GET' && req.url.match(/^\/products\/[^/]+\/renewal-context$/)) {
  try {
    const productId = req.url.split('/')[2];
    const SEUIL_ANGLES_AVANT_ROTATION = 18;

    const prRes = await fetch(`${SUPABASE_URL_INT}/rest/v1/products?id=eq.${productId}&select=derniere_synthese,deliveries,marche,creatives`, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
    });
    const prRows = await prRes.json();
    const product = prRows?.[0] || {};
    const marche = product.marche || {};
    const deliveries = product.deliveries || [];

    // Cible utilisée au DERNIER lot livré — sert de référence pour savoir si la prochaine
    // commande reste sur la même cible ou si le client en a imposé une nouvelle.
    // Cause profonde corrigée (changement de cible jamais détecté, ex: "prof d'EPS" → "professionnelle
    // active" traité comme identique) : cette référence n'était que le PRÉNOM du persona (ex:
    // "Aïssatou") — rien de comparable à une description de cible ("femme professionnelle active
    // souffrant de discrimination..."). Un prénom seul ne permet aucune comparaison de sens.
    // On construit maintenant une vraie description (rôle, âge, ville) à partir du persona complet.
    // Calculée ICI (avant l'angle gagnant, pas après) — l'angle gagnant en a besoin pour se
    // scoper à la bonne cible, voir juste en dessous.
    const derniereLivraison = deliveries.length ? deliveries[deliveries.length - 1] : null;
    // Le prénom n'entre plus dans la comparaison — voir le même correctif appliqué à
    // pushDeliverablesToProduct (memePerson). Gardé dans l'affichage pour le CRM/Factory,
    // mais exclu de la logique de détection "même cible".
    const descrPersona = (p) => p ? [p.nom, p.role, p.age ? `${p.age} ans` : null, p.ville].filter(Boolean).join(', ') : null;
    const signaturePersona = (p) => p ? [p.sexe, p.role, p.age, p.ville].filter(Boolean).join('|').toLowerCase().trim() : null;
    const cibleActuelle = descrPersona(marche.persona) || derniereLivraison?.cible || null;
    const signatureCibleActuelle = signaturePersona(marche.persona);

    // ── Angle gagnant (feedback loop Top Performer) — DOIT rester strictement identique à
    // getAngleGagnantActuel() dans Platform.jsx, sinon le badge affiché au client contredirait
    // l'angle réellement transmis à l'Analyste ici.
    //
    // Score combiné, pas un simple "dernier marqué gagne" : pour chaque créative marquée Top
    // Performer, on ajoute à son angle un poids de fraîcheur (position du batch — plus récent
    // = poids plus fort). Un angle avec PLUSIEURS marquages, même un peu plus anciens, peut
    // donc l'emporter sur un marquage unique très récent : ni le volume ni la fraîcheur seule
    // ne dominent, les deux se combinent dans UN seul score par angle.
    //
    // SCOPÉ À LA CIBLE ACTUELLE, PAS TOUT L'HISTORIQUE DU PRODUIT : un angle marketing joue sur
    // les émotions d'UNE cible précise — un angle gagnant pour "mères actives 35-45 ans" n'a
    // aucune raison de fonctionner pour "étudiants 18-22 ans" même sur le même produit. Mélanger
    // les cibles fausserait complètement le signal. On ne regarde donc que les livraisons dont
    // la cible correspond exactement à cibleActuelle (celle de la prochaine commande).
    //
    // On ne reconstruit RIEN de l'angle gagnant : on reprend nom + justification tels que déjà
    // livrés au client (version la plus récente si reformulée entre deux batchs), jamais le
    // détail interne (moteur/pools), qui n'est plus disponible après génération.
    let angleGagnant = null;
    const deliveriesMemeCible = deliveries.filter(d => (d.cible || null) === cibleActuelle);
    const creativesTopPerformer = (product.creatives || []).filter(c => c.topPerformer);
    if (creativesTopPerformer.length && deliveriesMemeCible.length) {
      const scores = {}; // nom d'angle -> score cumulé
      // v5.70 : score chiffré (ROAS, CPA, dépenses…) comparé aux autres créatives de LA MÊME cible ;
      // sans chiffres, repli sur le rang manuel.
      const semainesCible = new Set(deliveriesMemeCible.map(d => d.semaine));
      const scoresTP = scoresTopPerformer(creativesTopPerformer.filter(c => semainesCible.has(c.week)));
      deliveriesMemeCible.forEach((d, i) => {
        const poidsRecence = i + 1; // livraison la plus ancienne DE CETTE CIBLE = 1, chaque suivante pèse plus
        creativesTopPerformer.filter(c => c.week === d.semaine).forEach(c => {
          // Rang manuel (drag-and-drop client) — DOIT rester identique à Platform.jsx. Rang 1 =
          // ×2, rang 2 = ×1.5... décroît vers 1 (neutre) pour rangs élevés/non classées.
          const rankMultiplier = multiplicateurTP(c, scoresTP);
          if (!c.angle) return;
          scores[c.angle] = (scores[c.angle] || 0) + poidsRecence * rankMultiplier;
        });
      });
      const entries = Object.entries(scores);
      if (entries.length) {
        entries.sort((a, b) => b[1] - a[1]);
        const nomGagnant = entries[0][0];
        // Formulation la plus à jour : on cherche depuis la livraison DE CETTE CIBLE la plus
        // récente qui contient cet angle, pas forcément celle qui a déclenché le score le plus haut.
        for (let i = deliveriesMemeCible.length - 1; i >= 0 && !angleGagnant; i--) {
          const angleData = (deliveriesMemeCible[i].angles || []).find(a => a.nom === nomGagnant);
          if (angleData) {
            angleGagnant = { nom: angleData.nom, justification: angleData.justification || '', batchOrigine: deliveriesMemeCible[i].semaine };
          }
        }
      }
    }

    // Historique COMPLET des noms d'angles, toutes cibles confondues, depuis le tout début —
    // c'est cette liste que l'Analyste ne doit jamais reproduire, même après une rotation de cible.
    const anglesHistorique = deliveries.flatMap(d => (d.angles || []).map(a => a.nom).filter(Boolean));

    // Compteur d'angles pour la cible COURANTE uniquement : on remonte les livraisons les plus
    // récentes tant qu'elles partagent le même nom de cible que la dernière.
    let nbAnglesCibleCourante = 0;
    for (let i = deliveries.length - 1; i >= 0; i--) {
      const d = deliveries[i];
      if ((d.cible || null) !== cibleActuelle) break;
      nbAnglesCibleCourante += (d.angles || []).length;
    }

    // CT utilisés au dernier lot livré pour ce produit
    const ctsUtilisesDernierLot = derniereLivraison?.cts_utilises || [];

    // Une commande encore en cours pour ce même produit ailleurs ? (bloque le renouvellement)
    const briefs = await loadBriefs();
    // Fenêtre de sécurité : une génération réellement en cours dure au maximum ~15-20min pour un
    // gros batch. Au-delà, on considère que c'est une génération interrompue (crash navigateur,
    // fermeture d'onglet) plutôt que de bloquer indéfiniment un renouvellement légitime.
    const FENETRE_GENERATION_ACTIVE_MS = 25 * 60 * 1000;
    const commandeActiveAilleurs = briefs.some(b =>
      b.product?.id === productId &&
      b.status === 'in_production' &&
      b.generation_started_at &&
      (Date.now() - new Date(b.generation_started_at).getTime()) < FENETRE_GENERATION_ACTIVE_MS
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      estRenouvellement: !!product.derniere_synthese,
      syntheseExistante: product.derniere_synthese || null,
      cibleActuelle,
      anglesHistorique,
      nbAnglesCibleCourante,
      rotationNecessaire: nbAnglesCibleCourante >= SEUIL_ANGLES_AVANT_ROTATION,
      ctsUtilisesDernierLot,
      commandeActiveAilleurs,
      angleGagnant,
      // Portrait déjà généré pour cibleActuelle — permet à la Factory de le réutiliser tel quel
      // si la nouvelle commande porte sur la même cible, au lieu de le regénérer inutilement.
      portraitUrlCibleActuelle: marche.persona?.portrait_url || null,
    }));
  } catch(e) {
    res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
  }
  return;
}

// POST /products/:id/delete-creatives — suppression de créatives depuis la Galerie AdBoard
if (req.method === 'POST' && req.url.match(/^\/products\/[^/]+\/delete-creatives$/)) {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', async () => {
    try {
      const productId = req.url.split('/')[2];
      const { creativeIds } = JSON.parse(body);
      if (!Array.isArray(creativeIds) || !creativeIds.length) { res.writeHead(400); res.end(JSON.stringify({error:'creativeIds requis'})); return; }

      const prRes = await fetch(`${SUPABASE_URL_INT}/rest/v1/products?id=eq.${productId}&select=creatives`, {
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
      });
      const prRows = await prRes.json();
      const existing = prRows?.[0]?.creatives || [];
      const remaining = existing.filter(c => !creativeIds.includes(c.id));

      await fetch(`${SUPABASE_URL_INT}/rest/v1/products?id=eq.${productId}`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ creatives: remaining })
      });

      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: true, removed: existing.length - remaining.length }));
    } catch(e) {
      res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
    }
  });
  return;
}

// ══ TOP PERFORMER — copie exacte de src/topPerformer.js (AdBoard) ══
// Top Performer — chiffres fournis par le client + classement automatique.
// CE FICHIER EST AUSSI COPIÉ TEL QUEL DANS serveur.js (bloc « TOP PERFORMER »), pour que le
// classement vu par le client et l'angle gagnant calculé par le serveur soient toujours identiques.
// Ne rien importer ici : fonctions pures uniquement.

// Les chiffres que le client peut donner. Tous facultatifs. `sens` : 'haut' = plus c'est grand, mieux c'est.
const TP_CHAMPS = [
  { k: 'roas',     label: 'ROAS',          aide: 'ex. 2,8',            unite: '×',  sens: 'haut', poids: 3,   max: 200 },
  { k: 'cpa',      label: 'CPA',           aide: 'en $ ou €',     unite: '',   sens: 'bas',  poids: 3,   max: 100000000 },
  { k: 'depenses', label: 'Dépenses',      aide: 'en $ ou €',      unite: '',   sens: 'haut', poids: 1.5, max: 1000000000 },
  { k: 'jours',    label: 'Jours actifs',  aide: 'ex. 12',             unite: 'j',  sens: 'haut', poids: 1,   max: 365, entier: true },
  { k: 'achats',   label: 'Achats',        aide: 'nombre de ventes',   unite: '',   sens: 'haut', poids: 1,   max: 10000000, entier: true },
  { k: 'ctr',      label: 'CTR',           aide: 'ex. 1,9',            unite: '%',  sens: 'haut', poids: 1,   max: 100 },
];

function _nombre(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// Nettoie ce que le client a saisi : ne garde que des nombres valides (> 0 et sous la borne).
// Renvoie null si rien d'exploitable. Jamais d'erreur : une saisie bancale est simplement ignorée.
function nettoyerStats(brut) {
  if (!brut || typeof brut !== 'object') return null;
  const out = {};
  for (const ch of TP_CHAMPS) {
    let n = _nombre(brut[ch.k]);
    if (n === null || n <= 0 || n > ch.max) continue;
    if (ch.entier) n = Math.round(n);
    else n = Math.round(n * 1000) / 1000;
    out[ch.k] = n;
  }
  if (!Object.keys(out).length) return null;
  return out;
}

const aDesChiffres = (c) => !!(c && c.tpStats && TP_CHAMPS.some(ch => Number.isFinite(c.tpStats[ch.k])));

const _borne = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// Score de chaque créative, PAR RAPPORT aux autres créatives du même groupe (même produit, même cible).
// Pour chaque chiffre : on compare à la moyenne du groupe (1 = dans la moyenne, 2 = deux fois mieux),
// à l'envers pour le CPA (plus bas = mieux). Puis moyenne pondérée des chiffres que la créative a donnés.
// Une créative sans aucun chiffre n'a pas de score : elle reste au classement manuel (repli).
function scoresTopPerformer(creatives) {
  const liste = (creatives || []).filter(Boolean);
  const moyennes = {};
  for (const ch of TP_CHAMPS) {
    const vals = liste.map(c => c.tpStats && c.tpStats[ch.k]).filter(Number.isFinite);
    if (vals.length) moyennes[ch.k] = vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  const res = {};
  for (const c of liste) {
    let somme = 0, poids = 0, n = 0;
    for (const ch of TP_CHAMPS) {
      const v = c.tpStats && c.tpStats[ch.k];
      if (!Number.isFinite(v) || !moyennes[ch.k]) continue;
      const ratio = ch.sens === 'haut' ? v / moyennes[ch.k] : moyennes[ch.k] / v;
      somme += ch.poids * _borne(ratio, 0.25, 3);
      poids += ch.poids; n++;
    }
    res[c.id] = n ? { score: somme / poids, chiffre: true, nbChiffres: n } : { score: null, chiffre: false, nbChiffres: 0 };
  }
  return res;
}

// Classement : d'abord les créatives chiffrées (meilleur score en tête), puis celles sans chiffres,
// dans l'ordre manuel du client (rang 1 d'abord, sans rang à la fin).
function classerTopPerformer(creatives) {
  const liste = [...(creatives || [])];
  const sc = scoresTopPerformer(liste);
  const rang = (c) => (c.topPerformerRank ?? Infinity);
  return liste.sort((a, b) => {
    const A = sc[a.id], B = sc[b.id];
    if (A.chiffre !== B.chiffre) return A.chiffre ? -1 : 1;
    if (A.chiffre && B.chiffre && Math.abs(A.score - B.score) > 1e-9) return B.score - A.score;
    if (A.chiffre && B.chiffre) {
      const r = (b.tpStats.roas || 0) - (a.tpStats.roas || 0);
      if (r) return r;
      const d = (b.tpStats.depenses || 0) - (a.tpStats.depenses || 0);
      if (d) return d;
    }
    return rang(a) - rang(b);
  });
}

// Poids d'une créative marquée dans le calcul de l'angle gagnant (remplace le seul « rang manuel »).
// Chiffrée : son score (0,3 à 3). Sinon : repli sur le rang manuel (rang 1 = ×2, rang 2 = ×1,5 …), neutre sans rang.
function multiplicateurTP(c, scores) {
  const s = scores && scores[c.id];
  if (s && s.chiffre) return _borne(s.score, 0.3, 3);
  return c.topPerformerRank ? (1 + 1 / c.topPerformerRank) : 1;
}

// ══ fin TOP PERFORMER ══

// POST /products/:id/mark-top-performer — marque/démarque une créative comme Top Performer
// depuis la Galerie AdBoard (v5.70 : plus de délai de 7 jours ; chiffres facultatifs).
if (req.method === 'POST' && req.url.match(/^\/products\/[^/]+\/mark-top-performer$/)) {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', async () => {
    try {
      const productId = req.url.split('/')[2];
      const { creativeId, value, stats } = JSON.parse(body);
      if (!creativeId) { res.writeHead(400); res.end(JSON.stringify({error:'creativeId requis'})); return; }
      // v5.70 : plus de délai de 7 jours ; le client peut donner des chiffres (tous facultatifs).
      const statsPropres = value === false ? null : nettoyerStats(stats);

      const prRes = await fetch(`${SUPABASE_URL_INT}/rest/v1/products?id=eq.${productId}&select=creatives`, {
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
      });
      const prRows = await prRes.json();
      const existing = prRows?.[0]?.creatives || [];
      const updated = existing.map(c => {
        if (c.id !== creativeId) return c;
        if (value === false) { const { tpStats, tpAt, topPerformerRank, ...reste } = c; return { ...reste, topPerformer: false }; }
        const n = { ...c, topPerformer: true, tpAt: new Date().toISOString() };
        if (statsPropres) n.tpStats = statsPropres;
        return n;
      });

      await fetch(`${SUPABASE_URL_INT}/rest/v1/products?id=eq.${productId}`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ creatives: updated })
      });

      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: true }));
    } catch(e) {
      res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
    }
  });
  return;
}

// POST /products/:id/top-performer-stats — le client ajoute / corrige les chiffres d'une créative déjà marquée.
// stats vide ou invalide = on efface les chiffres (la créative retombe au classement manuel).
if (req.method === 'POST' && req.url.match(/^\/products\/[^/]+\/top-performer-stats$/)) {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', async () => {
    try {
      const productId = req.url.split('/')[2];
      const { creativeId, stats } = JSON.parse(body);
      if (!creativeId) { res.writeHead(400); res.end(JSON.stringify({error:'creativeId requis'})); return; }
      const propres = nettoyerStats(stats);
      const prRes = await fetch(`${SUPABASE_URL_INT}/rest/v1/products?id=eq.${productId}&select=creatives`, {
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
      });
      const prRows = await prRes.json();
      const existing = prRows?.[0]?.creatives || [];
      const cible = existing.find(c => c.id === creativeId);
      if (!cible || !cible.topPerformer) { res.writeHead(404); res.end(JSON.stringify({error:'créative non marquée Top Performer'})); return; }
      const updated = existing.map(c => {
        if (c.id !== creativeId) return c;
        if (!propres) { const { tpStats, ...reste } = c; return reste; }
        return { ...c, tpStats: propres };
      });
      await fetch(`${SUPABASE_URL_INT}/rest/v1/products?id=eq.${productId}`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ creatives: updated })
      });
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: true, stats: propres }));
    } catch(e) {
      res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
    }
  });
  return;
}

// POST /products/:id/reorder-top-performers — persiste le classement manuel (drag-and-drop,
// Galerie AdBoard) des créatives marquées Top Performer d'un produit. Reçoit l'ordre complet
// (tableau d'ids, index 0 = rang 1) plutôt qu'un déplacement unitaire — plus simple et plus
// robuste : un seul état à écrire, pas de logique d'insertion/décalage à répliquer serveur.
if (req.method === 'POST' && req.url.match(/^\/products\/[^/]+\/reorder-top-performers$/)) {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', async () => {
    try {
      const productId = req.url.split('/')[2];
      const { order } = JSON.parse(body);
      if (!Array.isArray(order) || !order.length) { res.writeHead(400); res.end(JSON.stringify({error:'order (tableau d\'ids) requis'})); return; }

      const prRes = await fetch(`${SUPABASE_URL_INT}/rest/v1/products?id=eq.${productId}&select=creatives`, {
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
      });
      const prRows = await prRes.json();
      const existing = prRows?.[0]?.creatives || [];
      const updated = existing.map(c => {
        const idx = order.indexOf(c.id);
        return idx === -1 ? c : { ...c, topPerformerRank: idx + 1 };
      });

      await fetch(`${SUPABASE_URL_INT}/rest/v1/products?id=eq.${productId}`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ creatives: updated })
      });

      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: true }));
    } catch(e) {
      res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
    }
  });
  return;
}

// POST /admin/impersonate — génère une vraie session pour n'importe quel compte client, à
// usage strictement admin. Sécurité : le token envoyé DOIT être une vraie session Supabase
// valide (jamais un simple champ "je suis admin" — trivialement falsifiable par n'importe
// qui) — on interroge Supabase avec ce token pour connaître l'email RÉEL et cryptographiquement
// vérifié qui y est associé, avant d'autoriser quoi que ce soit.
// Mécanisme : generateLink (magiclink) + verify — la façon officielle Supabase de créer une
// vraie session pour un utilisateur sans jamais connaître ni manipuler son mot de passe.
// GET /crm/clients — vue Clients du CRM (remplace "Acheteurs Starter"). Rassemble
// subscriptions + auth.users (emails/noms, jamais accessible directement en anon — d'où cet
// endpoint plutôt qu'une lecture directe du CRM) + briefs (usage) + transactions (dépense),
// avec la clé service pour tout voir peu importe le compte. Inclut TOUT abonné, qu'il ait ou
// non été prospect/lead dans le CRM au préalable.
if (req.method === 'GET' && req.url === '/crm/clients') {
  if (!(await crmAdminOk(req))) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'unauthorized' })); return; }
  try {
    const [subsRes, usersRes, briefsRes, txRes] = await Promise.all([
      fetch(`${SUPABASE_URL_INT}/rest/v1/subscriptions?select=*`, { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }),
      fetch(`${SUPABASE_URL_INT}/auth/v1/admin/users?per_page=1000`, { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }),
      fetch(`${SUPABASE_URL_INT}/rest/v1/briefs?select=user_id,status,credits_used`, { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }),
      fetch(`${SUPABASE_URL_INT}/rest/v1/transactions?select=user_id,montant_fcfa,created_at&order=created_at.asc`, { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }),
    ]);
    const subs = await subsRes.json();
    const usersData = await usersRes.json();
    const users = usersData.users || usersData || [];
    const briefs = await briefsRes.json();
    const transactions = await txRes.json();

    const usersById = {};
    users.forEach(u => { usersById[u.id] = u; });

    const briefEstActif = (b) => b.status === 'pending' || b.status === 'in_production';
    const briefCompteCredits = (b) => briefEstActif(b) || b.status === 'done';

    const clients = subs.map(sub => {
      const u = usersById[sub.user_id] || {};
      const mesBriefs = briefs.filter(b => b.user_id === sub.user_id);
      const used = mesBriefs.filter(briefCompteCredits).reduce((s, b) => s + (b.credits_used || 9), 0);
      let total;
      if (sub.type === 'pack') {
        total = sub.total_credits || 0;
      } else {
        const started = new Date(sub.started_at);
        const now = new Date();
        const startedMidnight = new Date(started.getFullYear(), started.getMonth(), started.getDate());
        const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weeksActive = Math.floor((nowMidnight - startedMidnight) / (7 * 86400000)) + 1;
        total = weeksActive * (sub.credits_per_week || 0);
      }
      const mesTx = transactions.filter(t => t.user_id === sub.user_id);
      const totalDepense = mesTx.reduce((s, t) => s + (t.montant_fcfa || 0), 0);

      return {
        user_id: sub.user_id,
        email: u.email || null,
        nom: u.user_metadata?.full_name || u.user_metadata?.name || null,
        avatar: u.user_metadata?.avatar_url || u.user_metadata?.picture || null,
        telephone_whatsapp: sub.telephone_whatsapp || null,
        plan: sub.plan, cycle: sub.cycle, type: sub.type, active: sub.active,
        started_at: sub.started_at, expires_at: sub.expires_at,
        credits_used: used, credits_total: Math.max(total, 0),
        total_depense_fcfa: totalDepense,
        nb_achats: mesTx.length,
        premier_achat: mesTx[0]?.created_at || sub.started_at,
      };
    }).sort((a, b) => new Date(b.started_at) - new Date(a.started_at));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(clients));
  } catch (e) {
    res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
  }
  return;
}

const ADMIN_EMAIL_IMPERSONATE = 'thefirstquality01@gmail.com';
if (req.method === 'POST' && req.url === '/admin/impersonate') {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', async () => {
    try {
      const adminToken = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
      if (!adminToken) { res.writeHead(401); res.end(JSON.stringify({ error: 'Token admin requis' })); return; }

      const meRes = await fetch(`${SUPABASE_URL_INT}/auth/v1/user`, {
        headers: { apikey: SUPABASE_ANON_KEY_INT, Authorization: `Bearer ${adminToken}` }
      });
      if (!meRes.ok) { res.writeHead(401); res.end(JSON.stringify({ error: 'Session admin invalide' })); return; }
      const me = await meRes.json();
      if ((me.email || '').toLowerCase() !== ADMIN_EMAIL_IMPERSONATE.toLowerCase()) {
        console.warn(`[Impersonate] ⚠️ Tentative refusée — compte non-admin : ${me.email}`);
        res.writeHead(403); res.end(JSON.stringify({ error: 'Non autorisé' })); return;
      }

      const { targetEmail } = JSON.parse(body);
      if (!targetEmail) { res.writeHead(400); res.end(JSON.stringify({ error: 'targetEmail requis' })); return; }

      const target = await findUserByEmail(targetEmail);
      if (!target) { res.writeHead(404); res.end(JSON.stringify({ error: 'Aucun compte avec cet email' })); return; }

      const linkRes = await fetch(`${SUPABASE_URL_INT}/auth/v1/admin/generate_link`, {
        method: 'POST',
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'magiclink', email: targetEmail })
      });
      if (!linkRes.ok) { const t = await linkRes.text(); res.writeHead(500); res.end(JSON.stringify({ error: 'Génération du lien échouée: ' + t })); return; }
      const linkData = await linkRes.json();
      const hashedToken = linkData.hashed_token || linkData.properties?.hashed_token;
      if (!hashedToken) { res.writeHead(500); res.end(JSON.stringify({ error: 'hashed_token absent de la réponse Supabase' })); return; }

      const verifyRes = await fetch(`${SUPABASE_URL_INT}/auth/v1/verify`, {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON_KEY_INT, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'magiclink', token_hash: hashedToken })
      });
      if (!verifyRes.ok) { const t = await verifyRes.text(); res.writeHead(500); res.end(JSON.stringify({ error: 'Vérification du lien échouée: ' + t })); return; }
      const session = await verifyRes.json();

      console.log(`[Impersonate] ${me.email} → connecté en tant que ${targetEmail}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, session }));
    } catch (e) {
      res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
    }
  });
  return;
}

// POST /reconcile-account — appelé automatiquement juste après une connexion réussie (voir
// Platform.jsx). Relie les données d'un compte migré (produits, briefs, abonnement...) à son
// nouvel identifiant Google, dès sa première connexion — sans ça, un compte migré vers un
// nouveau projet Supabase perd l'accès à ses propres données (nouvel id Google-OAuth ≠ ancien
// id, les deux ne se ressemblent pas). Sans effet et instantané pour un compte déjà réconcilié
// ou qui n'était pas concerné par une migration — sûr à appeler à chaque connexion.
if (req.method === 'POST' && req.url === '/reconcile-account') {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', async () => {
    try {
      const { email, userId } = JSON.parse(body);
      if (!email || !userId) { res.writeHead(400); res.end(JSON.stringify({error:'email et userId requis'})); return; }

      const remapRes = await fetch(`${SUPABASE_URL_INT}/rest/v1/user_id_remap?email=eq.${encodeURIComponent(email.toLowerCase())}&resolved=eq.false&select=*`, {
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
      });
      const rows = await remapRes.json();

      // Cause profonde corrigée (nouveau client — jamais eu de compte avant d'acheter — attend
      // jusqu'à 30-60 min avant d'avoir accès, au lieu d'un accès immédiat à sa 1ère connexion) :
      // ce endpoint ne vérifiait QUE user_id_remap (migration Supabase), jamais
      // pending_activations (un paiement reçu avant que le compte n'existe). Un vrai nouveau
      // client n'a par définition AUCUNE entrée user_id_remap (il n'a jamais été migré depuis
      // nulle part) — son activation dépendait donc entièrement du prochain passage du cron
      // /cron/check-pending. Même logique de résolution que ce cron, exécutée ici immédiatement,
      // au moment précis où on sait qu'un compte vient d'être créé/connecté avec cet email.
      let activationImmediate = false;
      try {
        const pendRes = await fetch(`${SUPABASE_URL_INT}/rest/v1/pending_activations?email=eq.${encodeURIComponent(email.toLowerCase())}&resolved_at=is.null&select=*`, {
          headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
        });
        const pendings = await pendRes.json();
        for (const pend of pendings) {
          const planInfo = PLAN_MAP[pend.plan_id];
          if (!planInfo) continue; // produit inconnu, laisse le cron gérer/signaler ce cas
          await activateSubscription(userId, planInfo, email, pend.name, pend.telephone);
          await traiterAttributionCRM(userId);
          await fetch(`${SUPABASE_URL_INT}/rest/v1/pending_activations?id=eq.${pend.id}`, {
            method: 'PATCH',
            headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
            body: JSON.stringify({ resolved_at: new Date().toISOString(), resolved_user_id: userId })
          });
          activationImmediate = true;
          notifierAdmin('✅ Activation immédiate à la connexion', `<p>${email} vient de se connecter pour la première fois — abonnement activé immédiatement (paiement du ${new Date(pend.created_at).toLocaleDateString('fr-FR')}, plus besoin d'attendre le cron).</p>`).catch(()=>{});
        }
      } catch(ePend) {
        console.error('[Reconcile] Vérification pending_activations échouée (le cron prendra le relais) :', ePend.message);
      }

      if (!rows.length) { res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({ ok: true, reconciled: false, activationImmediate })); return; }

      const oldId = rows[0].old_id;
      const TABLES_A_CORRIGER = [
        { table: 'products', colonne: 'user_id' },
        { table: 'briefs', colonne: 'user_id' },
        { table: 'subscriptions', colonne: 'user_id' },
        { table: 'pending_activations', colonne: 'resolved_user_id' },
      ];
      let totalLignes = 0;
      for (const { table, colonne } of TABLES_A_CORRIGER) {
        try {
          const patchRes = await fetch(`${SUPABASE_URL_INT}/rest/v1/${table}?${colonne}=eq.${oldId}`, {
            method: 'PATCH',
            headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
            body: JSON.stringify({ [colonne]: userId })
          });
          const patched = await patchRes.json();
          if (Array.isArray(patched)) totalLignes += patched.length;
        } catch(eTable) {
          console.warn(`[Reconcile] ${table}.${colonne} échoué :`, eTable.message);
        }
      }

      await fetch(`${SUPABASE_URL_INT}/rest/v1/user_id_remap?email=eq.${encodeURIComponent(email.toLowerCase())}`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ resolved: true, resolved_at: new Date().toISOString(), new_id: userId })
      });

      console.log(`[Reconcile] ${email} : ${totalLignes} ligne(s) reliée(s) à ${userId}`);
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: true, reconciled: true, totalLignes, activationImmediate }));
    } catch(e) {
      res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
    }
  });
  return;
}
// Remplace l'insertion directe client→Supabase (RLS) qui ne revérifiait jamais rien : un
// client dont l'état local n'était pas encore rafraîchi (allBriefs vide au tout premier
// rendu, par ex.) pouvait laisser passer une demande alors qu'il n'avait plus de crédits
// réellement disponibles — bug remonté en prod avec des demandes acceptées à tort.
// Même logique de calcul que computeCredits()/verifierPlafondProduction() côté client
// (Platform.jsx) — DOIT rester identique, sinon le chiffre affiché au client contredirait ce
// que le serveur autorise réellement.
if (req.method === 'POST' && req.url === '/briefs/create') {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', async () => {
    try {
      const { userId, productId, quantity } = JSON.parse(body);
      if (!userId || !productId || !quantity) { res.writeHead(400); res.end(JSON.stringify({error:'userId, productId et quantity requis'})); return; }
      // Volumes de production : 6 à 24 visuels, par multiples de 3 (3 visuels par angle, 2 à 8 angles).
      // Les anciens clients AdBoard encore ouverts peuvent envoyer 9 ou 18 : toujours valides. Au-delà de 24 : refusé.
      if (!Number.isInteger(quantity) || quantity < 6 || quantity > 24 || quantity % 3 !== 0) {
        res.writeHead(400); res.end(JSON.stringify({ error: 'quantite_invalide', quantity, min: 6, max: 24, palier: 3 })); return;
      }

      const [subRes, briefsRes] = await Promise.all([
        fetch(`${SUPABASE_URL_INT}/rest/v1/subscriptions?user_id=eq.${userId}&select=*&order=started_at.desc&limit=1`, {
          headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
        }),
        fetch(`${SUPABASE_URL_INT}/rest/v1/briefs?user_id=eq.${userId}&status=neq.cancelled&select=*`, {
          headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
        })
      ]);
      const subRows = await subRes.json();
      let sub = subRows?.[0] || null;
      const allBriefs = await briefsRes.json();

      // Même correction d'expiration que sbSubs.load() côté client — appliquée AVANT
      // computeCredits, comme côté client.
      if (sub?.expires_at && new Date(sub.expires_at) < new Date()) sub = { ...sub, active: false };

      if (!sub || !sub.active) {
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ error: 'abonnement_inactif' }));
        return;
      }

      // ── computeCredits() — copie exacte de la logique Platform.jsx ──
      const briefEstActif = (b) => !!b && (b.status === 'pending' || b.status === 'in_production');
      const briefCompteCredits = (b) => briefEstActif(b) || b.status === 'done';
      const used = allBriefs.filter(briefCompteCredits).reduce((sum, b) => sum + (b.credits_used || 9), 0);
      let total;
      if (sub.type === 'pack') {
        total = sub.total_credits || 0;
      } else {
        const started = new Date(sub.started_at);
        const now = new Date();
        const startedMidnight = new Date(started.getFullYear(), started.getMonth(), started.getDate());
        const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const msPerDay = 24 * 60 * 60 * 1000;
        const daysElapsed = Math.floor((nowMidnight - startedMidnight) / msPerDay);
        const weeksActive = Math.floor(daysElapsed / 7) + 1;
        total = weeksActive * sub.credits_per_week;
      }
      const available = Math.max(0, total - used);

      if (available < quantity) {
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ error: 'credits_insuffisants', available, requested: quantity }));
        return;
      }

      // ── verifierPlafondProduction() — copie exacte, plafond 36 images/24h tous produits ──
      const PLAFOND_PRODUCTION_24H = 36;
      const MS_24H = 24 * 60 * 60 * 1000;
      const seuil24h = Date.now() - MS_24H;
      const actifs24h = allBriefs.filter(b => briefEstActif(b) && new Date(b.created_at).getTime() >= seuil24h);
      const totalActuel24h = actifs24h.reduce((s, b) => s + (b.credits_used || b.quantity || 9), 0);
      if (totalActuel24h + quantity > PLAFOND_PRODUCTION_24H) {
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ error: 'plafond_production', totalActuel24h }));
        return;
      }

      // ── Tout est validé avec des données fraîches, ré-interrogées à l'instant : créer le brief ──
      const insertRes = await fetch(`${SUPABASE_URL_INT}/rest/v1/briefs`, {
        method: 'POST',
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({ user_id: userId, product_id: productId, quantity, status: 'pending', credits_used: quantity })
      });
      if (!insertRes.ok) { res.writeHead(500); res.end(JSON.stringify({ error: 'Échec de la création' })); return; }
      const rows = await insertRes.json();

      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: true, brief: rows[0] }));
    } catch(e) {
      res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
    }
  });
  return;
}

// GET /users/:id/products — produits existants d'un compte, pour choisir où livrer manuellement
if (req.method === 'GET' && req.url.match(/^\/users\/[^/]+\/products$/)) {
  try {
    const userId = req.url.split('/')[2];
    const r = await fetch(`${SUPABASE_URL_INT}/rest/v1/products?user_id=eq.${userId}&select=id,nom`, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
    });
    const products = await r.json();
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify(products));
  } catch(e) {
    res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
  }
  return;
}

// POST /manual-deliver — envoi manuel des livrables d'une production vers un compte choisi,
// indépendamment du ticket/de la commande d'origine. Crée le produit chez le client si besoin
// (compte sans forfait encore pris — cas explicitement demandé).
if (req.method === 'POST' && req.url === '/manual-deliver') {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', async () => {
    try {
      const { userId, productId, newProductName, deliverables, ticketId } = JSON.parse(body);
      if (!userId || !deliverables) { res.writeHead(400); res.end(JSON.stringify({error:'userId et deliverables requis'})); return; }

      let targetProductId = productId;
      if (!targetProductId) {
        if (!newProductName) { res.writeHead(400); res.end(JSON.stringify({error:'productId ou newProductName requis'})); return; }
        const createRes = await fetch(`${SUPABASE_URL_INT}/rest/v1/products`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json', Prefer: 'return=representation'
          },
          body: JSON.stringify({ user_id: userId, nom: newProductName, creatives: [], deliveries: [] })
        });
        const created = await createRes.json();
        targetProductId = created?.[0]?.id;
        if (!targetProductId) throw new Error('Création du produit échouée côté AdBoard');
      }

      // Cause profonde corrigée (2e envoi manuel sur le même ticket écrase silencieusement —
      // le client reçoit les VIEILLES créatives au lieu des nouvelles) : ce endpoint ne
      // chargeait jamais generation_version depuis le brief, retombant systématiquement sur la
      // valeur par défaut (1) de pushDeliverablesToProduct — donc chaque envoi manuel sur un
      // même ticketId reconstruit EXACTEMENT les mêmes id que la fois précédente, collisionnant
      // avec ce qui a déjà été poussé. Chargé ici explicitement, comme pour tous les autres
      // points d'envoi (send-one-creative, send-marche, send-one-copy, /done).
      let generationVersion = 1;
      if (ticketId) {
        try {
          const briefsPourVersion = await loadBriefs();
          const briefTrouve = briefsPourVersion.find(b => b.id === ticketId);
          if (briefTrouve?.generation_version) generationVersion = briefTrouve.generation_version;
        } catch(eVer) { console.warn('[manual-deliver] Lecture generation_version échouée, repli sur 1 :', eVer.message); }
      }
      const pushResult = await pushDeliverablesToProduct(targetProductId, ticketId || ('manuel-' + Date.now()), deliverables, new Set(), false, null, null, null, generationVersion);

      // Cause profonde corrigée (portrait persona jamais généré via "Envoyer à un autre
      // compte") : ce chemin d'envoi est entièrement séparé de /commandes/:id/done, où le
      // déclenchement avait été branché — jamais répliqué ici, donc jamais déclenché pour un
      // envoi manuel, alors que les Données Marché sont poussées exactement pareil.
      if (pushResult?.besoinPortrait && pushResult.personaPourPortrait?.nom) {
        genererEtSauvegarderPortraitEnTacheDeFond(targetProductId, pushResult.personaPourPortrait)
          .catch(e => console.error('[Portrait] Erreur non interceptée en tâche de fond :', e.message));
      }

      await notifyUserBoth(userId, {
        title: '🎉 Nouveaux visuels disponibles',
        body: 'De nouveaux visuels viennent d\'être ajoutés à ton compte — va y jeter un œil.',
        url: '/adboard/gallery',
        type: 'brief',
      });

      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: true, productId: targetProductId }));
    } catch(e) {
      res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
    }
  });
  return;
}

// POST /notify-action — notifs push+in-app pour des actions déclenchées côté client
// (création produit, annulation demande, suppression produit — pas de round-trip serveur existant sinon)
const ACTION_NOTIFS = {
  product_created:   (name) => ({ title: '✅ Produit créé',      body: `"${name}" a été ajouté à ton catalogue.`,          url: '/adboard/products', type: 'product' }),
  request_cancelled: (name) => ({ title: 'Demande annulée',      body: `Ta demande pour "${name}" a bien été annulée.`,     url: '/adboard/tracking', type: 'warning' }),
  product_deleted:   (name) => ({ title: 'Produit supprimé',     body: `"${name}" a été retiré de ton catalogue.`,          url: '/adboard/products', type: 'info' }),
};
if (req.method === 'POST' && req.url === '/notify-action') {
  let body = '';
  req.on('data', d => body += d);
  req.on('end', async () => {
    try {
      const { user_id, action, name } = JSON.parse(body);
      const builder = ACTION_NOTIFS[action];
      if (!user_id || !builder) { res.writeHead(400); res.end('{}'); return; }
      await notifyUserBoth(user_id, builder(name || ''));
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: true }));
    } catch(e) {
      console.error('[NotifyAction] Erreur:', e.message);
      res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
    }
  });
  return;
}

// Garde-fou simple contre les réponses manifestement bâclées/du n'importe quoi — pas d'appel IA, juste des heuristiques rapides
function isLowEffortAnswer(text) {
  const t = (text || '').trim();
  if (t.length < 8) return true; // trop court pour être une vraie réponse
  const words = t.split(/\s+/).filter(w => w.length > 1);
  if (words.length < 2) return true; // moins de 2 mots réels
  if (/(.)\1{5,}/.test(t)) return true; // "aaaaaaa", répétition abusive d'un caractère
  const uniqueChars = new Set(t.toLowerCase().replace(/\s/g, '')).size;
  if (t.length > 15 && uniqueChars < 5) return true; // charabia clavier ("asdasdasdasd")
  return false;
}

// Filtre basique — bloque les insultes les plus courantes (FR + EN). Non exhaustif par nature
// (contournable avec des variantes orthographiques), mais suffit à éviter l'abus évident sur
// un champ de commentaire libre destiné à de l'amélioration produit, pas à la modération fine.
const MOTS_INTERDITS = [
  'connard','connasse','encule','enculé','pute','putain','salope','batard','bâtard',
  'nique','niquer','ntm','pd','pédé','pd','merde','con','conne','abruti','débile',
  'fuck','shit','bitch','asshole','cunt','nigger','faggot',
];
function contientContenuInapproprie(texte) {
  const normalise = (texte || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return MOTS_INTERDITS.some(mot => {
    const motNormalise = mot.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return new RegExp(`\\b${motNormalise}\\b`, 'i').test(normalise);
  });
}

// Les 4 messages validés — sans accents volontairement (au-delà de 160 caractères GSM sinon la limite tombe à 70)
const SMS_TEMPLATES = {
  intro: (m) => `Bonjour ${m.marque}, vu votre pub ${m.produit}. On aide des vendeurs a booster leurs ventes avec de meilleures images pub. Voici votre demo gratuite : ${m.lien}`,
  j3:    (m) => `Salut ${m.marque}, vous avez vu la demo pour ${m.produit} ? On sait ce qui pousse vos clients a acheter. Vos prochaines images peuvent en parler : ${m.lien}`,
  j10:   (m) => `Bonjour ${m.marque}, les boutiques qui gagnent du terrain sur ${m.produit} misent sur plusieurs angles pub. On peut faire pareil pour vous : ${m.lien}`,
  j21:   (m) => `Hello ${m.marque}, ${m.produit} a un vrai potentiel selon notre analyse. Le jour ou vous etes pret, on est la : ${m.lien}`,
};

const AT_USERNAME = 'AdStack';
const AT_API_KEY = process.env.AT_API_KEY;

// Normalise un numéro vers le format international E.164 (nécessaire pour Africa's Talking)
function normalizePhone(phone, defaultCountryCode = '221') { // 221 = Sénégal
  let cleaned = (phone || '').replace(/[\s\-().]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('00')) return '+' + cleaned.slice(2);
  if (cleaned.startsWith('0')) return `+${defaultCountryCode}${cleaned.slice(1)}`;
  return `+${defaultCountryCode}${cleaned}`;
}

// POST /send-prospect-sms — envoie un SMS de prospection (intro/j3/j10/j21), raccourcit le lien, appelle Africa's Talking
if (req.method === 'POST' && req.url === '/send-prospect-sms') {
  let body = '';
  req.on('data', d => body += d);
  req.on('end', async () => {
    try {
      const { phone, template, marque, produit, dest_url, country_code } = JSON.parse(body);
      const builder = SMS_TEMPLATES[template];
      if (!phone || !builder || !marque || !produit || !dest_url) {
        res.writeHead(400); res.end(JSON.stringify({ error: 'missing_fields' })); return;
      }
      if (!AT_API_KEY) {
        res.writeHead(500); res.end(JSON.stringify({ error: 'AT_API_KEY manquante sur le serveur' })); return;
      }

      // 1. Raccourcir le lien avec tracking UTM déjà inclus dans dest_url
      const code = crypto.randomBytes(4).toString('hex');
      await fetch(`${SUPABASE_URL_INT}/rest/v1/short_links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` },
        body: JSON.stringify({ code, long_url: dest_url })
      });
      const shortUrl = `https://adstackofficial.com/s/${code}`;

      // 2. Construire le message
      const message = builder({ marque, produit, lien: shortUrl });

      // 3. Envoyer via Africa's Talking (API live, form-urlencoded)
      const toNumber = normalizePhone(phone, country_code || '221');
      const params = new URLSearchParams({ username: AT_USERNAME, to: toNumber, message });
      const atRes = await fetch('https://api.africastalking.com/version1/messaging', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'apiKey': AT_API_KEY,
        },
        body: params.toString(),
      });
      const atData = await atRes.json();
      const recipient = atData?.SMSMessageData?.Recipients?.[0];

      console.log(`[SMS] ${template} → ${toNumber} : ${recipient?.status || 'inconnu'} (${recipient?.cost || '?'})`);
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: recipient?.status === 'Success', status: recipient?.status, cost: recipient?.cost, message_id: recipient?.messageId, short_url: shortUrl }));
    } catch(e) {
      console.error('[SMS] Erreur:', e.message);
      res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
    }
  });
  return;
}

// GET /crm/utilisateurs — combine comptes AdBoard + produits créés + abonnement + LTV.
// Utilise la clé service Supabase CÔTÉ SERVEUR uniquement — jamais exposée au CRM
// (qui n'a que la clé anonyme), pour ne pas donner un accès total à la base à qui ouvre
// les outils de développement du navigateur.
if (req.method === 'GET' && req.url === '/crm/utilisateurs') {
  if (!(await crmAdminOk(req))) {
    res.writeHead(401); res.end(JSON.stringify({ error: 'unauthorized' })); return;
  }
  try {
    const headersAdmin = { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` };

    const [usersRes, produitsRes, subsRes, txRes] = await Promise.all([
      fetch(`${SUPABASE_URL_INT}/auth/v1/admin/users?per_page=1000`, { headers: headersAdmin }),
      fetch(`${SUPABASE_URL_INT}/rest/v1/products?select=user_id`, { headers: headersAdmin }),
      fetch(`${SUPABASE_URL_INT}/rest/v1/subscriptions?select=user_id,plan,active,expires_at,started_at`, { headers: headersAdmin }),
      fetch(`${SUPABASE_URL_INT}/rest/v1/transactions?select=user_id,montant_net_fcfa`, { headers: headersAdmin }),
    ]);
    const usersData = await usersRes.json();
    const produits  = await produitsRes.json();
    const subs      = await subsRes.json();
    const txs       = await txRes.json();

    const nbProduitsParUser = {};
    (produits || []).forEach(p => { nbProduitsParUser[p.user_id] = (nbProduitsParUser[p.user_id]||0) + 1; });

    const subParUser = {};
    (subs || []).forEach(s => {
      // Garder l'abonnement le plus récent si plusieurs lignes existent pour le même user
      if (!subParUser[s.user_id] || new Date(s.started_at) > new Date(subParUser[s.user_id].started_at)) {
        subParUser[s.user_id] = s;
      }
    });

    const ltvParUser = {};
    (txs || []).forEach(t => { ltvParUser[t.user_id] = (ltvParUser[t.user_id]||0) + (t.montant_net_fcfa||0); });

    const utilisateurs = (usersData?.users || []).map(u => {
      const sub = subParUser[u.id];
      return {
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        nb_produits: nbProduitsParUser[u.id] || 0,
        plan: sub?.plan || null,
        plan_actif: sub ? (sub.active && new Date(sub.expires_at) > new Date()) : false,
        a_achete: !!ltvParUser[u.id],
        ltv_fcfa: ltvParUser[u.id] || 0,
      };
    });

    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({ utilisateurs }));
  } catch(e) {
    console.error('[CRM Utilisateurs] Erreur:', e.message);
    res.writeHead(500, {'Content-Type':'application/json'});
    res.end(JSON.stringify({ error: e.message }));
  }
  return;
}


// GET /setup-templates — remplit la table templates avec le contenu actuel (emails + notifications),
// à lancer UNE SEULE FOIS pour migrer ce qui était codé en dur vers un espace modifiable par le CRM.
if (req.method === 'GET' && req.url === '/setup-templates') {
  const T = [
    // ── Emails ──
    { cle: 'email_welcome', categorie: 'email', etape_funnel: 'acquisition',
      sujet: `Bienvenue dans l'écosystème d'AdStack 👍`,
      contenu: `<p>Salut{{firstName}},</p><p>Moi c'est Amar, CEO et Founder d'AdStack.</p><p>J'ai lancé AdStack parce que je voyais des vendeurs comme toi perdre des heures chaque semaine à essayer de sortir des images publicitaires génériques — pendant que leurs concurrents scalent tranquillement avec des visuels qui sont faits pour vendre.</p><p>L'idée est simple : tu nous donnes ton produit, on t'envoie des images prêtes à lancer chaque semaine. Toi tu te concentres sur gérer ton business.</p><p>3 trucs pour bien démarrer :</p><p>1. <a href="https://adstackofficial.com/adboard/products" style="color:#2D7FF9;">Crée ton premier produit</a><br>2. <a href="https://adstackofficial.com/adboard/products" style="color:#2D7FF9;">Demande des images</a><br>3. <a href="https://adstackofficial.com/adboard/offers" style="color:#2D7FF9;">Découvre nos offres</a></p><p style="margin-top:24px;">Amar<br><span style="color:#888;">CEO et Founder, AdStack</span></p>` },

    { cle: 'email_j1_no_product', categorie: 'email', etape_funnel: 'activation',
      sujet: 'Ton catalogue est vide — 2 minutes pour changer ça',
      contenu: `<p>Salut{{firstName}},</p><p>Tu t'es inscrit sur AdBoard, mais ton catalogue est encore vide.</p><p>On sait que beaucoup de vendeurs bricolent leurs visuels eux-mêmes avec ChatGPT ou Canva pour aller plus vite — sauf que "plus vite" prend souvent des heures, et le résultat ne convertit pas toujours.</p><p>Ajoute ton produit, on s'occupe du reste.</p><p><a href="https://adstackofficial.com/adboard/products" style="color:#2D7FF9;">Ajouter mon produit →</a></p><p style="margin-top:24px;">AdStack</p>` },

    { cle: 'email_j1_has_product', categorie: 'email', etape_funnel: 'activation',
      sujet: `🤯 {{firstName}} ! Découverte hallucinante sur {{productName}}...`,
      contenu: `<p>Heyy{{firstName}},</p><p>On vient de faire une petite analyse sur {{productName}}.</p><p>Et nos spécialistes ont découvert une potentielle <strong>hausse de demande</strong> d'environ <strong>32%</strong> pour ce type de produit dans les 3 prochains mois.</p><p>Mais pour capter cette demande, il te faut une stratégie de créative publicitaire en béton. Ce qui est précisément ce dont nous sommes spécialisés — on sera ravis de mettre nos années d'expérience à ton service.</p><p><a href="https://adstackofficial.com/adboard/products" style="color:#2D7FF9;">Demander mes visuels →</a></p><p style="margin-top:24px;">AdStack</p>` },

    { cle: 'email_j5_vision', categorie: 'email', etape_funnel: 'conversion',
      sujet: '🫣 La méthode secrète qui a fait la différence pour un de nos clients',
      contenu: `<p>Salut{{firstName}},</p><p><strong>Maintenant :</strong> tu gères tes visuels toi-même avec l'IA, tu lances, tu croises les doigts. Si ça marche pas, tu recommences de zéro.</p><p><strong>Avec AdStack :</strong> tu profites des années d'expérience en stratégie publicitaire de notre équipe, tout est fait avec précision et avec un unique but — exploser tes records de ventes sans que t'aies rien à faire.</p><p>C'est exactement ce qui a convaincu un de nos clients qui vend un produit santé complexe en Afrique francophone : les angles distincts lui ont permis de tester ce qui marchait vraiment, au lieu de deviner.</p><p>En conséquence il ne compte pas sur la chance pour faire "SOLD OUT".</p><p><a href="https://adstackofficial.com/adboard/offers" style="color:#2D7FF9;">Découvrir Starter — {{prixLocal}} →</a></p><p style="margin-top:24px;">AdStack</p>` },

    { cle: 'email_j12_offer', categorie: 'email', etape_funnel: 'conversion',
      sujet: `"C'est cher" — parlons-en`,
      contenu: `<p>Salut{{firstName}},</p><p>Tu regardes peut-être le prix de PERF+ ({{prixLocal}}) et tu te dis que c'est cher.</p><p>Fais le calcul : ça revient à environ {{prixParImage}} par créative (vidéos et images comprises). Un freelance basique facture souvent 5x plus cher pour une seule image, sans données marché, sans stratégie ni amélioration continue.</p><p>Le vrai coût, c'est pas Starter. C'est chaque jour sans bon contenu publicitaire qui brûle ton budget, sans savoir comprendre pourquoi ça n'a pas marché.</p><p>La meilleure solution, elle est devant toi — pas ChatGPT que tout le monde a.</p><p><a href="https://adstackofficial.com/adboard/offers" style="color:#2D7FF9;">Je démarre avec Starter →</a></p><p style="margin-top:24px;">AdStack</p>` },

    { cle: 'email_j21_breakup', categorie: 'email', etape_funnel: 'conversion',
      sujet: `🤐 je vais arrêter de t'écrire !!!`,
      contenu: `<p>Salut{{firstName}},</p><p>Je vais arrêter de t'écrire — pas parce qu'on perd notre temps, mais plutôt pour qualifier les personnes avec qui on travaille.</p><p>Car tout e-commerçant voulant vraiment scaler son business aurait compris directement la valeur unique qu'on apporte dès le premier message.</p><p><a href="https://adstackofficial.com/adboard/offers" style="color:#2D7FF9;">Passer à l'action →</a></p><p style="margin-top:24px;">AdStack</p>` },

    { cle: 'email_monthly_social_proof', categorie: 'email', etape_funnel: 'retention',
      sujet: `Ce qu'un vendeur a fait avec ses images cette semaine`,
      contenu: `<p>Salut{{firstName}},</p><p>Un de nos clients vend un produit cosmétique avec plusieurs bénéfices différents — difficile de savoir quel argument allait vraiment convaincre.</p><p>On lui a livré une bonne diversité d'images publicitaires la même semaine. Il a pu tester quel angle résonnait le plus avec sa cible, au lieu de deviner.</p><p>C'est exactement ce que Starter permet de faire, chaque semaine.</p><p><a href="https://adstackofficial.com/adboard/offers" style="color:#2D7FF9;">Revoir les offres →</a></p><p style="margin-top:24px;">AdStack</p>` },

    { cle: 'email_monthly_novelty', categorie: 'email', etape_funnel: 'retention',
      sujet: `Ce qui a changé sur AdBoard depuis ta dernière visite`,
      contenu: `<p>Salut{{firstName}},</p><p>AdBoard continue d'évoluer — nouvelles fonctionnalités, suivi de tes demandes en temps réel, assistant intégré pour répondre à tes questions direct dans la plateforme.</p><p>Si tu avais mis ton inscription de côté, c'est peut-être le bon moment d'y rejeter un œil.</p><p><a href="https://adstackofficial.com/adboard/products" style="color:#2D7FF9;">Retourner sur AdBoard →</a></p><p style="margin-top:24px;">AdStack</p>` },

    { cle: 'email_monthly_checkin', categorie: 'email', etape_funnel: 'retention',
      sujet: 'On est toujours là',
      contenu: `<p>Salut{{firstName}},</p><p>Pas de pitch aujourd'hui — juste un mot pour savoir où tu en es.</p><p>Si tu as des questions sur AdStack, ou juste besoin d'un conseil sur tes visuels publicitaires, réponds à cet email. Zéro obligation d'acheter quoi que ce soit.</p><p style="margin-top:24px;">AdStack</p>` },

    // ── Notifications — catalogue vide (10 variantes) ──
    ...[
      "👋 Heyy — Ajoute ton premier produit, ça prend 30 secondes.",
      "Prêt pour qu'on t'aide à exploser tes ventes ? Ça commence par ajouter ton produit !",
      "Ton catalogue attend son premier produit. On s'occupe du reste.",
      "30 secondes. C'est le temps qu'il te faut pour ajouter ton produit et démarrer.",
      "Tes concurrents publient déjà. Ajoute ton produit, ne perds plus de temps.",
      "Un produit ajouté = une semaine d'images publicitaires qui commence. On attend le tien.",
      "Toujours pas de produit dans ton catalogue ? On est prêts dès que toi tu l'es.",
      "Ajoute ton produit maintenant — tes premières images arrivent vite après.",
      "Ton compte AdBoard est prêt. Il ne manque plus qu'un produit.",
      "On ne peut rien faire sans ton produit. Ajoute-le, on prend le relais.",
    ].map((texte, i) => ({
      cle: `push_catalogue_vide_${String(i+1).padStart(2,'0')}`, categorie: 'notification', etape_funnel: 'activation',
      titre: 'Ton catalogue est vide', contenu: texte,
    })),

    // ── Notifications — prêt pour les visuels (10 variantes) ──
    ...[
      `💥BOOM!!! c'est le bruit de la demande qu'a {{nom}} sur ton marché. Et notre équipe n'attend que toi, pour tout rafler 🫵`,
      `{{nom}} est dans ton catalogue. Il ne manque plus qu'un forfait pour lancer tes visuels.`,
      `Chaque jour sans forfait, c'est un jour sans nouvelles images publicitaires pour {{nom}}.`,
      `Tes concurrents sur {{nom}} ne t'attendent pas. Prends ton forfait, on s'occupe du reste.`,
      `{{nom}} mérite de vraies images publicitaires. On est prêts quand toi tu l'es.`,
      `Encore un produit sans visuels ? Débloque tes premières images dès aujourd'hui.`,
      `On a hâte de bosser sur {{nom}}. Choisis ton forfait pour démarrer.`,
      `{{nom}} est prêt à décoller — reste juste le forfait à choisir.`,
      `Le potentiel de {{nom}} mérite mieux que Canva. Passe au niveau supérieur.`,
      `Ton produit est là, tes images ne le sont pas encore. On règle ça avec un forfait.`,
    ].map((texte, i) => ({
      cle: `push_pret_visuels_${String(i+1).padStart(2,'0')}`, categorie: 'notification', etape_funnel: 'conversion',
      titre: '📸 Prêt pour tes premiers visuels ?', contenu: texte,
    })),
  ];

  // PostgREST exige que TOUS les objets d'un envoi groupé aient exactement les mêmes clés —
  // les emails ont "sujet" (pas "titre"), les notifications l'inverse. On uniformise ici
  // plutôt que de dupliquer titre:null / sujet:null sur chacune des 29 entrées ci-dessus.
  const T_NORMALISE = T.map(t => ({
    cle: t.cle, categorie: t.categorie, etape_funnel: t.etape_funnel || null,
    sujet: t.sujet || null, titre: t.titre || null, contenu: t.contenu,
  }));

  try {
    const r = await fetch(`${SUPABASE_URL_INT}/rest/v1/templates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(T_NORMALISE)
    });
    if (!r.ok) {
      const errText = await r.text();
      res.writeHead(500, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ error: errText.slice(0,500) }));
      return;
    }
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({ ok: true, count: T.length }));
  } catch(e) {
    res.writeHead(500, {'Content-Type':'application/json'});
    res.end(JSON.stringify({ error: e.message }));
  }
  return;
}

// GET /setup-thumbnails — génère et upload les 3 miniatures AdStack vers Supabase (à usage unique)
if (req.method === 'GET' && req.url === '/setup-thumbnails') {
  (async () => {
    const SB_URL2 = 'https://mifljhsusidgzelnswma.supabase.co';
    const SB_KEY2 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZmxqaHN1c2lkZ3plbG5zd21hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MjI2MzQsImV4cCI6MjA5MzQ5ODYzNH0.AX4Xu0sP2tgjLhZSbCKhtw4Q3sd7GRMJ2aMKK3GfzUc';
    const resultats = [];
    for (const v of THUMBS_ADSTACK) {
      try {
        const svg = buildAdStackThumb(v);
        const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
        const uploadRes = await new Promise((resolve, reject) => {
          const r = https.request({
            hostname: 'mifljhsusidgzelnswma.supabase.co',
            path: `/storage/v1/object/demos/${v.nom}.png`,
            method: 'POST',
            headers: { 'Authorization': `Bearer ${SB_KEY2}`, 'apikey': SB_KEY2, 'Content-Type': 'image/png', 'Content-Length': png.length, 'x-upsert': 'true' }
          }, resp => { let d=''; resp.on('data', c=>d+=c); resp.on('end', () => resolve({status: resp.statusCode, body: d})); });
          r.on('error', reject); r.write(png); r.end();
        });
        resultats.push({ nom: v.nom, ok: uploadRes.status === 200 || uploadRes.status === 201, status: uploadRes.status, url: `${SB_URL2}/storage/v1/object/public/demos/${v.nom}.png` });
      } catch(e) {
        resultats.push({ nom: v.nom, ok: false, erreur: e.message });
      }
    }
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify(resultats, null, 2));
  })();
  return;
}



// Resend signe via Svix (svix-id, svix-timestamp, svix-signature) — vérifié ici manuellement
// avec crypto natif de Node, sans dépendance supplémentaire à installer. Le secret whsec_...
// doit être configuré côté Resend (dashboard → Webhooks) ET dans RESEND_WEBHOOK_SECRET ici.
function verifierSignatureSvix(payloadBrut, svixId, svixTimestamp, svixSignature, secret) {
  if (!secret || !svixId || !svixTimestamp || !svixSignature) return false;
  // Anti-rejeu — un webhook dont l'horodatage dépasse 5 min d'écart (passé ou futur) est refusé,
  // même avec une signature par ailleurs valide.
  const maintenant = Math.floor(Date.now() / 1000);
  if (Math.abs(maintenant - parseInt(svixTimestamp, 10)) > 300) return false;
  const cle = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const contenuSigne = `${svixId}.${svixTimestamp}.${payloadBrut}`;
  const signatureAttendue = crypto.createHmac('sha256', cle).update(contenuSigne).digest('base64');
  // svix-signature peut contenir plusieurs signatures séparées par des espaces (ex: rotation de
  // clé), chacune préfixée par sa version ("v1,xxxxx") — une seule doit correspondre.
  return svixSignature.split(' ').some(s => {
    const sig = s.startsWith('v1,') ? s.slice(3) : s;
    try { return crypto.timingSafeEqual(Buffer.from(sig, 'base64'), Buffer.from(signatureAttendue, 'base64')); }
    catch(e) { return false; }
  });
}

if (req.method === 'POST' && req.url === '/webhook/resend') {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', async () => {
    try {
      const valide = verifierSignatureSvix(
        body,
        req.headers['svix-id'],
        req.headers['svix-timestamp'],
        req.headers['svix-signature'],
        process.env.RESEND_WEBHOOK_SECRET
      );
      if (!valide) {
        console.warn('[Webhook Resend] Signature invalide ou manquante — événement ignoré');
        res.writeHead(401); res.end(); return;
      }
      const event = JSON.parse(body);
      // type ex: "email.opened", "email.clicked", "email.delivered", "email.bounced"...
      const eventType = (event.type || '').replace('email.', '');
      const tags = event.data?.tags || [];
      const emailKeyTag = tags.find(t => t.name === 'email_key');
      const userIdTag = tags.find(t => t.name === 'user_id');
      await fetch(`${SUPABASE_URL_INT}/rest/v1/email_events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, Prefer: 'return=minimal' },
        body: JSON.stringify({
          email_key: emailKeyTag?.value || null,
          user_id: userIdTag?.value || null,
          event_type: eventType,
          resend_email_id: event.data?.email_id || null,
          clicked_url: event.data?.click?.link || null,
        })
      });
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true }));
    } catch(e) {
      console.error('[Webhook Resend] Erreur traitement :', e.message);
      res.writeHead(200); res.end(); // 200 quand même — éviter des retries en boucle sur une erreur de notre côté
    }
  });
  return;
}

// POST /track-funnel-event — ajout au panier / paiement initié sur la page de vente. La
// déduplication par session se fait déjà côté client (sessionStorage) — cet endpoint se contente
// d'enregistrer, jamais de re-dédupliquer côté serveur (pas de session fiable à ce niveau).
if (req.method === 'POST' && req.url === '/track-funnel-event') {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', async () => {
    try {
      const { type, prospect_id, campagne, source, user_id } = JSON.parse(body || '{}');
      if (type !== 'ajout_panier' && type !== 'paiement_initie') {
        res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'type invalide' })); return;
      }
      // Cause profonde probable (plus aucun ajout panier depuis la migration Supabase, alors que
      // le vrai trafic existe côté Clarity) : cette écriture ne vérifiait jamais sa propre
      // réussite — un {ok:true} était renvoyé au client quelle que soit la réponse réelle de
      // Supabase. Si la clé service n'a pas été mise à jour vers le nouveau projet en même temps
      // que l'URL, chaque insertion échoue en 401/403 depuis la migration, en silence total.
      const rSupa = await fetch(`${SUPABASE_URL_INT}/rest/v1/funnel_events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, Prefer: 'return=minimal' },
        body: JSON.stringify({ type, prospect_id: prospect_id || null, campagne: campagne || null, source: source || 'vente', user_id: user_id || null })
      });
      if (!rSupa.ok) {
        const detail = await rSupa.text().catch(() => '');
        console.error(`[track-funnel-event] Écriture Supabase échouée (${rSupa.status}) :`, detail);
        res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Écriture échouée', detail })); return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true }));
    } catch(e) {
      console.error('/track-funnel-event error:', e.message);
      res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: e.message }));
    }
  });
  return;
}

// POST /shorten — crée un lien court auto-hébergé (utilisé pour les SMS, limite de caractères,
// et les relances J+10/J+21 qui ont besoin d'une miniature différente du lien direct)
if (req.method === 'POST' && req.url === '/shorten') {
  let body = '';
  req.on('data', d => body += d);
  req.on('end', async () => {
    try {
      const { url, thumbnail, campagne } = JSON.parse(body);
      if (!url) { res.writeHead(400); res.end(JSON.stringify({ error: 'missing_url' })); return; }
      const code = crypto.randomBytes(4).toString('hex'); // 8 caractères, ex: a1b2c3d4
      const insertRes = await fetch(`${SUPABASE_URL_INT}/rest/v1/short_links`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify({ code, long_url: url, thumbnail: thumbnail || null, campagne: campagne || null })
      });
      if (!insertRes.ok) {
        const errText = await insertRes.text();
        console.error('[Shorten] Échec insertion:', insertRes.status, errText.slice(0,300));
        res.writeHead(500); res.end(JSON.stringify({ error: 'insert_failed' })); return;
      }
      // Cause profonde corrigée (miniatures qui n'apparaissent jamais sur WhatsApp dans les
      // vrais messages envoyés, alors que tous les tests isolés passaient) : le lien était
      // construit sans "www.", ce qui déclenche une redirection 308 (Vercel) avant d'atteindre
      // les vraies balises OG — WhatsApp ne suit pas cette redirection pour générer l'aperçu.
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ short_url: `https://www.adstackofficial.com/s/${code}` }));
    } catch(e) {
      console.error('[Shorten] Erreur:', e.message);
      res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
    }
  });
  return;
}

// GET /s/:code — redirige vers le lien d'origine, compte le clic. Si une miniature a été
// configurée sur ce lien (J+10/J+21), sert d'abord une page avec les bonnes balises OG,
// puis redirige en JS — sinon un simple 302 direct (miniature par défaut d'AdBoard).
if (req.method === 'GET' && req.url.startsWith('/s/')) {
  const code = req.url.split('/s/')[1]?.split('?')[0];
  if (!code) { res.writeHead(404); res.end('Not found'); return; }
  try {
    const r = await fetch(`${SUPABASE_URL_INT}/rest/v1/short_links?code=eq.${code}&select=id,long_url,clicks,thumbnail,campagne`, {
      headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
    });
    const rows = await r.json();
    const link = rows?.[0];
    if (!link) { res.writeHead(404); res.end('Lien introuvable ou expiré'); return; }
    // Comptage du clic — uniquement pour un vrai visiteur, jamais pour un robot de
    // prévisualisation (WhatsApp/Facebook/etc. visitent le lien automatiquement pour générer
    // l'aperçu — image, titre — dès l'envoi du message, bien avant que quiconque clique
    // vraiment). Sans ce filtre, chaque message envoyé gonflait le compteur de plusieurs
    // clics fantômes.
    const _uaClic = req.headers['user-agent'] || '';
    // Liste élargie — l'ancienne version ratait potentiellement des crawlers de prévisualisation
    // qui n'utilisent pas un user-agent contenant explicitement "bot"/"crawler"/"spider" (ex:
    // certains contextes WhatsApp Business/Cloud API ont un UA de prévisualisation différent de
    // l'app grand public). Un vrai navigateur envoie TOUJOURS un user-agent non vide et contenant
    // "Mozilla" — son absence ou un UA anormalement court est déjà un signal fort de robot/script.
    const _estRobotClicUA = !_uaClic
      || _uaClic.length < 20
      || !/Mozilla/i.test(_uaClic)
      || /WhatsApp|facebookexternalhit|Facebot|Meta-Extern|Twitterbot|LinkedInBot|Googlebot|Bingbot|Slackbot|Discordbot|TelegramBot|SkypeUriPreview|vkShare|Applebot|DuckDuckBot|YandexBot|AhrefsBot|SemrushBot|MJ12bot|ia_archiver|python-requests|curl|wget|headless|bot|crawler|spider/i.test(_uaClic);

    // Détection par IP — cause profonde trouvée après coup (voir logs réels : IP 173.252.95.115
    // et 69.63.184.9 avec user-agents Chrome 74 / Firefox 59, versions obsolètes de plusieurs
    // années) : Meta scanne les liens envoyés sur WhatsApp avec un user-agent volontairement
    // générique — "ressemble" à un vrai navigateur, ne contient aucun mot-clé de bot, passe donc
    // le filtre UA seul. Une IP ne se falsifie pas aussi facilement qu'un user-agent — on
    // vérifie donc aussi l'appartenance aux plages officielles de Meta (ASN 32934).
    const _ipClic = (req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0].trim();
    const _ipVersNombre = (ip) => {
      const parts = (ip||'').replace('::ffff:','').split('.').map(Number);
      if (parts.length !== 4 || parts.some(p => isNaN(p) || p<0 || p>255)) return null;
      return ((parts[0]<<24) >>> 0) + (parts[1]<<16) + (parts[2]<<8) + parts[3];
    };
    const _dansPlage = (ip, cidr) => {
      const [base, bits] = cidr.split('/');
      const ipNum = _ipVersNombre(ip), baseNum = _ipVersNombre(base);
      if (ipNum === null || baseNum === null) return false;
      const masque = bits==='0' ? 0 : (~0 << (32-Number(bits))) >>> 0;
      return (ipNum & masque) === (baseNum & masque);
    };
    // Plages Meta/Facebook officielles (ASN 32934) les plus significatives — vérifiées via
    // IPinfo/ASN publics au moment de l'écriture, à réviser si Meta change son allocation.
    const PLAGES_META = ['31.13.24.0/21','31.13.64.0/18','45.64.40.0/22','57.136.0.0/15','57.144.0.0/14',
      '66.220.0.0/16','69.63.176.0/20','69.171.0.0/16','74.119.76.0/22','102.132.96.0/20','103.4.96.0/22',
      '129.134.0.0/16','147.75.208.0/20','157.240.0.0/16','163.70.128.0/17','163.77.128.0/17',
      '163.114.128.0/20','173.252.64.0/18','179.60.192.0/22','185.60.216.0/22','185.89.216.0/22','204.15.20.0/22'];
    const _estIpMeta = PLAGES_META.some(cidr => _dansPlage(_ipClic, cidr));
    const _estRobotClic = _estRobotClicUA || _estIpMeta;
    // Log systématique (bot ou pas) — visible dans les logs Render. Objectif : pouvoir enfin
    // VOIR ce qui frappe réellement ce endpoint plutôt que de deviner depuis un compteur agrégé
    // qui ne dit rien du "pourquoi". À garder au moins le temps de comprendre l'écart clics/leads.
    console.log(`[Clic /s/${code}] campagne=${link.campagne||'?'} robot=${_estRobotClic}${_estIpMeta?' (ip_meta)':''} ip=${_ipClic} ua="${_uaClic.slice(0,140)}"`);
    if (!_estRobotClic) {
      fetch(`${SUPABASE_URL_INT}/rest/v1/short_links?id=eq.${link.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ clicks: (link.clicks || 0) + 1 })
      }).catch(()=>{});
    }

    if (link.thumbnail) {
      // Cause profonde corrigée (même classe de bug que l'og:image des démos) : cette URL pointait
      // directement vers Supabase, sollicité à CHAQUE envoi de pitch/J+10/J+21 (potentiellement des
      // centaines de fois pour seulement 3 fichiers statiques réutilisés). Route maintenant via
      // /demo/:slug.png sur ce serveur, qui a déjà son propre cache local + repli Supabase.
      const imgUrl = `${RENDER_URL_PUBLIC}/demo/${link.thumbnail}.png`;
      const escAttr = (s) => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<meta property="og:type" content="website">
<meta property="og:title" content="AdStack">
<meta property="og:image" content="${escAttr(imgUrl)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${escAttr(imgUrl)}">
<script>
  (function(){
    if (window.self !== window.top) return;
    var ua = navigator.userAgent || '';
    var isBot = /WhatsApp|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Googlebot|Slackbot|Discordbot/i.test(ua);
    if (!isBot) window.location.replace(${JSON.stringify(link.long_url)});
  })();
</script>
</head><body></body></html>`;
      res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
      res.end(html);
      return;
    }

    res.writeHead(302, { 'Location': link.long_url });
    res.end();
  } catch(e) {
    console.error('[Shorten] Erreur redirection:', e.message);
    res.writeHead(500); res.end('Erreur serveur');
  }
  return;
}

// POST /save-comment — commentaire libre depuis AdBoard, stocké comme les autres formulaires
if (req.method === 'POST' && req.url === '/save-comment') {
  let body = '';
  req.on('data', d => body += d);
  req.on('end', async () => {
    try {
      const { user_id, email, texte } = JSON.parse(body);
      if (!texte || !texte.trim()) {
        res.writeHead(400); res.end(JSON.stringify({ error: 'invalid_payload' })); return;
      }
      if (contientContenuInapproprie(texte)) {
        res.writeHead(422, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ error: 'contenu_inapproprie' }));
        return;
      }
      const insertRes = await fetch(`${SUPABASE_URL_INT}/rest/v1/data_insights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify([{
          source: 'commentaire_libre', user_id: user_id || null, email: email || null,
          question: 'Commentaire libre', answer: texte.trim(),
        }])
      });
      if (!insertRes.ok) {
        const errText = await insertRes.text();
        console.error('[Commentaire] Échec insertion:', insertRes.status, errText.slice(0,300));
        res.writeHead(500); res.end(JSON.stringify({ error: 'insert_failed' })); return;
      }
      console.log(`[Commentaire] ✅ Nouveau commentaire enregistré`);
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: true }));
    } catch(e) {
      res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
    }
  });
  return;
}

// POST /save-form-response — reçoit les réponses du formulaire pré-achat ou post-achat
if (req.method === 'POST' && req.url === '/save-form-response') {
  let body = '';
  req.on('data', d => body += d);
  req.on('end', async () => {
    try {
      const { user_id, email, source, answers } = JSON.parse(body);
      if (!source || !Array.isArray(answers) || answers.length === 0) {
        res.writeHead(400); res.end(JSON.stringify({ error: 'invalid_payload' })); return;
      }

      // Garde-fou uniquement sur le formulaire pré-achat (obligatoire) — le post-achat est facultatif, pas de blocage
      if (source === 'prepurchase_form') {
        const lowEffortCount = answers.filter(a => isLowEffortAnswer(a.answer)).length;
        if (lowEffortCount > 2) {
          res.writeHead(422, {'Content-Type':'application/json'});
          res.end(JSON.stringify({ error: 'low_effort', message: 'Essaie de répondre un peu plus en détail à certaines questions.' }));
          return;
        }
      }

      const rows = answers.map(a => ({
        source, user_id: user_id || null, email: email || null,
        question: a.question, answer: a.answer,
      }));
      const insertRes = await fetch(`${SUPABASE_URL_INT}/rest/v1/data_insights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify(rows)
      });
      if (!insertRes.ok) {
        const errText = await insertRes.text();
        console.error('[DataInsights] Échec insertion:', insertRes.status, errText.slice(0,300));
        res.writeHead(500); res.end(JSON.stringify({ error: 'insert_failed' })); return;
      }

      console.log(`[DataInsights] ✅ ${rows.length} réponse(s) enregistrée(s) — source: ${source}`);
      res.writeHead(200, {'Content-Type':'application/json'});
      // Code promo uniquement pour le pré-achat — code fixe, à créer une seule fois dans le dashboard Chariow
      res.end(JSON.stringify({ ok: true, promo_code: source === 'prepurchase_form' ? 'MERCI10' : null }));
    } catch(e) {
      console.error('[DataInsights] Erreur:', e.message);
      res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
    }
  });
  return;
}

// POST /products/:id/dedupe-creatives — nettoyage ponctuel des doublons créés par l'ancien bug
// d'envoi partiel (créatives avec un ID strictement identique dans le tableau, entrées de batch
// dupliquées, noms d'angle non tronqués). Garde la première occurrence de chaque ID/ticket,
// retire les autres. À usage unique par produit affecté — le nouveau mécanisme d'envoi (voir
// /commandes/:id/done) empêche ce problème de se reproduire.
if (req.method === 'POST' && req.url.match(/^\/products\/[^/]+\/dedupe-creatives$/)) {
  const productId = req.url.split('/')[2];
  try {
    const r = await fetch(`${SUPABASE_URL_INT}/rest/v1/products?id=eq.${productId}&select=creatives,deliveries`, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
    });
    const rows = await r.json();
    if (!rows.length) { res.writeHead(404); res.end(JSON.stringify({ error: 'Produit introuvable' })); return; }
    // Livraisons traitées en premier — construit la correspondance ticketId → cible, réutilisée
    // ensuite pour rétro-remplir les anciennes créatives qui n'ont pas encore ce champ.
    const deliveries = rows[0].deliveries || [];
    const vusTickets = new Set();
    const deliveriesNettoyees = [];
    const cibleParTicket = {};
    let batchsRetires = 0;
    let anglesNormalises = 0;
    for (const d of deliveries) {
      if (d.ticketId && vusTickets.has(d.ticketId)) { batchsRetires++; continue; }
      if (d.ticketId) { vusTickets.add(d.ticketId); if (d.cible) cibleParTicket[d.ticketId] = d.cible; }
      if (Array.isArray(d.angles)) {
        d.angles = d.angles.map(a => {
          if (a?.nom && a.nom.includes('*')) {
            const propre = a.nom.split('*')[0].trim();
            if (propre) { anglesNormalises++; return { ...a, nom: propre }; }
          }
          return a;
        });
      }
      deliveriesNettoyees.push(d);
    }

    const creatives = rows[0].creatives || [];
    const vusIds = new Set();
    const nettoyees = [];
    let doublonsRetires = 0;
    let ciblesRetrofillees = 0;
    for (const c of creatives) {
      if (c.id && vusIds.has(c.id)) { doublonsRetires++; continue; }
      if (c.id) vusIds.add(c.id);
      // Anciennes créatives (avant le fix de troncature) : le nom d'angle complet avec tout le
      // détail technique était encore stocké tel quel — les nouvelles ont la version tronquée,
      // donc les deux coexistaient comme des chaînes différentes, jamais fusionnées dans les
      // filtres. On normalise ici aussi, rétroactivement.
      if (c.angle && c.angle.includes('*')) {
        const propre = c.angle.split('*')[0].trim();
        if (propre) { c.angle = propre; anglesNormalises++; }
      }
      // Nouveau : rétro-remplissage de la cible pour les créatives livrées avant l'ajout de ce
      // champ — permet au nouveau filtre "Cible" d'AdBoard de fonctionner même sur les anciennes
      // données, pas seulement sur les créatives livrées après ce fix.
      if (!c.cible && c.id) {
        const ticketId = c.id.split('_').slice(0,-1).join('_');
        if (cibleParTicket[ticketId]) { c.cible = cibleParTicket[ticketId]; ciblesRetrofillees++; }
      }
      nettoyees.push(c);
    }
    const rPatch = await fetch(`${SUPABASE_URL_INT}/rest/v1/products?id=eq.${productId}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ creatives: nettoyees, deliveries: deliveriesNettoyees })
    });
    if (!rPatch.ok) { res.writeHead(500); res.end(JSON.stringify({ error: 'Écriture échouée', detail: await rPatch.text() })); return; }
    console.log(`[Dedupe] ${doublonsRetires} créative(s) doublon(s) + ${batchsRetires} batch(s) doublon(s) retirés, ${anglesNormalises} angle(s) normalisé(s), ${ciblesRetrofillees} cible(s) rétro-remplie(s) pour products/${productId}`);
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({ ok: true, doublonsRetires, batchsRetires, anglesNormalises, ciblesRetrofillees, totalRestant: nettoyees.length }));
  } catch(e) {
    res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
  }
  return;
}

// POST /commandes/:id/done — "Envoyer au client" : marque livré + pousse vers AdBoard (table briefs)
  if (req.method === 'POST' && req.url.match(/^\/commandes\/[^/]+\/done$/)) {

    const id = req.url.split('/')[2];
    const briefs = await loadBriefs();
    const idx = briefs.findIndex(b => b.id === id);
    if (idx >= 0) {
      briefs[idx].status = 'done';
      briefs[idx].done_at = new Date().toISOString();

      // Pousser les livrables vers la table `briefs` d'AdBoard (statut visible pour le client)
      if (briefs[idx].deliverables) {
        try {
          const rPatch = await fetch(`${SUPABASE_URL_INT}/rest/v1/briefs?id=eq.${id}`, {
            method: 'PATCH',
            headers: {
              apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
              'Content-Type': 'application/json', Prefer: 'return=minimal'
            },
            body: JSON.stringify({
              status: 'done',
              done_at: briefs[idx].done_at,
              creatives: briefs[idx].deliverables.creatives || null,
              ad_copies: briefs[idx].deliverables.copies || null,
              market_data: briefs[idx].deliverables.synthesis || null,
            })
          });
          // Cause profonde corrigée (minuteur/bouton annuler qui restent affichés côté client
          // malgré une livraison marquée "faite" dans Factory) : le succès de ce PATCH n'était
          // jamais vérifié — si Supabase le refusait (policy RLS manquante, contrainte, mauvais
          // nom de colonne), le statut ne passait jamais à 'done' dans la table que le CLIENT
          // lit, et rien ne le signalait nulle part.
          if (!rPatch.ok) {
            const errText = await rPatch.text();
            console.error(`[Deliver] ❌ ÉCHEC PATCH briefs (id=${id}) — statut jamais mis à jour côté client:`, rPatch.status, errText.slice(0,500));
          } else {
            console.log(`[Deliver] ✅ Statut 'done' confirmé dans briefs pour ${id}`);
          }
        } catch(e) {
          console.error('[Deliver] Push vers briefs (AdBoard) échoué :', e.message);
        }

        // Cause profonde corrigée (clic répété sur "Envoyer au client" → créatives ET ad copies
        // doublés dans AdBoard, au lieu de compléter ce qui manquait) : l'ancienne version
        // vérifiait les doublons en RE-LISANT la table products juste avant de pousser — une
        // lecture séparée, sujette à un décalage de synchronisation, qui pouvait rater les
        // créatives tout juste écrites par un appel précédent. Le suivi se fait maintenant
        // directement SUR LE BRIEF lui-même (déjà chargé de façon fiable, pas de lecture
        // croisée) : on ne pousse plus jamais que les indices pas encore confirmés livrés.
        const dejaPousses = new Set(briefs[idx].pushed_creative_indices || []);
        var pushResult = await pushDeliverablesToProduct(briefs[idx].product?.id, id, briefs[idx].deliverables, dejaPousses, !!briefs[idx].batch_deja_cree, briefs[idx].quantity, null, null, briefs[idx].generation_version || 1);
        if (pushResult?.newlyPushedIndices?.length) {
          briefs[idx].pushed_creative_indices = [...dejaPousses, ...pushResult.newlyPushedIndices];
        }
        if (pushResult?.batchCree) {
          briefs[idx].batch_deja_cree = true;
        }
        // Portrait persona — voir genererEtSauvegarderPortraitEnTacheDeFond : jamais attendu
        // ici (pas de "await"), volontairement. Continue de tourner dans ce process même une
        // fois la réponse HTTP envoyée et même si Factory est fermée juste après.
        if (pushResult?.besoinPortrait && pushResult.personaPourPortrait?.nom) {
          genererEtSauvegarderPortraitEnTacheDeFond(briefs[idx].product?.id, pushResult.personaPourPortrait)
            .catch(e => console.error('[Portrait] Erreur non interceptée en tâche de fond :', e.message));
        }
      } else {
        console.warn(`[Deliver] Aucun livrable sauvegardé pour ${id} — statut poussé à AdBoard sans contenu.`);
      }

      await saveBriefs([briefs[idx]]);
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: true, push: pushResult || null }));
      // Notification push + trace persistante — livrables prêts
      const userId = briefs[idx].client?.user_id;
      if (userId) {
        notifyUserBoth(userId, {
          title: '🎉 Tes visuels sont prêts',
          body: `Les images pour ${briefs[idx].product?.nom || 'ton produit'} sont livrées — va les récupérer sur AdBoard.`,
          url: '/adboard/gallery',
          type: 'brief',
        }).catch(()=>{});
      }
      // Email en complément du push (au cas où le push ne soit pas activé/vu) — texte à
      // valider, voir sendDeliverablesReadyEmail ci-dessous pour le contenu exact.
      if (briefs[idx].client?.email) {
        sendDeliverablesReadyEmail({
          email: briefs[idx].client.email,
          produit: briefs[idx].product?.nom || 'ton produit',
        }).catch(()=>{});
      }
    } else {
      res.writeHead(404); res.end(JSON.stringify({ error: 'Brief not found' }));
    }
    return;
  }

  // POST /commandes/:id/send-one-creative — envoie UNE SEULE créative précise au client, sans
  // toucher au reste du batch. Répond au besoin de contrôle fin : si une créative manque côté
  // client après un envoi complet, ou si le client veut voir une créative précise dès qu'elle
  // est prête sans attendre tout le batch, plutôt que de tout renvoyer.
  if (req.method === 'POST' && req.url.match(/^\/commandes\/[^/]+\/send-one-creative$/)) {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const id = req.url.split('/')[2];
        const { index } = JSON.parse(body);
        if (typeof index !== 'number') { res.writeHead(400); res.end(JSON.stringify({ error: 'index (nombre) requis' })); return; }

        const briefs = await loadBriefs();
        const idx = briefs.findIndex(b => b.id === id);
        if (idx < 0) { res.writeHead(404); res.end(JSON.stringify({ error: 'Brief not found' })); return; }
        if (!briefs[idx].deliverables) { res.writeHead(400); res.end(JSON.stringify({ error: 'Aucun livrable sauvegardé pour ce ticket' })); return; }
        const creative = briefs[idx].deliverables.creatives?.[index];
        if (!creative || (!creative.url && !creative.imgB64)) { res.writeHead(400); res.end(JSON.stringify({ error: `Créative ${index} inexistante ou pas encore générée` })); return; }

        const dejaPousses = new Set(briefs[idx].pushed_creative_indices || []);
        const pushResult = await pushDeliverablesToProduct(
          briefs[idx].product?.id, id, briefs[idx].deliverables,
          dejaPousses, !!briefs[idx].batch_deja_cree, briefs[idx].quantity,
          new Set([index]), new Set(), briefs[idx].generation_version || 1
        );
        if (pushResult?.newlyPushedIndices?.length) {
          briefs[idx].pushed_creative_indices = [...dejaPousses, ...pushResult.newlyPushedIndices];
        }
        if (pushResult?.batchCree) briefs[idx].batch_deja_cree = true;
        await saveBriefs([briefs[idx]]);

        const reussi = pushResult?.newlyPushedIndices?.includes(index) || dejaPousses.has(index);
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ ok: reussi, push: pushResult || null }));
      } catch(e) {
        res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // POST /commandes/:id/send-marche — pousse UNIQUEMENT les Données Marché au client, sans
  // toucher aux créatives ni aux ad copies. Réutilise pushDeliverablesToProduct avec un
  // ensemble d'indices vide (onlyIndices) : aucune créative ne matche jamais un Set() vide,
  // donc la boucle des créatives ne fait rien, mais le bloc marche — indépendant de cette
  // boucle — s'exécute normalement.
  if (req.method === 'POST' && req.url.match(/^\/commandes\/[^/]+\/send-marche$/)) {
    try {
      const id = req.url.split('/')[2];
      const briefs = await loadBriefs();
      const idx = briefs.findIndex(b => b.id === id);
      if (idx < 0) { res.writeHead(404); res.end(JSON.stringify({ error: 'Brief not found' })); return; }
      if (!briefs[idx].deliverables?.marche) { res.writeHead(400); res.end(JSON.stringify({ error: 'Aucune donnée marché sauvegardée pour ce ticket' })); return; }

      const dejaPousses = new Set(briefs[idx].pushed_creative_indices || []);
      const pushResult = await pushDeliverablesToProduct(
        briefs[idx].product?.id, id, briefs[idx].deliverables,
        dejaPousses, !!briefs[idx].batch_deja_cree, briefs[idx].quantity,
        new Set(), new Set(), briefs[idx].generation_version || 1
      );
      if (pushResult?.batchCree) briefs[idx].batch_deja_cree = true;
      await saveBriefs([briefs[idx]]);

      if (pushResult?.besoinPortrait && pushResult.personaPourPortrait?.nom) {
        genererEtSauvegarderPortraitEnTacheDeFond(briefs[idx].product?.id, pushResult.personaPourPortrait)
          .catch(e => console.error('[Portrait] Erreur non interceptée en tâche de fond :', e.message));
      }

      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: !!pushResult?.marcheOk, push: pushResult || null }));
    } catch(e) {
      res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // POST /commandes/:id/send-one-copy — envoie UNE SEULE ad copy précise (un angle) au client,
  // sans toucher aux créatives ni aux autres ad copies. Même principe que send-one-creative.
  if (req.method === 'POST' && req.url.match(/^\/commandes\/[^/]+\/send-one-copy$/)) {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const id = req.url.split('/')[2];
        const { index } = JSON.parse(body);
        if (typeof index !== 'number') { res.writeHead(400); res.end(JSON.stringify({ error: 'index (nombre) requis' })); return; }

        const briefs = await loadBriefs();
        const idx = briefs.findIndex(b => b.id === id);
        if (idx < 0) { res.writeHead(404); res.end(JSON.stringify({ error: 'Brief not found' })); return; }
        if (!briefs[idx].deliverables) { res.writeHead(400); res.end(JSON.stringify({ error: 'Aucun livrable sauvegardé pour ce ticket' })); return; }
        const copy = briefs[idx].deliverables.copies?.[index];
        if (!copy || !copy.description) { res.writeHead(400); res.end(JSON.stringify({ error: `Ad copy ${index} inexistante ou pas encore générée` })); return; }

        const dejaPousses = new Set(briefs[idx].pushed_creative_indices || []);
        const pushResult = await pushDeliverablesToProduct(
          briefs[idx].product?.id, id, briefs[idx].deliverables,
          dejaPousses, !!briefs[idx].batch_deja_cree, briefs[idx].quantity,
          new Set(), new Set([index]), briefs[idx].generation_version || 1
        );
        if (pushResult?.batchCree) briefs[idx].batch_deja_cree = true;
        await saveBriefs([briefs[idx]]);

        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ ok: !!pushResult?.patchOk, push: pushResult || null }));
      } catch(e) {
        res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ── SESSIONS DÉMO — persistance de la génération démo (avant : rien n'était sauvegardé, un
  // rafraîchissement de page pendant ou après une génération effaçait tout, y compris le lien
  // vers un HTML déjà uploadé sur Supabase Storage). Table dédiée `demo_sessions`, indépendante
  // de la table `demos` existante (qui gère la file d'attente prospection CRM, pas la génération).

  // POST /demo-sessions — crée une nouvelle session démo, retourne son id
  if (req.method === 'POST' && req.url === '/demo-sessions') {
    try {
      const id = crypto.randomUUID();
      const rInsert = await fetch(`${SUPABASE_URL_INT}/rest/v1/demo_sessions`, {
        method: 'POST',
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ id, status: 'in_progress', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), state: {} })
      });
      if (!rInsert.ok) { res.writeHead(500); res.end(JSON.stringify({ error: await rInsert.text() })); return; }
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: true, id }));
    } catch(e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // POST /demo-sessions/:id/save — écriture ciblée de l'état courant (mêmes principes que
  // save-deliverables : ne réécrit QUE ce qui change, jamais toute la ligne).
  if (req.method === 'POST' && req.url.match(/^\/demo-sessions\/[^/]+\/save$/)) {
    const id = req.url.split('/')[2];
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { state, status, finalUrl } = JSON.parse(body);
        const patchBody = { updated_at: new Date().toISOString() };
        if (state !== undefined) patchBody.state = state;
        if (status) patchBody.status = status;
        if (finalUrl !== undefined) patchBody.final_url = finalUrl;
        const rPatch = await fetch(`${SUPABASE_URL_INT}/rest/v1/demo_sessions?id=eq.${id}`, {
          method: 'PATCH',
          headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify(patchBody)
        });
        if (!rPatch.ok) { const t = await rPatch.text(); console.error('[Demo Session] Sauvegarde échouée:', t.slice(0,300)); res.writeHead(500); res.end(JSON.stringify({ error: t })); return; }
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ ok: true }));
      } catch(e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
    });
    return;
  }

  // GET /demo-sessions/:id — récupère l'état sauvegardé, pour la reprise au rechargement
  if (req.method === 'GET' && req.url.match(/^\/demo-sessions\/[^/]+$/)) {
    const id = req.url.split('/')[2];
    try {
      const r = await fetch(`${SUPABASE_URL_INT}/rest/v1/demo_sessions?id=eq.${id}&select=*`, {
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
      });
      const rows = await r.json();
      if (!rows.length) { res.writeHead(404); res.end(JSON.stringify({ error: 'Session introuvable' })); return; }
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify(rows[0]));
    } catch(e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // POST /commandes/:id/upload-creative-now — upload IMMÉDIAT d'une créative dès qu'elle est
  // générée, pas à la fin. Cause profonde corrigée (statement timeout persistant malgré
  // l'écriture ciblée sur deliverables) : le vrai poids ne venait pas de QUELLES colonnes
  // étaient réécrites, mais de LA TAILLE du contenu lui-même — deliverables.creatives
  // accumulait les images en base64 directement dans la ligne, grossissant à chaque créative
  // jusqu'à devenir trop lourd pour Supabase, peu importe l'écriture ciblée. Chaque créative
  // est maintenant uploadée vers le Storage dès sa génération — la base de données ne
  // contient plus jamais que des liens légers (quelques dizaines d'octets), jamais les
  // images elles-mêmes (souvent 500Ko-2Mo chacune).
  if (req.method === 'POST' && req.url.match(/^\/commandes\/[^/]+\/upload-creative-now$/)) {
    const id = req.url.split('/')[2];
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { imgB64, mime, index, thumbB64 } = JSON.parse(body);
        if (!imgB64) { res.writeHead(400); res.end(JSON.stringify({ error: 'imgB64 requis' })); return; }
        // Cause profonde corrigée (le client voit éternellement l'image du 1er lancement, même
        // après plusieurs relances réussies et confirmées) : le nom de fichier ne changeait
        // jamais d'une relance à l'autre (${id}_${index} seul, sans version) — combiné au cache
        // "immutable" 1 an sur ces fichiers (volontaire, ces images ne changent normalement
        // jamais UNE FOIS livrées), le navigateur qui avait déjà vu cette URL une fois ne la
        // redemande plus JAMAIS au serveur, même si le fichier lui-même a bien été écrasé
        // (x-upsert:true) avec la nouvelle image entre-temps. La métadonnée texte (ct/desc,
        // stockée en JSON, jamais mise en cache) se mettait à jour normalement — d'où l'angle/
        // description corrects mais l'image visuellement figée sur l'ancienne version.
        const briefsPourVersion = await loadBriefs();
        const briefTrouve = briefsPourVersion.find(b => b.id === id);
        const generationVersion = briefTrouve?.generation_version || 1;
        const { imageUrl, thumbUrl } = await uploadCreativeImage(imgB64, mime || 'image/png', `${id}_g${generationVersion}_${index}`, thumbB64);
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ ok: true, url: imageUrl, thumbUrl }));
      } catch(e) {
        console.error(`[Upload immédiat] Échec pour ${id}_${JSON.parse(body||'{}').index ?? '?'}:`, e.message);
        res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // POST /commandes/:id/save-deliverables — appelé automatiquement dès qu'une production
  // se termine (si lancée depuis un ticket), pour que "Envoyer au client" trouve toujours
  // les livrables même après avoir quitté la page.
  if (req.method === 'POST' && req.url.match(/^\/commandes\/[^/]+\/save-deliverables$/)) {
    const id = req.url.split('/')[2];
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const deliverables = JSON.parse(body);
        // Cause profonde corrigée (statement timeout persistant malgré l'espacement des appels) :
        // passer par saveBriefs() réécrivait TOUTE la ligne (photo_nobg comprise, une image
        // complète qui ne change jamais pendant la génération) à chaque sauvegarde automatique —
        // le vrai poids venait de là, pas seulement de la fréquence des appels. Écriture ciblée
        // maintenant : uniquement la colonne deliverables, rien d'autre n'est retransmis.
        const rPatch = await fetch(`${SUPABASE_URL_INT}/rest/v1/commandes?id=eq.${id}`, {
          method: 'PATCH',
          headers: {
            apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json', Prefer: 'return=minimal'
          },
          body: JSON.stringify({ deliverables })
        });
        if (!rPatch.ok) {
          const errText = await rPatch.text();
          console.error(`[Autosave] ❌ Échec écriture ciblée pour ${id}:`, rPatch.status, errText.slice(0,300));
          res.writeHead(500); res.end(JSON.stringify({ error: errText })); return;
        }
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ ok: true }));
      } catch(e) {
        res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404); res.end('Not found');
});

// ═══════════════════════════════════════════════════════════════════════════
// v5.68 — BALAYAGE PAR LE PROBLÈME + SCRAPECREATORS + HYPOTHÈSE STOCKÉE
//   • planBalayage : part du PROBLÈME du client (pas de la marque), liste concurrents directs et alternatives
//   • balayageScrapeCreators : Reddit, TikTok (vidéos + commentaires), Bibliothèque de pubs Meta — plafonné
//   • decideBalayage : réutilise l'hypothèse stockée tant qu'il reste assez d'angles en réserve et que le
//     dernier balayage a moins de 30 jours ; sinon nouveau balayage
//   • enregistrerBalayage : date du dernier balayage par produit (table Supabase balayages_marche)
// ═══════════════════════════════════════════════════════════════════════════
const SC_KEY = process.env.SOCIAL_MEDIA_SCRAPING_API || '';
const SC_BASE = 'https://api.scrapecreators.com';
const SC_MAX_REQUETES = parseInt(process.env.SC_MAX_REQUETES || '16', 10);
const BALAYAGE_VALIDITE_JOURS = parseInt(process.env.BALAYAGE_VALIDITE_JOURS || '30', 10);

async function scGet(chemin, params, compteur, timeoutMs = 25000) {
  if (!SC_KEY) throw new Error('clé SOCIAL_MEDIA_SCRAPING_API absente sur Render');
  if (compteur.n >= SC_MAX_REQUETES) throw new Error('plafond de ' + SC_MAX_REQUETES + ' requêtes atteint');
  compteur.n++;
  const qs = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, String(v)); });
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(SC_BASE + chemin + '?' + qs.toString(), { headers: { 'x-api-key': SC_KEY }, signal: ctl.signal });
    const txt = await r.text();
    let j = null; try { j = JSON.parse(txt); } catch (e) { /* réponse non JSON */ }
    if (!r.ok) throw new Error('HTTP ' + r.status + (j && (j.message || j.error) ? ' ' + (j.message || j.error) : ''));
    compteur.credits += (j && typeof j.credits_charged === 'number') ? j.credits_charged : 1;
    return j || {};
  } finally { clearTimeout(t); }
}

function _coupe(s, n) { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '…' : s; }

// Plan de balayage : tout part du PROBLÈME que le produit résout, jamais du nom de la marque.
async function planBalayage(brief, produit, marque, pays) {
  const repli = { probleme: produit, formulations: [produit], categorie: produit, alternatives: [], concurrents: [],
                  reddit: [produit], tiktok: [produit], ads: [produit], source: 'repli' };
  try {
    const token = await getToken();
    const briefTxt = JSON.stringify(brief || {}).slice(0, 3000);
    const prompt = `Tu prépares la recherche de marché pour un produit vendu en ${pays || 'Afrique francophone'}.
Produit : "${produit}"${marque ? ` (marque du client : ${marque}, probablement inconnue du marché)` : ''}.
Brief (extrait) : ${briefTxt}

Règle de fond : la recherche PART DU PROBLÈME que la cible veut résoudre, pas de la marque. Les gens ne parlent pas de la marque du client : ils parlent de leur problème et des solutions qu'ils connaissent.

Réponds UNIQUEMENT par un objet JSON, sans texte autour, avec ces clés :
{
 "probleme": "le problème principal vécu par la cible, en une phrase courte et concrète",
 "formulations": ["3 façons dont les gens en parlent vraiment, dans leurs mots, dans la langue du marché"],
 "categorie": "catégorie du produit en 2-4 mots",
 "alternatives": ["jusqu'à 5 solutions ALTERNATIVES que la cible utilise ou envisage pour le même problème (produits d'autres catégories compris)"],
 "concurrents": ["jusqu'à 3 produits directement concurrents (même catégorie)"],
 "reddit": ["3 requêtes courtes centrées sur le problème, en français ou en anglais selon où la cible en parle"],
 "tiktok": ["2 requêtes courtes centrées sur le problème, dans la langue de la cible"],
 "ads": ["3 mots-clés pour la bibliothèque de pubs : le problème, une alternative, un concurrent direct"]
}`;
    const body = { contents: [{ role: 'user', parts: [{ text: prompt }] }],
                   generationConfig: { temperature: 0.2, maxOutputTokens: 1800, ...reflexion(MODELES.tendances, 0) } };
    const d = await vertexRequest(token, MODELES.tendances, body, 40000, 'analyste_plan_balayage');
    const raw = (d.candidates?.[0]?.content?.parts || []).filter(p => !p.thought).map(p => p.text).filter(Boolean).join('');
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('réponse sans JSON');
    const j = JSON.parse(m[0]);
    const arr = (x, n) => (Array.isArray(x) ? x : []).map(v => _coupe(v, 90)).filter(Boolean).slice(0, n);
    const plan = {
      probleme: _coupe(j.probleme || produit, 200),
      formulations: arr(j.formulations, 3),
      categorie: _coupe(j.categorie || produit, 60),
      alternatives: arr(j.alternatives, 5),
      concurrents: arr(j.concurrents, 3),
      reddit: arr(j.reddit, 3),
      tiktok: arr(j.tiktok, 2),
      ads: arr(j.ads, 3),
      source: 'gemini'
    };
    if (!plan.reddit.length) plan.reddit = [plan.probleme];
    if (!plan.tiktok.length) plan.tiktok = [plan.probleme];
    if (!plan.ads.length) plan.ads = [plan.categorie];
    return plan;
  } catch (e) {
    console.log('   ✗ plan de balayage échoué, repli sur le nom du produit :', e.message);
    return repli;
  }
}

// Texte injecté en tête du prompt de recherche Google : force le point de départ « problème ».
function blocProblemePourRecherche(plan) {
  if (!plan) return '';
  return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
POINT DE DÉPART DE LA RECHERCHE : LE PROBLÈME, PAS LA MARQUE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Problème de la cible : ${plan.probleme}
Façons dont les gens en parlent : ${plan.formulations.join(' | ') || 'n/a'}
Catégorie : ${plan.categorie}
Alternatives que la cible connaît déjà : ${plan.alternatives.join(', ') || 'n/a'}
Concurrents directs : ${plan.concurrents.join(', ') || 'n/a'}
→ Cherche d'abord ce que les gens disent de CE PROBLÈME et de ces ALTERNATIVES (avis, échecs, scepticisme, ce qu'ils ont déjà essayé). La marque du client est probablement inconnue : ne gaspille pas tes requêtes dessus.
→ Les discussions qui parlent d'un produit précis restent acceptables quand elles décrivent le problème.

`;
}

// Balayage ScrapeCreators : voix du marché au niveau du PROBLÈME + pubs natives des alternatives/concurrents.
async function balayageScrapeCreators(plan, pays, compteur) {
  const stats = { reddit: 0, tiktok_videos: 0, tiktok_commentaires: 0, pubs: 0, erreurs: [] };
  const sections = { reddit: '', tiktok: '', pubs: '' };
  const geo = PAYS_TO_GEO[pays] || '';

  const tacheReddit = async () => {
    const lignes = [];
    for (const q of plan.reddit.slice(0, 3)) {
      try {
        const j = await scGet('/v1/reddit/search', { query: q, filter: 'posts', sort: 'relevance', timeframe: 'all', trim: 'true' }, compteur);
        const posts = (j.posts || []).slice(0, 5);
        posts.forEach(p => {
          stats.reddit++;
          lignes.push(`- [${p.subreddit_name_prefixed || ('r/' + (p.subreddit || '?'))}] "${_coupe(p.title, 160)}"${p.selftext ? ' — ' + _coupe(p.selftext, 380) : ''} (score ${p.score ?? '?'}, ${p.num_comments ?? '?'} commentaires) ${p.url || ''}`);
        });
      } catch (e) { stats.erreurs.push('reddit « ' + q + ' » : ' + e.message); }
    }
    try {
      const qC = plan.formulations[0] || plan.probleme;
      const j = await scGet('/v1/reddit/search', { query: qC, filter: 'comments', sort: 'top', trim: 'true' }, compteur);
      const liste = (j.comments || j.posts || []).slice(0, 8);
      liste.forEach(c => {
        const t = c.body || c.selftext || c.text || c.comment || '';
        if (String(t).length < 25) return;
        stats.reddit++;
        lignes.push(`- [commentaire ${c.subreddit_name_prefixed || ''}] "${_coupe(t, 380)}" (score ${c.score ?? '?'}) ${c.url || c.permalink || ''}`);
      });
    } catch (e) { stats.erreurs.push('reddit commentaires : ' + e.message); }
    if (lignes.length) sections.reddit = `### SOURCE — SCRAPECREATORS · REDDIT (discussions sur le PROBLÈME : « ${plan.probleme} »)\n` + lignes.join('\n') + '\n\n';
  };

  const tacheTikTok = async () => {
    const videos = [];
    for (const q of plan.tiktok.slice(0, 2)) {
      try {
        const j = await scGet('/v1/tiktok/search/keyword', { query: q }, compteur);
        const items = (j.search_item_list || []).map(x => x.aweme_info).filter(Boolean);
        items.sort((a, b) => ((b.statistics?.comment_count) || 0) - ((a.statistics?.comment_count) || 0));
        items.slice(0, 2).forEach(a => videos.push({ q, a }));
      } catch (e) { stats.erreurs.push('tiktok « ' + q + ' » : ' + e.message); }
    }
    const lignes = [];
    let nbCom = 0;
    for (const { a } of videos.slice(0, 4)) {
      stats.tiktok_videos++;
      const pseudo = a.author?.unique_id || '';
      const url = a.share_url || (pseudo && a.aweme_id ? `https://www.tiktok.com/@${pseudo}/video/${a.aweme_id}` : '');
      lignes.push(`- VIDÉO « ${_coupe(a.desc, 220)} » (${a.statistics?.play_count ?? '?'} vues, ${a.statistics?.comment_count ?? '?'} commentaires) ${url}`);
      if (!url) continue;
      try {
        const j = await scGet('/v1/tiktok/video/comments', { url, trim: 'true' }, compteur);
        const coms = (j.comments || []).filter(c => String(c.text || '').length >= 15)
          .sort((x, y) => (y.digg_count || 0) - (x.digg_count || 0)).slice(0, 8);
        coms.forEach(c => { nbCom++; lignes.push(`    · commentaire : "${_coupe(c.text, 300)}" (${c.digg_count ?? 0} likes)`); });
      } catch (e) { stats.erreurs.push('tiktok commentaires : ' + e.message); }
    }
    stats.tiktok_commentaires = nbCom;
    if (lignes.length) sections.tiktok = `### SOURCE — SCRAPECREATORS · TIKTOK (vidéos et commentaires sur le problème)\n` + lignes.join('\n') + '\n\n';
  };

  const tachePubs = async () => {
    const lignes = [];
    const vus = new Set();
    for (const q of plan.ads.slice(0, 3)) {
      try {
        let j = await scGet('/v1/facebook/adLibrary/search/ads', { query: q, country: geo || 'ALL', status: 'ACTIVE', sort_by: 'total_impressions', media_type: 'ALL' }, compteur);
        let res = j.searchResults || [];
        if (!res.length && geo) {
          j = await scGet('/v1/facebook/adLibrary/search/ads', { query: q, country: 'ALL', language: 'FR', status: 'ACTIVE', sort_by: 'total_impressions', media_type: 'ALL' }, compteur);
          res = j.searchResults || [];
        }
        res.slice(0, 6).forEach(ad => {
          const cle = ad.collation_id || ad.ad_archive_id;
          if (cle && vus.has(cle)) return;
          if (cle) vus.add(cle);
          const s = ad.snapshot || {};
          const corps = (s.body && (s.body.text || s.body)) || s.link_description || '';
          if (!corps && !s.title) return;
          const jours = ad.start_date ? Math.max(0, Math.round((Date.now() / 1000 - ad.start_date) / 86400)) : null;
          stats.pubs++;
          lignes.push(`- [${ad.page_name || '?'}] (recherche « ${q} »${jours !== null ? ', diffusée depuis ' + jours + ' j' : ''}${ad.collation_count > 1 ? ', ' + ad.collation_count + ' variantes' : ''}) ${s.title ? 'TITRE « ' + _coupe(s.title, 120) + ' » — ' : ''}« ${_coupe(typeof corps === 'string' ? corps : JSON.stringify(corps), 420)} »${s.cta_text ? ' [CTA : ' + s.cta_text + ']' : ''}`);
        });
      } catch (e) { stats.erreurs.push('pubs « ' + q + ' » : ' + e.message); }
    }
    if (lignes.length) sections.pubs = `### SOURCE — SCRAPECREATORS · BIBLIOTHÈQUE DE PUBS META (pubs actives des alternatives et concurrents, classées par impressions — les plus longtemps diffusées sont les plus rentables)\n` + lignes.join('\n') + '\n\n';
  };

  await Promise.all([tacheReddit(), tacheTikTok(), tachePubs()]);
  const texte = [sections.reddit, sections.tiktok, sections.pubs].map(s => s.slice(0, 7000)).join('');
  return { texte, stats };
}

// ── Hypothèse stockée : faut-il refaire un balayage ? ──
function _nbAnglesReserve(syntheseTxt) {
  const m = String(syntheseTxt || '').match(/STOCK\s*:\s*(\d+)\s+angles?\s+construits?\s+au\s+total\s*,\s*(\d+)\s+partis?\s+dans\s+ce\s+lot\s*,\s*(\d+)\s+restants?\s+en\s+r[ée]serve/i);
  return m ? parseInt(m[3], 10) : null;
}

async function _memeCible(cibleBrief, cibleStockee) {
  try {
    const token = await getToken();
    const body = { contents: [{ role: 'user', parts: [{ text: `Deux descriptions de cible marketing. Désignent-elles la même cible (même type de personne, même âge approximatif, même situation), même reformulée autrement ?\nA : ${cibleBrief}\nB : ${cibleStockee}\nRéponds uniquement : {"meme": true} ou {"meme": false}` }] }],
                   generationConfig: { temperature: 0, maxOutputTokens: 40, ...reflexion(MODELES.tendances, 0) } };
    const d = await vertexRequest(token, MODELES.tendances, body, 20000, 'analyste_meme_cible');
    const raw = (d.candidates?.[0]?.content?.parts || []).filter(p => !p.thought).map(p => p.text).join('');
    return /"meme"\s*:\s*true/i.test(raw);
  } catch (e) { return false; }
}

async function decideBalayage({ productId, isTest, nbAngles, brief, forcer }) {
  if (forcer) return { reutiliser: false, raison: 'balayage forcé' };
  if (isTest) return { reutiliser: false, raison: 'interface de test : balayage toujours refait' };
  if (!productId) return { reutiliser: false, raison: 'produit sans identifiant' };
  const H = { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` };
  const rp = await fetch(`${SUPABASE_URL_INT}/rest/v1/products?id=eq.${encodeURIComponent(productId)}&select=derniere_synthese,marche,deliveries`, { headers: H });
  const prod = (await rp.json())?.[0];
  if (!prod || !prod.derniere_synthese) return { reutiliser: false, raison: 'première commande sur ce produit' };
  const rb = await fetch(`${SUPABASE_URL_INT}/rest/v1/balayages_marche?product_id=eq.${encodeURIComponent(productId)}&select=balayage_at`, { headers: H });
  const lig = rb.ok ? (await rb.json())?.[0] : null;
  if (!lig || !lig.balayage_at) return { reutiliser: false, raison: 'date du dernier balayage inconnue (une seule fois, elle sera enregistrée)' };
  const age = (Date.now() - new Date(lig.balayage_at).getTime()) / 86400000;
  if (age > BALAYAGE_VALIDITE_JOURS) return { reutiliser: false, raison: `dernier balayage il y a ${Math.round(age)} jours (limite ${BALAYAGE_VALIDITE_JOURS})` };
  const reserve = _nbAnglesReserve(prod.derniere_synthese);
  if (reserve === null) return { reutiliser: false, raison: 'ligne « STOCK » illisible dans l\'hypothèse stockée' };
  if (reserve < (nbAngles || 1)) return { reutiliser: false, raison: `${reserve} angle(s) en réserve pour ${nbAngles || 1} demandé(s)` };
  const cibleBrief = String((brief && brief.cible) || '').trim();
  if (cibleBrief) {
    const p = prod.marche && prod.marche.persona;
    const derniere = (prod.deliveries || []).slice(-1)[0];
    const stockee = p ? [p.nom, p.role, p.age ? p.age + ' ans' : null, p.ville].filter(Boolean).join(', ') : (derniere && derniere.cible) || '';
    if (!stockee || !(await _memeCible(cibleBrief, stockee))) return { reutiliser: false, raison: 'le client impose une cible différente de celle de l\'hypothèse stockée' };
  }
  return { reutiliser: true, raison: `balayage du ${String(lig.balayage_at).slice(0, 10)} (${Math.round(age)} j), ${reserve} angle(s) en réserve`, reserve, age: Math.round(age) };
}

async function enregistrerBalayage(productId, infos) {
  try {
    const r = await fetch(`${SUPABASE_URL_INT}/rest/v1/balayages_marche?on_conflict=product_id`, {
      method: 'POST',
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ product_id: productId, balayage_at: new Date().toISOString(), requetes_sc: infos.requetes || 0, credits_sc: infos.credits || 0, plan: infos.plan || null })
    });
    if (!r.ok) console.log('   ⚠ date du balayage non enregistrée (HTTP ' + r.status + ') — table balayages_marche créée ?');
    else console.log('   ✓ date du balayage enregistrée pour ce produit');
  } catch (e) { console.log('   ⚠ date du balayage non enregistrée :', e.message); }
}

// ── HTTPS GET → JSON ────────────────────────────
function httpsGetJson(targetUrl) {
  return new Promise((resolve, reject) => {
    https.get(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch(e) { reject(new Error('JSON invalide: ' + d.slice(0,200))); }
      });
    }).on('error', reject);
  });
}

// ── HTTPS GET → HTML brut (pour parsing regex, ex. Jumia) ──
function fetchRawHtml(targetUrl, depth) {
  depth = depth || 0;
  return new Promise((resolve, reject) => {
    const urlObj = new URL(targetUrl);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + (urlObj.search || ''),
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9'
      },
      timeout: 15000
    };
    const r = https.request(options, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && depth < 3) {
        const redir = new URL(res.headers.location, targetUrl).href;
        res.resume(); // drain
        fetchRawHtml(redir, depth + 1).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', c => { data += c; if (data.length > 1_500_000) res.destroy(); });
      res.on('end', () => resolve(data));
      res.on('error', reject);
    });
    r.on('error', reject);
    r.on('timeout', () => { r.destroy(); reject(new Error('Timeout')); });
    r.end();
  });
}

// ── Teaser SVG (miniature OG style mindmap) ────────
// ── Miniatures de marque AdStack (principale + 2 variantes J+10/J+21) ──
// Générées une seule fois via /setup-thumbnails, puis servies statiquement depuis Supabase.
function buildAdStackThumb({ accent, accentGlow, label }) {
  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="1" fill="rgba(255,255,255,0.10)"/>
    </pattern>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${accentGlow}" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="${accentGlow}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#0D1828"/>
  <rect width="1200" height="630" fill="url(#dots)"/>
  <circle cx="600" cy="315" r="420" fill="url(#glow)"/>
  <rect x="790" y="90"  width="230" height="290" rx="16" fill="#16222F" stroke="#233247" stroke-width="1.5" opacity="0.9"/>
  <rect x="815" y="115" width="180" height="130" rx="10" fill="#1D2F45"/>
  <rect x="815" y="260" width="140" height="10" rx="5" fill="#2C4060"/>
  <rect x="815" y="280" width="180" height="8"  rx="4" fill="#233247"/>
  <rect x="815" y="296" width="120" height="8"  rx="4" fill="#233247"/>
  <rect x="815" y="325" width="180" height="34" rx="8" fill="${accent}" opacity="0.9"/>
  <rect x="1050" y="150" width="120" height="150" rx="14" fill="#16222F" stroke="#233247" stroke-width="1.5" opacity="0.55" transform="rotate(8 1110 225)"/>
  <text x="80" y="270" fill="#FFFFFF" font-size="90" font-weight="900" font-family="Arial,sans-serif" letter-spacing="-2">AdStack</text>
  <rect x="82" y="292" width="230" height="6" rx="3" fill="${accent}"/>
  <text x="80" y="345" fill="#B0C4D8" font-size="27" font-weight="600" font-family="Arial,sans-serif">Images publicitaires Meta Ads,</text>
  <text x="80" y="382" fill="#B0C4D8" font-size="27" font-weight="600" font-family="Arial,sans-serif">basées sur une vraie analyse de marché.</text>
  <text x="80" y="450" fill="${accent}" font-size="20" font-weight="800" letter-spacing="2" font-family="Arial,sans-serif">${label}</text>
  <text x="80" y="580" fill="#5A7290" font-size="19" font-weight="700" letter-spacing="1" font-family="Arial,sans-serif">ADSTACKOFFICIAL.COM</text>
</svg>`;
}

const THUMBS_ADSTACK = [
  { nom: 'adstack_thumb_main', accent: '#1FB6FF', accentGlow: '#1FB6FF', label: 'AGENCE DE CRÉATIVES PUBLICITAIRES' },
  { nom: 'adstack_thumb_j10',  accent: '#32FF7E', accentGlow: '#32FF7E', label: 'VOS PROCHAINES IMAGES VOUS ATTENDENT' },
  { nom: 'adstack_thumb_j21',  accent: '#FFB547', accentGlow: '#FFB547', label: 'DERNIÈRE RELANCE — POTENTIEL À EXPLOITER' },
];

function buildTeaserSvg({ marque, score }) {
  const escXml = (s) => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');

  const s = Math.max(0, Math.min(100, Number(score) || 75));
  const tier = s >= 85 ? 'Exceptionnel' : s >= 75 ? 'Très élevé' : s >= 65 ? 'Élevé' : 'Modéré';

  const cx = 320, cy = 315, r = 145, sw = 26;
  const circumference = 2 * Math.PI * r;
  const dash = (s/100) * circumference;
  const gap = circumference - dash;

  const ghostCards = [
    { x: 660, y: 60,  w: 230, h: 100 },
    { x: 930, y: 195, w: 230, h: 110 },
    { x: 660, y: 330, w: 230, h: 100 },
    { x: 930, y: 460, w: 230, h: 110 },
  ];

  const connectors = ghostCards.map(c =>
    `<line x1="${cx + r + 10}" y1="${cy}" x2="${c.x}" y2="${c.y + c.h/2}" stroke="#2C4060" stroke-width="2" opacity="0.55"/>`
  ).join('\n      ');

  const ghosts = ghostCards.map(c =>
    `<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" rx="13" fill="#1D2F45" stroke="#2C4060" stroke-width="1.5" opacity="0.55"/>
      <rect x="${c.x+18}" y="${c.y+18}" width="60" height="8" rx="4" fill="#2C4060" opacity="0.8"/>
      <rect x="${c.x+18}" y="${c.y+36}" width="${c.w-36}" height="6" rx="3" fill="#2C4060" opacity="0.6"/>
      <rect x="${c.x+18}" y="${c.y+50}" width="${c.w-70}" height="6" rx="3" fill="#2C4060" opacity="0.6"/>`
  ).join('\n      ');

  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="1" fill="rgba(255,255,255,0.12)"/>
    </pattern>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#1FB6FF" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#1FB6FF" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="1200" height="630" fill="#0D1828"/>
  <rect width="1200" height="630" fill="url(#dots)"/>

  ${connectors}

  ${ghosts}

  <circle cx="${cx}" cy="${cy}" r="${r+50}" fill="url(#glow)"/>

  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#16222F" stroke-width="${sw}"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#1FB6FF" stroke-width="${sw}"
    stroke-dasharray="${dash.toFixed(1)} ${gap.toFixed(1)}" stroke-linecap="round"
    transform="rotate(-90 ${cx} ${cy})"/>

  <text x="${cx}" y="${cy - 8}" text-anchor="middle" fill="#FFFFFF" font-size="92" font-weight="900" font-family="Arial,sans-serif">${s}</text>
  <text x="${cx}" y="${cy + 38}" text-anchor="middle" fill="#6A84A0" font-size="22" font-weight="700" font-family="Arial,sans-serif">/100</text>

  <text x="${cx}" y="${cy + r + 50}" text-anchor="middle" fill="#6A84A0" font-size="18" font-weight="700" letter-spacing="3" font-family="Arial,sans-serif">POTENTIEL</text>
  <text x="${cx}" y="${cy + r + 82}" text-anchor="middle" fill="#1FB6FF" font-size="26" font-weight="900" font-family="Arial,sans-serif">${escXml(tier)}</text>

  <text x="60" y="60" fill="#B0C4D8" font-size="20" font-weight="800" letter-spacing="2" font-family="Arial,sans-serif">${escXml((marque||'').toUpperCase())}</text>

  <text x="1140" y="600" text-anchor="end" fill="#6A84A0" font-size="16" font-weight="700" letter-spacing="2" font-family="Arial,sans-serif">ADSTACK</text>
</svg>`;
}

// ── URL Page Fetcher ────────────────────────────
// ── v5.49 — Aides pour le remplissage automatique de la fiche produit ─────────────────────────────
// Couleurs candidates de la marque, lues dans le HTML brut : meta theme-color, variables CSS « primaire / accent /
// bouton », puis couleurs les plus fréquentes — en écartant blancs, noirs et gris. Gemini choisit ENSUITE parmi cette
// liste seulement (jamais de couleur inventée).
function extraireCandidatsCouleurs(html) {
  try {
    const norm = (h) => { h = String(h || '').replace('#', '').trim().toLowerCase(); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return /^[0-9a-f]{6}$/.test(h) ? '#' + h : null; };
    const neutre = (hex) => { const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16); const lum = 0.299 * r + 0.587 * g + 0.114 * b; return (Math.max(r, g, b) - Math.min(r, g, b)) < 22 || lum > 242 || lum < 14; };
    const prio = [];
    [/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i, /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']theme-color["']/i, /<meta[^>]+name=["']msapplication-TileColor["'][^>]+content=["']([^"']+)["']/i]
      .forEach(re => { const m = html.match(re); if (m) { const h = norm(m[1]); if (h && !neutre(h)) prio.push(h); } });
    const css = (html.match(/<style[\s\S]*?<\/style>/gi) || []).join(' ') + ' ' + (html.match(/style=["'][^"']*["']/gi) || []).join(' ');
    let m;
    const reVar = /--[\w-]*(?:primary|accent|brand|button|btn|main)[\w-]*\s*:\s*(#[0-9a-fA-F]{3,6})\b/gi;
    while ((m = reVar.exec(css))) { const h = norm(m[1]); if (h && !neutre(h)) prio.push(h); }
    const compte = {};
    const reHex = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
    while ((m = reHex.exec(css))) { const h = norm(m[1]); if (h && !neutre(h)) compte[h] = (compte[h] || 0) + 1; }
    const freq = Object.entries(compte).sort((a, b) => b[1] - a[1]).slice(0, 8).map(x => x[0]);
    return [...new Set([...prio, ...freq])].slice(0, 10);
  } catch (e) { return []; }
}

// Télécharge une image candidate pour que Gemini la REGARDE (tri : produit / emballage / autre produit / inutile).
// Jamais bloquant : renvoie null au moindre souci (délai, taille > 1,5 Mo, format non pris en charge, adresse locale).
function telechargerImagePourTri(urlStr, profondeur) {
  profondeur = profondeur || 0;
  return new Promise((resolve) => {
    let fini = false, req = null, tm = null;
    const fin = (v) => { if (fini) return; fini = true; if (tm) clearTimeout(tm); resolve(v); };
    tm = setTimeout(() => { try { if (req) req.destroy(); } catch (e) {} fin(null); }, 7000);
    try {
      const u = new URL(urlStr);
      if (!/^https?:$/.test(u.protocol) || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/i.test(u.hostname)) return fin(null);
      if (/cdn\.shopify\.com|\/cdn\/shop\//i.test(u.href) && !u.searchParams.get('width')) u.searchParams.set('width', '640');
      const lib = u.protocol === 'https:' ? https : http;
      req = lib.get({
        hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80), path: u.pathname + u.search,
        headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', 'Accept': 'image/jpeg,image/png,image/webp,*/*;q=0.5' },
        timeout: 6000
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && profondeur < 2) {
          res.resume();
          telechargerImagePourTri(new URL(res.headers.location, u).href, profondeur + 1).then(fin);
          return;
        }
        if (res.statusCode !== 200) { res.resume(); return fin(null); }
        let ct = String(res.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
        if (ct === 'application/octet-stream' || !ct) { const ext = (u.pathname.match(/\.(jpe?g|png|webp)$/i) || [])[1]; ct = ext ? 'image/' + ext.toLowerCase().replace('jpg', 'jpeg') : ''; }
        if (ct === 'image/jpg') ct = 'image/jpeg';
        if (!/^image\/(jpeg|png|webp)$/.test(ct)) { res.resume(); return fin(null); }
        const chunks = []; let taille = 0;
        res.on('data', (c) => { taille += c.length; if (taille > 1500000) { res.destroy(); return fin(null); } chunks.push(c); });
        res.on('end', () => fin({ mimeType: ct, data: Buffer.concat(chunks).toString('base64') }));
        res.on('error', () => fin(null));
      });
      req.on('error', () => fin(null));
      req.on('timeout', () => { try { req.destroy(); } catch (e) {} fin(null); });
    } catch (e) { fin(null); }
  });
}


// ── Marchés : langue, apparence des personnages, devise ─────────────────────────────────
// Sert à décider si plusieurs pays peuvent être produits dans UNE seule demande. Deux pays sont compatibles
// s'ils partagent la même langue ET la même apparence des personnages montrés dans les créatives. La devise ne
// bloque rien : si le prix diffère d'un pays à l'autre, les créatives n'affichent simplement pas de prix.
// Un pays absent de cette table n'est jamais bloqué (il suit le groupe principal). Cameroun (bilingue) et
// Mauritanie (apparences très variées) sont volontairement « à part ».
// NB : cette table existe aussi côté serveur (server) — toute modification se fait aux deux endroits.
const MARCHES_LANGUES = { fr:'français', en:'anglais', ar_fr:'arabe / français', mg:'malgache / français', pt:'portugais' };
const MARCHES_APPARENCES = { afrique_noire:'Afrique subsaharienne', maghreb:'Maghreb', europe:'Europe', ocean_indien:'océan Indien' };
const MARCHES_INFOS = {
  'senegal':{n:'Sénégal',l:'fr',a:'afrique_noire',d:'XOF'}, 'mali':{n:'Mali',l:'fr',a:'afrique_noire',d:'XOF'},
  'cote d ivoire':{n:"Côte d'Ivoire",l:'fr',a:'afrique_noire',d:'XOF'}, 'burkina faso':{n:'Burkina Faso',l:'fr',a:'afrique_noire',d:'XOF'},
  'benin':{n:'Bénin',l:'fr',a:'afrique_noire',d:'XOF'}, 'togo':{n:'Togo',l:'fr',a:'afrique_noire',d:'XOF'},
  'niger':{n:'Niger',l:'fr',a:'afrique_noire',d:'XOF'}, 'guinee':{n:'Guinée',l:'fr',a:'afrique_noire',d:'GNF'},
  'gabon':{n:'Gabon',l:'fr',a:'afrique_noire',d:'XAF'}, 'congo':{n:'Congo',l:'fr',a:'afrique_noire',d:'XAF'},
  'tchad':{n:'Tchad',l:'fr',a:'afrique_noire',d:'XAF'}, 'rdc':{n:'RDC',l:'fr',a:'afrique_noire',d:'CDF'},
  'burundi':{n:'Burundi',l:'fr',a:'afrique_noire',d:'BIF'}, 'rwanda':{n:'Rwanda',l:'fr',a:'afrique_noire',d:'RWF'},
  'nigeria':{n:'Nigeria',l:'en',a:'afrique_noire',d:'NGN'}, 'ghana':{n:'Ghana',l:'en',a:'afrique_noire',d:'GHS'},
  'kenya':{n:'Kenya',l:'en',a:'afrique_noire',d:'KES'}, 'tanzanie':{n:'Tanzanie',l:'en',a:'afrique_noire',d:'TZS'},
  'ouganda':{n:'Ouganda',l:'en',a:'afrique_noire',d:'UGX'}, 'zambie':{n:'Zambie',l:'en',a:'afrique_noire',d:'ZMW'},
  'afrique du sud':{n:'Afrique du Sud',l:'en',a:'afrique_noire',d:'ZAR'},
  'maroc':{n:'Maroc',l:'ar_fr',a:'maghreb',d:'MAD'}, 'algerie':{n:'Algérie',l:'ar_fr',a:'maghreb',d:'DZD'}, 'tunisie':{n:'Tunisie',l:'ar_fr',a:'maghreb',d:'TND'},
  'madagascar':{n:'Madagascar',l:'mg',a:'ocean_indien',d:'MGA'},
  'france':{n:'France',l:'fr',a:'europe',d:'EUR'}, 'belgique':{n:'Belgique',l:'fr',a:'europe',d:'EUR'},
  'cameroun':{n:'Cameroun',mixte:'marché bilingue (français et anglais)',d:'XAF'},
  'mauritanie':{n:'Mauritanie',mixte:'apparence des personnes très variée',d:'MRU'},
};
const MARCHES_ALIAS = { 'senegal':'senegal','sn':'senegal','cote divoire':'cote d ivoire','ci':'cote d ivoire','ivory coast':'cote d ivoire','cotedivoire':'cote d ivoire','burkina':'burkina faso','bf':'burkina faso','guinee conakry':'guinee','guinea':'guinee','congo brazzaville':'congo','republique du congo':'congo','congo kinshasa':'rdc','republique democratique du congo':'rdc','drc':'rdc','cameroon':'cameroun','mauritania':'mauritanie','morocco':'maroc','algeria':'algerie','tunisia':'tunisie','tanzania':'tanzanie','uganda':'ouganda','zambia':'zambie','south africa':'afrique du sud','togo':'togo','benin':'benin','mali':'mali','niger':'niger','ml':'mali','tg':'togo','bj':'benin','ng':'nigeria','gh':'ghana','ke':'kenya','cm':'cameroun','ga':'gabon','ma':'maroc','dz':'algerie','tn':'tunisie','mg':'madagascar','fr':'france','be':'belgique' };
const _cleMarche = (s) => { const k = String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); return MARCHES_INFOS[k] ? k : (MARCHES_ALIAS[k] || k); };
const infoMarche = (nom) => MARCHES_INFOS[_cleMarche(nom)] || null;
// Classe de compatibilité : deux marchés de même classe peuvent partager une demande.
const classeMarche = (nom) => { const i = infoMarche(nom); if (!i) return 'inconnu'; return i.mixte ? 'mixte:' + _cleMarche(nom) : i.l + '|' + i.a; };
// Raison (en français, pour le client) pour laquelle `nom` ne peut pas être produit avec `ref`.
const raisonIncompatibilite = (nom, ref) => {
  const a = infoMarche(nom), b = infoMarche(ref);
  if (!a || !b) return '';
  if (a.mixte) return a.mixte + ' : il faut une demande à part pour choisir la langue et l’apparence des personnages';
  if (b.mixte) return 'le marché ' + (b.n) + ' (' + b.mixte + ') doit être produit à part';
  const dl = a.l !== b.l, da = a.a !== b.a;
  if (dl && da) return 'langue et apparence des personnages différentes (' + MARCHES_LANGUES[a.l] + ', ' + MARCHES_APPARENCES[a.a] + ' — contre ' + MARCHES_LANGUES[b.l] + ', ' + MARCHES_APPARENCES[b.a] + ')';
  if (dl) return 'langue différente (' + MARCHES_LANGUES[a.l] + ' au lieu de ' + MARCHES_LANGUES[b.l] + ')';
  return 'apparence des personnages différente (' + MARCHES_APPARENCES[a.a] + ' au lieu de ' + MARCHES_APPARENCES[b.a] + ')';
};
// Sépare une liste de marchés en { retenus, ecartes:[{nom, raison}] }. Groupe principal = le plus nombreux
// (à égalité, celui du premier de la liste), ou celui du marché `prefere` s'il est fourni. Les marchés absents
// de la table suivent le groupe principal.
const analyserMarches = (liste, prefere) => {
  const noms = [...new Set((liste || []).map(x => String(x || '').trim()).filter(Boolean))];
  const classes = new Map();
  noms.forEach(n => { const c = classeMarche(n); if (c === 'inconnu') return; if (!classes.has(c)) classes.set(c, []); classes.get(c).push(n); });
  let principale = null;
  if (prefere && classeMarche(prefere) !== 'inconnu') principale = classeMarche(prefere);
  else { let max = 0; classes.forEach((v, k) => { if (v.length > max) { max = v.length; principale = k; } }); }
  const retenus = [], ecartes = [];
  const ref = principale ? (classes.get(principale) || [])[0] : null;
  noms.forEach(n => {
    const c = classeMarche(n);
    if (c === 'inconnu' || c === principale) retenus.push(n);
    else ecartes.push({ nom: n, raison: raisonIncompatibilite(n, ref) });
  });
  return { retenus, ecartes, reference: ref };
};
// Le prix peut figurer sur une créative seulement s'il est identique sur tous les marchés retenus.
// `prixParPays` : { pays: texte du prix } ; `prixGeneral` : prix de la fiche, utilisé pour les pays non précisés.
const _normPrix = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const prixAffichable = (retenus, prixParPays, prixGeneral) => {
  if (!retenus || retenus.length < 2) return true;
  const vus = new Set(retenus.map(m => _normPrix((prixParPays && prixParPays[m]) || prixGeneral)));
  return vus.size === 1;
};

// ───────── v5.60 — CAPTURES D'AVIS DU CLIENT, TRANSCRITES ─────────
// Le client peut fournir ses avis sous forme de captures d'écran. L'analyste ne voit pas les images : on les fait
// transcrire mot pour mot par Gemini Flash, puis le texte rejoint son entrée (comme les documents). Jamais bloquant.
async function transcrireCaptureAvis(url) {
  try {
    const buf = await telechargerBuffer(url, 8 * 1024 * 1024);
    if (!buf || !buf.length) return { url, statut: 'illisible', raison: 'téléchargement impossible' };
    const ext = (String(url).split('?')[0].split('.').pop() || '').toLowerCase();
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const token = await getToken();
    const body = {
      system_instruction: { parts: [{ text: "Tu es un outil de transcription. Tu recopies MOT POUR MOT les avis clients visibles sur la capture d'écran fournie, sans rien corriger, reformuler, résumer ni inventer. Pour chaque avis : le texte exact, suivi entre parenthèses du prénom et de la note SEULEMENT s'ils sont affichés. Un avis par ligne, séparés par une ligne vide. Si l'image ne contient aucun avis lisible, réponds uniquement : AUCUN AVIS LISIBLE." }] },
      contents: [{ role: 'user', parts: [{ inlineData: { mimeType: mime, data: buf.toString('base64') } }, { text: 'Transcris les avis de cette capture.' }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 8000, thinkingConfig: { thinkingBudget: 0 } }
    };
    const data = await vertexRequestAvecReessai(token, MODELES.documents, body, 90000, 'lecture_capture_avis');
    if (data.error) throw new Error(data.error.message || 'erreur Gemini');
    const t = (data.candidates?.[0]?.content?.parts || []).filter(p => !p.thought).map(p => p.text).filter(Boolean).join('').trim();
    if (!t || /^AUCUN AVIS LISIBLE/i.test(t)) return { url, statut: 'vide', raison: 'aucun avis lisible' };
    return { url, statut: 'ok', texte: t.slice(0, 6000) };
  } catch (err) {
    return { url, statut: 'illisible', raison: String(err && err.message || err).slice(0, 100) };
  }
}
async function blocCapturesAvis(captures) {
  const liste = (Array.isArray(captures) ? captures : []).filter(u => typeof u === 'string' && u).slice(0, 8);
  if (!liste.length) return '';
  const lus = await Promise.all(liste.map(transcrireCaptureAvis));
  const ok = lus.filter(x => x.statut === 'ok');
  console.log('   → captures d\'avis : ' + ok.length + '/' + lus.length + ' transcrites');
  if (!ok.length) return '';
  return '\n\n=== AVIS CLIENTS FOURNIS EN CAPTURES D\'ÉCRAN PAR LA MARQUE (transcrits mot pour mot — preuve fournie par la marque, jamais donnée de marché) ===\n' + ok.map((x, i) => '--- Capture ' + (i + 1) + ' ---\n' + x.texte).join('\n\n');
}

// ───────── v5.50 — DOCUMENTS DU CLIENT, LUS EN ENTIER ─────────
// Le client peut joindre un document écrit (PDF, Word, Markdown, texte, tableur, présentation). On le lit TEL QUEL,
// sans le résumer ni le raccourcir. Seuls les fichiers hébergés sur le stockage du projet sont acceptés.
function telechargerBuffer(urlStr, maxOctets, profondeur) {
  profondeur = profondeur || 0;
  return new Promise((resolve) => {
    let fini = false, req = null, tm = null;
    const fin = (v) => { if (fini) return; fini = true; if (tm) clearTimeout(tm); resolve(v); };
    tm = setTimeout(() => { try { if (req) req.destroy(); } catch (e) {} fin(null); }, 25000);
    try {
      const u = new URL(urlStr);
      const hoteOk = (() => { try { return u.hostname === new URL(SUPABASE_URL_INT).hostname; } catch (e) { return false; } })();
      if (u.protocol !== 'https:' || !hoteOk) return fin(null);
      req = https.get({ hostname: u.hostname, path: u.pathname + u.search, headers: { 'User-Agent': 'AdStack/1.0' }, timeout: 20000 }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && profondeur < 2) {
          res.resume(); telechargerBuffer(new URL(res.headers.location, u).href, maxOctets, profondeur + 1).then(fin); return;
        }
        if (res.statusCode !== 200) { res.resume(); return fin(null); }
        const chunks = []; let taille = 0;
        res.on('data', (c) => { taille += c.length; if (taille > maxOctets) { res.destroy(); return fin(null); } chunks.push(c); });
        res.on('end', () => fin(Buffer.concat(chunks)));
        res.on('error', () => fin(null));
      });
      req.on('error', () => fin(null));
      req.on('timeout', () => { try { req.destroy(); } catch (e) {} fin(null); });
    } catch (e) { fin(null); }
  });
}

// Lecture minimale d'une archive ZIP (docx, pptx, xlsx) : renvoie { 'chemin/dans/zip': Buffer } pour les fichiers voulus.
function lireZip(buf, veutFichier) {
  const sortie = {};
  let fin = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 70000); i--) { if (buf.readUInt32LE(i) === 0x06054b50) { fin = i; break; } }
  if (fin < 0) return sortie;
  const n = buf.readUInt16LE(fin + 10);
  let pos = buf.readUInt32LE(fin + 16);
  for (let k = 0; k < n; k++) {
    if (pos + 46 > buf.length || buf.readUInt32LE(pos) !== 0x02014b50) break;
    const methode = buf.readUInt16LE(pos + 10), tailleComp = buf.readUInt32LE(pos + 20);
    const lNom = buf.readUInt16LE(pos + 28), lExtra = buf.readUInt16LE(pos + 30), lCom = buf.readUInt16LE(pos + 32);
    const posLocal = buf.readUInt32LE(pos + 42);
    const nom = buf.slice(pos + 46, pos + 46 + lNom).toString('utf8');
    pos += 46 + lNom + lExtra + lCom;
    if (!veutFichier(nom)) continue;
    if (posLocal + 30 > buf.length) continue;
    const debut = posLocal + 30 + buf.readUInt16LE(posLocal + 26) + buf.readUInt16LE(posLocal + 28);
    const brut = buf.slice(debut, debut + tailleComp);
    try { sortie[nom] = methode === 0 ? brut : zlib.inflateRawSync(brut); } catch (e) {}
  }
  return sortie;
}
function xmlVersTexte(xml) {
  return String(xml)
    .replace(/<\/(w:p|a:p|row|si)>/g, '\n').replace(/<\/(w:tc|c)>/g, ' \t')
    .replace(/<w:br[^>]*\/>|<w:tab[^>]*\/>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&#x([0-9a-fA-F]+);/g, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Renvoie { name, texte, statut } : statut = 'ok' | 'illisible'. Ne lève jamais d'erreur.
async function lireDocumentClient(doc) {
  const name = String((doc && doc.name) || 'document');
  const MAX_TEXTE = 200000;
  try {
    const ext = (name.match(/\.([a-z0-9]+)$/i) || [])[1] || '';
    const e = ext.toLowerCase();
    const buf = await telechargerBuffer(doc.url, 12 * 1024 * 1024);
    if (!buf || !buf.length) return { name, texte: '', statut: 'illisible', raison: 'téléchargement impossible' };
    let texte = '';
    if (['md', 'txt', 'csv'].includes(e)) {
      texte = buf.toString('utf8');
    } else if (e === 'docx') {
      const f = lireZip(buf, n => n === 'word/document.xml');
      texte = f['word/document.xml'] ? xmlVersTexte(f['word/document.xml']) : '';
    } else if (e === 'pptx') {
      const f = lireZip(buf, n => /^ppt\/slides\/slide\d+\.xml$/.test(n));
      texte = Object.keys(f).sort((a, b) => parseInt(a.match(/(\d+)\.xml/)[1]) - parseInt(b.match(/(\d+)\.xml/)[1]))
        .map((n, i) => 'Diapositive ' + (i + 1) + ' :\n' + xmlVersTexte(f[n])).join('\n\n');
    } else if (e === 'xlsx') {
      const f = lireZip(buf, n => n === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
      const chaines = f['xl/sharedStrings.xml'] ? String(f['xl/sharedStrings.xml']).split(/<\/si>/).map(x => xmlVersTexte(x + '</si>').replace(/\n/g, ' ').trim()) : [];
      const feuilles = Object.keys(f).filter(n => n.startsWith('xl/worksheets/')).sort();
      texte = feuilles.map((n, i) => {
        const lignes = String(f[n]).split(/<\/row>/).map(r => {
          const cel = []; const re = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g; let m;
          while ((m = re.exec(r))) {
            const t = (m[1].match(/\bt="(\w+)"/) || [])[1]; const inner = m[2] || '';
            if (t === 'inlineStr') { cel.push(xmlVersTexte(inner).replace(/\n/g, ' ')); continue; }
            const v = (inner.match(/<v>([^<]*)<\/v>/) || [])[1];
            if (v === undefined) continue;
            cel.push(t === 's' ? (chaines[parseInt(v)] || '') : v);
          }
          return cel.join(' | ');
        }).filter(Boolean);
        return 'Feuille ' + (i + 1) + ' :\n' + lignes.join('\n');
      }).join('\n\n');
    } else if (e === 'pdf') {
      const token = await getToken();
      const body = {
        system_instruction: { parts: [{ text: 'Tu es un outil de transcription. Tu recopies le texte du document fourni, INTÉGRALEMENT et FIDÈLEMENT, dans l\'ordre de lecture. Tu ne résumes rien, ne raccourcis rien, ne commentes rien, n\'ajoutes rien. Les tableaux sont recopiés ligne par ligne. Si une image contient du texte lisible (étiquette, schéma légendé), recopie ce texte précédé de [image]. Réponds uniquement par la transcription.' }] },
        contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'application/pdf', data: buf.toString('base64') } }, { text: 'Transcris ce document en entier.' }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 60000, thinkingConfig: { thinkingBudget: 0 } }
      };
      const data = await vertexRequestAvecReessai(token, MODELES.documents, body, 150000, 'lecture_document_client');
      if (data.error) throw new Error(data.error.message || 'erreur Gemini');
      texte = (data.candidates?.[0]?.content?.parts || []).filter(p => !p.thought).map(p => p.text).filter(Boolean).join('');
    } else {
      return { name, texte: '', statut: 'illisible', raison: 'format ' + (e || 'inconnu') + ' non pris en charge' };
    }
    texte = String(texte || '').replace(/\u0000/g, '').trim();
    if (texte.length < 20) return { name, texte: '', statut: 'illisible', raison: 'aucun texte trouvé' };
    return { name, texte: texte.slice(0, MAX_TEXTE), statut: 'ok', tronque: texte.length > MAX_TEXTE };
  } catch (err) {
    return { name, texte: '', statut: 'illisible', raison: String(err && err.message || err).slice(0, 120) };
  }
}
async function blocDocumentsClient(docs) {
  const liste = (Array.isArray(docs) ? docs : []).filter(d => d && d.url).slice(0, 5);
  if (!liste.length) return '';
  const lus = await Promise.all(liste.map(lireDocumentClient));
  const parts = lus.map(d => d.statut === 'ok'
    ? '--- DOCUMENT « ' + d.name + ' » (texte intégral' + (d.tronque ? ', tronqué à 200 000 caractères' : '') + ') ---\n' + d.texte
    : '--- DOCUMENT « ' + d.name + ' » : NON LU (' + d.raison + ') — n\'en déduis rien ---');
  console.log('   → documents client : ' + lus.map(d => d.name + ' ' + d.statut).join(', '));
  return '\n\n=== DOCUMENTS FOURNIS PAR LE CLIENT (source fiable : ce que le client dit de son propre produit) ===\n' + parts.join('\n\n');
}


// ───────── v5.56 — NAVIGATEUR CÔTÉ SERVEUR (pages dont le contenu se charge en JavaScript) ─────────
// Beaucoup de pages (avis Okendo/Yotpo/Judge.me, FAQ, onglets, carrousels) n'existent pas dans le HTML brut : elles se construisent
// dans le navigateur. Ici un vrai Chromium charge la page, fait défiler, clique « voir plus », puis on lit ce qui est AFFICHÉ.
// Garde-fous : jamais bloquant (null au moindre souci), un seul navigateur à la fois, refusé si la mémoire libre est faible,
// images/vidéos/polices non téléchargées, fermeture forcée au bout du délai. Désactivable avec RENDU_NAVIGATEUR=off.
// Nécessite : npm install puppeteer-core@24.15.0 @sparticuz/chromium@138.0.2 (sans eux, la fonction est simplement ignorée).
const _rendu = { occupe: false };
function memoireLibreMo() {
  try {
    const fs = require('fs');
    let max, cur;
    try { max = fs.readFileSync('/sys/fs/cgroup/memory.max', 'utf8').trim(); cur = fs.readFileSync('/sys/fs/cgroup/memory.current', 'utf8').trim(); }
    catch (e) { max = fs.readFileSync('/sys/fs/cgroup/memory/memory.limit_in_bytes', 'utf8').trim(); cur = fs.readFileSync('/sys/fs/cgroup/memory/memory.usage_in_bytes', 'utf8').trim(); }
    if (max === 'max') return Infinity;
    const m = Number(max);
    if (!m || m > 1e13) return Infinity;
    return (m - Number(cur)) / 1048576;
  } catch (e) { return Infinity; }
}
async function fetchPageRendue(urlStr, opts) {
  opts = opts || {};
  const tempsMax = opts.tempsMax || 30000;
  if (process.env.RENDU_NAVIGATEUR === 'off') return null;
  let puppeteer = null, chromium = null;
  try { puppeteer = require('puppeteer-core'); } catch (e) { console.log('   [rendu] puppeteer-core non installé — navigateur ignoré'); return null; }
  try { chromium = require('@sparticuz/chromium'); } catch (e) { chromium = null; }
  if (_rendu.occupe) { console.log('   [rendu] un navigateur tourne déjà — ignoré pour cette page'); return null; }
  const libre = memoireLibreMo();
  if (libre < (opts.memoireMinMo || 400)) { console.log(`   [rendu] mémoire libre trop faible (${Math.round(libre)} Mo) — navigateur ignoré`); return null; }
  _rendu.occupe = true;
  let browser = null;
  const debut = Date.now();
  const tuer = async () => { try { if (browser) await browser.close(); } catch (e) { try { browser.process() && browser.process().kill('SIGKILL'); } catch (e2) {} } };
  const garde = setTimeout(tuer, tempsMax + 6000);
  const pause = (ms) => new Promise(r => setTimeout(r, ms));
  try {
    const u = new URL(urlStr);
    if (!/^https?:$/.test(u.protocol) || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/i.test(u.hostname) && !process.env.RENDU_AUTORISER_LOCAL) return null;
    const exe = process.env.CHROMIUM_EXECUTABLE || (chromium ? await chromium.executablePath() : null);
    if (!exe) return null;
    browser = await puppeteer.launch({
      args: chromium ? chromium.args : ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
      executablePath: exe, headless: chromium && !process.env.CHROMIUM_EXECUTABLE ? 'shell' : true,
      defaultViewport: { width: 1280, height: 900 },
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36');
    await page.setRequestInterception(true);
    page.on('request', (r) => { const t = r.resourceType(); if (t === 'image' || t === 'media' || t === 'font') r.abort().catch(() => {}); else r.continue().catch(() => {}); });
    await page.goto(urlStr, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await pause(2500);
    // défilement progressif : déclenche les blocs chargés au scroll (avis, FAQ, carrousels)
    await page.evaluate(() => new Promise((res) => {
      let y = 0;
      const t = setInterval(() => { window.scrollBy(0, 700); y += 700; if (y >= document.body.scrollHeight || y > 25000) { clearInterval(t); res(); } }, 250);
      setTimeout(() => { clearInterval(t); res(); }, 9000);
    })).catch(() => {});
    await pause(1500);
    // jusqu'à 3 clics sur « voir plus » (boutons seulement, jamais de lien qui quitterait la page)
    const clicsMax = opts.clics || 3;
    for (let i = 0; i < clicsMax && Date.now() - debut < tempsMax - 6000; i++) {
      const clique = await page.evaluate(() => {
        const re = /^(load more|show more|see more|view more|more reviews|read more reviews|voir plus|afficher plus|charger plus|plus d'avis)/i;
        const b = Array.from(document.querySelectorAll('button,[role="button"]')).find(x => re.test((x.innerText || '').trim()) && x.offsetParent);
        if (b) { b.click(); return true; }
        return false;
      }).catch(() => false);
      if (!clique) break;
      await pause(1500);
    }
    const maxAvis = opts.maxAvis || 40;
    const rendu = await page.evaluate((maxAvis) => {
      const net = (t) => (t || '').replace(/\s+/g, ' ').trim();
      const sel = '[class*="review" i],[id*="review" i],[class*="testimonial" i],[itemprop="review"],[data-review-id],[class*="avis" i]';
      const ok = (e) => { const n = net(e.innerText).length; return n >= 60 && n <= 1800; };
      const dansUnPlusGrand = (e) => { let p = e.parentElement; while (p) { if (p.matches(sel) && ok(p)) return true; p = p.parentElement; } return false; };
      // un conteneur qui regroupe plusieurs cartes identiques (même classe) est éclaté en cartes séparées
      const eclater = (e) => {
        const groupes = {};
        Array.from(e.querySelectorAll(sel)).filter(ok).forEach((x) => { const c = String(x.className || ''); if (c) (groupes[c] = groupes[c] || []).push(x); });
        const multiples = Object.values(groupes).filter(g => g.length >= 2).sort((a, b) => b.length - a.length)[0];
        return multiples || [e];
      };
      const vus = new Set(), avis = [];
      Array.from(document.querySelectorAll(sel)).forEach((e) => {
        if (!ok(e) || dansUnPlusGrand(e)) return;
        eclater(e).forEach((c) => { const t = net(c.innerText); if (!vus.has(t)) { vus.add(t); avis.push(t); } });
      });
      return { texte: (document.body.innerText || '').slice(0, 80000), avis: avis.slice(0, maxAvis), html: document.documentElement.outerHTML.slice(0, 1500000), url: location.href };
    }, maxAvis);
    console.log(`   [rendu] ✓ ${Math.round((Date.now() - debut) / 100) / 10} s · ${rendu.texte.length} car. affichés · ${rendu.avis.length} bloc(s) d'avis · ${Math.round(libre)} Mo libres au départ`);
    return { text: rendu.texte, avis: rendu.avis, html: rendu.html, urlFinale: rendu.url };
  } catch (e) {
    console.log(`   [rendu] ✗ ${e.message} — retour au HTML brut`);
    return null;
  } finally {
    clearTimeout(garde);
    await tuer();
    _rendu.occupe = false;
  }
}
// Budget de texte : tête + extraits autour des mots-clés utiles (garantie, livraison, avis, offres).
function budgeterTexte(t, tete, total) {
  t = String(t || '').replace(/\s{2,}/g, ' ').trim();
  if (t.length <= total) return t;
  const debut = t.slice(0, tete), reste = t.slice(tete);
  const re = /(guarant|garanti|money.?back|refund|rembours|return|retour|exchange|[ée]change|shipping|delivery|livraison|expedi|free\s|gratuit|satisf|review|avis|testimon|ingredient|ingr[ée]dient|faq|\bsave\b|bundle|offre|promo)/gi;
  const fen = []; let m, fin = -1, taille = 0;
  while ((m = re.exec(reste)) && taille < total - tete) {
    if (m.index < fin) continue;
    const d = Math.max(0, m.index - 150), f = Math.min(reste.length, m.index + 450);
    fen.push(reste.slice(d, f)); fin = f; taille += f - d;
  }
  return debut + ' … ' + fen.join(' … ');
}

// ───────── v5.52 — ENRICHISSEMENT DE LA FICHE AUTOMATIQUE ─────────
// Données lisibles dans le HTML brut mais perdues par le nettoyage texte : bandeau d'annonce (« Livraison gratuite dès… »),
// note moyenne et avis balisés (JSON-LD), description méta.
function extraireExtrasHtml(html, baseUrl) {
  const out = { avis: [], note: null, bandeau: '', description: '' };
  try {
    const dec = (t) => String(t || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
    const reScripts = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let m;
    while ((m = reScripts.exec(html))) {
      try {
        const bloc = JSON.parse(m[1].trim());
        const items = [];
        const pousser = (x) => { if (!x) return; if (Array.isArray(x)) return x.forEach(pousser); if (typeof x === 'object') { items.push(x); if (x['@graph']) pousser(x['@graph']); } };
        pousser(bloc);
        for (const it of items) {
          if (it.aggregateRating && !out.note) {
            const v = it.aggregateRating.ratingValue, n = it.aggregateRating.reviewCount || it.aggregateRating.ratingCount;
            if (v) out.note = { valeur: String(v), nombre: n ? String(n) : '' };
          }
          if (it.review) {
            for (const r of [].concat(it.review)) {
              const t = dec(r && (r.reviewBody || r.description));
              if (t.length >= 15 && t.length <= 500) {
                const a = r.author && (typeof r.author === 'string' ? r.author : r.author.name);
                out.avis.push(a ? `${t} (${String(a).split(' ')[0]})` : t);
              }
            }
          }
        }
      } catch (e) {}
    }
    const d = (html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']{20,500})["']/i) || [])[1];
    if (d) out.description = dec(d);
    const re = /<(?:div|section|p|span|aside)\b[^>]*class=["'][^"']*(?:announcement|promo-bar|top-bar|topbar|free-shipping|shipping-bar)[^"']*["'][^>]*>([\s\S]{0,1200}?)<\/(?:div|section|p|span|aside)>/gi;
    const blocs = [];
    while ((m = re.exec(html)) && blocs.length < 4) { const t = dec(m[1]); if (t.length >= 8 && t.length <= 300 && !blocs.includes(t)) blocs.push(t); }
    out.bandeau = blocs.join(' | ').slice(0, 500);
  } catch (e) {}
  out.avis = [...new Set(out.avis)].slice(0, 15);
  return out;
}

// Shopify : /products/<handle>.js donne titre, prix, ancien prix, TOUTES les images, variantes ; les pages de politique
// donnent retour / remboursement / livraison. Jamais bloquant : renvoie null au moindre souci.
function avecDelai(promesse, ms) { return Promise.race([promesse, new Promise(r => setTimeout(() => r(null), ms))]).catch(() => null); }
async function enrichirShopify(urlStr) {
  try {
    const u = new URL(urlStr);
    const mm = u.pathname.match(/^(?:\/[a-z]{2}(?:-[a-z]{2})?)?\/products\/([^\/?#]+)/i);
    if (!mm) return null;
    const racine = `${u.protocol}//${u.host}`;
    const prefixe = u.pathname.slice(0, u.pathname.indexOf('/products/'));
    const texteHtml = (h) => String(h || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<(nav|header|footer)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
    let [js, refund, shipping] = await Promise.all([
      avecDelai(fetchRawHtml(`${racine}${prefixe}/products/${mm[1]}.js`), 9000),
      avecDelai(fetchRawHtml(`${racine}${prefixe}/policies/refund-policy`), 9000),
      avecDelai(fetchRawHtml(`${racine}${prefixe}/policies/shipping-policy`), 9000),
    ]);
    const politiqueOk = (h) => { const t = texteHtml(h); return t.length >= 60 && !/\b404\b|not found|introuvable/i.test(t.slice(0, 250)) ? t : ''; };
    refund = politiqueOk(refund); shipping = politiqueOk(shipping);
    let produit = null;
    try { produit = js ? JSON.parse(js) : null; } catch (e) { produit = null; }
    if (!produit || !produit.title) return refund || shipping ? { produit: null, remboursement: refund.slice(0, 2500), livraison: shipping.slice(0, 2500) } : null;
    const abs = (x) => { try { return new URL(String(x).startsWith('//') ? 'https:' + x : x, racine).href; } catch (e) { return null; } };
    const argent = (c) => (typeof c === 'number' ? c : parseInt(c, 10)) / 100;
    return {
      produit: {
        titre: produit.title,
        prix: produit.price != null ? argent(produit.price) : null,
        ancien_prix: produit.compare_at_price ? argent(produit.compare_at_price) : null,
        description: texteHtml(produit.description).slice(0, 3500),
        images: (produit.images || []).map(abs).filter(Boolean),
        variantes: (produit.variants || []).slice(0, 12).map(v => `${v.title || v.name}${v.price != null ? ' — ' + argent(v.price) : ''}${v.compare_at_price ? ' (avant ' + argent(v.compare_at_price) + ')' : ''}`),
      },
      remboursement: refund.slice(0, 2500),
      livraison: shipping.slice(0, 2500),
    };
  } catch (e) { return null; }
}

function fetchPageText(targetUrl, depth, avecImages, htmlPrefourni) {
  depth = depth || 0;
  return new Promise((resolve, reject) => {
    // Cause confirmée par les logs : connexion réussie, en-têtes reçus (HTTP 200, gzip), mais le
    // flux ne se termine jamais proprement — le serveur distant garde la connexion ouverte malgré
    // Connection: close. Plutôt que d'attendre une fin propre qui n'arrive jamais, le timeout
    // utilise maintenant ce qui a déjà été reçu (souvent déjà complet ou quasi complet) au lieu
    // de tout rejeter — bien plus utile qu'un échec sec sur une page qu'on a en réalité déjà.
    let reglee = false;
    let data = '';
    // Extraction d'images — cherche AVANT le nettoyage qui retire toutes les balises (dont
    // src="...", perdu pour toujours une fois passé à la moulinette texte). Couvre src, data-src
    // (lazy-loading, très courant) et og:image (fiable même quand la galerie est en JS pur).
    // URLs relatives résolues contre l'URL de la page ; filtre les icônes/logos évidents.
    // Cause profonde corrigée (images d'autres produits récupérées, doublons multiples) : le
    // balayage de tous les <img> de la page attrapait aussi la barre latérale "Produits
    // Populaire"/"Vous aimerez aussi", présente sur la quasi-totalité des pages produit Shopify
    // — ce ne sont jamais des images DE ce produit. Et les mêmes images de galerie apparaissent
    // souvent plusieurs fois dans le HTML (miniature + visionneuse + lightbox), chacune avec un
    // paramètre de taille différent (?width=150 vs sans), donc jamais détectées comme doublons
    // par une simple comparaison d'URL exacte.
    // Priorité 1 — JSON-LD structuré (schema.org Product), quand présent : LA source de vérité
    // du produit lui-même, jamais mélangée à la barre latérale, quel que soit le thème Shopify.
    const extraireImagesJsonLd = (html, baseUrl) => {
      const urls = [];
      const reScripts = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
      let m;
      while ((m = reScripts.exec(html))) {
        try {
          const bloc = JSON.parse(m[1].trim());
          const items = Array.isArray(bloc) ? bloc : (bloc['@graph'] || [bloc]);
          for (const item of items) {
            if (item?.['@type'] !== 'Product' || !item.image) continue;
            const imgs = Array.isArray(item.image) ? item.image : [item.image];
            imgs.forEach(u => { if (typeof u === 'string') urls.push(u); });
          }
        } catch(e) { /* bloc JSON-LD invalide ou non-Product — ignoré, pas bloquant */ }
      }
      return urls
        .map(u => { try { return new URL(u, baseUrl).href; } catch(e) { return null; } })
        .filter(Boolean);
    };
    // Normalise une URL image Shopify pour comparaison — retire les paramètres de taille/version
    // (&width=, &height=, ?v=) qui font apparaître la MÊME image comme plusieurs URLs distinctes.
    const cleUniqueImage = (u) => {
      try {
        const url = new URL(u);
        url.searchParams.delete('width'); url.searchParams.delete('height');
        url.searchParams.delete('v'); url.searchParams.delete('crop'); url.searchParams.delete('pad_color');
        return url.origin + url.pathname;
      } catch(e) { return u; }
    };
    // Retire les blocs identifiables comme vente croisée / comparateur / produits liés avant le
    // balayage brut — sans ça, ces widgets (très courants, intégrés DANS la page produit elle-
    // même sur beaucoup de thèmes, pas dans une barre latérale séparée) ramènent des images
    // d'AUTRES produits. Fenêtre de taille fixe après chaque marqueur trouvé plutôt qu'un vrai
    // parsing de balises équilibrées (impossible en regex pur) — approximatif mais couvre
    // largement ces widgets sans risquer de tout retirer la page.
    const retirerWidgetsVenteCroisee = (html) => {
      const marqueurs = /class=["'][^"']*(related|recommend|cross-sell|crosssell|frequently|also-like|similar-product|upsell|popular-product|produits?-populaire|acheté[ -]fréquemment|comparateur|comparison|you-may-also|also-bought)[^"']*["']/gi;
      let resultat = html;
      let m;
      const positions = [];
      while ((m = marqueurs.exec(html))) positions.push(m.index);
      // Retire du plus loin au plus proche pour ne pas décaler les positions déjà trouvées.
      for (let i = positions.length - 1; i >= 0; i--) {
        resultat = resultat.slice(0, positions[i]) + resultat.slice(positions[i] + 3000);
      }
      return resultat;
    };
    const extraireImages = (html, baseUrl) => {
      // v5.52 — fusion des sources (avant : JSON-LD seul s'il existait → 1 seule image sur beaucoup de pages) :
      // JSON-LD Product, puis og:image, puis balayage des <img> (src, data-src, srcset → la plus grande). Dédoublonné.
      const brutes = [];
      const viaJsonLd = extraireImagesJsonLd(html, baseUrl);
      console.log(`   [fetchPageText] Images : JSON-LD ${viaJsonLd.length}`);
      brutes.push(...viaJsonLd);
      const abs = (u) => { try { return new URL(String(u).replace(/&amp;/g, '&'), baseUrl).href; } catch(e) { return null; } };
      let m;
      const reOg = /<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image)["'][^>]+content=["']([^"']+)["']/gi;
      while ((m = reOg.exec(html))) brutes.push(abs(m[1]));
      const reImg = /<img\b[^>]*>/gi;
      while ((m = reImg.exec(html))) {
        const tag = m[0];
        const srcset = (tag.match(/(?:data-srcset|srcset)=["']([^"']+)["']/i) || [])[1];
        let meilleure = null;
        if (srcset) {
          let w = -1;
          srcset.split(',').forEach(part => { const [u, d] = part.trim().split(/\s+/); const n = parseInt(d, 10) || 0; if (u && n >= w) { w = n; meilleure = u; } });
        }
        const s = (tag.match(/(?:data-src|data-original|src)=["']([^"']+)["']/i) || [])[1];
        const choix = meilleure || s;
        if (choix && !/^data:/i.test(choix)) brutes.push(abs(choix));
      }
      const vues = new Set();
      return brutes.filter(Boolean)
        .filter(u => /^https?:/i.test(u))
        .filter(u => !/logo|icon|favicon|sprite|placeholder|avatar|payment|badge|\.svg(\?|$)|\.gif(\?|$)/i.test(u))
        .filter(u => { const cle = cleUniqueImage(u); if (vues.has(cle)) return false; vues.add(cle); return true; })
        .slice(0, 14);
    };
    const nettoyerBrut = (dataBrute) => dataBrute
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
      .replace(/<header[\s\S]*?<\/header>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/\s{2,}/g, ' ').trim();
    // v5.52 — budget de texte : 12 000 premiers caractères tels quels + extraits du reste autour des mots-clés utiles
    // (garantie, retour, livraison, avis, offres), pour ne plus perdre le bas de page.
    const budgeter = (t) => {
      if (t.length <= 16000) return t;
      const tete = t.slice(0, 12000), reste = t.slice(12000);
      const re = /(guarant|garanti|money.?back|refund|rembours|return|retour|exchange|[ée]change|shipping|delivery|livraison|expedi|free\s|gratuit|satisf|review|avis|testimon|t[ée]moign|\bsave\b|\bbundle\b|offre|promo)/gi;
      const fenetres = [];
      let m, fin = -1;
      while ((m = re.exec(reste)) && fenetres.join(' ').length < 4000) {
        if (m.index < fin) continue;
        const d = Math.max(0, m.index - 150), f = Math.min(reste.length, m.index + 350);
        fenetres.push(reste.slice(d, f)); fin = f;
      }
      return tete + ' … ' + fenetres.join(' … ');
    };
    const nettoyer = (dataBrute) => budgeter(nettoyerBrut(dataBrute));
    // Filtre de widgets de vente croisée appliqué UNE FOIS ici, en amont — partagé par le texte
    // (nettoyer) ET les images (extraireImages) ci-dessous. Avant ce correctif, seul le chemin
    // image en bénéficiait ; le texte envoyé à Gemini restait pollué par le widget comparateur
    // ("Quel produit choisir", listant plusieurs produits avec leur propre prix côte à côte),
    // brouillant "de quel produit parle vraiment cette page" — cause du "confiance basse"
    // persistant sur des pages pourtant parfaitement exploitables.
    // v5.48 — Logo de la marque, repéré dans le HTML BRUT (le nettoyage texte supprime <header>, et le filtre
    // d'images écarte volontairement tout ce qui s'appelle « logo »). Ordre : 1) JSON-LD Organization/WebSite
    // (champ logo), 2) <img> dont la classe / l'id / l'alt / le nom de fichier contient « logo », dans le haut de
    // la page. Préfère un fichier raster (png/jpg/webp) à un SVG. Renvoie null si rien de sûr : jamais d'invention.
    const extraireLogo = (html, baseUrl) => {
      const abs = (u) => { try { return new URL(u, baseUrl).href; } catch(e) { return null; } };
      const candidats = [];
      try {
        const reScripts = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
        let m;
        while ((m = reScripts.exec(html))) {
          try {
            const bloc = JSON.parse(m[1].trim());
            const items = Array.isArray(bloc) ? bloc : (bloc['@graph'] || [bloc]);
            for (const it of items) {
              const t = it && it['@type'];
              const estOrg = [].concat(t || []).some(x => /Organization|WebSite|Store|Brand/i.test(String(x)));
              if (!estOrg || !it.logo) continue;
              const l = typeof it.logo === 'string' ? it.logo : (it.logo.url || it.logo.contentUrl || (Array.isArray(it.logo) ? it.logo[0] : null));
              if (typeof l === 'string') candidats.push(l);
            }
          } catch(e) {}
        }
      } catch(e) {}
      try {
        const haut = html.slice(0, 60000);
        const reImg = /<img\b[^>]*>/gi;
        let m;
        while ((m = reImg.exec(haut))) {
          const tag = m[0];
          if (!/logo/i.test(tag)) continue;
          if (/payment|paiement|visa|mastercard|paypal|badge|trust|secure|certif|footer-|review|avis/i.test(tag)) continue;
          const src = (tag.match(/(?:data-src|src)=["']([^"']+)["']/i) || [])[1];
          if (src && !/^data:/i.test(src)) candidats.push(src);
          if (candidats.length > 12) break;
        }
      } catch(e) {}
      const urls = candidats.map(abs).filter(u => u && /^https?:/i.test(u));
      const raster = urls.find(u => /\.(png|jpe?g|webp)(\?|$)/i.test(u));
      return raster || urls[0] || null;
    };
    const emballer = (dataBrute) => {
      const filtre = retirerWidgetsVenteCroisee(dataBrute);
      return avecImages
        ? { text: nettoyer(filtre), images: extraireImages(filtre, targetUrl), logo: extraireLogo(dataBrute, targetUrl), couleurs: extraireCandidatsCouleurs(dataBrute), extras: extraireExtrasHtml(dataBrute, targetUrl), urlFinale: targetUrl }
        : nettoyer(filtre);
    };
    if (htmlPrefourni) { resolve(emballer(htmlPrefourni)); return; } // v5.56 : HTML déjà obtenu par le navigateur
    const finirUneFois = (fn, arg) => { if (reglee) return; reglee = true; clearTimeout(timeoutGlobal); fn(arg); };
    const timeoutGlobal = setTimeout(() => {
      if (req) req.destroy();
      if (data.length >= 80) {
        console.log(`   ⏱️ [fetchPageText] Timeout global (25s) — flux jamais terminé proprement, mais ${data.length} chars déjà reçus, utilisés tels quels`);
        finirUneFois(resolve, emballer(data));
      } else {
        console.log(`   ⏱️ [fetchPageText] Timeout global (25s) atteint pour ${targetUrl} — aucune donnée exploitable reçue`);
        finirUneFois(reject, new Error('Timeout global 25s — aucune réponse'));
      }
    }, 25000);
    let req;
    try {
      console.log(`   [fetchPageText] Résolution/connexion vers ${targetUrl}...`);
      const urlObj = new URL(targetUrl);
      const isHttps = urlObj.protocol === 'https:';
      const lib = isHttps ? https : http;
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + (urlObj.search || ''),
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
          'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9',
          'Accept-Language': 'fr-FR,fr;q=0.9',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'close'
        },
        timeout: 20000
      };
      req = lib.request(options, (res) => {
        console.log(`   [fetchPageText] Réponse reçue — HTTP ${res.statusCode}, content-encoding: ${res.headers['content-encoding'] || '(aucun)'}`);
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && depth < 3) {
          const redir = new URL(res.headers.location, targetUrl).href;
          console.log(`   [fetchPageText] Redirection vers ${redir}`);
          fetchPageText(redir, depth + 1, avecImages).then(t => finirUneFois(resolve, t)).catch(e => finirUneFois(reject, e));
          return;
        }
        // Cause profonde corrigée (fiche produit jamais remplie automatiquement) : la requête
        // annonçait Accept-Encoding: gzip, deflate mais la réponse n'était jamais décompressée —
        // sur un site répondant en gzip (la majorité), le texte accumulé était du binaire brut,
        // les regex de nettoyage HTML ne faisaient qu'abîmer davantage ce charabia, et Gemini ne
        // pouvait rien y reconnaître. Décompression réelle ajoutée selon l'en-tête reçu.
        let stream = res;
        const encoding = (res.headers['content-encoding'] || '').toLowerCase();
        try {
          if (encoding === 'gzip') stream = res.pipe(zlib.createGunzip());
          else if (encoding === 'deflate') stream = res.pipe(zlib.createInflate());
          else if (encoding === 'br') stream = res.pipe(zlib.createBrotliDecompress());
        } catch(eDecomp) { stream = res; } // repli sur le flux brut si la décompression elle-même échoue à démarrer
        stream.on('data', c => {
          data += c;
          if (data.length > 1200000 && !reglee) {
            // v5.52 — avant : coupure à 200 000 caractères (le bas de page — avis, FAQ, garanties — était perdu) puis attente
            // de 25 s car un flux détruit n'envoie jamais « end ». Maintenant : plafond 1,2 M et réponse immédiate.
            const p = emballer(data);
            finirUneFois(resolve, p);
            try { res.destroy(); } catch (e) {}
          }
        });
        stream.on('end', () => {
          console.log(`   [fetchPageText] Flux terminé — ${data.length} chars bruts reçus`);
          const paquet = emballer(data);
          console.log(`   [fetchPageText] ✓ ${(avecImages ? paquet.text : paquet).length} chars de texte nettoyé${avecImages ? ` · ${paquet.images.length} image(s) trouvée(s)` : ''}`);
          finirUneFois(resolve, paquet);
        });
        stream.on('error', (e) => { console.log(`   [fetchPageText] ✗ Erreur flux décompression : ${e.message}`); finirUneFois(reject, e); });
        // Cause potentielle de blocage indéfini corrigée : .pipe() ne propage JAMAIS
        // automatiquement une erreur de la source (res) vers la destination (stream de
        // décompression) — sans ce forward explicite, une connexion qui s'interrompt en cours de
        // décompression ne fait ni resolve ni reject, la promesse reste pendante pour toujours.
        res.on('error', (e) => { console.log(`   [fetchPageText] ✗ Erreur réponse brute : ${e.message}`); stream.destroy(e); finirUneFois(reject, e); });
      });
      req.on('error', (e) => { console.log(`   [fetchPageText] ✗ Erreur requête : ${e.message}`); finirUneFois(reject, e); });
      req.on('timeout', () => { console.log(`   [fetchPageText] ✗ Timeout socket Node (20s)`); req.destroy(); finirUneFois(reject, new Error('Timeout URL')); });
      req.end();
    } catch(e) { finirUneFois(reject, e); }
  });
}


// ══════════════════════════════════════════════════════════════════════════
// SYSTÈME COMMANDES — AdBoard → Factory
// ══════════════════════════════════════════════════════════════════════════

// Cause profonde corrigée : briefs_queue.json vivait sur le disque local Render — éphémère,
// effacé à chaque redéploiement. Toute commande (photos, quantités, historique client) risquait
// de disparaître silencieusement (loadBriefs() catchait l'échec et retournait [] sans avertir).
// Migré vers Supabase (table commandes, clé service — jamais exposée, contourne RLS comme
// pour prospects/demos).
async function loadBriefs() {
  try {
    const r = await fetch(`${SUPABASE_URL_INT}/rest/v1/commandes?order=created_at.desc`, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch(e) {
    console.error('[Commandes] Lecture Supabase échouée :', e.message);
    return [];
  }
}

async function saveBriefs(briefs) {
  try {
    for (const b of briefs) {
      const r = await fetch(`${SUPABASE_URL_INT}/rest/v1/commandes`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify({
          id: b.id, created_at: b.created_at, status: b.status, client: b.client,
          product: b.product, quantity: b.quantity, history: b.history, photo_nobg: b.photo_nobg,
          deliverables: b.deliverables, started_at: b.started_at, done_at: b.done_at,
          pending_alert_sent: b.pending_alert_sent || false,
          delivery_reminder_sent: b.delivery_reminder_sent || false,
          pushed_creative_indices: b.pushed_creative_indices || [],
          batch_deja_cree: b.batch_deja_cree || false,
          // Cause profonde corrigée (le fix anti-collision "version de génération" semblait ne
          // JAMAIS marcher malgré plusieurs corrections successives) : cette liste de champs est
          // celle RÉELLEMENT écrite en base — resolution=merge-duplicates ne touche QUE les
          // colonnes listées ici, laisse toutes les autres inchangées. generation_version
          // s'incrémentait bien en mémoire à chaque appel, s'utilisait correctement pour CET
          // appel précis, mais n'était jamais dans cette liste — donc jamais réellement
          // persisté. Au prochain chargement, generation_version revenait à sa valeur d'avant,
          // recréant EXACTEMENT la même collision d'id qu'avant le premier fix.
          generation_version: b.generation_version || 1,
        })
      });
      if (!r.ok) console.error('[Commandes] Sauvegarde échouée pour', b.id, ':', await r.text());
    }
  } catch(e) {
    console.error('[Commandes] Sauvegarde Supabase échouée :', e.message);
  }
}

// ── Effacement de fond — via Gemini (gemini-3-pro-image), pas rembg ──
// Cause profonde évitée : rembg est un outil Python en ligne de commande, jamais installé sur
// Render (environnement Node.js standard, sans Python) — chaque appel échouait silencieusement
// depuis le début. Remplacé par la même infrastructure de génération d'image déjà utilisée et
// confirmée fiable pour les créatives (Vertex AI, gemini-3-pro-image) — aucune dépendance
// système supplémentaire à installer.
// Fond BLANC uni demandé plutôt qu'une vraie transparence : les modèles de génération d'image
// ne produisent pas de canal alpha fiable, un fond blanc propre est un résultat solide et
// directement exploitable pour des créatives publicitaires.
// ───────── v5.61 — PHOTOS DU PRODUIT : ANALYSE, NETTOYAGE INTELLIGENT, REMPLACEMENT DE PERSONNE, VÉRIFICATION, CACHE ─────────
// Chaque photo du client (jusqu'à 6, avec son aspect : face, côté, dos, produit lui-même, détail, en main, préparé)
// est examinée UNE par UNE, puis :
//   • déjà propre (fond uni, produit seul, personne conforme à la cible) → gardée telle quelle, aucune retouche ;
//   • décor ou personne gênante autour d'un produit → produit isolé sur fond blanc ;
//   • « en main » / « préparé » avec une personne qui ne ressemble pas à la cible du marché → la personne est remplacée
//     par une apparence qui correspond à la cible, le produit restant identique.
// Toute retouche est VÉRIFIÉE (même produit, même étiquette, rien de coupé, personne conforme) ; en cas d'échec on garde
// l'original, ou on écarte la photo si elle montrerait une personne qui n'est pas la cible. Résultats stockés et réutilisés.
const APPARENCE_CIBLE = {
  afrique_noire: "une personne noire d'Afrique subsaharienne (peau foncée, traits typiques de la région)",
  maghreb: "une personne d'apparence maghrébine (peau mate, type nord-africain)",
  europe: "une personne d'apparence européenne",
  ocean_indien: "une personne d'apparence malgache",
};
const PHOTOS_ASPECTS_PRIORITE = ['face', 'forme', 'dos', 'cote', 'detail', 'kit', 'en_main', 'prepare', 'autre'];
const PHOTOS_ASPECTS_PERSONNE = new Set(['en_main', 'prepare']);
const PHOTOS_MAX = 6;
const PHOTOS_VERSION = 'v2';
const _photosVues = new Map(); // petit cache mémoire (url → image normalisée) pour ne pas retélécharger à chaque créative
function _photosVuesPoser(cle, val) { _photosVues.set(cle, val); if (_photosVues.size > 24) _photosVues.delete(_photosVues.keys().next().value); }
const _apparenceCache = new Map();
// v5.66 — La personne à montrer se déduit de la CIBLE réelle du brief, jamais d'une règle « pays = apparence ». Un marché peut
// viser n'importe quelle apparence (une cible noire aux États-Unis, chinoise en France...). On ne remplace une personne que
// lorsque la cible est certaine ET que la personne sur la photo la contredit nettement ; sinon la photo reste intacte.
async function apparenceCibleDe(product) {
  const p = product || {};
  let pays = Array.isArray(p.marches) && p.marches.length ? p.marches.filter(Boolean).join(', ') : String(p.pays || '').trim();
  const cibleExplicite = (p.cible && !p.cible_auto) ? String(p.cible).slice(0, 500) : '';
  const cibleSuggeree = (p.cible && p.cible_auto) ? String(p.cible).slice(0, 300) : '';
  if (!pays && !cibleExplicite) { console.log('[photos] ni pays ni cible dans le brief : aucune personne ne sera remplacée'); return null; }
  const cle = [pays, cibleExplicite, cibleSuggeree, p.nom || ''].join('|');
  if (_apparenceCache.has(cle)) return _apparenceCache.get(cle);
  let res = null;
  try {
    const token = await getToken();
    const body = { contents: [{ role: 'user', parts: [{ text:
      'Tu prépares les photos d\'un produit pour des publicités Meta. Détermine l\'apparence physique des PERSONNES que ces publicités doivent montrer.\n' +
      'Produit : ' + (p.nom || 'n/a') + '\nMarché(s) : ' + (pays || 'n/a') + '\n' +
      'Cible indiquée par le client : ' + (cibleExplicite || 'aucune') + '\n' +
      (cibleSuggeree ? 'Suggestion automatique de cible (non contraignante) : ' + cibleSuggeree + '\n' : '') +
      'RÈGLES : (1) la cible indiquée par le client prime toujours sur le pays ; un marché peut viser n\'importe quelle origine (une cible noire aux États-Unis, chinoise en France, arabe en Allemagne...). (2) Sans origine précisée, le pays ne permet de conclure avec certitude que s\'il est très homogène (ex. Sénégal, Mali, Côte d\'Ivoire, Algérie, Maroc, Japon, Corée du Sud, Madagascar) : certitude "haute". (3) Pays multiethniques (États-Unis, France, Royaume-Uni, Canada, Brésil, Afrique du Sud, Émirats...) sans origine précisée : certitude "faible" — toute apparence est acceptable. (4) Plusieurs marchés d\'apparences différentes : certitude "faible". (5) Au moindre doute : "faible".\n' +
      'Réponds UNIQUEMENT par JSON {"certitude":"haute|faible","apparence_en":"description courte en ANGLAIS de la personne attendue (origine, teint), vide si faible","raison":"une phrase"}.' }] }], generationConfig: { temperature: 0, maxOutputTokens: 300, thinkingConfig: { thinkingBudget: 0 } } };
    const data = await vertexRequestAvecReessai(token, MODELES.photos, body, 30000, 'apparence_cible');
    const j = _jsonDe(data);
    if (j.certitude === 'haute' && String(j.apparence_en || '').trim()) {
      const texte = 'a person who is ' + String(j.apparence_en).trim().replace(/^an? /i, '');
      res = { cle: crypto.createHash('sha1').update(texte).digest('hex').slice(0, 10), texte };
      console.log('[photos] cible certaine : ' + texte + ' (' + String(j.raison || '').slice(0, 100) + ')');
    } else console.log('[photos] cible non tranchée (' + String(j.raison || '').slice(0, 100) + ') : aucune personne ne sera remplacée, les photos restent intactes sur ce point');
  } catch (e) { console.log('[photos] cible non déterminée (' + e.message + ') : aucune personne remplacée'); }
  _apparenceCache.set(cle, res);
  return res;
}
async function chargerImageNormalisee(source, tailleMax) {
  const t = tailleMax || 2000;
  let buf;
  if (String(source).startsWith('data:')) {
    buf = Buffer.from(String(source).replace(/^data:image\/[\w+.-]+;base64,/, ''), 'base64');
  } else {
    const cle = t + '|' + source;
    if (_photosVues.has(cle)) return _photosVues.get(cle);
    const r = await fetch(source, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error('téléchargement HTTP ' + r.status);
    buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 20 * 1024 * 1024) throw new Error('image trop lourde');
  }
  const out = await sharp(buf).rotate().flatten({ background: '#ffffff' }).resize({ width: t, height: t, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer();
  const res = { mime: 'image/jpeg', b64: out.toString('base64') };
  if (!String(source).startsWith('data:')) _photosVuesPoser(t + '|' + source, res);
  return res;
}
function cleStockagePhoto(source, aspect, apparenceCle) {
  return crypto.createHash('sha1').update([PHOTOS_VERSION, source, aspect, apparenceCle || 'sans'].join('|')).digest('hex');
}
async function lireCachePhoto(cle) {
  try {
    const r = await fetch(`${SUPABASE_URL_INT}/storage/v1/object/public/product-photos/nettoyees/${cle}.json`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const j = await r.json();
    return (j && j.decision) ? j : null;
  } catch (e) { return null; }
}
async function ecrireStorage(chemin, buffer, contentType) {
  if (!SUPABASE_SERVICE_KEY) throw new Error('clé Supabase absente');
  const r = await fetch(`${SUPABASE_URL_INT}/storage/v1/object/product-photos/${chemin}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': contentType, 'x-upsert': 'true' },
    body: buffer, signal: AbortSignal.timeout(30000)
  });
  if (!r.ok) throw new Error('stockage refusé ' + r.status);
  return `${SUPABASE_URL_INT}/storage/v1/object/public/product-photos/${chemin}`;
}
function _jsonDe(data) {
  const t = (data.candidates?.[0]?.content?.parts || []).filter(p => !p.thought).map(p => p.text).filter(Boolean).join('');
  return JSON.parse(t.replace(/```json|```/g, '').trim());
}
async function analyserPhotoProduit(img, aspect, apparence) {
  const token = await getToken();
  const cible = apparence ? apparence.texte : null;
  const body = {
    system_instruction: { parts: [{ text: "Tu inspectes UNE photo d'un produit e-commerce. Tu réponds UNIQUEMENT par un objet JSON strict, sans texte autour." }] },
    contents: [{ role: 'user', parts: [
      { inlineData: { mimeType: img.mime, data: img.b64 } },
      { text: `Aspect annoncé par le client : ${aspect}.\n` + (cible ? `Personne attendue sur les visuels de ce marché : ${cible}.\n` : 'Aucune apparence cible connue (ne juge pas la personne).\n') +
        `Réponds par ce JSON exact :\n{"fond":"aucun|uni|decor","personne":{"presente":true,"correspond_cible":"oui|non|incertain"},"produit_complet":true,"qualite":"bonne|moyenne|mauvaise","description":"une phrase sur ce que montre la photo"}\n` +
        `fond : "aucun" = fond blanc pur ou transparent ; "uni" = une seule couleur lisse sans objet ; "decor" = scène, surface texturée, objets, plusieurs plans.\n` +
        `personne.presente = true si un visage, une main, un bras ou un corps est visible (même partiel). correspond_cible : "oui" si l'apparence (couleur de peau, traits) correspond à la personne attendue, "non" si elle est nettement différente, "incertain" si on ne peut pas juger. Sans personne : presente=false et correspond_cible="oui".\n` +
        `produit_complet = false si le produit est coupé ou largement masqué.` }
    ]}],
    generationConfig: { temperature: 0, maxOutputTokens: 700, thinkingConfig: { thinkingBudget: 0 } }
  };
  const data = await vertexRequestAvecReessai(token, MODELES.photos, body, 60000, 'analyse_photo_produit');
  if (data.error) throw new Error(data.error.message || 'erreur Gemini');
  const j = _jsonDe(data);
  return {
    fond: ['aucun', 'uni', 'decor'].includes(j.fond) ? j.fond : 'decor',
    personne: { presente: !!(j.personne && j.personne.presente), correspond: (j.personne && j.personne.correspond_cible) || 'incertain' },
    complet: j.produit_complet !== false,
    qualite: j.qualite || 'moyenne',
    description: String(j.description || '').slice(0, 220),
  };
}
async function editerPhotoProduit(img, mode, apparence) {
  const token = await getToken();
  const systeme = mode === 'remplacer'
    ? `You are a professional photo retoucher. In the supplied photo, change ONLY the person (skin tone, face, hands, arms and any visible body) so that it shows ${apparence ? apparence.texte : 'a person matching the target'}, with the smallest change that achieves it: keep the same gender, approximate age, pose, framing, clothing, hairstyle type, lighting and the exact same way of holding or using the product. The PRODUCT must stay strictly identical: same shape, same label, same printed text, same colours, same reflections, same position in the frame. Keep the rest of the scene unchanged, or simplify it to a clean neutral light background if it contains other people or distracting elements. The result must look like a real photograph; hands must have a natural anatomy. Output a single image.`
    : `You are a professional product-photo retoucher. Keep ONLY the product (or all items if it is a kit or a pack) from the supplied photo and place it on a pure white seamless background. Remove EVERYTHING else: background, surface, props, and ANY person, hand, arm, finger or face. If a hand hides part of the product, rebuild the hidden part only where it follows obviously from symmetry, never invent text or details. Do NOT redraw, restyle, recolour, crop or resize the product: same shape, same proportions, same label, same printed text, same colours, same reflections. Output a single image with the product centered and some margin around it.`;
  const body = {
    system_instruction: { parts: [{ text: systeme }] },
    contents: [{ role: 'user', parts: [
      { inlineData: { mimeType: img.mime, data: img.b64 } },
      { text: mode === 'remplacer' ? 'Replace only the person as described. Keep the product identical.' : 'Isolate only the product on a pure white background.' }
    ]}],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'], temperature: 0.2 }
  };
  const data = await vertexRequestGlobalAvecReessai(token, MODELES.image, body, 120000, 'photo_produit_' + mode);
  if (data.error) throw new Error(data.error.message || 'erreur image');
  const part = (data.candidates?.[0]?.content?.parts || []).find(p => p.inlineData?.mimeType?.startsWith('image/'));
  if (!part) throw new Error('pas d\'image dans la réponse');
  // renormalise (jpeg, fond blanc, taille raisonnable) pour que tout le reste du système reçoive le même format
  return await chargerImageNormalisee('data:' + part.inlineData.mimeType + ';base64,' + part.inlineData.data, 2000);
}
async function verifierPhotoProduit(orig, res, mode, apparence) {
  const token = await getToken();
  const body = {
    system_instruction: { parts: [{ text: "Tu contrôles une retouche photo. Tu réponds UNIQUEMENT par un objet JSON strict." }] },
    contents: [{ role: 'user', parts: [
      { text: 'PHOTO ORIGINALE :' }, { inlineData: { mimeType: orig.mime, data: orig.b64 } },
      { text: 'PHOTO RETOUCHÉE :' }, { inlineData: { mimeType: res.mime, data: res.b64 } },
      { text: `Compare. JSON exact :\n{"produit_identique":true,"texte_etiquette_identique":true,"rien_coupe":true,"personne_presente":false,"personne_correspond_cible":"oui|non|sans_objet","anatomie_naturelle":true,"probleme":"phrase courte ou vide"}\n` +
        `produit_identique : même forme, mêmes proportions, mêmes couleurs, même packaging que sur l'originale. texte_etiquette_identique : le texte imprimé est le même et lisible (false s'il est déformé, inventé ou illisible alors qu'il l'était). rien_coupe : le produit est entier. personne_presente : une personne, une main ou un visage est visible sur la RETOUCHÉE. personne_correspond_cible` + (apparence ? ` : la personne de la RETOUCHÉE correspond à ${apparence.texte} ("oui"/"non", "sans_objet" s'il n'y a personne)` : ' : "sans_objet"') + `. anatomie_naturelle : mains et corps naturels (cinq doigts, pas de déformation).` }
    ]}],
    generationConfig: { temperature: 0, maxOutputTokens: 600, thinkingConfig: { thinkingBudget: 0 } }
  };
  const data = await vertexRequestAvecReessai(token, MODELES.photos, body, 60000, 'verification_photo_produit');
  if (data.error) throw new Error(data.error.message || 'erreur Gemini');
  const j = _jsonDe(data);
  const fidele = j.produit_identique !== false && j.texte_etiquette_identique !== false && j.rien_coupe !== false;
  let ok = fidele;
  if (mode === 'isoler') ok = ok && !j.personne_presente;
  if (mode === 'remplacer') ok = ok && (!apparence || j.personne_correspond_cible === 'oui') && j.anatomie_naturelle !== false;
  return { ok, probleme: String(j.probleme || '').slice(0, 160) };
}
// Décision pour UNE photo, à partir de son analyse (fonction pure : testée à part).
function decisionPhoto(aspect, analyse, apparence) {
  const personneGenante = !!(apparence && analyse.personne.presente && analyse.personne.correspond !== 'oui');
  if (personneGenante) return PHOTOS_ASPECTS_PERSONNE.has(aspect) ? 'remplacer' : 'isoler';
  if (analyse.fond === 'decor' && !PHOTOS_ASPECTS_PERSONNE.has(aspect)) return 'isoler';
  return 'garder';
}
async function preparerUnePhoto(item, apparence) {
  const aspect = item.aspect || 'autre';
  const cle = cleStockagePhoto(item.source, aspect, apparence && apparence.cle);
  const cache = await lireCachePhoto(cle);
  if (cache) { console.log('   [photos] ' + aspect + ' : réutilisée (' + cache.decision + (cache.exclue ? ', écartée' : '') + ')'); return { ...cache, principale: !!item.principale, depuis_cache: true }; }
  const res = { aspect, source: String(item.source).startsWith('data:') ? null : item.source, principale: !!item.principale, decision: 'garder', exclue: false, raison: '', verifie: false, description: '', url: null };
  let orig;
  try { orig = await chargerImageNormalisee(item.source, 2000); }
  catch (e) { res.exclue = true; res.raison = 'photo illisible (' + String(e.message).slice(0, 60) + ')'; return res; }
  let analyse;
  try { analyse = await analyserPhotoProduit(orig, aspect, apparence); }
  catch (e) { console.log('   [photos] ' + aspect + ' : analyse impossible (' + e.message + ') → photo gardée telle quelle'); analyse = { fond: 'uni', personne: { presente: false, correspond: 'oui' }, complet: true, qualite: 'moyenne', description: '' }; res.raison = 'non analysée'; }
  res.description = analyse.description;
  const decision = decisionPhoto(aspect, analyse, apparence);
  res.decision = decision;
  let finale = orig;
  if (decision !== 'garder') {
    let reussi = false, dernierProbleme = '';
    for (let essai = 0; essai < 2 && !reussi; essai++) {
      try {
        const cand = await editerPhotoProduit(orig, decision, apparence);
        const v = await verifierPhotoProduit(orig, cand, decision, apparence);
        if (v.ok) { finale = cand; reussi = true; } else dernierProbleme = v.probleme || 'retouche non fidèle';
      } catch (e) { dernierProbleme = String(e.message).slice(0, 80); }
    }
    if (reussi) { res.verifie = true; }
    else if (analyse.personne.presente && apparence && analyse.personne.correspond !== 'oui') {
      res.exclue = true; res.raison = 'personne ne correspondant pas à la cible et retouche non fiable (' + dernierProbleme + ')';
    } else {
      res.decision = 'garder'; res.raison = 'retouche abandonnée, original conservé (' + dernierProbleme + ')';
    }
  } else { res.verifie = true; }
  if (!res.exclue) {
    if (res.decision === 'garder' && res.source) res.url = res.source;
    else {
      try { res.url = await ecrireStorage('nettoyees/' + cle + '.jpg', Buffer.from(finale.b64, 'base64'), 'image/jpeg'); }
      catch (e) { res.raison = (res.raison ? res.raison + ' ; ' : '') + 'stockage impossible'; }
    }
  }
  console.log('   [photos] ' + aspect + ' : ' + res.decision + (res.exclue ? ' → ÉCARTÉE (' + res.raison + ')' : res.raison ? ' (' + res.raison + ')' : '') + ' [fond ' + analyse.fond + ', personne ' + (analyse.personne.presente ? analyse.personne.correspond : 'non') + ']');
  try { await ecrireStorage('nettoyees/' + cle + '.json', Buffer.from(JSON.stringify({ aspect, source: res.source, decision: res.decision, exclue: res.exclue, raison: res.raison, verifie: res.verifie, description: res.description, url: res.url })), 'application/json'); } catch (e) { /* le cache est un bonus */ }
  res._b64 = finale.b64; res._mime = finale.mime;
  return res;
}
// Construit la liste des photos à traiter (6 max, la principale d'abord, puis par ordre d'utilité).
function listerPhotosATraiter(product) {
  const p = product || {};
  const aspects = (p.galerie_aspects && typeof p.galerie_aspects === 'object') ? p.galerie_aspects : {};
  const principale = p.photo_base64 || p.photo_url || null;
  const items = [];
  (Array.isArray(p.galerie_images) ? p.galerie_images : []).forEach(u => { if (u) items.push({ source: u, aspect: aspects[u] || 'autre', principale: !!(p.photo_url && u === p.photo_url) }); });
  if (principale && !items.some(x => x.principale)) {
    const deja = items.find(x => x.source === principale);
    if (deja) deja.principale = true; else items.unshift({ source: principale, aspect: 'face', principale: true });
  }
  const rang = (a) => { const i = PHOTOS_ASPECTS_PRIORITE.indexOf(a); return i < 0 ? 99 : i; };
  items.sort((a, b) => (b.principale ? 1 : 0) - (a.principale ? 1 : 0) || rang(a.aspect) - rang(b.aspect));
  return items.slice(0, PHOTOS_MAX);
}
async function preparerPhotosProduit(product) {
  const apparence = await apparenceCibleDe(product);
  const items = listerPhotosATraiter(product);
  if (!items.length) return { photos: [], apparence };
  console.log('[photos] préparation de ' + items.length + ' photo(s)' + (apparence ? ' — personne attendue : ' + apparence.texte : ' — cible non tranchée, personnes conservées') );
  const resultats = new Array(items.length);
  let i = 0;
  const ouvrier = async () => { while (i < items.length) { const k = i++; try { resultats[k] = await preparerUnePhoto(items[k], apparence); } catch (e) { resultats[k] = { aspect: items[k].aspect, source: items[k].source, principale: !!items[k].principale, decision: 'garder', exclue: false, raison: 'erreur : ' + String(e.message).slice(0, 60), verifie: false, url: String(items[k].source).startsWith('data:') ? null : items[k].source }; } } };
  await Promise.all([ouvrier(), ouvrier(), ouvrier()]);
  return { photos: resultats, apparence };
}
// Tâche liée à une commande : une seule à la fois par commande, résultat écrit dans la commande (product.photos_produit + photo_nobg).
const _prepPhotos = new Map();
function preparationPhotosCommande(idCommande) {
  if (_prepPhotos.has(idCommande)) return _prepPhotos.get(idCommande);
  const p = (async () => {
    try {
      const briefs = await loadBriefs();
      const b = briefs.find(x => x.id === idCommande);
      if (!b) return null;
      const { photos } = await preparerPhotosProduit(b.product);
      if (!photos.length) return null;
      const utilisables = photos.filter(x => !x.exclue);
      const principale = utilisables.find(x => x.principale) || utilisables.find(x => x.aspect === 'face') || utilisables[0] || null;
      let nobg = null;
      if (principale) {
        try {
          const base = principale._b64 ? { mime: principale._mime, b64: principale._b64 } : await chargerImageNormalisee(principale.url || principale.source, 2000);
          nobg = 'data:' + base.mime + ';base64,' + base.b64;
        } catch (e) { console.log('[photos] photo principale non rechargée : ' + e.message); }
      }
      const frais = await loadBriefs();
      const fb = frais.find(x => x.id === idCommande);
      if (!fb) return null;
      fb.product = fb.product || {};
      fb.product.photos_produit = photos.map(x => ({ aspect: x.aspect, url: x.exclue ? null : (x.url || x.source || null), url_originale: x.source || null, decision: x.decision, exclue: !!x.exclue, raison: x.raison || '', verifie: !!x.verifie, description: x.description || '', principale: !!x.principale }));
      if (nobg) fb.photo_nobg = nobg;
      await saveBriefs([fb]);
      console.log('[photos] commande ' + idCommande + ' : ' + photos.length + ' photo(s) prêtes (' + photos.filter(x => x.exclue).length + ' écartée(s))');
      return fb.product.photos_produit;
    } catch (e) { console.log('[photos] préparation échouée : ' + e.message); return null; }
    finally { setTimeout(() => _prepPhotos.delete(idCommande), 60000); }
  })();
  _prepPhotos.set(idCommande, p);
  return p;
}

// ───────── v5.61 — ASPECTS POUR LES CRÉATIVES : choix par l'agent, assemblage en UNE seule image (4 max) ─────────
const LIBELLE_ASPECT = { face:'face (devant)', cote:'côté', dos:'dos (étiquette arrière)', forme:'le produit lui-même (poudre, gélule, liquide, texture)', prepare:'préparé / en usage', en_main:'tenu en main', detail:'détail', kit:'kit / pack / cadeaux offerts avec le produit', autre:'autre vue' };
// Aspects réellement disponibles pour une commande : la principale (déjà fournie par Factory) + les autres photos préparées.
function aspectsDisponibles(brief) {
  const liste = Array.isArray(brief && brief.photos_produit) ? brief.photos_produit : [];
  const out = [];
  const vus = new Set();
  liste.forEach(p => {
    if (!p || p.exclue || !p.url || !p.aspect) return;
    let code = String(p.aspect);
    if (p.principale && !vus.has('face')) code = code === 'autre' ? 'face' : code;
    if (vus.has(code)) return; // un seul exemplaire par aspect (le plus prioritaire, la liste est déjà triée)
    vus.add(code);
    out.push({ code, url: p.url, principale: !!p.principale, description: p.description || '' });
  });
  return out;
}
// Lit la ligne « ASPECTS ENVOYÉS À GEMINI IMAGE : face, forme » du bloc META et ne garde que des aspects qui existent.
function lireAspectsChoisis(metaBlock, dispo) {
  const m = String(metaBlock || '').match(/ASPECTS\s+ENVOY[ÉE]S\s+[ÀA]\s+GEMINI\s+IMAGE\s*:\s*([^\n]+)/i);
  if (!m) return [];
  const codes = m[1].toLowerCase().replace(/[éèê]/g, 'e').split(/[,;·+\/]| et /).map(x => x.trim().replace(/[^a-z_]/g, '')).filter(Boolean);
  const alias = { devant:'face', front:'face', produit:'forme', contenu:'forme', poudre:'forme', main:'en_main', enmain:'en_main', preparation:'prepare', cote_:'cote', arriere:'dos', back:'dos', side:'cote' };
  const res = [];
  codes.forEach(c => { const k = alias[c] || c; if (dispo.some(d => d.code === k) && !res.includes(k)) res.push(k); });
  return res.slice(0, 4);
}
// Assemble 1 à 4 images en UNE seule image. v5.62 : c'est Gemini 3 Pro Image qui compose la planche (fond neutre propre, vues
// fidèles, rendu fluide), un contrôle vérifie la fidélité, et le montage simple par le code ne sert que de repli.
async function composerPlancheSimple(imgs) {
  if (!imgs.length) return null;
  if (imgs.length === 1) return imgs[0];
  const n = imgs.length;
  const cols = n === 4 ? 2 : n;
  const rows = n === 4 ? 2 : 1;
  const cell = n === 3 ? 800 : 1000;
  const bg = { create: { width: cols * cell, height: rows * cell, channels: 3, background: '#ffffff' } };
  const compos = [];
  for (let i = 0; i < n; i++) {
    const buf = await sharp(Buffer.from(imgs[i].b64, 'base64')).resize({ width: cell - 40, height: cell - 40, fit: 'inside', background: '#ffffff' }).png().toBuffer();
    const meta = await sharp(buf).metadata();
    compos.push({ input: buf, left: (i % cols) * cell + Math.round((cell - meta.width) / 2), top: Math.floor(i / cols) * cell + Math.round((cell - meta.height) / 2) });
  }
  const out = await sharp(bg).composite(compos).jpeg({ quality: 92 }).toBuffer();
  return { mime: 'image/jpeg', b64: out.toString('base64') };
}
async function composerPlancheAspects(imgs, codes) {
  if (!imgs.length) return null;
  if (imgs.length === 1) return imgs[0];
  try {
    const token = await getToken();
    const parts = [];
    imgs.forEach((im, i) => { parts.push({ text: 'VIEW ' + (i + 1) + ' = ' + (LIBELLE_ASPECT[codes[i]] || codes[i]) + ' :' }); parts.push({ inlineData: { mimeType: im.mime, data: im.b64 } }); });
    parts.push({ text: `These ${imgs.length} photos show the SAME product (or the same set) from different aspects. Create ONE single clean product reference image that shows all of them together, arranged naturally and harmoniously side by side (or slightly overlapping when it looks natural, like a commercial packshot), on a plain seamless light-neutral background, soft even studio light, a soft contact shadow under each item. Every item must stay STRICTLY identical to its photo: same shape, proportions, colours, material, label, printed text, quantity and details. Remove any background, hand, person or décor from the source photos. Do not add any item, text, logo or prop that is not in the photos. Do not crop any item. Square format.` });
    const body = { system_instruction: { parts: [{ text: 'You are a professional product photographer composing a packshot. Fidelity to the supplied products is absolute.' }] }, contents: [{ role: 'user', parts }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'], temperature: 0.3 } };
    for (let essai = 0; essai < 2; essai++) {
      const data = await vertexRequestGlobalAvecReessai(token, MODELES.image, body, 120000, 'assemblage_aspects_produit');
      if (data.error) throw new Error(data.error.message || 'erreur image');
      const part = (data.candidates?.[0]?.content?.parts || []).find(p => p.inlineData?.mimeType?.startsWith('image/'));
      if (!part) continue;
      const cand = await chargerImageNormalisee('data:' + part.inlineData.mimeType + ';base64,' + part.inlineData.data, 2000);
      const vb = { system_instruction: { parts: [{ text: 'Tu contrôles une composition de packshot. Tu réponds UNIQUEMENT par un objet JSON strict.' }] }, contents: [{ role: 'user', parts: [...imgs.flatMap((im, i) => [{ text: 'SOURCE ' + (i + 1) + ' :' }, { inlineData: { mimeType: im.mime, data: im.b64 } }]), { text: 'COMPOSITION :' }, { inlineData: { mimeType: cand.mime, data: cand.b64 } }, { text: 'JSON exact : {"tous_presents":true,"identiques":true,"texte_etiquette_conserve":true,"rien_ajoute":true,"probleme":""}. tous_presents : chacun des ' + imgs.length + ' éléments/aspects des sources figure entier dans la composition. identiques : forme, couleurs, packaging, quantité identiques aux sources. texte_etiquette_conserve : texte imprimé identique et lisible. rien_ajoute : aucun objet, texte ou personne absent des sources.' }] }], generationConfig: { temperature: 0, maxOutputTokens: 500, thinkingConfig: { thinkingBudget: 0 } } };
      const vd = await vertexRequestAvecReessai(token, MODELES.photos, vb, 60000, 'verification_assemblage_aspects');
      const j = _jsonDe(vd);
      if (j.tous_presents !== false && j.identiques !== false && j.texte_etiquette_conserve !== false && j.rien_ajoute !== false) return cand;
      console.log('   [aspects] assemblage IA refusé au contrôle (' + String(j.probleme || '').slice(0, 100) + ')' + (essai === 0 ? ' → nouvel essai' : ''));
    }
  } catch (e) { console.log('   [aspects] assemblage IA impossible (' + String(e.message).slice(0, 100) + ')'); }
  console.log('   [aspects] repli : montage simple par le code');
  return await composerPlancheSimple(imgs);
}
function blocPlancheAspects(codes) {
  if (codes.length < 2) return '';
  return `⚠️ L'IMAGE FOURNIE EST UNE IMAGE DE RÉFÉRENCE DU MÊME PRODUIT montrant ${codes.length} aspects réunis sur fond neutre (${codes.map(c => LIBELLE_ASPECT[c] || c).join(' ; ')}). Ces éléments appartiennent à UN SEUL produit (ou ensemble) : ils servent UNIQUEMENT à reproduire fidèlement le produit. Le visuel final ne doit PAS ressembler à cette image de référence : ni fond neutre, ni éléments juxtaposés comme un packshot, sauf si la scène décrite plus bas le demande. Tu utilises chaque élément là où la scène le demande, avec exactement la même forme, la même étiquette, les mêmes couleurs, la même matière.\n\n`;
}
async function preparerImageProduitPourCreative(brief, metaBlock, productBase64, productMime) {
  const dispo = aspectsDisponibles(brief);
  const codes = lireAspectsChoisis(metaBlock, dispo);
  if (codes.length === 0) return { image: productBase64 ? { mime: productMime || 'image/jpeg', b64: productBase64 } : null, codes: ['face'], bloc: '' };
  const imgs = [], gardes = [];
  for (const c of codes) {
    const d = dispo.find(x => x.code === c);
    try {
      if (d.principale && productBase64) { imgs.push({ mime: productMime || 'image/jpeg', b64: productBase64 }); }
      else { imgs.push(await chargerImageNormalisee(d.url, 1600)); }
      gardes.push(c);
    } catch (e) { console.log('   [aspects] ' + c + ' non chargé : ' + e.message); }
  }
  if (!imgs.length) return { image: productBase64 ? { mime: productMime || 'image/jpeg', b64: productBase64 } : null, codes: ['face'], bloc: '' };
  const planche = await composerPlancheAspects(imgs, gardes);
  return { image: planche, codes: gardes, bloc: blocPlancheAspects(gardes) };
}

async function removeBackground(photoBase64, mime) {
  const token = await getToken();
  const base64Only = photoBase64.replace(/^data:image\/\w+;base64,/, '');
  const vertexBody = {
    system_instruction: { parts: [{ text: 'Tu isoles UNIQUEMENT le produit (ou l\'ensemble des éléments s\'il s\'agit d\'un kit/pack) présent sur la photo fournie, sur un fond blanc pur et uniforme (#FFFFFF), sans ombre parasite ni élément de décor. Fidélité photographique ABSOLUE au produit d\'origine : ne change jamais sa forme, ses proportions, ses couleurs, son étiquette, ses textes, ses reflets — uniquement le fond change. Ne recadre pas de façon agressive, garde le produit entièrement visible tel qu\'il apparaît sur la photo source.' }] },
    contents: [{ role: 'user', parts: [
      { inlineData: { mimeType: mime || 'image/jpeg', data: base64Only } },
      { text: 'Isole le produit (ou l\'ensemble du pack) de cette photo sur un fond blanc pur, propre, sans rien d\'autre.' }
    ]}],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'], temperature: 0.3 }
  };
  const data = await vertexRequestGlobalAvecReessai(token, MODELES.image, vertexBody, 60000, 'background_removal');
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  const parts = data.candidates?.[0]?.content?.parts || [];
  const imgPart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'));
  if (!imgPart) throw new Error('Pas d\'image dans la réponse Gemini — ' + JSON.stringify(parts).slice(0,200));
  return `data:${imgPart.inlineData.mimeType};base64,${imgPart.inlineData.data}`;
}

// ── Recherche d'une meilleure photo du MÊME produit exact, via recherche d'image inversée ──
// Contrairement à une recherche par mots-clés (qui risque de ramener un produit similaire mais
// différent), Vision API "Web Detection" part de l'IMAGE elle-même pour trouver où EXACTEMENT
// cette même photo (ou le même produit) apparaît ailleurs sur le web — c'est la seule approche
// qui garantit "le même produit, au pixel près", comme demandé. Réutilise le même compte de
// service que Vertex AI (scope cloud-platform déjà couvert) — nécessite juste que l'API Cloud
// Vision soit activée sur le projet Google Cloud.
async function chercherMeilleurePhotoProduit(photoBase64, mime) {
  try {
    const token = await getToken();
    const base64Only = photoBase64.replace(/^data:image\/\w+;base64,/, '');
    const r = await fetch('https://vision.googleapis.com/v1/images:annotate', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          image: { content: base64Only },
          features: [{ type: 'WEB_DETECTION', maxResults: 15 }]
        }]
      }),
      signal: AbortSignal.timeout(20000)
    });
    if (!r.ok) {
      console.warn('[Photo Finder] Vision API a répondu HTTP', r.status, '— API probablement pas activée sur le projet GCP.');
      return null;
    }
    const data = await r.json();
    const web = data.responses?.[0]?.webDetection;
    if (!web) { console.log('[Photo Finder] Aucune détection web renvoyée.'); return null; }

    // fullMatchingImages = copies EXACTES de cette image trouvées ailleurs (souvent en
    // meilleure résolution) — c'est la garantie "même produit, au pixel près" demandée.
    // partialMatchingImages en filet de sécurité seulement si aucune correspondance exacte.
    const candidats = [
      ...(web.fullMatchingImages || []),
      ...(web.partialMatchingImages || []),
    ].map(x => x.url).filter(Boolean);

    if (!candidats.length) {
      console.log('[Photo Finder] Aucune image correspondante trouvée ailleurs sur le web.');
      return null;
    }

    console.log(`[Photo Finder] ${candidats.length} candidat(e)s trouvé(e)s — vérification qualité de chacune...`);
    for (const url of candidats.slice(0, 8)) { // limite raisonnable, évite de scanner indéfiniment
      try {
        const imgResp = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!imgResp.ok) continue;
        const contentType = imgResp.headers.get('content-type') || '';
        if (!contentType.startsWith('image/')) continue;
        const buffer = Buffer.from(await imgResp.arrayBuffer());
        if (buffer.length < 5000 || buffer.length > 15 * 1024 * 1024) continue; // trop petite ou trop lourde, suspect
        const candidatBase64 = `data:${contentType};base64,${buffer.toString('base64')}`;
        const quality = await checkPhotoQuality(candidatBase64);
        if (quality.ok) {
          console.log(`[Photo Finder] ✅ Meilleure photo trouvée et validée : ${url}`);
          return candidatBase64;
        }
      } catch(e) { continue; } // ce candidat a échoué, on essaie le suivant
    }
    console.log('[Photo Finder] Candidats trouvés mais aucun ne passe le contrôle qualité — on garde l\'originale.');
    return null;
  } catch(e) {
    console.warn('[Photo Finder] Erreur recherche :', e.message);
    return null;
  }
}

// ── Analyse qualité photo produit (Gemini Vision) ──
// Sert de déclencheur au pipeline photo complet (voir /commandes/:id/start) : une qualité
// jugée mauvaise déclenche chercherMeilleurePhotoProduit() avant l'effacement de fond.
// Sélection dans le carrousel — quand le client a plusieurs images (récupérées de sa page
// produit ou uploadées), identifie laquelle est une VRAIE photo produit (le produit seul, net,
// sans mise en scène ni texte promo superposé) plutôt qu'une bannière marketing, une photo
// lifestyle avec un mannequin, ou un visuel de grille multi-produits — avant même de lancer le
// contrôle qualité habituel dessus. Étape 1 d'un pipeline en deux temps : celle-ci choisit LA
// bonne image, checkPhotoQuality juge ensuite si CETTE image précise est assez nette/propre.
async function choisirPhotoProduitDuCarrousel(imagesUrls) {
  if (!imagesUrls || imagesUrls.length <= 1) return null; // rien à trancher, une seule ou zéro image
  const candidats = imagesUrls.slice(0, 6); // plafonné — au-delà, coût/temps disproportionnés pour peu de gain
  try {
    const images = [];
    for (const url of candidats) {
      try {
        const imgResp = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!imgResp.ok) continue;
        const ct = imgResp.headers.get('content-type') || 'image/jpeg';
        if (!ct.startsWith('image/')) continue;
        const buf = Buffer.from(await imgResp.arrayBuffer());
        images.push({ url, mime: ct, base64: buf.toString('base64') });
      } catch(e) { /* image individuelle inaccessible — ignorée, pas bloquant pour les autres */ }
    }
    if (images.length < 2) return images[0]?.url || null; // 0 ou 1 image récupérable, rien à comparer

    const contentBlocks = [
      { type: 'text', text: `Tu vois ${images.length} images issues de la galerie d'une fiche produit e-commerce, numérotées de 1 à ${images.length} dans l'ordre où elles apparaissent ci-dessous. Identifie celle qui est LA VRAIE PHOTO PRODUIT — le produit seul, net, sur fond simple ou neutre, sans mannequin/mise en scène lifestyle, sans texte promotionnel superposé, sans grille multi-produits/multi-couleurs. Réponds UNIQUEMENT par un JSON strict : {"index":N,"raison":"..."} où N est le numéro (1 à ${images.length}) de la meilleure image, raison en une phrase courte. Si aucune ne convient vraiment, choisis quand même la moins mauvaise.` },
    ];
    images.forEach(img => contentBlocks.push({ type: 'image', source: { media_type: img.mime, data: img.base64 } }));

    const result = await callGeminiPro(
      'Tu identifies la vraie photo produit (isolée, nette, sans mise en scène) parmi plusieurs images d\'une galerie e-commerce. Réponds uniquement en JSON strict.',
      contentBlocks, 200,
      { temperature: 0.1, thinkingBudget: 256, logLabel: 'Sélection Carrousel', timeoutMs: 30000 }
    );
    const parsed = JSON.parse(result.replace(/```json|```/g, '').trim());
    const idx = parseInt(parsed.index, 10) - 1;
    if (idx >= 0 && idx < images.length) {
      console.log(`[Carrousel] Photo produit choisie : image ${idx+1}/${images.length} — ${parsed.raison || ''}`);
      return images[idx].url;
    }
    return images[0].url;
  } catch(e) {
    console.warn('[Carrousel] Sélection échouée, repli sur la première image :', e.message);
    return imagesUrls[0] || null;
  }
}

async function checkPhotoQuality(photoBase64) {
  try {
    const m = photoBase64.match(/^data:(image\/[a-z]+);base64,(.+)$/);
    if (!m) return { ok: true, note: 'format non reconnu — analyse ignorée' };
    const result = await callGeminiPro(
      'Tu évalues UNIQUEMENT la qualité technique d\'une photo produit e-commerce (netteté, résolution, cadrage, éclairage, présence de watermark/texte parasite) — jamais son contenu marketing. Réponds UNIQUEMENT par un JSON strict, sans texte autour : {"qualite":"bonne","raison":"..."} ou {"qualite":"mauvaise","raison":"..."} — raison en une phrase courte.',
      [{ type: 'image', source: { media_type: m[1], data: m[2] } }, { type: 'text', text: 'Évalue la qualité technique de cette photo produit.' }],
      200,
      { temperature: 0.2, thinkingBudget: 128, logLabel: 'Quality Check Photo', timeoutMs: 30000 }
    );
    const parsed = JSON.parse(result.replace(/```json|```/g, '').trim());
    return { ok: parsed.qualite === 'bonne', note: parsed.raison || '' };
  } catch(e) {
    console.warn('[Quality Check] Analyse échouée, image conservée par défaut :', e.message);
    return { ok: true, note: 'analyse échouée — image conservée par défaut' };
  }
}

// ── Portrait persona — image ultra-réaliste générée depuis la description du persona,
// dans une situation quotidienne qui lui est propre (pas un studio, pas un stock photo générique).
// Même infrastructure que removeBackground (Gemini 3 Pro Image), mais texte-vers-image pur :
// aucune photo d'entrée, on décrit la scène entièrement à partir des données déjà extraites
// par l'Analyste (rôle, âge, ville, journée type) — jamais une vraie personne existante.
async function genererPortraitPersona(persona) {
  const token = await getToken();
  const { nom, age, role, ville } = persona || {};
  // Puise une situation concrète dans la journée type déjà connue plutôt que d'inventer une
  // scène générique — cohérent avec le reste du persona affiché au client à côté du portrait.
  const moments = (persona?.journee_type || []).map(j => j.texte).filter(Boolean);
  const situation = moments.length
    ? moments[Math.floor(moments.length / 2)] // un moment de milieu de journée, ni trop tôt ni trop tard
    : `dans son activité de ${role || 'tous les jours'}`;

  const prompt = `Photographie ultra-réaliste, style reportage/documentaire (pas de studio, pas de pose figée), d'une personne de ${age || 'trente'} ans, ${role || ''}, vivant à ${ville || 'une ville d\'Afrique de l\'Ouest'}, photographiée naturellement en train de : ${situation}. Lumière naturelle, cadrage portrait serré (visage et buste visibles), expression authentique et non posée, vêtements et décor cohérents avec son quotidien réel décrit. Qualité photo professionnelle (appareil réflex), aucun style illustration/dessin/3D — doit ressembler à une vraie photo prise sur le vif, jamais à une image de banque d'images générique.`;

  const vertexBody = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'], temperature: 0.6 }
  };
  const data = await vertexRequestGlobalAvecReessai(token, MODELES.image, vertexBody, 60000, 'persona_portrait');
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  const parts = data.candidates?.[0]?.content?.parts || [];
  const imgPart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'));
  if (!imgPart) throw new Error('Pas d\'image dans la réponse Gemini — ' + JSON.stringify(parts).slice(0,200));
  return { base64: imgPart.inlineData.data, mime: imgPart.inlineData.mimeType };
}

async function uploadPortraitPersona(base64Data, mime, filename) {
  const buffer = Buffer.from(base64Data, 'base64');
  const ext = (mime.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  const objPath = `personas/${filename}.${ext}`;
  const r = await fetch(`${SUPABASE_URL_INT}/storage/v1/object/demos/${objPath}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': mime, 'x-upsert': 'true', 'Cache-Control': 'public, max-age=31536000, immutable' },
    body: buffer
  });
  if (!r.ok) throw new Error(`Upload portrait échoué : HTTP ${r.status}`);
  return `${SUPABASE_URL_INT}/storage/v1/object/public/demos/${objPath}`;
}

async function uploadCreativeImage(base64Data, mime, filename, clientThumbB64) {
  const buffer = Buffer.from(base64Data, 'base64');
  const ext = (mime.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  const objPath = `creatives/${filename}.${ext}`;
  const r = await fetch(`${SUPABASE_URL_INT}/storage/v1/object/demos/${objPath}`, {
    method: 'POST',
    // Cause profonde corrigée (rechargement perçu de la Galerie) : sans cache-control explicite,
    // Supabase applique sa valeur par défaut (courte) — le navigateur doit re-télécharger l'image
    // après expiration. Ces créatives ne changent jamais une fois générées : cache long + immutable.
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': mime, 'x-upsert': 'true', 'Cache-Control': 'public, max-age=31536000, immutable' },
    body: buffer
  });
  if (!r.ok) throw new Error(`Upload créative échoué : HTTP ${r.status}`);
  const imageUrl = `${SUPABASE_URL_INT}/storage/v1/object/public/demos/${objPath}`;

  // Miniature compressée pour la Galerie AdBoard — chargement très lent remonté par le client,
  // cause trouvée : la grille affichait l'image pleine résolution (souvent >1024px de large,
  // plusieurs centaines de Ko) pour une vignette de ~110-150px. 400px de large (confortable même
  // en écran retina 2-3x) + JPEG qualité 78 réduit généralement à 15-40 Ko, sans perte visible à
  // cette taille d'affichage. Échec de la miniature toléré : la Galerie retombe alors sur
  // imageUrl (voir Platform.jsx), jamais un blocage de l'upload principal pour ça.
  let thumbUrl = null;

  // PRIORITÉ : miniature déjà générée côté navigateur (Canvas, voir factory.html) — contourne
  // entièrement sharp/libvips, dont la génération serveur échoue systématiquement en prod
  // ("vipspng: libpng read error", reproductible même Node LTS + cache de build vidé — cause
  // exacte encore non identifiée, diagnostic en cours). Plus fiable, à privilégier tant que
  // cette cause n'est pas trouvée et corrigée.
  if (clientThumbB64) {
    try {
      const thumbBuffer = Buffer.from(clientThumbB64, 'base64');
      const thumbPath = `creatives_thumb/${filename}.jpg`;
      const rThumb = await fetch(`${SUPABASE_URL_INT}/storage/v1/object/demos/${thumbPath}`, {
        method: 'POST',
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'image/jpeg', 'x-upsert': 'true', 'Cache-Control': 'public, max-age=31536000, immutable' },
        body: thumbBuffer
      });
      if (rThumb.ok) thumbUrl = `${SUPABASE_URL_INT}/storage/v1/object/public/demos/${thumbPath}`;
      else console.warn(`[Miniature] Upload (générée navigateur) échoué pour ${filename} : HTTP ${rThumb.status}`);
    } catch(eThumbClient) {
      console.warn(`[Miniature] Upload miniature navigateur échoué pour ${filename} :`, eThumbClient.message);
    }
  }

  // REPLI : génération serveur via sharp — seulement si le client n'a pas fourni de miniature
  // (navigateur sans support Canvas, très rare, ou ancien format) ou si son upload a échoué.
  if (!thumbUrl) {
    try {
      const thumbBuffer = await sharp(buffer).resize({ width: 400, withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer();
      const thumbPath = `creatives_thumb/${filename}.jpg`;
      const rThumb = await fetch(`${SUPABASE_URL_INT}/storage/v1/object/demos/${thumbPath}`, {
        method: 'POST',
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'image/jpeg', 'x-upsert': 'true', 'Cache-Control': 'public, max-age=31536000, immutable' },
        body: thumbBuffer
      });
      if (rThumb.ok) thumbUrl = `${SUPABASE_URL_INT}/storage/v1/object/public/demos/${thumbPath}`;
      else console.warn(`[Miniature] Upload échoué pour ${filename} : HTTP ${rThumb.status}`);
    } catch(eThumb) {
      console.warn(`[Miniature] Génération échouée pour ${filename} :`, eThumb.message, '| code:', eThumb.code, '| taille buffer entrée:', buffer.length, 'octets', '| stack:', eThumb.stack);
    }
  }

  return { imageUrl, thumbUrl };
}

// Pousse les livrables (créatives uploadées en Storage + ad copies) dans la table `products`
// d'AdBoard, dans le format EXACT que la Galerie Créatives et les Ad Copies attendent déjà
// (vérifié dans Platform.jsx). Cumulatif — n'écrase jamais les livraisons précédentes du
// même produit. Données Marché volontairement absent : l'agent qui produit ce format n'est
// pas encore câblé dans le pipeline de production (voir note dans le code).
// Génère + sauvegarde le portrait persona ENTIÈREMENT côté serveur, jamais dépendant de la
// connexion du navigateur (Factory peut être fermée juste après "Envoyer au client" — la
// génération continue et se termine quand même, puisqu'elle tourne dans ce process Node, pas
// dans l'onglet). Jamais appelée en étant attendue (await) par son appelant — volontairement
// fire-and-forget, pour ne jamais bloquer la réponse au clic "Envoyer au client".
async function genererEtSauvegarderPortraitEnTacheDeFond(productId, persona) {
  try {
    console.log(`[Portrait] Génération en tâche de fond démarrée pour ${persona?.nom} (produit ${productId})...`);
    const { base64, mime } = await genererPortraitPersona(persona);
    // Cause profonde corrigée (upload portrait échoue systématiquement en HTTP 400 pour toute
    // cible au prénom accentué, ex: "Aïssatou") : ce regex autorisait explicitement les
    // caractères accentués à passer tels quels dans le nom de fichier — mais un chemin d'objet
    // Supabase Storage doit être strictement ASCII-safe. Translittéré en ASCII pur maintenant
    // (Aïssatou → AISSATOU) avant construction du nom, plutôt que de garder l'accent original.
    const nomAscii = (persona.nom || 'persona').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const slug = nomAscii.toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g,'_').slice(0, 30);
    const filename = `${slug}_${Date.now()}`;
    const url = await uploadPortraitPersona(base64, mime, filename);

    // Relit products.marche À CE MOMENT PRÉCIS (pas l'état d'avant la génération) — le temps
    // qu'a pris la génération (jusqu'à ~5 min dans le pire cas), une autre commande pour ce
    // même produit pourrait avoir déjà modifié marche entre-temps ; on fusionne sur l'état
    // actuel, jamais sur une copie potentiellement périmée.
    const prRes = await fetch(`${SUPABASE_URL_INT}/rest/v1/products?id=eq.${productId}&select=marche`, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
    });
    const prRows = await prRes.json();
    const marcheActuel = prRows[0]?.marche || {};
    const rPatch = await fetch(`${SUPABASE_URL_INT}/rest/v1/products?id=eq.${productId}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ marche: { ...marcheActuel, persona: { ...marcheActuel.persona, portrait_url: url } } })
    });
    if (!rPatch.ok) { console.error('[Portrait] PATCH final échoué :', await rPatch.text()); return; }
    console.log(`[Portrait] ✅ Généré et sauvegardé en tâche de fond pour ${productId} → ${url}`);
  } catch(e) {
    console.error('[Portrait] Génération en tâche de fond échouée :', e.message);
  }
}

async function pushDeliverablesToProduct(productId, ticketId, deliverables, alreadyPushedIndices = new Set(), batchDejaCree = false, quantiteDemandee = null, onlyIndices = null, onlyCopyIndices = null, generationVersion = 1) {
  if (!productId || !deliverables) return;
  try {
    const prRes = await fetch(`${SUPABASE_URL_INT}/rest/v1/products?id=eq.${productId}&select=creatives,deliveries,marche`, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
    });
    if (!prRes.ok) throw new Error(`Lecture produit échouée : HTTP ${prRes.status}`);
    const prRows = await prRes.json();
    if (!prRows.length) throw new Error(`Produit ${productId} introuvable côté AdBoard`);
    const existing = prRows[0];
    let existingCreatives = existing.creatives || [];
    const existingDeliveries = existing.deliveries || [];

    // Cause profonde corrigée (l'ancien batch reste visible à côté du nouveau après une
    // relance, CONFIRMÉ par diagnostic réel : g1_0..g1_8 ET g2_0..g2_7 coexistaient) : le
    // nettoyage vivait avant dans /generation-started, qui ne connaît que le produit OFFICIEL
    // du ticket — mais "Envoyer à un autre compte" pousse vers un produit TEST complètement
    // différent, jamais nettoyé puisque generation-started ignore son existence. Fait ici à la
    // place : à CHAQUE envoi réel, peu importe la cible, on retire d'abord toute créative de CE
    // ticket dont la version de génération est PLUS ANCIENNE que celle en cours — scope strict
    // par regex sur l'id (ticketId_g{N}_...), jamais une créative d'un autre ticket/produit.
    const regexVersionTicket = new RegExp(`^${ticketId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_g(\\d+)_`);
    const nettoyees = existingCreatives.filter(c => {
      const m = c.id && c.id.match(regexVersionTicket);
      return !m || parseInt(m[1], 10) >= generationVersion;
    });
    if (nettoyees.length !== existingCreatives.length) {
      await fetch(`${SUPABASE_URL_INT}/rest/v1/products?id=eq.${productId}`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ creatives: nettoyees })
      });
      console.log(`[Push] ${existingCreatives.length - nettoyees.length} créative(s) d'une version antérieure retirée(s) pour le ticket ${ticketId} sur le produit ${productId}`);
      existingCreatives = nettoyees;
    }
    // Sur un renvoi (après un envoi partiel précédent), ce ticket a déjà sa propre entrée de
    // batch — on reprend son même label, jamais un nouveau numéro, pour rester cohérent.
    const livraisonExistante = existingDeliveries.find(d => d.ticketId === ticketId);
    // "Batch" plutôt que "Semaine" — un client peut recharger ses demandes n'importe quand,
    // un calendrier hebdomadaire n'a jamais de sens réel ici. Déjà comptabilisé PAR PRODUIT
    // (existingDeliveries vient de la fiche de CE produit précis), juste le libellé change.
    const weekLabel = livraisonExistante ? livraisonExistante.semaine : `B${existingDeliveries.length + 1}`;
    const dateLabel = livraisonExistante ? livraisonExistante.date : new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

    // Double protection : le suivi fiable vient du BRIEF (alreadyPushedIndices, passé par
    // l'appelant) — la vérification des IDs déjà présents dans products reste en filet de
    // sécurité supplémentaire, mais n'est plus la SEULE ligne de défense contre les doublons.
    // Description de la cible pour ce lot — calculée une seule fois, réutilisée à la fois pour
    // l'entrée de livraison globale ET pour chaque créative individuelle (nouveau : avant, seule
    // la livraison globale la connaissait, aucune créative ne savait à quelle cible elle appartenait).
    const cibleCeLot = [deliverables.marche?.persona?.nom, deliverables.marche?.persona?.role, deliverables.marche?.persona?.age ? `${deliverables.marche.persona.age} ans` : null, deliverables.marche?.persona?.ville].filter(Boolean).join(', ') || null;
    // Cause profonde corrigée (la même cible apparaît dupliquée plusieurs fois côté client —
    // "Aïssatou, Aïssatou, Aïssatou" — une par batch au lieu d'une seule avec tous les batches
    // dessous) : le client regroupe les livraisons par égalité EXACTE du texte cibleCeLot
    // ci-dessus, qui inclut le prénom généré par l'IA. Même sur "la même cible" logiquement,
    // ce prénom (ou la formulation du rôle) peut légèrement varier d'un batch à l'autre malgré
    // l'instruction de réutilisation — assez pour casser une comparaison de texte exact.
    // Signature stable ajoutée ici, sans le prénom, réservée à l'identité/au regroupement —
    // cibleCeLot reste inchangé pour l'affichage (le prénom reste agréable à lire).
    const cibleSignatureCeLot = [deliverables.marche?.persona?.sexe, deliverables.marche?.persona?.role, deliverables.marche?.persona?.age, deliverables.marche?.persona?.ville].filter(Boolean).join('|').toLowerCase().trim() || null;

    const existingIds = new Set(existingCreatives.map(c => c.id));
    const newCreatives = [];
    const newlyPushedIndices = [];
    for (let i = 0; i < (deliverables.creatives || []).length; i++) {
      const c = deliverables.creatives[i];
      // Nouveau format : chaque créative est uploadée dès sa génération (voir
      // /commandes/:id/upload-creative-now) — c.url est déjà prêt, jamais de ré-upload ici.
      // Ancien format (c.imgB64) toléré en repli, pour les commandes en cours de transition.
      if (!c || (!c.url && !c.imgB64 && !c.videoUrl)) continue; // une vidéo n'a que videoUrl (+ thumbUrl = affiche)
      if (alreadyPushedIndices.has(i)) continue; // déjà confirmé livré pour CE ticket — jamais repoussé
      // Envoi ciblé (voir /commandes/:id/send-one-creative) : ignore tout ce qui n'est pas
      // l'index précis demandé, sans toucher au reste de la logique (id, angle, cible identiques
      // à un envoi complet — juste une portée réduite).
      if (onlyIndices && !onlyIndices.has(i)) continue;
      const idCandidat = `${ticketId}_g${generationVersion}_${i}`;
      if (existingIds.has(idCandidat)) { newlyPushedIndices.push(i); continue; } // déjà là mais pas encore tracé sur le brief — on le trace sans le repousser
      try {
        // Cas normal : déjà uploadée via /upload-creative-now, c.url ET c.thumbUrl transmis par
        // Factory — aucun nouvel upload nécessaire. Cas de repli (ancien format, c.imgB64 encore
        // présent) : un seul upload direct ici, dont le résultat sert à la fois pour url et thumbUrl.
        let url = c.url, thumbUrl = c.thumbUrl || null;
        if (!url && !c.videoUrl) {
          const uploaded = await uploadCreativeImage(c.imgB64, c.mime || 'image/png', idCandidat);
          url = uploaded.imageUrl;
          thumbUrl = uploaded.thumbUrl;
        }
        // Même correctif que pour angleEntries plus bas — ce champ est CONSTRUIT SÉPARÉMENT et
        // avait été oublié lors du premier correctif, d'où le texte technique complet encore
        // visible dans la légende de chaque créative de la Galerie.
        const angleBrutCreative = (deliverables.angles && deliverables.angles[c.angleIdx]) || `Angle ${((c.angleIdx || 0) + 1)}`;
        const angleCreative = angleBrutCreative.split('*')[0].trim() || `Angle ${((c.angleIdx || 0) + 1)}`;
        newCreatives.push({
          id: idCandidat, productId,
          angle: angleCreative, cible: cibleCeLot,
          week: weekLabel, imageUrl: url || null, thumbUrl: thumbUrl || null,
          // Vidéo 9:16 : AdBoard l'affiche en 4:5 dans la grille (via thumbUrl = affiche) et en 9:16 à l'ouverture.
          ...(c.videoUrl ? { type: 'video', videoUrl: c.videoUrl } : {})
        });
        newlyPushedIndices.push(i);
      } catch(eUp) { console.error('[Deliver] Upload créative échoué :', eUp.message); }
    }

    const angleEntries = (deliverables.copies || [])
      .map((copy, i) => ({ copy, i }))
      // Envoi ciblé (voir /commandes/:id/send-one-copy) : ignore tout ce qui n'est pas l'index
      // précis demandé — même principe que onlyIndices pour les créatives, appliqué ici avant
      // le .map() principal pour ne jamais casser les index i utilisés dans le reste du bloc.
      .filter(({ i }) => !onlyCopyIndices || onlyCopyIndices.has(i))
      .map(({ copy, i }) => {
      // Cause profonde corrigée (nom d'angle affiché avec tout le détail technique "* Moteur
      // dominant : ..." dans AdBoard) : le nom brut extrait de la synthèse contient ce suffixe
      // interne, jamais destiné au client — on ne garde que la partie avant le premier "*".
      const nomBrut = (deliverables.angles && deliverables.angles[i]) || `Angle ${i + 1}`;
      const nom = nomBrut.split('*')[0].trim() || `Angle ${i + 1}`;
      // Justification client-safe — vient du bloc DONNEES_MARCHE (deliverables.marche.angles),
      // pas du tableau interne deliverables.angles qui ne contient que les noms bruts.
      // Cause profonde corrigée (justification absente sur certains angles) : le matching par
      // nom EXACT (après split sur '*') échouait silencieusement à la moindre différence de
      // formatage entre deliverables.angles[i] et deliverables.marche.angles[i] (guillemets,
      // espace, ponctuation) — pourtant les deux tableaux décrivent LES MÊMES angles, dans LE
      // MÊME ORDRE, extraits de LA MÊME réponse. On matche donc d'abord par position (fiable),
      // avec un repli sur le nom normalisé (sans guillemets/ponctuation, insensible à la casse)
      // uniquement si jamais les deux tableaux n'étaient pas alignés.
      const margles = deliverables.marche?.angles || [];
      const normalise = (s) => (s||'').split('*')[0].replace(/["'""»«]/g,'').trim().toLowerCase();
      let justification = margles[i]?.justification || '';
      if (!justification && margles.length) {
        justification = margles.find(a => normalise(a?.nom) === normalise(nom))?.justification || '';
      }
      return { numero: i + 1, nom, justification, hooks: copy?.hooks || [], description: copy?.description || '' };
    });

    // CT utilisés pour ce lot — nécessaire pour qu'un futur renouvellement puisse en éviter
    // 50-60% et garantir de la variété visuelle plutôt que répéter les mêmes structures.
    const ctsUtilisesCeLot = [...new Set((deliverables.creatives || []).map(c => c?.ct).filter(Boolean))];

    // Sur un renvoi (après un envoi partiel précédent) DE LA MÊME génération, ce ticket a déjà
    // sa propre entrée de batch — ne jamais en recréer une deuxième, juste garder celle qui
    // existe déjà. Mais sur une VRAIE relance (generation_version a avancé depuis la création de
    // cette entrée), le contenu doit être REMPLACÉ, pas laissé figé sur la toute première
    // tentative — sinon les angles/ad copies restent bloqués sur un lancement abandonné, même
    // quand les créatives, elles (suivies séparément par index), se mettent à jour normalement.
    // Cause profonde corrigée (ad copies/angles à 0 chez le client malgré [Deliver] annonçant un
    // succès) : avant, dejaCree ignorait complètement la version — une seule entrée créée UNE
    // FOIS, plus jamais rafraîchie, peu importe combien de relances suivaient.
    const dejaCreeMemeVersion = livraisonExistante && livraisonExistante.generation_version === generationVersion;
    const dejaCree = dejaCreeMemeVersion;
    const nouvelleEntreeLivraison = { ticketId, semaine: weekLabel, date: dateLabel, created_at: new Date().toISOString(), cible: cibleCeLot, cible_signature: cibleSignatureCeLot, angles: angleEntries, cts_utilises: ctsUtilisesCeLot, generation_version: generationVersion };
    const deliveriesFinal = dejaCree
      ? existingDeliveries
      : livraisonExistante
        // Remplace l'entrée existante en place (même position) plutôt que d'en ajouter une
        // nouvelle — une relance reste UN SEUL batch pour ce ticket, juste son contenu change.
        ? existingDeliveries.map(d => d.ticketId === ticketId ? nouvelleEntreeLivraison : d)
        : [...existingDeliveries, nouvelleEntreeLivraison];

    const patchBody = {
      creatives: [...existingCreatives, ...newCreatives],
      // created_at (ISO, fiable pour comparaison chronologique) + cible (nom du persona utilisé
      // pour ce lot) — nécessaires pour calculer, à la demande, le compteur d'angles de la cible
      // COURANTE uniquement, et la liste complète d'angles à exclure (mode remplacement, plus
      // d'accumulation dans la synthèse elle-même).
      deliveries: deliveriesFinal,
      // Dernière synthèse complète — nécessaire pour qu'une future commande sur ce même produit
      // puisse reprendre le même persona (ajout d'angles) plutôt que de repartir de zéro.
      derniere_synthese: deliverables.synthesis || undefined,
    };
    // Données Marché — calculées en brouillon à la génération (voir /livrable-marche), écrites
    // pour de vrai seulement maintenant, au moment où le client doit réellement les voir.
    let besoinPortrait = false;
    if (deliverables.marche) {
      // Cause profonde corrigée (portrait régénéré à chaque batch même sur la même cible, et
      // détection "même cible" peu fiable) : cette comparaison se faisait sur persona.nom —
      // un prénom choisi librement par l'IA à chaque appel, qui varie même pour EXACTEMENT la
      // même cible démographique. Comparaison basée maintenant sur les faits stables (sexe,
      // rôle, âge, ville) — jamais le prénom, qui n'est qu'une habillage narratif.
      const signaturePersona = (p) => p ? [p.sexe, p.role, p.age, p.ville].filter(Boolean).join('|').toLowerCase().trim() : '';
      const memePerson = signaturePersona(existing.marche?.persona) && signaturePersona(existing.marche?.persona) === signaturePersona(deliverables.marche.persona);
      patchBody.marche = {
        ...deliverables.marche,
        // Nécessaire pour compter les angles du SEUL persona courant (voir /products/:id/renewal-context) —
        // un changement de persona (rotation après 18 angles) redémarre le compteur à zéro.
        persona_started_at: memePerson
          ? (existing.marche?.persona_started_at || new Date().toISOString())
          : new Date().toISOString(),
      };
      // Portrait persona — réutilisé directement si c'est la même personne (rien à regénérer,
      // aucun appel IA). Sinon, généré en tâche de fond APRÈS la réponse de ce endpoint (voir
      // l'appelant plus bas) : jamais bloquant ici, jamais de label "en cours" visible côté
      // client — juste présent la prochaine fois qu'il consulte Données Marché, une fois prêt.
      if (memePerson && existing.marche?.persona?.portrait_url) {
        patchBody.marche.persona = { ...patchBody.marche.persona, portrait_url: existing.marche.persona.portrait_url };
      } else {
        besoinPortrait = true;
      }
    }

    const rPatch = await fetch(`${SUPABASE_URL_INT}/rest/v1/products?id=eq.${productId}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(patchBody)
    });
    // Cause profonde corrigée (bouton "Envoyer au client" verrouillé sur un envoi partiel, sans
    // aucun moyen de renvoyer les créatives manquantes) : ce PATCH final ne vérifiait jamais son
    // propre succès, ET rien ne comparait le nombre de créatives réellement poussées au nombre
    // attendu — un envoi partiel (ex: échec d'upload sur certaines images) semblait "réussi" du
    // point de vue de Factory. On retourne maintenant ces deux compteurs pour que le client
    // puisse comparer et proposer de renvoyer si un écart est détecté.
    if (!rPatch.ok) {
      const errText = await rPatch.text();
      console.error('[Deliver] ❌ ÉCHEC PATCH products:', rPatch.status, errText.slice(0,400));
    }
    const expectedCount = (deliverables.creatives || []).filter(c => c?.imgB64 || c?.url).length;
    // Cause profonde corrigée ("6 sur 9 considéré comme complet") : expectedCount se basait
    // UNIQUEMENT sur ce qui était sauvegardé, jamais sur ce qui avait été RÉELLEMENT demandé à
    // l'origine — si une sauvegarde a échoué en route (timeout) et que 3 créatives générées
    // n'ont jamais atteint le brief, "6/6 sauvegardées" semblait complet alors que 9 étaient
    // attendues. Comparaison supplémentaire à la quantité d'origine, distincte du contrôle
    // d'envoi — un manque ici veut dire "régénère les manquantes dans Factory", pas "renvoie".
    const manqueVsQuantiteDemandee = quantiteDemandee && expectedCount < quantiteDemandee;
    const dejaPresentesCeTicket = existingCreatives.filter(c => c.id && c.id.startsWith(`${ticketId}_`)).length;
    const totalMaintenant = dejaPresentesCeTicket + newCreatives.length;
    console.log(`[Deliver] ✅ ${newCreatives.length} nouvelle(s) créative(s) (${totalMaintenant}/${expectedCount} au total pour ce ticket) + ${angleEntries.length} angle(s)${deliverables.marche ? ' + données marché' : ''} poussés vers products/${productId}`);
    // Si le PATCH a échoué, rien n'a réellement été écrit — ne jamais tracer ces indices comme
    // "livrés" sur le brief dans ce cas, sinon un futur renvoi croirait à tort qu'ils sont déjà
    // passés et ne les repousserait jamais, alors qu'ils manquent toujours réellement.
    return {
      expectedCount, pushedCount: totalMaintenant, patchOk: rPatch.ok,
      newlyPushedIndices: rPatch.ok ? newlyPushedIndices : [], batchCree: rPatch.ok ? true : dejaCree,
      adCopiesOk: rPatch.ok && angleEntries.length === (deliverables.copies || []).length && angleEntries.length > 0,
      adCopiesCount: angleEntries.length, adCopiesAttendu: (deliverables.copies || []).length,
      marcheOk: rPatch.ok && !!deliverables.marche,
      manqueVsQuantiteDemandee, quantiteDemandee,
      besoinPortrait: rPatch.ok && besoinPortrait, personaPourPortrait: deliverables.marche?.persona || null,
    };
  } catch(e) {
    console.error('[Deliver] Push vers products échoué :', e.message);
    return { expectedCount: (deliverables.creatives || []).filter(c => c?.imgB64 || c?.url).length, pushedCount: 0, patchOk: false, newlyPushedIndices: [], batchCree: false, error: e.message };
  }
}

async function processProductPhoto(photoBase64, briefId) {
  if (!photoBase64 || !photoBase64.startsWith('data:')) return null;
  try {
    const mime = photoBase64.match(/^data:(image\/\w+);/)?.[1] || 'image/jpeg';
    const pngBase64 = await removeBackground(photoBase64, mime);
    console.log(`[ReBG] ✅ Background supprimé pour brief ${briefId}`);
    return pngBase64;
  } catch(e) {
    console.warn(`[ReBG] ⚠️ Échec background removal: ${e.message} → image originale conservée`);
    return null;
  }
}


server.listen(PORT, () => {
  console.log(`\n✅ AdStack Server → http://localhost:${PORT}\n`);
  setTimeout(() => { sonderModeles(); }, 3000);
});

// ── Auto-ping — empêche Render (offre gratuite) de mettre le serveur en veille ──
// Sans ça, après 15 min sans trafic, Render endort le service, et le 1er visiteur
// suivant (souvent un prospect qui clique sur sa démo) tombe sur l'écran de réveil
// générique de Render — mauvaise impression, surtout en pleine prospection à froid.
const RENDER_URL_PUBLIC = 'https://adstack-server.onrender.com';
setInterval(() => {
  https.get(`${RENDER_URL_PUBLIC}/`, (res) => {
    res.on('data', () => {});
    res.on('end', () => console.log(`[Auto-ping] OK (${res.statusCode})`));
  }).on('error', (e) => console.log(`[Auto-ping] Erreur : ${e.message}`));
}, 10 * 60 * 1000); // toutes les 10 minutes — bien en dessous du seuil de 15 min de Render
