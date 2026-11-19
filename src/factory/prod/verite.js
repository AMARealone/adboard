// verite-v1 — UNE SEULE VÉRITÉ PAR ANGLE, PARTAGÉE PAR L'IMAGE, L'AD COPY ET LA VIDÉO.
// Production test 6 : une image disait « cette panne n'est pas due au stress », la vidéo du même angle disait « le stress l'aggrave »,
// et l'ad copy finissait sur « avant la rupture des 9 dernières pièces » (aucun stock dans le brief). Chaque agent improvisait
// ses propres faits. Ici, une seule lecture de la synthèse et du brief fixe, pour chaque angle : la promesse, la cause du problème
// telle que la synthèse la dit, ce qu'on peut affirmer, ce qu'on ne dit pas, et l'offre vraie. Les agents écrivent librement
// (procédés, émotion, mots), mais à partir des mêmes faits.
// Le nom de marque affichable se décide ici aussi : un champ « marque » qui contient plusieurs sociétés n'est jamais écrit tel quel.
// Rien ici ne bloque une production : si un appel échoue, chaque agent travaille comme avant.
import { prodv2State as S } from './state'
import { apiCopywriter } from './verbatim'

const json = (t) => { const s = String(t || ''); const i = s.indexOf('{'), j = s.lastIndexOf('}'); if (i < 0 || j <= i) return null; try { return JSON.parse(s.slice(i, j + 1)) } catch (_) { return null } }
const court = (x, n) => String(x == null ? '' : x).replace(/\s+/g, ' ').trim().slice(0, n)

// ── 1. le nom de marque à écrire sur les livrables ──
// Un nom simple (« AS TRADE », « BeeVenom ») passe tel quel, sans appel. Plusieurs noms collés (« A \ B et C », « A / B », « A & B »)
// sont lus par l'agent avec le nom du produit et l'adresse de la boutique : il choisit LE nom que l'acheteur verra, ou aucun.
const PLUSIEURS = /[\\/|+&;]|\s(et|and|x)\s|,/i
export async function resoudreMarque(signal) {
  const brut = court(S.brief && S.brief.marque, 200)
  if (!brut) return ''
  if (!PLUSIEURS.test(brut) && brut.length <= 40) return brut
  try {
    const sys = 'Tu prépares le nom de marque à écrire sur des publicités Meta Ads. Réponds UNIQUEMENT par un JSON {"nom":"…","raison":"une phrase"}.'
    const txt = 'Le champ « marque » rempli par le client contient : « ' + brut + ' ».\n'
      + 'Nom du produit : « ' + court(S.brief.produit, 200) + ' ».\n'
      + 'Adresse de la page produit : « ' + court(S.brief.lien_page_produit, 200) + ' ».\n'
      + (S.logoB64 ? 'Un logo officiel est fourni.\n' : '')
      + 'Ce champ contient peut-être plusieurs sociétés (fabricant, importateur, distributeur, boutique). Une publicité n\'affiche qu\'UN nom : celui que l\'acheteur reconnaîtra (le nom de la boutique qui vend et livre, souvent celui de l\'adresse de la page produit, ou la marque imprimée sur le produit). '
      + 'Choisis UN de ces noms, écrit exactement comme le client l\'écrit, sans rien ajouter. Si aucun choix n\'est sûr, réponds {"nom":""} : mieux vaut aucun nom qu\'un mauvais.'
    const d = json(await apiCopywriter(sys, [{ type: 'text', text: txt }], 2000, signal))
    const nom = court(d && d.nom, 60)
    // garde-fou : le nom retenu doit venir du champ du client ou de l'adresse de la boutique (jamais inventé)
    const norm = (x) => String(x).toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '')
    const source = norm(brut + ' ' + (S.brief.lien_page_produit || '') + ' ' + (S.brief.produit || ''))
    if (nom && norm(nom) && source.includes(norm(nom))) return nom
    return ''
  } catch (e) { console.warn('[Marque] nom affichable non décidé :', e.message); return PLUSIEURS.test(brut) ? '' : brut }
}

