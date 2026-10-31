import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { fetchProspects, fetchConfig, mergeNotes, mergeConfig, shorten } from './api'
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
      const clesClosing = ['closing_sent_j1', 'closing_sent_j3', 'closing_sent_j7', 'closing_sent_j10', 'closing_sent_j21']
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
      if (ok) toast(choix === 'relance' ? 'Dans Closing : première relance à J+1' : choix === 'paye' ? 'Marqué payé ✓ : passé en Acheteur' : choix === 'perdu' ? 'Pas intéressé : retourné dans Suivi' : 'Remis dans les relances'); return ok
    },
    // — Closing
    infosAppel: (id, v) => mutate(id, { notes: { closing_prenom: v.prenom.trim() || undefined, closing_mots: v.mots.trim() || undefined, closing_objectif: v.objectif.trim() || undefined, closing_objection: v.objection.trim() || undefined, closing_offre: v.offre || undefined } }),
    closingVersion: (id, jour, v) => mutate(id, { notes: { ['closing_ab' + jour]: v === 'B' ? 'B' : undefined } }),
    marquer: (id, cle, val) => mutate(id, { notes: { [cle]: val ? true : undefined, [cle + '_at']: val ? now() : undefined } }),
    // — Écrit
    passerEcrit: (id) => mutate(id, { notes: { ecrit_etat: 'actif', ecrit_at: now() } }),
    ecritInfos: (id, v) => mutate(id, { notes: { ecrit_faille: v.faille || undefined, ecrit_offre: v.offre || undefined, ecrit_remarque: v.remarque.trim() || undefined } }),
    // — Ouverture du canal : WhatsApp (nouvel onglet) ou Instagram (texte copié)
    ouvrirCanal: async (p, msg) => {
      if (estInstagram(p)) {
        if (!p.lien_instagram) { toast('Pas de lien Instagram pour ce prospect'); return false }
        try { await navigator.clipboard.writeText(msg); toast('Texte copié : colle-le (Ctrl+V) dans la conversation Instagram') } catch (_) { toast('Copie automatique impossible : copie le texte à la main') }
        window.open(p.lien_instagram, '_blank'); return true
      }
      const num = numeroWa(p); if (!num) { toast('Pas de numéro WhatsApp pour ce prospect'); return false }
      window.open('https://wa.me/' + num + '?text=' + encodeURIComponent(msg), '_blank'); return true
    },
    shorten,
  }), [mutate])

  const value = { prospects, cfg, state, reload, mutate, saveCfg, A, fiche, ouvrirFiche: setFiche }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
