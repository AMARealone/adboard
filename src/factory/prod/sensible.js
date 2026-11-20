// meta-sensible-v1 (19 nov. 2026) — PRODUITS SENSIBLES ET RÈGLES META.
// Décision du fondateur : rendre les créatives plus « propres » aux yeux de Meta SANS casser le ton. Le motif d'achat dominant
// (le « soleil ») ne bouge pas : chaque angle reste en orbite autour du même désir / du même problème, avec la même douleur
// psychologique, dite directement. Ce qui change, c'est la FORMULATION (3e personne, désir, témoignage) et le VISUEL
// (pas d'avant/après, pas de gros plan sur le corps). En plus : une MENTION LÉGALE (« claim ») quasi invisible à l'œil nu mais
// lisible par la machine (Andromeda lit la créative pixel par pixel) qui responsabilise la marque.
//   - CT image : les CT qui portent déjà une petite mention sont préférés ; sinon le contrôle qualité vérifie et le code
//     appose une mention propre, discrète, à la couleur du bas de l'image (jamais de texte inventé par le modèle d'image).
//   - Vidéo : la mention est incrustée en bas de toute la vidéo par le moteur (ligne MENTION_META des consignes).
import { prodv2State as S } from './state'

const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9%+ ]+/g, ' ').replace(/\s+/g, ' ')

// Catégories : motifs (texte normalisé), niveau (2 = très surveillé par Meta, 1 = surveillé), mots à ne pas écrire en clair et
// leurs remplacements qui gardent la même force.
export const CATEGORIES = {
  sexualite: { lib: 'santé sexuelle', niveau: 2, re: /erection|erectile|sexuel|sexualite|libido|aphrodisia|ejaculat|impuissan|bander|bandaison|vigueur sex|puissance sex|endurance (au lit|sex)|performance sex|au lit|intime|intimite|vaginal|vagin|retrecissement|penis|zizi|panne (au lit|sex)|faiblesse sexuelle|baisse de desir|plaisir feminin|orgasme|prostate/,
    eviter: '« érection », « pénis », « sexe », « éjaculation », « impuissance », « faiblesse sexuelle », « bander »',
    remplacer: '« vigueur », « endurance », « confiance au lit » (sans image suggestive), « retrouver sa force d\'homme », « le moment à deux », « elle le remarque »' },
  poids: { lib: 'minceur / poids', niveau: 2, re: /minceur|mincir|maigrir|perte de poids|perdre du poids|kilos? (en|perdus|de moins|en trop)|kg en|ventre plat|graisse|brule graisse|coupe faim|amincissant|cellulite|prise de poids|grossir|prendre des fesses|fessier|hanches|tour de taille|obesite|surpoids/,
    eviter: '« perdez X kg », « en X jours », « brûle les graisses », « gros », « obèse », « ventre qui pend »',
    remplacer: '« se sentir légère », « retrouver sa silhouette », « elle a remis sa robe », « accompagne une alimentation équilibrée »' },
  sante: { lib: 'santé', niveau: 2, re: /diabete|glycemie|tension arterielle|hypertension|hemorroide|arthrose|rhumatisme|cholesterol|infection|guerir|guerison|traitement|maladie|ulcere|fertilite|infertilite|enceinte|grossesse|regles douloureuses|fibrome|kyste|asthme|sinusite|migraine|douleurs? articulaire|varices|insomnie|anxiete|depression|paludisme|vers intestinaux|hepatite/,
    eviter: '« guérit », « soigne », « traitement », « remplace vos médicaments », « fini le diabète »',
    remplacer: '« aide à », « soutient », « contribue au confort de », « retrouver des journées sereines »' },
  corps: { lib: 'peau / corps', niveau: 1, re: /eclaircissant|blanchiment|blanchissant|depigment|vergeture|acne|cicatrice|taches? (brunes|noires|de peau)|peau claire|anti age|rides|poitrine|seins|raffermi|agrandissement|grossir les|chute de cheveux|calvitie|alopecie|pousse (des )?cheveux|repousse/,
    eviter: '« blanchit la peau », « éclaircit », « fait disparaître », « agrandit », « avant / après »',
    remplacer: '« teint unifié », « peau nette et lumineuse », « elle a retrouvé confiance », « cheveux plus denses au regard »' },
  argent: { lib: 'argent / opportunité', niveau: 1, re: /devenir riche|gagner de l argent|revenus? passifs?|trading|crypto|forex|investissement garanti|business en ligne|argent facile|millionnaire|paris sportifs|pronostic/,
    eviter: '« gagnez X par jour », « garanti », « devenez riche »',
    remplacer: '« apprendre une méthode », « ceux qui s\'y mettent sérieusement », « des résultats qui dépendent de chacun »' },
}