// Le brief que voient les agents : le même, avec le nom de marque affichable (le champ brut reste dans S.brief).
export function briefAgents() {
  if (!S.brief) return S.brief
  if (typeof S.marqueAffichee !== 'string') return S.brief
  return { ...S.brief, marque: S.marqueAffichee, marque_brute: S.brief.marque || '' }
}

// ── 2. la fiche de vérité de chaque angle ──
export async function fichesVerite(nbAngles, signal) {
  const b = S.brief || {}
  const sys = 'Tu es le directeur de la cohérence d\'une agence de publicités. Plusieurs agents (image, vidéo, ad copy) vont écrire sur les mêmes angles, en parallèle, sans se lire. '
    + 'Ton travail : fixer pour chaque angle les FAITS qu\'ils partageront, pris uniquement dans la synthèse et le brief ci-dessous. Tu n\'inventes rien : un fait absent reste absent. '
    + 'Tu ne fixes PAS le style, le procédé, l\'émotion ni les mots : chaque agent garde sa liberté créative. Réponds UNIQUEMENT par un JSON.'
  const txt = 'BRIEF CLIENT (seules vérités sur l\'offre) :\n'
    + '- Produit : ' + court(b.produit, 200) + '\n- Ce qu\'il fait (mots du client) : ' + court(b.utilite, 600) + '\n- Prix : ' + court(b.pricing, 80) + (b.prix_affichable === false ? ' (PRIX NON AFFICHABLE)' : '')
    + '\n- Promo : ' + (court(b.promo, 200) || 'aucune') + '\n- Garantie : ' + (court(b.garantie, 200) || 'aucune') + '\n- Livraison et paiement : ' + (court(b.livraison_paiement, 200) || 'non précisé')
    + '\n(Le nombre de créatives commandées n\'est PAS un stock.)\n\n'
    + 'ANGLES :\n' + (S.angles || []).slice(0, nbAngles).map((a, i) => (i + 1) + '. ' + court(a, 700)).join('\n') + '\n\n'
    + 'SYNTHÈSE DE MARCHÉ :\n' + String(S.synthesis || '').slice(0, 60000) + '\n\n'
    + 'Pour CHAQUE angle, donne :\n'
    + '- promesse : la transformation promise, en une phrase, avec les mots du marché ;\n'
    + '- cause : ce que la synthèse dit de la cause du problème et du mécanisme du produit (une ou deux phrases ; si la synthèse ne tranche pas, écris-le) ;\n'
    + '- on_peut_dire : 3 à 6 affirmations sûres (bénéfices, preuves, chiffres) présentes dans la synthèse ou le brief ;\n'
    + '- on_ne_dit_pas : les affirmations qu\'un agent pourrait être tenté d\'écrire et qui contrediraient la cause, la synthèse ou le brief (ex. nier une cause que la synthèse reconnaît, promettre une guérison, inventer un stock ou une échéance) ;\n'
    + '- raison_d_agir : la vraie raison d\'agir maintenant, prise dans le brief (promo, livraison, paiement à la livraison, garantie) ou dans le moment de vie de la cible ; jamais une rareté absente du brief.\n'
    + 'Format : {"angles":[{"angle":1,"promesse":"…","cause":"…","on_peut_dire":["…"],"on_ne_dit_pas":["…"],"raison_d_agir":"…"}]}'
  const d = json(await apiCopywriter(sys, [{ type: 'text', text: txt }], 12000, signal))
  const L = Array.isArray(d && d.angles) ? d.angles : []
  return Array.from({ length: nbAngles }, (_, i) => {
    const f = L.find((x) => Number(x && x.angle) === i + 1) || L[i]
    if (!f || !f.promesse) return null
    const liste = (x, n) => (Array.isArray(x) ? x : []).map((y) => court(y, 220)).filter(Boolean).slice(0, n)
    return { promesse: court(f.promesse, 300), cause: court(f.cause, 500), on_peut_dire: liste(f.on_peut_dire, 6), on_ne_dit_pas: liste(f.on_ne_dit_pas, 6), raison_d_agir: court(f.raison_d_agir, 300) }
  })
}

