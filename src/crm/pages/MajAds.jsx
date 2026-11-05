import React, { useState } from 'react'
import { Modal } from '../ui'
import { useCrm } from '../store'
import { N } from '../domain/notes'
import { pitchVariante } from '../domain/messages'
import { appelDansListe, jDepuisLead, ecritB1Saute } from '../domain/rules'

// Leads concernés : en Lead, pas dans Appels, J+3 pas encore envoyé, au moins 3 jours depuis le passage en Lead (ou déjà en Écrit actif)
export function leadsAds(prospects) {
  return prospects.filter((p) => {
    const n = N(p)
    if (n.ecrit_etat === 'actif') return !ecritB1Saute(n) && !n.ecrit_sent_b1 // closing par écrit (Leads ou Suivi) : l'audit du bloc 1 a besoin de ses ads
    if (p.statut !== 'lead' || appelDansListe(p)) return false
    if (n.sent_j3 || n.j3_envoye) return false
    return jDepuisLead(p) >= 3
  })
}
export const texteAds = (v) => (v.cas === 0 ? '✅ 0 ad active · cas 0' : v.cas ? '✅ ' + v.ads + ' ads · ' + v.jours + ' j · cas ' + v.cas : v.maj ? '○ ' + v.raison : '⏳ à mettre à jour')
// Un seul prospect : le script du PC ne relit que lui (adstack-maj://id=…)
export function BoutonMajAdsProspect({ p }) {
  const { cfg, reload } = useCrm(), [ouvert, setOuvert] = useState(false), [ch, setCh] = useState(false), v = pitchVariante(p, cfg)
  return (<>
    <button className="cx-btn sm" onClick={() => setOuvert(true)}>📊 Mettre à jour ses ads{v.maj ? ' ✓' : ''}</button>
    {ouvert && <Modal title={'Ads de ' + (p.nom_marque || '')} onClose={() => setOuvert(false)}>
      <p className="cx-sub">Le script de votre PC relit la bibliothèque publicitaire de ce prospect (nombre d'ads + durée). Le cas, l'audit du bloc 1 et la faille du bloc 2 s'en déduisent tout seuls.</p>
      <div className="cx-when" style={{ margin: '8px 0' }}>Relevé actuel : {texteAds(v)}{v.age != null && v.maj ? ' · il y a ' + v.age + ' j' : ''}</div>
      <div className="cx-act" style={{ marginTop: 14 }}>
        <button className="cx-btn primary" onClick={() => { window.location.href = 'adstack-maj://id=' + encodeURIComponent(p.id) }}>▶ Lancer sur mon PC pour lui</button>
        <button className="cx-btn" disabled={ch} onClick={async () => { setCh(true); try { await reload() } catch (_) {} setCh(false) }}>{ch ? '…' : 'Actualiser'}</button>
        <button className="cx-btn ghost" onClick={() => setOuvert(false)}>Fermer</button>
      </div>
      <p className="cx-note" style={{ marginTop: 10 }}>Quand le script a fini, cliquez sur « Actualiser » : le relevé s'affiche ici.</p>
    </Modal>}
  </>)
}
export function BoutonMajAds({ compact }) {
  const { prospects, cfg } = useCrm(), [ouvert, setOuvert] = useState(false)
  const l = leadsAds(prospects), sans = l.filter((p) => !pitchVariante(p, cfg).maj).length
  return (<>
    <button className="cx-btn ghost sm" onClick={() => setOuvert(true)}>📊 Mettre à jour les ads{!compact && l.length ? ' · ' + (sans ? sans + '/' + l.length : l.length) : ''}</button>
    {ouvert && <MajAds onClose={() => setOuvert(false)} />}
  </>)
}
export function MajAds({ onClose }) {
  const { prospects, cfg, reload } = useCrm(), l = leadsAds(prospects), [ch, setCh] = useState(false)
  return (
    <Modal title="Mettre à jour les ads des leads J+3" onClose={onClose}>
      <p className="cx-sub">Le script de votre PC relit la bibliothèque publicitaire de chaque lead ci-dessous (nombre d'ads + durée) pour que le message J+3 soit vrai au moment de l'envoi. Un relevé est valable quelques jours.</p>
      {l.length ? l.map((p) => { const v = pitchVariante(p, cfg); return (
        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--line, #2a2f3a)', fontSize: 13 }}>
          <span><b>{p.nom_marque || '—'}</b> <span className="cx-note">{N(p).ecrit_etat === 'actif' ? '· closing par écrit' : '· lead depuis ' + jDepuisLead(p) + ' j'}</span></span>
          <span style={{ textAlign: 'right', color: v.cas != null ? '#32ff7e' : v.maj ? undefined : '#ffb547' }}>{texteAds(v)}</span>
        </div>) }) : <div className="cx-empty"><b>Aucun lead à J+3 pour le moment</b></div>}
      <div className="cx-act" style={{ marginTop: 14 }}>
        <button className="cx-btn primary" onClick={() => { window.location.href = 'adstack-maj://j3' }}>▶ Lancer sur mon PC</button>
        <button className="cx-btn" disabled={ch} onClick={async () => { setCh(true); try { await reload() } catch (_) {} setCh(false) }}>{ch ? '…' : 'Actualiser la liste'}</button>
        <button className="cx-btn ghost" onClick={onClose}>Fermer</button>
      </div>
      <p className="cx-note" style={{ marginTop: 10 }}>« Lancer sur mon PC » ouvre le script s'il a été installé (une seule fois, voir installer_maj_j3.ps1). Sinon, double-cliquez sur MAJ_J3 sur votre PC, puis « Actualiser la liste ».</p>
    </Modal>
  )
}