let cache = { cle: null, val: null }
// Lecture du brief (et du début de l'hypothèse) : niveau max et catégories touchées. Calcul mémorisé par commande.
export function analyser() {
  const b = S.brief || {}
  const cle = (S.commandeId || '') + '|' + (b.produit || '') + '|' + String(S.synthesis || '').length
  if (cache.cle === cle) return cache.val
  const txt = norm([b.produit, b.nom, b.utilite, b.description, b.promesse, b.benefices, b.cible, b.categorie, b.notes, b.probleme, String(S.synthesis || '').slice(0, 5000)].filter(Boolean).join(' '))
  const cats = Object.keys(CATEGORIES).filter((k) => CATEGORIES[k].re.test(txt))
  const niveau = cats.reduce((m, k) => Math.max(m, CATEGORIES[k].niveau), 0)
  cache = { cle, val: { niveau, categories: cats, libelle: cats.map((k) => CATEGORIES[k].lib).join(', ') } }
  return cache.val
}
export const estSensible = () => analyser().niveau > 0

const ANGLAIS = /nigeria|ghana|kenya|tanzan|ougand|uganda|zamb|afrique du sud|south africa|liberia|sierra leone|gambi/i
const marque = () => String((typeof S.marqueAffichee === 'string' && S.marqueAffichee) || (S.brief && (S.brief.marque || S.brief.produit)) || 'La marque').trim().slice(0, 40)

// La mention : personnalisée au nom de la marque, adaptée aux catégories touchées. Courte (≈ 200 caractères), factuelle.
export function claim() {
  const a = analyser(); if (!a.niveau) return ''
  const m = marque(), en = ANGLAIS.test(String((S.brief && S.brief.pays) || ''))
  const c = new Set(a.categories)
  if (en) {
    let t = `*${m} is solely responsible for this product and the claims in this ad. Results vary from person to person.`
    if (c.has('sexualite') || c.has('sante')) t += ' Wellness product, not a substitute for medical advice. Adults only.'
    else if (c.has('poids')) t += ' Best combined with a balanced diet and physical activity.'
    else if (c.has('corps')) t += ' For external use. Patch test before first use.'
    else if (c.has('argent')) t += ' No earnings are guaranteed.'
    return t
  }
  let t = `*${m} est seule responsable de ce produit et des allégations de cette publicité. Résultats variables selon les personnes.`
  if (c.has('sexualite') || c.has('sante')) t += ' Produit de bien-être, ne remplace pas un avis médical. Réservé aux adultes.'
  else if (c.has('poids')) t += ' À associer à une alimentation équilibrée et à une activité physique.'
  else if (c.has('corps')) t += ' Usage externe, testez sur une petite zone avant la première utilisation.'
  else if (c.has('argent')) t += ' Aucun gain n\'est garanti.'
  return t
}

// ── Règles communes à tous les agents : le soleil ne bouge pas, seule la formulation change ──
function regles() {
  const a = analyser()
  const cats = a.categories.map((k) => CATEGORIES[k])
  return '⚠️ PRODUIT SENSIBLE SUR META (' + a.libelle + ') — RÈGLES « PASSER SOUS LES RADARS SANS PERDRE LA VENTE » (meta-sensible-v1)\n'
    + '1. LE SOLEIL NE BOUGE PAS : le motif d\'achat dominant (le désir ou le problème principal) reste le centre de CHAQUE angle, avec la même douleur psychologique et le même ton direct. Un angle qui s\'éloigne de ce désir pour paraître « propre » ne vend pas : interdit. Rendre la pub acceptable par Meta = changer la FORMULATION, jamais le SUJET ni l\'intensité émotionnelle.\n'
    + '2. JAMAIS D\'ATTRIBUTION DIRECTE AU SPECTATEUR : pas de « vous souffrez de… », « votre ventre… », « tu as des problèmes de… ». Dis-le à la 3e personne (« beaucoup d\'hommes après 40 ans… »), en témoignage (« il m\'a dit… »), en désir ou en résultat de vie (« retrouver… », « elle l\'a remarqué »). La douleur reste nommée, frontale, émotionnelle.\n'
    + '3. AUCUNE PROMESSE CORPORELLE CHIFFRÉE OU DATÉE (« -10 kg en 7 jours », « 100 % garanti », « résultat en 3 jours ») et aucun mot de guérison médicale (guérit, soigne, traitement). Le mécanisme se dit avec « aide à », « soutient ».\n'
    + (cats.length ? '4. MOTS À NE PAS ÉCRIRE EN CLAIR : ' + cats.map((c) => c.eviter).join(' ; ') + '. À LA PLACE, même force : ' + cats.map((c) => c.remplacer).join(' ; ') + '.\n' : '')
    + '5. VISUEL : pas d\'avant/après côte à côte, pas de gros plan sur une partie du corps visée (ventre, poitrine, entrejambe, fesses, peau abîmée), pas de nudité ni de geste ou d\'objet suggestif, pas de mètre ruban sur un corps. Montre l\'émotion, la relation, la situation de vie, la fierté retrouvée, le produit en main.\n'
}