// Bloc transmis à un agent (image, copy, vidéo). Vide si la fiche manque : l'agent travaille alors comme avant.
export function bloc(angleIdx, agent) {
  const f = (S.verites || [])[angleIdx]
  const L = []
  if (f) {
    L.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nFICHE DE VÉRITÉ DE L\'ANGLE ' + (angleIdx + 1) + ' — LES MÊMES FAITS POUR L\'IMAGE, LA VIDÉO ET L\'AD COPY DE CET ANGLE')
    L.push('Ces faits sont partagés par tous les livrables de l\'angle : ils ne se contredisent jamais. Ton procédé, ton émotion, tes mots restent libres ; tu n\'affirmes rien qui contredise cette fiche, et tu n\'ajoutes aucune cause, aucun chiffre ni aucune rareté qu\'elle ne contient pas.')
    L.push('- Promesse : ' + f.promesse)
    if (f.cause) L.push('- Cause et mécanisme (ce que dit la synthèse) : ' + f.cause)
    if (f.on_peut_dire.length) L.push('- On peut dire : ' + f.on_peut_dire.join(' ; '))
    if (f.on_ne_dit_pas.length) L.push('- On ne dit pas : ' + f.on_ne_dit_pas.join(' ; '))
    if (f.raison_d_agir && agent !== 'image_sans_cta') L.push('- Raison vraie d\'agir maintenant : ' + f.raison_d_agir)
  }
  if (typeof S.marqueAffichee === 'string' && S.brief && S.marqueAffichee !== court(S.brief.marque, 200)) {
    L.push(S.marqueAffichee ? '- Nom de marque à écrire (un seul) : « ' + S.marqueAffichee + ' ». Aucun autre nom de société.' : '- Aucun nom de marque à écrire : le champ du client contient plusieurs sociétés. N\'écris aucun nom de société.')
  }
  return L.length ? L.join('\n') + '\n' : ''
}

// ── 3. le closer de l'ad copy : relu avant livraison ──
// Le code ne juge pas le style : il demande à un lecteur si la fin donne une raison vraie, une seule action, et aucune rareté inventée.
export async function closerOk(angleIdx, description, signal) {
  const b = S.brief || {}
  const f = (S.verites || [])[angleIdx]
  const sys = 'Tu relis la fin d\'une publicité Facebook avant publication. Réponds UNIQUEMENT par un JSON {"ok":true|false,"probleme":"…"}.'
  const txt = 'OFFRE RÉELLE (brief client) : prix ' + (court(b.pricing, 60) || '—') + ' ; promo ' + (court(b.promo, 160) || 'aucune') + ' ; garantie ' + (court(b.garantie, 160) || 'aucune') + ' ; livraison et paiement ' + (court(b.livraison_paiement, 160) || '—') + '.\n'
    + (f && f.raison_d_agir ? 'Raison d\'agir retenue pour cet angle : ' + f.raison_d_agir + '\n' : '')
    + 'TEXTE :\n' + String(description || '').slice(0, 4000) + '\n\n'
    + 'ok = false SEULEMENT si l\'un de ces défauts est net : (1) une rareté, un stock, un nombre de pièces ou une échéance qui ne figure pas dans l\'offre réelle ; (2) une promo, un prix ou une garantie différents de l\'offre réelle ; (3) la fin propose deux actions différentes ou aucune. Sinon ok = true. Dans probleme, cite la phrase fautive et dis quoi écrire à la place, en une phrase.'
  try { const d = json(await apiCopywriter(sys, [{ type: 'text', text: txt }], 3000, signal)); return d && d.ok === false ? { ok: false, probleme: court(d.probleme, 400) } : { ok: true } }
  catch (e) { return { ok: true, indisponible: e.message } }
}
