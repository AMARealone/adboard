/* GÉNÉRÉ automatiquement depuis l'ancien Factory (code repris tel quel, sans l'affichage). Ne pas modifier à la main. */
import { prodv2State, SERVER, COMP_FILES, CT_IMAGES } from './state'

export function fetchAvecTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  // Cause profonde corrigée (message cryptique "signal is aborted without reason" dans les
  // logs, difficile à distinguer d'une vraie panne réseau) : controller.abort() sans argument
  // produit ce message générique du navigateur. Une raison explicite est donnée maintenant,
  // et l'erreur est réécrite pour être immédiatement compréhensible en cas de vrai timeout.
  const timer = setTimeout(() => controller.abort(`Timeout après ${timeoutMs/1000}s — le serveur n'a pas répondu à temps (probablement en train de se réveiller)`), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .catch(e => {
      if (controller.signal.aborted) throw new Error(controller.signal.reason || `Timeout après ${timeoutMs/1000}s`);
      throw e;
    })
    .finally(() => clearTimeout(timer));
}

export async function compressImg(b64, mime) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      const MAX = 1024;
      let w = img.width, h = img.height;
      if(w > MAX || h > MAX) { const r = Math.min(MAX/w, MAX/h); w *= r; h *= r; }
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', 0.8).split(',')[1]);
    };
    img.src = 'data:' + mime + ';base64,' + b64;
  });
}

export async function apiSynthesize(system, parts, maxTokens, enrichWithSearch, signal) {
  const res = await fetch(SERVER+'/synthesize', {
    method:'POST', headers:{'Content-Type':'application/json'},
    signal,
    body: JSON.stringify({
      system, parts,
      maxOutputTokens: maxTokens || 16000,
      maxTokens: maxTokens || 16000,
      enrichWithSearch: enrichWithSearch !== false  // défaut true (Stratège)
    })
  });
  const d = await res.json();
  if(d.error) throw new Error(d.error);
  return d.text;
}

export async function apiAnalysteSynthese(system, parts, maxTokens, brief, signal, isTest=false) {
  const res = await fetch(SERVER+'/analyste-synthese', {
    method:'POST', headers:{'Content-Type':'application/json'},
    signal,
    body: JSON.stringify({system, parts, maxOutputTokens: maxTokens || 32000, brief, isTest})
  });
  const d = await res.json();
  if(d.error) throw new Error(d.error);
  return d.text;
}

export async function apiCopywriter(system, parts, maxTokens, signal, isTest=false) {
  const res = await fetch(SERVER+'/copywriter', {
    method:'POST', headers:{'Content-Type':'application/json'},
    signal,
    body: JSON.stringify({system, parts, maxOutputTokens: maxTokens || 8000, isTest})
  });
  const d = await res.json();
  if(d.error) throw new Error(d.error);
  return d.text;
}