export function blocAnalyste() {
  if (!estSensible()) return ''
  return regles() + 'POUR TOI (analyste) : pose le motif d\'achat dominant en clair dans S1 comme d\'habitude ; puis formule chaque angle (nom et promesse) selon les règles 2 à 4 — le nom d\'angle se lit sans mot interdit, mais vise exactement le même désir.\n\n'
}
export function blocCopy() {
  if (!estSensible()) return ''
  return regles() + 'POUR TOI (copywriter) : chaque hook garde la force d\'un hook direct, avec le sujet nommé dès les premiers mots selon les règles 2 à 4. Les titres et le texte principal restent percutants : un texte qui ne nomme plus la douleur ne vend plus.\n\n'
}
export function blocImage(mention) {
  if (!estSensible()) return ''
  return regles() + 'POUR TOI (créative image) : le hook principal garde le ton direct (règles 2 à 4). MENTION LÉGALE : si le CT porte une toute petite mention en bas (texte légal, astérisque), garde sa place et son style et écris-y exactement, en très petit : « ' + mention + ' ». '
    + 'S\'il n\'en porte pas, n\'en invente pas : laisse simplement libre la toute petite bande du bas de l\'image (aucun texte important dans les 3 % du bas), la mention y sera posée après.\n\n'
}
export function blocCT() {
  if (!estSensible()) return ''
  return '⚠️ PRODUIT SENSIBLE SUR META (' + analyser().libelle + ') : la mention légale est AJOUTÉE automatiquement si le CT n\'en porte pas : ne choisis donc JAMAIS un CT pour sa mention (c\'est ce qui faisait revenir toujours les mêmes). Choisis d\'abord pour l\'intention psychologique et la variété de mise en page du lot. Évite les CT construits sur un avant/après côte à côte ou un gros plan sur une partie du corps.\n\n'
}
export function blocVideo() {
  if (!estSensible()) return ''
  return regles() + 'POUR TOI (vidéo) : la première phrase de la voix off nomme le désir ou la douleur selon les règles 2 à 4, sans perdre la dynamique des créateurs actuels. Ne mets AUCUNE mention légale toi-même : elle est incrustée en bas de toute la vidéo après le montage.\n'
    + 'MENTION_META: ' + claim() + '\n'
}
export function blocControle() {
  if (!estSensible()) return ''
  return regles() + 'MENTION LÉGALE ATTENDUE (ou équivalente) : « ' + claim() + ' »'
}

// ── Apposer la mention sur une image (navigateur) : bande du bas, très petite, couleur tirée du fond, jamais sur le sujet ──
export async function apposerMention(b64, mime, texte) {
  if (!b64 || !texte) return null
  const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error('image illisible')); i.src = 'data:' + (mime || 'image/png') + ';base64,' + b64 })
  const W = img.naturalWidth, H = img.naturalHeight
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H
  const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0)
  const fs = Math.max(9, Math.round(H * 0.0105))
  ctx.font = `500 ${fs}px Arial, Helvetica, sans-serif`
  // découpe en lignes à 92 % de la largeur
  const mots = String(texte).split(/\s+/), lignes = []; let l = ''
  for (const m of mots) { const t = l ? l + ' ' + m : m; if (ctx.measureText(t).width > W * 0.92 && l) { lignes.push(l); l = m } else l = t }
  if (l) lignes.push(l)
  const pas = Math.round(fs * 1.22), bas = Math.round(H * 0.012)
  const yTop = H - bas - pas * lignes.length
  // couleur : luminance moyenne de la bande du bas
  const zone = ctx.getImageData(0, Math.max(0, yTop - 4), W, Math.min(H - Math.max(0, yTop - 4), pas * lignes.length + bas + 4)).data
  let lum = 0, n = 0; for (let i = 0; i < zone.length; i += 16) { lum += 0.2126 * zone[i] + 0.7152 * zone[i + 1] + 0.0722 * zone[i + 2]; n++ }
  lum = n ? lum / n / 255 : 0.5
  ctx.fillStyle = lum > 0.55 ? 'rgba(20,20,20,0.62)' : 'rgba(255,255,255,0.66)'
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'
  // fin liseré de la couleur opposée : la mention reste lisible pour la machine même quand elle passe sur un objet d'une autre couleur
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(1.5, fs * 0.2); ctx.strokeStyle = lum > 0.55 ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)'
  lignes.forEach((t, k) => { ctx.strokeText(t, W / 2, yTop + k * pas); ctx.fillText(t, W / 2, yTop + k * pas) })
  const out = cv.toDataURL('image/png')
  return { b64: out.split(',')[1], mime: 'image/png' }
}
