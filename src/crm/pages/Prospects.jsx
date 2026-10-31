import React, { useMemo, useState } from 'react'
import { useCrm } from '../store'
import { N } from '../domain/notes'
import { Chip, Empty, toast } from '../ui'

const STATUTS = { '': 'Tous', a_contacter: 'À contacter', en_suivi: 'En suivi', lead: 'Leads', acheteur: 'Clients', archive: 'Archivés' }
const TRI = { recents: 'Plus récents', anciens: 'Plus anciens', az: 'Nom A→Z', za: 'Nom Z→A' }
const info = (p) => ['Marque : ' + (p.nom_marque || '—'), 'Produit : ' + (p.produit || '—'), 'Pays : ' + (p.pays || '—'), 'WhatsApp : ' + (p.lien_wa || '—'), 'Instagram : ' + (p.lien_instagram || '—'), 'Page produit : ' + (p.page_produit || '—')].join('\n')
// Annuaire de tous les prospects (remplace « Contacts ») : recherche, statut, pays, date de contact, tri.
export default function Prospects() {
  const { prospects, ouvrirFiche, A } = useCrm()
  const [q, setQ] = useState(''), [s, setS] = useState(''), [pays, setPays] = useState(''), [date, setDate] = useState(''), [tri, setTri] = useState('recents'), [max, setMax] = useState(100)
  const listePays = useMemo(() => [...new Set(prospects.map((p) => p.pays).filter(Boolean))].sort(), [prospects])
  const liste = useMemo(() => {
    const t = q.trim().toLowerCase()
    const l = prospects.filter((p) => (!s || p.statut === s) && (!pays || p.pays === pays) && (!date || (p.date_contact || '').slice(0, 10) === date) && (!t || [p.nom_marque, p.produit, p.pays, p.lien_wa].some((v) => (v || '').toLowerCase().includes(t))))
    const d = (p) => Date.parse(p.date_contact || 0) || 0
    return l.sort(tri === 'recents' ? (a, b) => d(b) - d(a) : tri === 'anciens' ? (a, b) => d(a) - d(b) : tri === 'az' ? (a, b) => (a.nom_marque || '').localeCompare(b.nom_marque || '') : (a, b) => (b.nom_marque || '').localeCompare(a.nom_marque || ''))
  }, [prospects, q, s, pays, date, tri])
  const compte = (k) => prospects.filter((p) => !k || p.statut === k).length
  return (<>
    <div className="cx-tools"><input className="cx-search" placeholder="Rechercher une marque, un produit, un numéro…" value={q} onChange={(e) => { setQ(e.target.value); setMax(100) }} />
      <div className="cx-tabs">{Object.keys(STATUTS).map((k) => <button key={k} className={'cx-tab' + (s === k ? ' on' : '')} onClick={() => { setS(k); setMax(100) }}>{STATUTS[k]} <i>{compte(k)}</i></button>)}</div>
      <div className="cx-tabs"><select value={pays} onChange={(e) => setPays(e.target.value)}><option value="">Tous les pays</option>{listePays.map((x) => <option key={x}>{x}</option>)}</select>
        <select value={tri} onChange={(e) => setTri(e.target.value)}>{Object.entries(TRI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <span className="cx-range"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date de contact" />{date && <button className="cx-btn ghost sm" onClick={() => setDate('')}>✕</button>}</span></div></div>
    <p className="cx-when" style={{ margin: '0 0 8px' }}>{liste.length} contact{liste.length > 1 ? 's' : ''}</p>
    {liste.length ? <>
      {liste.slice(0, max).map((p) => { const pasInt = !!N(p).pas_interesse && (p.statut === 'archive' || p.statut === 'en_suivi'); return <div className="cx-li" key={p.id}><button className="cx-name" onClick={() => ouvrirFiche(p.id)}>{p.nom_marque || '—'}</button><span className="cx-meta">{[p.produit, p.pays, p.date_contact && new Date(p.date_contact).toLocaleDateString('fr-FR')].filter(Boolean).join(' · ')}</span><Chip c={pasInt ? 'red' : 'mu'}>{pasInt ? 'Pas intéressé' : STATUTS[p.statut] || p.statut}</Chip>
        {pasInt && <button className="cx-btn ghost sm" onClick={() => A.pasInteresse(p.id, false)}>↩ Suivi</button>}
        <button className="cx-btn ghost sm" title="Copier les infos" onClick={async () => { try { await navigator.clipboard.writeText(info(p)); toast('Infos copiées') } catch (_) { toast('Copie automatique impossible') } }}>Copier</button></div> })}
      {liste.length > max && <button className="cx-btn" onClick={() => setMax(max + 200)}>Afficher plus ({liste.length - max} restants)</button>}
    </> : <Empty t="Aucun résultat" s="Modifiez les filtres pour voir plus de résultats." />}
  </>)
}