export async function selectCTsForGeneration(synthesis, count, mode, excludeIds) {
  const ids = Object.keys(CT_IMAGES).filter(function(k) {
    return !k.endsWith('_mime') && !k.endsWith('_name') && !k.endsWith('_addedAt') && !k.endsWith('_meta') && !k.endsWith('_awareness') && !k.endsWith('_styleTags') && !k.endsWith('_niche');
  });
  if (ids.length === 0) return [];
  // Cause profonde corrigée (créatives en échec silencieux sur les grosses commandes Pro/Scale,
  // jusqu'à 36 créatives) : quand le pool de CT disponibles est plus PETIT que le nombre demandé,
  // cette fonction ne renvoyait que ids.length éléments au lieu de `count` — tout index au-delà
  // (ctPick[30] à ctPick[35] par exemple, pour un pool de 30 CT sur une commande de 36) valait
  // undefined, faisant planter silencieusement CES créatives précises plus loin dans le pipeline.
  // On complète maintenant en RECYCLANT le pool (avec un ré-mélange à chaque tour, pas une
  // simple répétition dans le même ordre) jusqu'à atteindre exactement `count` éléments.
  const completerParCyclage = function(liste) {
    const résultat = liste.slice();
    while (résultat.length < count) {
      const tour = ids.slice().sort(function() { return Math.random() - 0.5; });
      résultat.push(...tour.slice(0, Math.min(tour.length, count - résultat.length)));
    }
    return résultat;
  };
  if (ids.length <= count) return completerParCyclage(ids.sort(function() { return Math.random() - 0.5; }));

  const ctList = ids.map(function(id) {
    return { id: id, name: CT_IMAGES[id + '_name'] || id, meta: CT_IMAGES[id + '_meta'] || '', awareness: CT_IMAGES[id + '_awareness'] || [], styleTags: CT_IMAGES[id + '_styleTags'] || [], niche: CT_IMAGES[id + '_niche'] || '' };
  });

  try {
    const resp = await fetch(SERVER + '/select-cts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        synthesis: synthesis.substring(0, 4000),
        ctList: ctList,
        count: count,
        mode: mode || 'prod',
        excludeIds: excludeIds || [],
        assets: (function() {
          try {
            var b = (typeof prodv2State !== 'undefined' && prodv2State.brief) ? prodv2State.brief : null;
            if (!b) return '';
            var L = [];
            var ph = (b.photos_produit || []).filter(function(p) { return !p.exclue; });
            if (ph.length) L.push('Aspects photo disponibles : ' + ph.map(function(p) { return p.aspect; }).join(', '));
            else if ((b.galerie_images || []).length > 1) L.push('Photos du produit : ' + b.galerie_images.length + ' (aspects non précisés)');
            else L.push('Une seule photo produit (aspect unique)');
            if (ph.some(function(p) { return p.aspect === 'kit'; })) L.push('KIT / CADEAUX fournis : le client vend ou offre des produits complémentaires avec le produit principal');
            else L.push('Aucun kit ni cadeau fourni');
            L.push('Avis fournis : ' + (((b.avis_textes || []).length) + (b.avis_captures_nb || 0)) + ' (textes + captures)');
            L.push('Logo : ' + (b.logo_url ? 'fourni' : 'absent'));
            L.push('Prix affichable : ' + (b.prix_affichable === false ? 'NON (prix différents selon les pays)' : 'oui'));
            if (b.promo) L.push('Offre en cours : ' + b.promo);
            if (b.garantie) L.push('Garantie : ' + b.garantie);
            if (b.marches && b.marches.length > 1) L.push('Mode multi-marché : ' + b.marches.length + ' pays, aucun lieu précis');
            return L.join('\n');
          } catch (e) { return ''; }
        })()
      })
    });
    const data = await resp.json();
    if (data.selectedIds && data.selectedIds.length > 0) {
      const valid = data.selectedIds.filter(function(id) { return !!CT_IMAGES[id]; });
      if (valid.length >= Math.min(count, ids.length)) return completerParCyclage(valid);
    }
  } catch(e) {
    console.warn('[selectCTs] Fallback aléatoire :', e.message);
  }
  return completerParCyclage(ids.sort(function() { return Math.random() - 0.5; }).slice(0, count));
}

export function prodv2BriefTextOnly() {
  const b = prodv2State.brief || {};
  const clean = {};
  for (const k in b) {
    if (k === 'photo_produit' || k === 'logo') {
      clean[k] = (b[k] && b[k].mime) ? `[IMAGE FOURNIE EN PIÈCE JOINTE — ${b[k].mime}]` : '[IMAGE FOURNIE EN PIÈCE JOINTE]';
    } else if (k === 'documents') {
      clean[k] = (b[k] || []).map(d => d.name || 'document');   // le texte intégral est ajouté par le serveur
    } else if (k === 'galerie_images' || k === 'packaging_images' || k === 'avis_captures') {
      clean[k] = Array.isArray(b[k]) ? (b[k].length + ' image(s) fournie(s)') : b[k];
    } else if (k === 'logo_url') {
      clean[k] = b[k] ? '[LOGO FOURNI EN PIÈCE JOINTE]' : '';
    } else {
      clean[k] = b[k];
    }
  }
  return JSON.stringify(clean, null, 2);
}

