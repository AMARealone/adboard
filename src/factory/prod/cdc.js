// Cahier des charges de la marque — cdc-franchise-v1.
// Ce que le propriétaire demande (ses notes sur la commande + ce que le fondateur colle ici) est transmis TEL QUEL à chaque agent,
// avec une consigne de priorité : analyste, copywriter, images, vidéos. Avant ce module, les notes du client n'étaient qu'une ligne
// perdue dans le brief JSON : aucun agent ne les traitait comme une demande à respecter.
import { prodv2State as S } from './state'

const MAX = 2500

// Nettoyage : le texte du propriétaire est une donnée, jamais une instruction de format ni de balisage pour les agents.
export function nettoyer(t) {
  return String(t == null ? '' : t)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ')
    .replace(/[<>{}`]/g, ' ')
    .replace(/^\s*Clip\s*(\d+)\s*:/gim, 'Plan $1 :')   // « Clip N : » est un marqueur du moteur vidéo : jamais dans un texte libre
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX)
}

const idProduit = () => String(S.productId || S.commandeId || 'libre').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80) || 'libre'
const cle = () => 'adstack_cdc_' + idProduit()
const cleVid = () => 'adstack_cdc_vid_' + idProduit()

export function lire() { try { return localStorage.getItem(cle()) || '' } catch (_) { return '' } }
export function ecrire(t) { try { const v = nettoyer(t); if (v) localStorage.setItem(cle(), v); else localStorage.removeItem(cle()) } catch (_) {} }
export function notesClient() { return nettoyer(S.brief && S.brief.notes) }

// Texte complet transmis aux agents : les notes de la commande, puis ce que le fondateur a ajouté.
export function texte() {
  const n = notesClient(), l = nettoyer(lire())
  const L = []
  if (n) L.push('Notes du client sur la commande : ' + n)
  if (l && l !== n) L.push(l)
  return L.join('\n\n').slice(0, MAX * 2)
}

const ENTETE = '⚠️ CAHIER DES CHARGES DE LA MARQUE — DEMANDES DU PROPRIÉTAIRE (PRIORITÉ SUR TES RÉGLAGES PAR DÉFAUT DE SUJET, DE TON, D\'AUDACE ET DE PRUDENCE)\n'
  + 'Ce qui suit est ce que le propriétaire de la marque a demandé, avec ses mots. Ce ne sont pas des goûts à interpréter : c\'est un cahier des charges, et il attend de le retrouver dans ce qu\'on lui livre. '
  + 'Il ne te fait jamais inventer un fait, un résultat, un chiffre ou une capacité que le produit n\'établit pas.\n'

const REGLE = {
  analyste: 'POUR TOI : applique la procédure « CAHIER DES CHARGES DE LA MARQUE » et l\'ÉTAPE 1ter de tes instructions. Pose d\'abord le motif d\'achat dominant, répartis les angles par motif, recopie ce cahier en S11 rubrique G. Si ce cahier contredit l\'hypothèse existante ou la réserve, c\'est lui qui a raison.',
  copy: 'POUR TOI : le sujet, le ton, l\'audace et les mots demandés ci-dessus s\'appliquent à chaque hook et à chaque description. Le sujet de l\'angle se nomme dès les premiers mots, avec les mots du marché. Aucun détour par un sujet voisin.',
  image: 'POUR TOI : le hook principal de la créative nomme le sujet demandé avec les mots du marché ; la scène montre la situation humaine de ce sujet, jamais un sujet voisin, jamais de nudité ni de geste explicite.',
  video: 'POUR TOI : le sujet demandé se nomme dès la première phrase de la voix off ou du texte à l\'écran, avec les mots du marché ; les plans montrent la situation humaine de ce sujet (jamais un sujet voisin, jamais de nudité ni de geste explicite) ; le ton et l\'audace demandés valent pour toute la vidéo.',
}

export function bloc(agent) {
  const t = texte()
  if (!t || !REGLE[agent]) return ''
  const b = ENTETE + '«««\n' + t + '\n»»»\n' + REGLE[agent]
  return b + '\n\n'
}

// Règle de franchise pour les vidéos : toujours transmise, avec ou sans cahier des charges (même logique que pour les ad copies et les images).
export function regleVideo() {
  return 'FRANCHISE DU SUJET (règle de fond, prioritaire sur le réflexe d\'élégance ou de prudence) : le sujet de l\'angle — ce que la personne veut vraiment retrouver, résoudre ou obtenir — se nomme dès la première phrase de la voix off ou du texte à l\'écran, avec les mots que le marché emploie. '
    + 'Pas de métaphore, d\'euphémisme, de conséquence voisine ni de détour par un symptôme annexe à la place du sujet. Le sujet se dit en désir, en résultat ou à la troisième personne, jamais en attribution directe d\'un état au spectateur. '
    + 'Les plans montrent la situation humaine de ce sujet, jamais de nudité ni de geste explicite. La promesse reste celle que le produit établit.'
}

// Vidéos : lancement automatique (défaut) ou à la main, produit par produit — pour valider les ad copies avec le propriétaire avant de payer les vidéos.
export function videosManuelles() { try { return localStorage.getItem(cleVid()) === '1' } catch (_) { return false } }
export function poserVideosManuelles(v) { try { if (v) localStorage.setItem(cleVid(), '1'); else localStorage.removeItem(cleVid()) } catch (_) {} }

// Lecture de l'hypothèse livrée : le motif d'achat dominant est-il posé ? Le cahier est-il recopié en S11-G ? Affichage seulement.
export function noterSynthese(raw) {
  try {
    const U = S.ui, s = String(raw || '')
    const m = s.match(/MOTIF D'ACHAT DOMINANT\s*:\s*([^\n]{3,400})/i)
    const motif = m ? m[1].replace(/[\[\]*]/g, '').trim() : ''
    const avecCDC = !!texte()
    const g = /^\s*G\.\s*CAHIER DES CHARGES/im.test(s)
    const alertes = []
    if (!motif) alertes.push('l\'analyste n\'a pas posé le motif d\'achat dominant (bloc de S1)')
    if (avecCDC && !g) alertes.push('le cahier des charges n\'est pas recopié en S11 rubrique G')
    if (alertes.length) U.cdcNote = { commandeId: S.commandeId, kind: 'warn', text: 'Cahier des charges : ' + alertes.join(' ; ') + '. Relis les angles avant de lancer les vidéos.' }
    else U.cdcNote = { commandeId: S.commandeId, kind: 'info', text: 'Motif d\'achat dominant retenu par l\'analyste : « ' + motif.slice(0, 220) + ' ». Vérifie que les angles le nomment avant de lancer les vidéos.' }
  } catch (_) {}
}
