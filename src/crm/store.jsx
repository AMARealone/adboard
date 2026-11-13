import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { fetchProspects, fetchConfig, mergeNotes, mergeConfig, shorten, supprimerProspect } from './api'
import { N } from './domain/notes'
import { toast, confirmDlg } from './ui'
import { estInstagram, numeroWa } from './domain/rules'

const Ctx = createContext(null)
export const useCrm = () => useContext(Ctx)

export function CrmProvider({ children }) {
  const [prospects, setProspects] = useState([])
  const [cfg, setCfg] = useState({}), cfgId = useRef(null)
  const [state, setState] = useState({ loading: true, error: '', n: 0 })
  const [fiche, setFiche] = useState(null)
  const ref = useRef([]); ref.current = prospects

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }))
    try {
      const [rows, c] = await Promise.all([fetchProspects((n) => setState((s) => ({ ...s, n }))), fetchConfig()])
      cfgId.current = c.id; setCfg(c.cfg); setProspects(rows); setState({ loading: false, error: '', n: rows.length })
    } catch (e) { setState({ loading: false, error: e.message, n: 0 }) }
  }, [])
  useEffect(() => { reload() }, [reload])

  // Écriture optimiste : l'écran se met à jour tout de suite, la base reçoit seulement les clés modifiées.
  const mutate = useCallback(async (id, { notes, body } = {}) => {
    const before = ref.current.find((p) => p.id === id); if (!before) return false
    const cur = N(before), next = { ...cur }
    Object.keys(notes || {}).forEach((k) => { if (notes[k] === undefined) delete next[k]; else next[k] = notes[k] })
    const optimistic = { ...before, ...(body || {}), notes: JSON.stringify(next) }
    setProspects((l) => l.map((p) => (p.id === id ? optimistic : p)))
    try {
      const saved = await mergeNotes(id, notes, body)
      setProspects((l) => l.map((p) => (p.id === id ? { ...p, notes: saved } : p)))
      return true
    } catch (e) {
      setProspects((l) => l.map((p) => (p.id === id ? before : p)))
      toast('Échec, rien n\'a été enregistré : ' + e.message); return false
    }
  }, [])
  const saveCfg = useCallback(async (changes) => {
    if (!cfgId.current) { toast('Pas de ligne de configuration'); return false }
    try { const next = await mergeConfig(cfgId.current, changes); setCfg(next); return true } catch (e) { toast('Échec : ' + e.message); return false }
  }, [])

  const now = () => new Date().toISOString()
  const A = useMemo(() => ({
    // — Appels
    reserver: (id, programmeIso, via) => mutate(id, { notes: { appel_reserve: true, appel_reserve_at: now(), appel_via: via || undefined, appel_programme_at: programmeIso || undefined, appel_fait: undefined, appel_fait_at: undefined } }),
    programmer: (id, iso) => mutate(id, { notes: { appel_programme_at: iso || undefined } }),
    annulerAppel: async (id) => { if (!(await confirmDlg('Annuler la réservation d\'appel ?\nLe prospect retrouve son étape (Suivi ou Leads).', 'Annuler la réservation'))) return false; return mutate(id, { notes: { appel_reserve: undefined, appel_reserve_at: undefined, appel_via: undefined, appel_programme_at: undefined, appel_fait: undefined, appel_fait_at: undefined } }) },
    appelFait: (id) => mutate(id, { notes: { appel_fait: true, appel_fait_at: now() } }),
    noShow: async (id, auto) => {
      const p = ref.current.find((x) => x.id === id); if (!p || (p.statut !== 'en_suivi' && p.statut !== 'lead')) return false
      if (!auto && !(await confirmDlg((p.nom_marque || 'Ce prospect') + ' ne s\'est pas présenté ?\nIl repart en Leads.', 'Oui, no-show'))) return false
      const n = N(p), lead = p.statut === 'lead'
      const ok = await mutate(id, { notes: { appel_reserve: undefined, appel_reserve_at: undefined, appel_fait: undefined, appel_fait_at: undefined, appel_via: undefined, appel_programme_at: undefined, no_show_count: (n.no_show_count || 0) + 1, no_show_at: now() }, body: lead ? {} : { statut: 'lead', date_lead: now() } })
      if (ok) toast((p.nom_marque || 'Prospect') + ' : no-show → ' + (lead ? 'de retour dans Leads' : 'passé en Lead')); return ok
    },
    // — Décision après appel / closing / écrit
    decision: async (id, choix) => {
      const p = ref.current.find((x) => x.id === id); if (!p) return false
      const nom = p.nom_marque || 'ce prospect'
      if (choix === 'paye' && !(await confirmDlg('Confirmer : ' + nom + ' a payé ?\nIl passe en « Acheteur ».', 'Oui, a payé'))) return false
      if (choix === 'perdu' && !(await confirmDlg('Marquer ' + nom + ' « pas intéressé » ?\nIl retourne dans Suivi (réversible).', 'Pas intéressé'))) return false
      const t = now(), n = N(p), efface = {}
      const clesClosing = ['closing_sent_j1', 'closing_sent_j3', 'closing_sent_j4', 'closing_sent_j7', 'closing_sent_j11', 'closing_sent_j10', 'closing_sent_j21']
      clesClosing.forEach((k) => { efface[k] = undefined; efface[k + '_at'] = undefined })
      let notes = {}, body = {}
      if (choix === 'relance') notes = { ...efface, closing_etat: 'relance', closing_at: n.appel_fait_at || t }
      else if (choix === 'paye') { notes = n.ecrit_etat === 'actif' ? { ecrit_etat: 'paye', ecrit_paye_at: t } : { closing_etat: 'paye', closing_paye_at: t }; body = { statut: 'acheteur', date_achat: t } }
      else if (choix === 'perdu') {
        notes = { ...efface, appel_reserve: undefined, appel_reserve_at: undefined, appel_fait: undefined, appel_fait_at: undefined, appel_via: undefined, appel_programme_at: undefined, closing_etat: undefined, closing_at: undefined, closing_paye_at: undefined, pas_interesse: true, pas_interesse_at: t }
        if (n.ecrit_etat === 'actif') notes.ecrit_etat = 'perdu'
        if (p.statut === 'lead') body = { statut: 'en_suivi', date_lead: null }
      } else if (choix === 'relances') notes = { ecrit_etat: undefined, ecrit_at: undefined }
      const ok = await mutate(id, { notes, body })
      if (ok) toast(choix === 'relance' ? 'Dans Closing : première relance à J+1' : choix === 'paye' ? 'Marqué payé ✓ : il est maintenant dans Acheteurs' : choix === 'perdu' ? 'Pas intéressé : retourné dans Suivi' : 'Remis dans les relances'); return ok
    },
    // — Acheteurs
    acheteurOffre: (id, cle) => mutate(id, { notes: { acheteur_offre: cle || undefined } }),
    retirerAcheteur: async (id) => {
      const p = ref.current.find((x) => x.id === id); if (!p) return false
      if (!(await confirmDlg((p.nom_marque || 'Ce client') + ' n\'a finalement pas acheté ?\nIl retourne dans Leads (son historique reste).', 'Retirer des acheteurs'))) return false
      const n = N(p)
      const ok = await mutate(id, { notes: { closing_etat: n.closing_etat === 'paye' ? undefined : n.closing_etat, closing_paye_at: undefined, ecrit_etat: n.ecrit_etat === 'paye' ? 'actif' : n.ecrit_etat, ecrit_paye_at: undefined }, body: { statut: 'lead', date_achat: null } })
      if (ok) toast((p.nom_marque || 'Le client') + ' : retiré des acheteurs, retour dans Leads'); return ok
    },
    // — Closing
    infosAppel: (id, v) => mutate(id, { notes: { closing_prenom: v.prenom.trim() || undefined, closing_mots: v.mots.trim() || undefined, closing_objectif: v.objectif.trim() || undefined, closing_situation: v.situation && v.situation !== 'reflechir' ? v.situation : undefined, closing_offre: v.offre || undefined } }),
    closingVersion: (id, jour, v) => mutate(id, { notes: { ['closing_ab' + jour]: v === 'B' ? 'B' : undefined } }),
    // Cocher garde la date du PREMIER envoi (jamais écrasée) ; décocher l'efface (les écrans demandent d'abord une confirmation).
    marquer: (id, cle, val) => { const p = ref.current.find((x) => x.id === id), n = N(p); return mutate(id, { notes: { [cle]: val ? true : undefined, [cle + '_at']: val ? (n[cle + '_at'] || now()) : undefined } }) },
    // — Écrit
    passerEcrit: (id) => mutate(id, { notes: { ecrit_etat: 'actif', ecrit_at: now() } }),
    ecritCas: (id, cas) => mutate(id, { notes: { ecrit_cas: cas } }),
    ecritInfos: (id, v) => mutate(id, { notes: { ecrit_faille: undefined, ecrit_offre: v.offre || undefined, ecrit_remarque: v.remarque.trim() || undefined } }),
    // — Suivi
    setCheck: (id, champ, val) => mutate(id, { body: { [champ]: val }, notes: champ === 'interesse' && val ? { pas_interesse: undefined, pas_interesse_at: undefined } : {} }),
    pitchEnvoye: (id, val) => { const p = ref.current.find((x) => x.id === id), n = N(p); return mutate(id, { notes: val ? { pitch_envoye: true, pitch_envoye_at: n.pitch_envoye_at || now() } : { pitch_envoye: false } }) },
    pasInteresse: async (id, val) => {
      const ok = await mutate(id, { notes: val ? { pas_interesse: true, pas_interesse_at: now(), appel_reserve: undefined, appel_reserve_at: undefined, appel_fait: undefined, appel_fait_at: undefined, appel_via: undefined, appel_programme_at: undefined } : { pas_interesse: undefined, pas_interesse_at: undefined } })
      if (ok) toast(val ? 'Pas intéressé : reste dans le Suivi' : 'Marqueur « pas intéressé » retiré'); return ok
    },
    versLead: async (id) => { const ok = await mutate(id, { body: { statut: 'lead', date_lead: now() } }); if (ok) toast('Passé en Lead'); return ok },
    remettreAContacter: async (id) => {
      if (!(await confirmDlg('Remettre ce prospect dans « À contacter » ?\nLe suivi (réponse, intérêt) est effacé.', 'Remettre à contacter'))) return false
      const ok = await mutate(id, { body: { statut: 'a_contacter', date_contact: null, a_repondu: false, interesse: false, lead_qualifie: false }, notes: { appel_reserve: undefined, appel_reserve_at: undefined, appel_fait: undefined, appel_fait_at: undefined, appel_via: undefined, appel_programme_at: undefined } })
      if (ok) toast('Remis dans « À contacter »'); return ok
    },
    // — À contacter
    canal: (id, c) => mutate(id, { body: { dernier_canal_clique: c } }),
    contacte: async (id) => {
      const p = ref.current.find((x) => x.id === id); if (!p) return false
      const canal = p.dernier_canal_clique || (p.lien_instagram ? 'instagram' : 'whatsapp')
      const ok = await mutate(id, { body: { statut: 'en_suivi', date_contact: now(), canal_contact: canal } })
      if (ok) { try { localStorage.setItem('ig_last_send_at', String(Date.now())) } catch (_) {} toast('Marqué comme contacté') }
      return ok
    },
    whatsappInvalide: async (id) => { const p = ref.current.find((x) => x.id === id); if (!(await confirmDlg('Marquer le WhatsApp de ' + (p.nom_marque || 'ce prospect') + ' comme invalide ?\nLe numéro reste conservé pour le SMS.', 'Marquer invalide'))) return false; return mutate(id, { body: { whatsapp_invalide: true } }) },
    instagramInvalide: async (id) => { const p = ref.current.find((x) => x.id === id); if (!(await confirmDlg("Marquer l'Instagram de " + (p.nom_marque || 'ce prospect') + ' comme invalide ?\nIl ne sera plus proposé via ce canal.', 'Marquer invalide'))) return false; return mutate(id, { body: { lien_instagram: null } }) },
    // — Retirer / supprimer / notes (boutons « Supprimer » et « Notes » de l'ancien CRM)
    // « Supprimer » dans le pipeline retire le prospect du pipeline : il reste dans Contacts (statut archivé).
    retirer: async (id) => { const p = ref.current.find((x) => x.id === id); if (!p) return false; if (!(await confirmDlg('Retirer ' + (p.nom_marque || 'ce prospect') + ' du pipeline ?\nIl restera dans Contacts.', 'Supprimer'))) return false; const ok = await mutate(id, { body: { statut: 'archive' } }); if (ok) toast((p.nom_marque || 'Prospect') + ' retiré du pipeline'); return ok },
    retirerPlus: async (ids) => { if (!ids.length || !(await confirmDlg('Retirer ' + ids.length + ' prospect(s) du pipeline ?\nIls resteront dans Contacts.', 'Supprimer'))) return false; for (const id of ids) await mutate(id, { body: { statut: 'archive' } }); toast(ids.length + ' prospect(s) retiré(s) du pipeline'); return true },
    supprimerDefinitif: async (id) => {
      const p = ref.current.find((x) => x.id === id); if (!p) return false
      if (!(await confirmDlg('Supprimer définitivement ' + (p.nom_marque || 'ce prospect') + ' de tous les contacts ?\nCette action est irréversible.', 'Supprimer définitivement'))) return false
      try { await supprimerProspect(id); setProspects((l) => l.filter((x) => x.id !== id)); toast('Contact supprimé définitivement'); return true } catch (e) { toast('Échec, rien n\'a été supprimé : ' + e.message); return false }
    },
    contactePlus: async (ids) => { if (!ids.length || !(await confirmDlg('Déplacer ' + ids.length + ' prospect(s) vers Suivi ?', 'Déplacer vers Suivi'))) return false; for (const id of ids) { const p = ref.current.find((x) => x.id === id); if (!p) continue; await mutate(id, { body: { statut: 'en_suivi', date_contact: now(), canal_contact: p.dernier_canal_clique || (p.lien_instagram ? 'instagram' : 'whatsapp') } }) } toast(ids.length + ' prospect(s) déplacé(s) vers Suivi'); return true },
    waInvalidePlus: async (ids) => { if (!ids.length || !(await confirmDlg('Marquer le WhatsApp de ' + ids.length + ' prospect(s) comme invalide ?\nLes numéros restent disponibles pour le SMS.', 'Marquer invalide'))) return false; for (const id of ids) await mutate(id, { body: { whatsapp_invalide: true } }); toast('WhatsApp retiré pour ' + ids.length + ' prospect(s)'); return true },
    note: (id, texte) => mutate(id, { notes: { note_texte: texte } }),
    reprogrammer: async (id) => {
      const p = ref.current.find((x) => x.id === id); if (!p) return false
      if (!(await confirmDlg('Reprogrammer un nouvel appel avec ' + (p.nom_marque || 'ce prospect') + ' ?\nIl retourne dans Appels et sort du Closing.', 'Nouvel appel'))) return false
      return mutate(id, { notes: { appel_fait: undefined, appel_fait_at: undefined, appel_programme_at: undefined, closing_etat: undefined, closing_at: undefined, appel_reserve: true, appel_reserve_at: now() } })
    },
    // — Ouverture du canal : WhatsApp (nouvel onglet) ou Instagram (texte copié)
    // Sur mobile, ouvrir WhatsApp APRÈS un await (raccourcissement du lien) est bloqué par le navigateur :
    // on ouvre l'onglet tout de suite, au clic (preOuvrir), puis on y met le message (ouvrirCanal).
    preOuvrir: (p) => (!estInstagram(p) && numeroWa(p) ? window.open('', '_blank') : null),
    ouvrirCanal: async (p, msg, tab) => {
      if (estInstagram(p)) {
        if (!p.lien_instagram) { toast('Pas de lien Instagram pour ce prospect'); return false }
        try { await navigator.clipboard.writeText(msg); toast('Texte copié : colle-le (Ctrl+V) dans la conversation Instagram') } catch (_) { toast('Copie automatique impossible : copie le texte à la main') }
        window.open(p.lien_instagram, '_blank'); return true
      }
      const num = numeroWa(p); if (!num) { if (tab) tab.close(); toast('Pas de numéro WhatsApp pour ce prospect'); return false }
      const url = 'https://wa.me/' + num + '?text=' + encodeURIComponent(msg)
      if (tab && !tab.closed) tab.location.href = url; else window.open(url, '_blank')
      return true
    },
    shorten,
  }), [mutate])

  const value = { prospects, cfg, state, reload, mutate, saveCfg, A, fiche, ouvrirFiche: setFiche }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