export function prodv2SplitSynthesisAndMarche(raw) {
  const delimiter = '===DONNEES_MARCHE===';
  const idx = raw.indexOf(delimiter);
  if (idx === -1) {
    console.warn('[Analyste] Délimiteur DONNEES_MARCHE introuvable — données marché absentes pour ce batch.');
    return { synthesisText: raw, marche: null };
  }
  const synthesisText = raw.slice(0, idx).trim();
  let jsonPart = raw.slice(idx + delimiter.length).trim();
  // Tolérance : retire d'éventuels backticks/code fence si le modèle en a mis malgré la consigne
  jsonPart = jsonPart.replace(/^```json\s*/i, '').replace(/^```\s*/,'').replace(/```\s*$/,'').trim();
  let marche = null;
  try {
    marche = JSON.parse(jsonPart);
  } catch(e) {
    console.error('[Analyste] JSON données marché invalide :', e.message, '\nContenu reçu :', jsonPart.slice(0, 500));
  }
  return { synthesisText, marche };
}

export function prodv2ExtractAngles(synthesis, nbAngles=3) {
  // Looks for lines starting with "Angle 1", "Angle 2", ... "Angle N"
  // Retourne TOUS les angles trouvés (pas tronqué à nbAngles) — nécessaire en renouvellement,
  // où la synthèse contient les anciens angles + les nouveaux ajoutés pour cette commande.
  // Le tri "quels angles utiliser pour CETTE production" se fait à l'appel (voir prodv2Launch).
  const angles = [];
  const lines = synthesis.split('\n');
  let current = null;
  for(const line of lines) {
    const m = line.match(/^\*{0,2}\s*Angle\s*(\d+)\s*\*{0,2}\s*[:—–-]?\s*\*{0,2}\s*(.*)/i);
    if(m) {
      if(current) angles.push(current);
      current = { idx: parseInt(m[1])-1, text: m[2].trim() };
    } else if(line.match(/^\s*→/)) {
      // Cause profonde corrigée (angle affiché avec toute la justification technique dans AdBoard) :
      // les lignes "→ Moteur dominant / → Formulation de l'angle" qui suivent le titre dans le
      // format imposé à l'Analyste étaient auparavant ajoutées au nom de l'angle. On arrête ici
      // la capture dès qu'on rencontre ce marqueur — le nom d'angle reste juste le titre court.
      if(current) { angles.push(current); current = null; }
    } else if(current && line.trim() && !line.match(/^S\d\s*[—–-]/)) {
      // Append continuation lines (max ~3 lignes, cas rare où le titre déborde sur 2 lignes)
      if(current.text.length < 120) current.text += ' ' + line.trim();
    } else if(line.match(/^S[3-9]\s*[—–-]/)) {
      if(current) { angles.push(current); current = null; break; }
    }
  }
  if(current) angles.push(current);
  // Pad to nbAngles si on en a trouvé MOINS que prévu (cas normal, pas un renouvellement) —
  // ne tronque jamais si on en a trouvé PLUS (cas renouvellement, tous sont légitimes).
  while(angles.length < nbAngles) angles.push({ idx: angles.length, text: 'Angle ' + (angles.length+1) });
  return angles.map(a => a.text);
}

export function prodv2GetAngleCount() {
  const q = Number(prodv2State.brief?.quantite) || 6;
  const nb = Math.round(q / 3);
  return Math.max(2, Math.min(12, nb));
}

export async function prodv2GenerateOneCopyAttempt(angleIdx, signal) {
  const copywriterSystem = COMP_FILES['COMPETENCE_COPYWRITER_PROD.md'] || '';
  const angle = prodv2State.angles[angleIdx] || ('Angle ' + (angleIdx+1));
  // Consigne durcie : pas de markdown gras autour des labels, pas de labels AIDA visibles
  const userPrompt = `SYNTHÈSE COMPLÈTE :\n${prodv2State.synthesis}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nGÉNÈRE LE COPY POUR L'ANGLE ${angleIdx+1} UNIQUEMENT :\n${angle}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nFORMAT STRICT (RESPECTE-LE EXACTEMENT, sinon le parsing échoue) :\n\nHOOK 1: <texte du hook>\nHOOK 2: <texte du hook>\nHOOK 3: <texte du hook>\nHOOK 4: <texte du hook>\nHOOK 5: <texte du hook>\nDESCRIPTION:\n[BLOC1] <ATTENTION — 1 phrase d'accroche qui nomme la douleur exacte du persona>\n[BLOC2] <INTÉRÊT — 1-2 phrases qui expliquent le problème et introduisent le mécanisme produit>\n[BLOC3] <DÉSIR — OBLIGATOIRE : 3 à 4 bullet points, un par ligne, chacun commençant par "• " suivi d'un emoji pertinent puis du bénéfice concret (avec une donnée chiffrée si disponible dans la synthèse) — jamais un paragraphe de phrases suivies, jamais moins de 3 bullet points, jamais zéro emoji>\n[BLOC4] <ACTION — 1 phrase de CTA — si une offre/promo est active dans le brief (ex: "2 achetés = 1 offert"), mentionne-la explicitement ici pour environ 1 génération sur 5 (pas systématiquement, pour garder de la variété) ; sinon CTA avec le prix/livraison, ou un slogan fort>\n\nEXEMPLE DE BLOC [BLOC3] ATTENDU (structure à respecter, pas le contenu) :\n[BLOC3]\n• 🌿 Une formule 100% naturelle qui nourrit la fibre en profondeur\n• ⚡ Des résultats visibles dès les premières semaines d'utilisation\n• 💧 Une texture non grasse qui pénètre instantanément\n\nINTERDIT ABSOLU :\n- N'utilise PAS de markdown autour des labels (PAS de **HOOK 1:**, PAS de **DESCRIPTION:**)\n- N'utilise PAS de titre/intro avant la liste (PAS de "### ANGLE 1", PAS de "Voici les hooks")\n- Garde les labels [BLOC1] [BLOC2] [BLOC3] [BLOC4] EXACTEMENT comme indiqués, MOT POUR MOT, quelle que soit la langue du marché (S0) — ils servent UNIQUEMENT au parsing technique, ne les traduis JAMAIS, ne les remplace JAMAIS par ATTENTION/INTEREST/DESIRE/ACTION ou toute autre langue. Seul le CONTENU à l'intérieur des blocs est dans la langue du marché.\n- BLOC1/BLOC2/BLOC4 restent en 1-2 phrases courantes (pas de bullet points) — SEUL BLOC3 est en bullet points, ne mélange pas les styles\n- Démarre TA RÉPONSE directement par "HOOK 1:" — aucun préambule\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  // 12 000 tokens — Gemini 2.5 Pro utilise ~3-4k tokens pour "thinking" avant de générer,
  // avec 4000 max il ne lui reste que ~1000 pour le texte → description tronquée
  const text = await apiCopywriter(copywriterSystem, [{ type:'text', text: userPrompt }], 12000, signal);

  // ── Parsing robuste : tolère **, espaces français, casse mixte ──
  // Étape 1 : nettoyer le markdown gras autour des labels pour simplifier les regex
  const cleaned = text
    .replace(/\*\*\s*(HOOK\s*\d|DESCRIPTION)\s*([:：])?\s*\*\*/gi, '$1$2')   // **HOOK 1:** → HOOK 1:
    .replace(/\*\*\s*(HOOK\s*\d|DESCRIPTION)\s*\*\*\s*([:：])/gi, '$1$2');   // **HOOK 1** : → HOOK 1:

  const hooks = [];
  for(let i=1; i<=5; i++) {
    // Tolère : HOOK 1:, HOOK 1 :, **HOOK 1:**, accepte deux-points français ":" ou japonais "："
    const m = cleaned.match(new RegExp(
      'HOOK\\s*' + i + '\\s*[:：]\\s*([\\s\\S]+?)(?=\\n\\s*\\**\\s*HOOK\\s*\\d|\\n\\s*\\**\\s*DESCRIPTION|$)',
      'i'
    ));
    if(m) hooks.push(m[1].trim().replace(/^\*+|\*+$/g, '').trim());
  }

  // Description : tout après DESCRIPTION:
  let description = '';
  const descMatch = cleaned.match(/DESCRIPTION\s*[:：]\s*([\s\S]+)$/i);
  if(descMatch) {
    const rawDesc = descMatch[1].trim();
    // Parsing tolérant : Gemini varie parfois le format malgré la consigne stricte — crochets
    // [ATTENTION], gras **ATTENTION :**, ou avec préfixe "Bloc 1 — ATTENTION" comme dans les
    // exemples du fichier de compétences. On accepte toutes ces variantes à l'extraction.
    // Cause profonde corrigée (bullet coupé en plein milieu, ex: "...pour une" puis saut de
    // ligne parasite puis "profonde.") : la détection de fin de bloc ne demandait rien pour
    // distinguer un vrai label ("ACTION :") d'une occurrence normale du même mot dans le texte
    // ("une action profonde") — n'importe quelle phrase contenant ce mot coupait le parsing au
    // mauvais endroit. On exige maintenant que le label soit en DÉBUT DE LIGNE, jamais au milieu
    // d'une phrase — c'est la seule façon fiable de distinguer un vrai label d'un mot normal.
    // Cause profonde corrigée (texte dupliqué/empilé de façon chaotique dans la description) :
    // les labels étaient en français (ATTENTION/INTÉRÊT/DÉSIR/ACTION) même pour un marché en
    // anglais — Gemini écrivait alors "INTEREST"/"DESIRE" (anglais) au lieu de "INTÉRÊT"/"DÉSIR",
    // que le parsing ne reconnaissait jamais, faisant échouer toute la découpe en 4 blocs et
    // retomber sur un texte brut mal structuré. Les labels sont maintenant des marqueurs neutres
    // (BLOC1-4) qui ne dépendent d'aucune langue — tolérance conservée pour les anciens labels
    // français/anglais en filet de sécurité si jamais Gemini s'en écarte encore.
    const aAttn = rawDesc.match(/(?:^|\n)\s*\*{0,2}\s*(?:Bloc\s*1\s*[—-]\s*)?(?:\[(?:BLOC1|ATTENTION)\]|(?:BLOC1|ATTENTION)\s*[:：])\s*([\s\S]+?)(?=(?:^|\n)\s*\*{0,2}\s*(?:Bloc\s*2\s*[—-]\s*)?(?:\[(?:BLOC2|INT(?:ÉRÊT|ERET))\]|(?:BLOC2|INT(?:ÉRÊT|ERET))\s*[:：])|$)/i);
    const aIntr = rawDesc.match(/(?:^|\n)\s*\*{0,2}\s*(?:Bloc\s*2\s*[—-]\s*)?(?:\[(?:BLOC2|INT(?:ÉRÊT|ERET))\]|(?:BLOC2|INT(?:ÉRÊT|ERET))\s*[:：])\s*([\s\S]+?)(?=(?:^|\n)\s*\*{0,2}\s*(?:Bloc\s*3\s*[—-]\s*)?(?:\[(?:BLOC3|D(?:ÉS|ES)IRE?)\]|(?:BLOC3|D(?:ÉS|ES)IRE?)\s*[:：])|$)/i);
    const aDesir= rawDesc.match(/(?:^|\n)\s*\*{0,2}\s*(?:Bloc\s*3\s*[—-]\s*)?(?:\[(?:BLOC3|D(?:ÉS|ES)IRE?)\]|(?:BLOC3|D(?:ÉS|ES)IRE?)\s*[:：])\s*([\s\S]+?)(?=(?:^|\n)\s*\*{0,2}\s*(?:Bloc\s*4\s*[—-]\s*)?(?:\[(?:BLOC4|ACTION)\]|(?:BLOC4|ACTION)\s*[:：])|$)/i);
    const aAct  = rawDesc.match(/(?:^|\n)\s*\*{0,2}\s*(?:Bloc\s*4\s*[—-]\s*)?(?:\[(?:BLOC4|ACTION)\]|(?:BLOC4|ACTION)\s*[:：])\s*([\s\S]+)$/i);
    if(aAttn && aIntr && aDesir && aAct) {
      // Cause profonde corrigée : les labels ne servent qu'à structurer la génération de
      // Gemini — ils ne doivent JAMAIS apparaître dans le texte final copié dans Ads Manager.
      description = [
        aAttn[1].trim(),
        aIntr[1].trim(),
        aDesir[1].trim(),
        aAct[1].trim()
      ].join('\n\n');
    } else {
      // Fallback : garder le texte brut en nettoyant les anciens labels si présents
      description = rawDesc;
    }
  }
  // Filet de sécurité final — s'applique quoi qu'il arrive, même si un label a échappé aux
  // deux passes ci-dessus (variante non anticipée). Ne doit jamais laisser un label visible.
  const stripAidaLabels = (t) => t
    .replace(/\*{0,2}[ \t]*(?:Bloc\s*\d\s*[—-]\s*)?\[?(?:ATTENTION|INT(?:ÉRÊT|ERET)|D(?:ÉS|ES)IR|ACTION)\]?[ \t]*[:：]?[ \t]*\*{0,2}[ \t]*/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (description) description = stripAidaLabels(description);
  if(!description) description = '(description vide — Gemini n\'a pas suivi le format)';

  return { hooks, description };
}

export function prodv2EstActuellementComplet() {
  if (!prodv2State.commandeId) return true; // rien de chargé, rien à perdre
  const nbAnglesAttendu = prodv2GetAngleCount();
  const nbCreaAttendu = nbAnglesAttendu * 3;
  const nbCrea = (prodv2State.creatives || []).filter(c => c && (c.imgB64 || c.url)).length;
  const nbCopy = (prodv2State.copies || []).filter(Boolean).length;
  return nbCrea >= nbCreaAttendu && nbCopy >= nbAnglesAttendu;
}

export function _vctNiveau(x){
  const t = String(x || '').toLowerCase();
  if(/problem|probl/.test(t)) return 'Problem Aware';
  if(/solution/.test(t)) return 'Solution Aware';
  if(/product|produit/.test(t)) return 'Product Aware';
  if(/most|plus/.test(t)) return 'Most Aware';
  return null;
}

export function _vctAwDuTexte(texte){
  const m = texte.match(/"awareness"\s*:\s*\[([^\]]*)\]/); if(!m) return [];
  return m[1].split(',').map(x => _vctNiveau(x)).filter(Boolean);
}

export function _vctNomDuTexte(texte, fichier){
  const m = texte.match(/"name"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  let n = ''; try { n = m ? JSON.parse('"' + m[1] + '"').trim() : ''; } catch(e){}
  return n || String(fichier || 'CT vidéo').replace(/\.(md|txt)$/i, '').replace(/^CT_VIDEO_\d*_?/i, '').replace(/_/g, ' ');
}

export function _vctExtra(o){
  const r = {};
  _VCT_EXTRA_CLES.forEach(function(k){ if(o && o[k] !== undefined && o[k] !== null && o[k] !== '' && !(Array.isArray(o[k]) && !o[k].length)) r[k] = o[k]; });
  return r;
}

export function _vctFicheDuTexte(texte){
  const m = String(texte).match(/M[ÉE]TADONN[ÉE]ES DE S[ÉE]LECTION[\s\S]*?```json\s*([\s\S]*?)```/i);
  if(!m) return null;
  let j; try { j = JSON.parse(m[1]); } catch(e){ return null; }
  const arr = function(v){ return Array.isArray(v) ? v.map(String) : (v ? [String(v)] : []); };
  const num = function(v){ const n = Number(v); return isFinite(n) && n > 0 ? n : undefined; };
  return {
    name: j.name ? String(j.name) : '',
    meta: j.meta ? String(j.meta) : '',
    awareness: arr(j.awareness).map(function(x){ return _vctNiveau(x); }).filter(Boolean),
    awareness2: arr(j.awareness_secondaire).map(function(x){ return _vctNiveau(x); }).filter(Boolean),
    styleTags: arr(j.styleTags).map(function(x){ return x.toLowerCase().replace(/^#/,'').trim(); }).filter(Boolean),
    niches: arr(j.niche),
    duree_s: num(j.duree_s), blocs: num(j.blocs), mots_par_seconde: num(j.mots_par_seconde),
    produit_compatible: j.produit_compatible ? String(j.produit_compatible) : '',
    angles_fit: arr(j.angles_fit),
    hook: j.hook_framework_impose ? String(j.hook_framework_impose) : '',
    chute: j.point_de_chute_prefere ? String(j.point_de_chute_prefere) : '',
    lieux_interdits: arr(j.lieux_interdits),
    epic: j.epic_quadrant ? String(j.epic_quadrant) : ''
  };
}

export function _vctAppliquerFiche(rec, f, ecraser){
  if(!f) return false;
  let change = false;
  const poser = function(k, v){
    const vide = (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length));
    if(vide) return;
    const ici = rec[k], icivide = (ici === undefined || ici === null || ici === '' || (Array.isArray(ici) && !ici.length));
    if(ecraser || icivide){ if(JSON.stringify(ici) !== JSON.stringify(v)){ rec[k] = v; change = true; } }
  };
  ['name','meta','awareness','styleTags'].forEach(function(k){ poser(k, f[k]); });
  _VCT_EXTRA_CLES.forEach(function(k){ poser(k, f[k]); });
  if(f.niches && f.niches.length) poser('niche', f.niches.join(', '));
  return change;
}

export const _VCT_EXTRA_CLES = ['duree_s','blocs','mots_par_seconde','niches','produit_compatible','angles_fit','hook','chute','lieux_interdits','epic','awareness2']

export async function buildAnalysteInputs(nbAngles, nbCreativesTotal) {
    const analysteSystem = (COMP_FILES['COMPETENCE_ANALYSTE.md'] || COMP_FILES['ANALYSTE_DE_MARCHÉ.md'] || '');
    // Injecter l'URL en tête de manière très explicite pour que l'agent ne la manque pas
    const _briefUrl = (prodv2State.brief || {}).lien_page_produit || '';
    const _urlHeader = _briefUrl
      ? '⚠️ URL PAGE PRODUIT CLIENT (PRIORITÉ ABSOLUE — utilise cette URL pour analyser la page) :\n'
        + _briefUrl + '\n\n'
      : '';
    // Nombre d'angles imposé explicitement — l'Analyste ne doit plus supposer 3 par défaut
    // Date réelle du jour — sans ça, le modèle ne peut que deviner "l'année actuelle" pour tout
    // ce qui en dépend (taille_marche_historique, saisonnalité, fraîcheur d'une donnée trouvée
    // dans DONNÉES BRUTES). Cause profonde du bug "2024 mis en avant comme année actuelle" :
    // cette info n'existait nulle part dans le prompt avant ce fix.
    const _dateHeader = `⚠️ DATE RÉELLE D'AUJOURD'HUI (NON-NÉGOCIABLE, sers-t'en pour TOUT ce qui dépend du temps — historique de marché, saisonnalité, fraîcheur d'une donnée) : ${new Date().toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long', year:'numeric'})}. Ne devine JAMAIS l'année courante depuis ta mémoire interne — utilise UNIQUEMENT celle-ci.\n\n`;
    const ag = prodv2State.renewalContext?.angleGagnant;
    const _nbAnglesHeader = ag
      ? `⚠️ NOMBRE D'ANGLES À PRODUIRE POUR CETTE COMMANDE (NON-NÉGOCIABLE) : ${nbAngles}\nCette commande porte sur ${nbCreativesTotal} visuels (3 par angle). Sur ces ${nbAngles} angles : 1 est l'ANGLE_GAGNANT ci-dessous (repris tel quel, pas reconstruit), les ${nbAngles - 1} autres sont NOUVEAUX et distincts, construits selon le processus habituel. S2 ne contient que ces ${nbAngles} angles au total.\n\n`
      : `⚠️ NOMBRE D'ANGLES ${prodv2State.renewalContext?.estRenouvellement ? 'NOUVEAUX ' : ''}À PRODUIRE POUR CETTE COMMANDE (NON-NÉGOCIABLE) : ${nbAngles}\nCette commande porte sur ${nbCreativesTotal} visuels (3 par angle) — tu dois donc construire exactement ${nbAngles} angles ${prodv2State.renewalContext?.estRenouvellement ? 'NOUVEAUX ' : ''}distincts en S2, ni plus ni moins, peu importe le nombre habituel. ${prodv2State.renewalContext?.estRenouvellement ? "S2 ne contient QUE ces angles — ne recopie jamais les anciens dedans, ils restent seulement dans l'historique fourni plus bas pour éviter les répétitions." : ''}\n\n`;

    // ── Angle gagnant (feedback loop Top Performer) — voir GESTION DU VOLUME ÉTENDU ET DE
    // L'ANGLE GAGNANT dans COMPETENCE_ANALYSTE.md. Repris tel quel, jamais reconstruit — un
    // des ${nbAngles} angles de S2 doit être CET angle, pas un nouveau construit à partir de lui.
    const _angleGagnantHeader = ag
      ? `⚠️ ANGLE_GAGNANT (feedback loop — voir GESTION DU VOLUME ÉTENDU ET DE L'ANGLE GAGNANT dans tes instructions) :\nNom : ${ag.nom}\nJustification d'origine : ${ag.justification || '(non renseignée)'}\nOrigine : ${ag.batchOrigine || 'batch précédent'}, marqué performant par le client.\n\nUn des ${nbAngles} angles de S2 doit être CET angle, repris tel quel (même formulation, même nom) — pas reconstruit. Les créatives qui lui sont allouées doivent utiliser des concepts visuels ENTIÈREMENT NOUVEAUX, jamais une reprise de ce qui a déjà été produit pour lui.\n\n`
      : '';

    // ── Contexte de renouvellement — injecté uniquement si ce n'est pas la première commande
    // sur ce produit (voir MODE RENOUVELLEMENT dans le fichier de compétences) ──
    let _renewalHeader = '';
    const rctx = prodv2State.renewalContext;
    if (rctx?.estRenouvellement && rctx.syntheseExistante) {
      _renewalHeader = `⚠️ COMMANDE DE RENOUVELLEMENT — CE N'EST PAS LA PREMIÈRE COMMANDE SUR CE PRODUIT :\nROTATION NÉCESSAIRE : ${rctx.rotationNecessaire ? 'OUI' : 'NON'}\n${rctx.cibleActuelle ? `CIBLE ACTUELLE (dernier lot livré) : ${rctx.cibleActuelle} (${rctx.nbAnglesCibleCourante} angle(s) déjà exploité(s) sur cette cible)` : ''}\n\nANGLES DÉJÀ EXPLOITÉS DANS L'HISTORIQUE DE CE PRODUIT (toutes cibles confondues — à ne JAMAIS reproduire, même après une rotation de cible) :\n${(rctx.anglesHistorique && rctx.anglesHistorique.length) ? rctx.anglesHistorique.map(n => `- ${n}`).join('\n') : '(aucun — vérifier quand même DONNÉES BRUTES pour éviter les évidences du marché)'}\n\nSYNTHÈSE EXISTANTE POUR CE PRODUIT :\n${rctx.syntheseExistante}\n\n(Voir section MODE RENOUVELLEMENT de tes instructions pour savoir exactement quoi faire de cette synthèse existante — notamment comparer le champ cible du BRIEF ci-dessous à la cible actuelle indiquée plus haut.)\n\n`;
    }

    const analysteParts = [
      { type: 'text', text: _dateHeader + _renewalHeader + _nbAnglesHeader + _angleGagnantHeader + _urlHeader + 'BRIEF (JSON) :\n' + prodv2BriefTextOnly() },
      { type: 'image', source: { type:'base64', media_type: prodv2State.productMime, data: prodv2State.productB64 } }
    ];
    if(prodv2State.logoB64) {
      analysteParts.push({ type:'image', source:{ type:'base64', media_type: prodv2State.logoMime, data: prodv2State.logoB64 } });
    }
    // v7.2 — logo, emballage et autres angles du produit : chargés ici pour que l'Analyste les REGARDE
    // (description précise du logo en S11, vérification du packaging). Jamais bloquant : un échec = on continue sans.
    try {
      const _b = prodv2State.brief || {};
      const _charger = async (url) => {
        try {
          const r = await fetch(url); if (!r.ok) return null;
          const blob = await r.blob();
          const dataUrl = await new Promise((ok, ko) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = ko; fr.readAsDataURL(blob); });
          const m = String(dataUrl).match(/^data:(image\/[a-z+]+);base64,(.+)$/);
          if (!m) return null;
          let mime = m[1], data = m[2];
          if (!/png|jpeg|webp/.test(mime)) return null;
          if (mime !== 'image/png') { try { const c = await Promise.race([compressImg(data, mime), new Promise(r => setTimeout(() => r(null), 8000))]); if (c) { data = c; mime = 'image/jpeg'; } } catch(e) {} }
          return { mime, data };
        } catch(e) { return null; }
      };
      if (!prodv2State.logoB64 && _b.logo_url) {
        const lg = await _charger(_b.logo_url);
        if (lg) { analysteParts.push({ type:'text', text:'IMAGE SUIVANTE = LOGO DU CLIENT (à décrire avec une précision maximale dans S11 — FICHE LOGO) :' }); analysteParts.push({ type:'image', source:{ type:'base64', media_type: lg.mime, data: lg.data } }); }
      }
      const _sup = [];
      // v7.3 — plus d'« emballage » : chaque photo porte un ASPECT (face, côté, dos, forme, préparé, en main, détail).
      const _ASP = { face:'FACE', cote:'CÔTÉ', dos:'DOS (étiquette arrière)', forme:'LE PRODUIT LUI-MÊME (poudre, gélule, texture…)', prepare:'PRÉPARÉ / EN USAGE', en_main:'EN MAIN', detail:'DÉTAIL', kit:'KIT / CADEAUX OFFERTS AVEC LE PRODUIT' };
      const _asps = _b.galerie_aspects || {};
      (_b.packaging_images || []).slice(0, 2).forEach(u => _sup.push(['AUTRE VUE DU PRODUIT', u])); // anciens briefs
      const _prep = Array.isArray(_b.photos_produit) ? _b.photos_produit : [];
      if (_prep.length) {
        // v7.9 : on envoie TOUS les aspects préparés (6 max), sauf la principale déjà jointe plus haut, avec leur code d'aspect.
        _prep.filter(p => !p.exclue && !p.principale && p.url).forEach(p => _sup.push(['ASPECT ' + String(p.aspect).toUpperCase() + ' — ' + (_ASP[p.aspect] || 'AUTRE ANGLE'), p.url]));
      } else {
        (_b.galerie_images || []).filter(u => u !== _b.photo_url).slice(0, 5).forEach(u => _sup.push([_asps[u] && _ASP[_asps[u]] ? 'ASPECT DU PRODUIT : ' + _ASP[_asps[u]] : 'AUTRE ANGLE DU PRODUIT', u]));
      }
      for (const [lib, u] of _sup) {
        const im = await _charger(u);
        if (im) { analysteParts.push({ type:'text', text:'IMAGE SUIVANTE = ' + lib + ' (même produit que la photo principale ; sert à comprendre le mécanisme, le format, l\'étiquette et la composition) :' }); analysteParts.push({ type:'image', source:{ type:'base64', media_type: im.mime, data: im.data } }); }
      }
    } catch(e) { console.warn('[Analyste] images supplémentaires ignorées :', e.message); }
  return { analysteSystem, analysteParts }
}

export function buildCreativeInstruction(angleIdx, ctPositionInAngle) {
  const creativeSystem = COMP_FILES['COMPETENCE_CREATIVE_PROD.md'] || '';
  const angle = prodv2State.angles[angleIdx] || ('Angle ' + (angleIdx+1));
  const nbAnglesTotal = prodv2State.angles.length || 2;
  const nbCreativesTotalRun = nbAnglesTotal * 3;

  // ── Routing niveau de conscience par position CT dans l'angle ──
  // ctPositionInAngle : 0 → Solution Aware, 1 → Product Aware, 2 → Most Aware
  const niveauxConscience = ['Solution Aware', 'Product Aware', 'Most Aware'];
  const consciencePos = ctPositionInAngle; // 0, 1 ou 2
  const niveauConscience = niveauxConscience[consciencePos];

  const angleInstruction = `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nANGLE IMPOSÉ POUR CETTE CRÉATIVE (NON-NÉGOCIABLE) :\nAngle ${angleIdx+1} — ${angle}\n\n⛔ INTERDICTION ABSOLUE : tu ne dois PAS choisir un autre angle. L'angle ${angleIdx+1} est déjà sélectionné par l'orchestrateur. La PHASE de choix d'angle est NEUTRALISÉE.\n\n✅ DANS TON BLOC ===META===, tu écris OBLIGATOIREMENT : "ANGLE CHOISI : ${angleIdx+1} · ${angle}"\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚠️ TAILLE RÉELLE DE CE RUN (prime sur toute mention "3 angles"/"9 créatives" du fichier de compétences, qui décrit le cas le plus courant mais pas systématique) :\nCette commande compte ${nbAnglesTotal} angles au total (pas nécessairement 3) et ${nbCreativesTotalRun} créatives au total (pas nécessairement 9) — 3 niveaux de conscience par angle, comme toujours.\n\nROUTAGE ${nbAnglesTotal} ANGLES × 3 NIVEAUX DE CONSCIENCE (NON-NÉGOCIABLE) :\nCette créative est la créative n°${consciencePos+1} de l'Angle ${angleIdx+1}.\n\nNIVEAU DE CONSCIENCE IMPOSÉ : ${niveauConscience}. Utilise la déclinaison "${niveauConscience}" de l'Angle ${angleIdx+1} telle que définie dans S3 de la synthèse (ton, instructions spécifiques, dosage peur/désir-douleur — voir RÈGLE V4.3).\n\n✅ Dans le bloc ===META===, déclare :\n   NIVEAU DE CONSCIENCE CHOISI : ${niveauConscience}\n   MOTEUR DOMINANT : [peur/désir/douleur de l'Angle ${angleIdx+1}, depuis S2]\n   VARIABLE UNIQUE DE CETTE CRÉATIVE PAR RAPPORT AUX ${nbCreativesTotalRun-1} AUTRES : Niveau ${niveauConscience} · Angle ${angleIdx+1} · Concept CT [type observé en IMAGE 2]\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  return { creativeSystem, angleInstruction }
}

export function buildCopyPromptUnused(){}
