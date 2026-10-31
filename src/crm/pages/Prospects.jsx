import React, { useMemo, useState } from 'react'
import { useCrm } from '../store'
import { N } from '../domain/notes'
import { Chip, Empty } from '../ui'

const STATUTS = { '': 'Tous', a_contacter: 'À contacter', en_suivi: 'En suivi', lead: 'Leads', acheteur: 'Clients', archive: 'Archivés' }
export default function Prospects() {
  const { prospects, ouvrirFiche } = useCrm()
  const [q, setQ] = useState(''), [s, setS] = useState(''), [max, setMax] = useState(100)
  const liste = useMemo(() => {
    const t = q.trim().toLowerCase()
    return prospects.filter((p) => (!s || p.statut === s) && (!t || [p.nom_marque, p.produit, p.pays, p.lien_wa].some((v) => (v || '').toLowerCase().includes(t)))).reverse()
  }, [prospects, q, s])
  const compte = (k) => prospects.filter((p) => !k || p.statut === k).length
  return (<>
    <div className="cx-tools"><input className="cx-search" placeholder="Rechercher une marque, un produit, un numéro…" value={q} onChange={(e) => { setQ(e.target.value); setMax(100) }} />
      <div className="cx-tabs">{Object.keys(STATUTS).map((k) => <button key={k} className={'cx-tab' + (s === k ? ' on' : '')} onClick={() => { setS(k); setMax(100) }}>{STATUTS[k]} <i>{compte(k)}</i></button>)}</div></div>
    {liste.length ? <>
      {liste.slice(0, max).map((p) => <div className="cx-li" key={p.id}><button className="cx-name" onClick={() => ouvrirFiche(p.id)}>{p.nom_marque || '—'}</button><span className="cx-meta">{[p.produit, p.pays].filter(Boolean).join(' · ')}</span><Chip c="mu">{STATUTS[p.statut] || p.statut}</Chip></div>)}
      {liste.length > max && <button className="cx-btn" onClick={() => setMax(max + 200)}>Afficher plus ({liste.length - max} restants)</button>}
    </> : <Empty t="Aucun résultat" />}
  </>)
}
