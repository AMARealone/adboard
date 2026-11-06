import React, { useMemo, useState } from 'react'
import { N } from './domain/notes'
import { OFFRES } from './domain/offres'

// ── Recherche intelligente, commune à toutes les sections qui listent des personnes ──
// Insensible aux accents et aux majuscules ; plusieurs mots = tous doivent être présents (dans n'importe quel champ) ;
// un numéro de téléphone se retrouve même écrit avec espaces, « + » ou tirets.
export const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const chiffres = (s) => String(s || '').replace(/\D/g, '')
const cache = new WeakMap()
function botteDeFoin(p) {
  const n = N(p)
  const k = (p.nom_marque || '') + '|' + (p.notes || '').length + '|' + (p.statut || '')
  const c = cache.get(p)
  if (c && c.k === k) return c
  const t = norm([p.nom_marque, p.produit, p.pays, p.email, p.lien_wa, p.lien_instagram, p.page_facebook, n.form_nom, n.form_objectif, n.closing_prenom, n.closing_mots, n.note_texte].filter(Boolean).join(' '))
  const o = { k, t, d: chiffres(p.lien_wa) }
  cache.set(p, o)
  return o
}
export function correspond(p, q) {
  const s = String(q || '').trim()
  if (!s) return true
  const b = botteDeFoin(p)
  if (/^[\d\s+().-]{5,}$/.test(s)) return b.d.includes(chiffres(s))
  return norm(s).split(/\s+/).every((m) => b.t.includes(m))
}
export const canalDe = (p) => ({ wa: !!p.lien_wa && !p.whatsapp_invalide, ig: !!p.lien_instagram, mail: !!p.email })
const offreDe = (p) => { const n = N(p); return n.closing_offre || n.ecrit_offre || '' }
const dateDe = (p) => Date.parse(p.date_lead || p.date_contact || p.created_at || 0) || 0
const TRIS = { defaut: 'Ordre habituel', recents: 'Plus récents', anciens: 'Plus anciens', az: 'Nom A → Z', za: 'Nom Z → A' }

// Barre de recherche + filtres automatiques (pays, canal, offre) construits d'après les personnes présentes dans la liste.
export function useFiltre(base, { placeholder = 'Rechercher une marque, un produit, un numéro…', tris = true } = {}) {
  const [q, setQ] = useState(''), [pays, setPays] = useState(''), [canal, setCanal] = useState(''), [offre, setOffre] = useState(''), [tri, setTri] = useState('defaut')
  const listePays = useMemo(() => {
    const m = new Map(); base.forEach((p) => { if (p.pays) m.set(p.pays, (m.get(p.pays) || 0) + 1) }); return [...m].sort((a, b) => b[1] - a[1])
  }, [base])
  const listeOffres = useMemo(() => [...new Set(base.map(offreDe).filter((k) => OFFRES[k]))], [base])
  const liste = useMemo(() => {
    const l = base.filter((p) => (!pays || p.pays === pays) && (!canal || canalDe(p)[canal]) && (!offre || offreDe(p) === offre) && correspond(p, q))
    if (tri === 'defaut') return l
    const nom = (p) => p.nom_marque || ''
    return [...l].sort(tri === 'recents' ? (a, b) => dateDe(b) - dateDe(a) : tri === 'anciens' ? (a, b) => dateDe(a) - dateDe(b) : tri === 'az' ? (a, b) => nom(a).localeCompare(nom(b)) : (a, b) => nom(b).localeCompare(nom(a)))
  }, [base, q, pays, canal, offre, tri])
  const actif = !!(q || pays || canal || offre || tri !== 'defaut')
  const reset = () => { setQ(''); setPays(''); setCanal(''); setOffre(''); setTri('defaut') }
  const bar = (
    <div className="cx-tools">
      <div className="cx-searchbox"><input className="cx-search" type="search" placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" />{q && <button className="cx-btn ghost sm" onClick={() => setQ('')} aria-label="Effacer la recherche">✕</button>}</div>
      <div className="cx-tabs">
        {[['wa', '💬 WhatsApp'], ['ig', '📷 Instagram'], ['mail', '✉ Email']].map(([k, l]) => <button key={k} className={'cx-tab' + (canal === k ? ' on' : '')} onClick={() => setCanal(canal === k ? '' : k)}>{l}</button>)}
        {listePays.length > 1 && <select value={pays} onChange={(e) => setPays(e.target.value)} aria-label="Pays"><option value="">Tous les pays</option>{listePays.map(([x, c]) => <option key={x} value={x}>{x} ({c})</option>)}</select>}
        {listeOffres.length > 0 && <select value={offre} onChange={(e) => setOffre(e.target.value)} aria-label="Offre"><option value="">Toutes les offres</option>{listeOffres.map((k) => <option key={k} value={k}>{OFFRES[k].label}</option>)}</select>}
        {tris && <select value={tri} onChange={(e) => setTri(e.target.value)} aria-label="Trier">{Object.entries(TRIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}
        {actif && <button className="cx-btn ghost sm" onClick={reset}>Réinitialiser</button>}
      </div>
      {actif && <p className="cx-when" style={{ margin: 0 }}>{liste.length} sur {base.length}</p>}
    </div>
  )
  return { liste, bar, actif, total: base.length }
}
