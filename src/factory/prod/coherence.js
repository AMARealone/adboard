// produit-vrai-v1 (26 nov. 2026) — CE QUE L'EMBALLAGE DIT ET CE QUE LE BRIEF VEND DOIVENT ÊTRE LA MÊME CHOSE.
// Commande BioTonik 2c038beb : l'étiquette de la photo principale dit « améliorer la fertilité des sols et stimuler la croissance des plantes —
// pulvérisation, arrosage » ; le brief vend la bouteille comme une boisson pour la digestion et la vigueur. L'analyste l'a écrit en tête de son étude
// (« contournement majeur : masquer l'étiquette »), la lecture des photos l'a écrit, le contrôle d'un clip l'a écrit. Aucun ne s'est arrêté : 6 créatives
// ont été payées. Ce désaccord ne se tranche pas par un agent : le propriétaire le lève avec son client (mauvaises photos ou mauvais brief).
// Ici : la production est RETENUE tant que le propriétaire n'a pas confirmé. Sa décision est écrite en tête de l'étude (sauvegardée avec la commande) :
// tous les agents la lisent, le moteur vidéo aussi, et la question n'est plus posée pour ce lot.
import { prodv2State as S } from './state'
import { confirmDlg } from '../ui'

export const MARQUE_CONFIRME = 'PRODUIT CONFIRMÉ PAR LE PROPRIÉTAIRE'
export const MARQUE_MOTEUR = 'EMBALLAGE ET BRIEF EN DÉSACCORD'   // même libellé que le moteur vidéo (lab_server.js)
const RE_LIGNE = /ACCORD EMBALLAGE\s*\/\s*BRIEF\s*:\s*(D[ÉE]SACCORD|ACCORD)\b\s*(?:[—–:-]\s*)?([^\n]*)/i
const RE_CONFIRME = /PRODUIT CONFIRM[ÉE] PAR LE PROPRI[ÉE]TAIRE/i

let _sauver = null
export const brancher = (o) => { _sauver = (o && o.sauver) || null }

export function lire(synthese) {
  const t = String(synthese || ''), m = RE_LIGNE.exec(t)
  return { desaccord: !!(m && /^d/i.test(m[1])), constat: m && /^d/i.test(m[1]) ? m[2].trim().slice(0, 400) : '', confirme: RE_CONFIRME.test(t) }
}

// Le moteur vidéo a relevé le désaccord (étude plus ancienne, sans la ligne de l'analyste) : il entre dans l'étude sous la même forme.
export function noterDepuisMoteur(erreur) {
  const e = String(erreur || ''), i = e.indexOf(MARQUE_MOTEUR)
  if (i < 0 || !S.synthesis || lire(S.synthesis).desaccord) return false
  const constat = e.slice(i + MARQUE_MOTEUR.length).replace(/^\s*:\s*/, '').split(' — ')[0].replace(/\s+/g, ' ').trim().slice(0, 400)
  S.synthesis = 'ACCORD EMBALLAGE / BRIEF : DÉSACCORD — ' + constat + ' (relevé par le moteur vidéo)\n' + S.synthesis
  return true
}

const auto = () => { try { return typeof window !== 'undefined' && !!window.__AUTO } catch (_) { return false } }
export const messageRetenue = (constat) => 'PRODUCTION RETENUE — l\'emballage et le brief ne disent pas la même chose' + (constat ? ' : ' + constat : '') + '. À vérifier avec le client (photos ou brief à corriger) avant de produire.'

// true = on peut produire. false = le propriétaire arrête. En production automatique, personne ne peut décider : la production s'arrête avec le motif.
export async function garde() {
  const c = lire(S.synthesis)
  if (!c.desaccord || c.confirme) return true
  if (auto()) throw new Error(messageRetenue(c.constat))
  const ok = await confirmDlg('⚠ L\'EMBALLAGE ET LE BRIEF NE DISENT PAS LA MÊME CHOSE\n\n' + (c.constat || 'Voir la première ligne de l\'étude de marché.') + '\n\nUne publicité qui fait consommer ou appliquer un produit que son propre emballage présente autrement engage la santé de l\'acheteur, la marque du client et son compte publicitaire. Et l\'acheteur recevra un colis avec cette étiquette.\n\nÀ vérifier avec le client : ce sont les mauvaises photos, ou le brief décrit un autre produit.\n\n« Annuler » : rien n\'est produit, rien n\'est dépensé de plus.', { ok: 'Le client a confirmé : produire', danger: true })
  if (!ok) return false
  S.synthesis = MARQUE_CONFIRME + ' (' + new Date().toLocaleDateString('fr-FR') + ') : l\'emballage et le brief ne disent pas la même chose (' + (c.constat || 'voir la ligne ACCORD EMBALLAGE / BRIEF') + '). Le propriétaire a vérifié avec son client ; la vente décrite par le brief est maintenue.\n' + String(S.synthesis || '')
  if (_sauver) { try { await _sauver() } catch (_) { } }   // la commande porte la décision AVANT que le moteur vidéo ne la relise
  return true
}
