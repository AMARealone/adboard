import React, { useState } from 'react'
import { Modal, toast } from '../ui'
import { useCrm } from '../store'
import { OFFRES, OFFRE_KEYS } from '../domain/offres'
import { CLOSING_OBJECTIONS, ECRIT_FAILLES } from '../domain/defaults'
import { N } from '../domain/notes'

export function Marque({ p }) { const { ouvrirFiche } = useCrm(); return <button className="cx-name" onClick={() => ouvrirFiche(p.id)}>{p.nom_marque || '—'}</button> }
export function Meta({ p }) {
  const n = N(p)
  return <div className="cx-meta">{p.produit && <span>{p.produit}</span>}{p.pays && <span>{p.pays}</span>}{n.form_nom && <span>{n.form_nom}</span>}{n.form_objectif && <span>🎯 {n.form_objectif}</span>}{n.form_budget && <span>💰 {n.form_budget}</span>}</div>
}
export function OffrePick({ value, onChange }) {
  return <div className="cx-offres">{OFFRE_KEYS.map((k) => <button type="button" key={k} className={'cx-opt' + (value === k ? ' on' : '')} style={value === k ? { borderColor: OFFRES[k].couleur, color: OFFRES[k].couleur } : null} onClick={() => onChange(value === k ? '' : k)}>{OFFRES[k].label}</button>)}</div>
}
export function InfosAppel({ p, onClose }) {
  const { A } = useCrm(); const n = N(p)
  const [v, setV] = useState({ prenom: n.closing_prenom || (n.form_nom || '').split(/\s+/)[0] || '', mots: n.closing_mots || '', objectif: n.closing_objectif || n.form_objectif || '', objection: n.closing_objection || '', offre: n.closing_offre || '' })
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value })
  return (
    <Modal title={'Infos de l\'appel · ' + (p.nom_marque || '')} onClose={onClose}>
      <div className="cx-form">
        <label>Prénom<input value={v.prenom} onChange={set('prenom')} /></label>
        <label>Ses mots (sa douleur, tels qu'il/elle les a dits)<textarea value={v.mots} onChange={set('mots')} placeholder="Copie sa phrase exacte, elle apparaîtra entre guillemets" /></label>
        <label>Son objectif (commence par un verbe)<input value={v.objectif} onChange={set('objectif')} placeholder="vendre plus de votre crème" /></label>
        <label>Son objection (suit « Si c'est… »)<input list="objs" value={v.objection} onChange={set('objection')} /></label>
        <datalist id="objs">{CLOSING_OBJECTIONS.map((o) => <option key={o} value={o} />)}</datalist>
        <label>Offre discutée<OffrePick value={v.offre} onChange={(o) => setV({ ...v, offre: o })} /></label>
      </div>
      <div className="cx-act"><button className="cx-btn" onClick={onClose}>Annuler</button><button className="cx-btn primary" onClick={async () => { if (await A.infosAppel(p.id, v)) { toast('Infos enregistrées'); onClose() } }}>Enregistrer</button></div>
    </Modal>
  )
}
export function EcritInfos({ p, onClose }) {
  const { A } = useCrm(); const n = N(p)
  const [v, setV] = useState({ faille: n.ecrit_faille || '', offre: n.ecrit_offre || '', remarque: n.ecrit_remarque || '' })
  return (
    <Modal title={'Écrit · ' + (p.nom_marque || '')} onClose={onClose}>
      <div className="cx-form">
        <label>Sa faille principale
          <select value={v.faille} onChange={(e) => setV({ ...v, faille: e.target.value })}><option value="">— choisir —</option>{Object.keys(ECRIT_FAILLES).map((k) => <option key={k} value={k}>{ECRIT_FAILLES[k].label || ECRIT_FAILLES[k]}</option>)}</select></label>
        <label>Offre à lui proposer<OffrePick value={v.offre} onChange={(o) => setV({ ...v, offre: o })} /></label>
        <label>Remarque personnelle (facultatif, apparaît en haut du bloc 2)<textarea value={v.remarque} onChange={(e) => setV({ ...v, remarque: e.target.value })} /></label>
      </div>
      <div className="cx-act"><button className="cx-btn" onClick={onClose}>Annuler</button><button className="cx-btn primary" onClick={async () => { if (await A.ecritInfos(p.id, v)) { toast('Enregistré'); onClose() } }}>Enregistrer</button></div>
    </Modal>
  )
}
export function Decision({ p, onClose, ecrit }) {
  const { A } = useCrm()
  const go = async (c) => { if (await A.decision(p.id, c)) onClose() }
  return (
    <Modal title={'Après l\'appel · ' + (p.nom_marque || '')} onClose={onClose}>
      <p className="cx-p">Que s'est-il passé ?</p>
      <div className="cx-stack">
        <button className="cx-btn primary" onClick={() => go('paye')}>✅ Il/elle a payé</button>
        <button className="cx-btn" onClick={() => go('relance')}>🔁 À relancer (Closing J+1 / J+3 / J+7)</button>
        <button className="cx-btn danger" onClick={() => go('perdu')}>✖ Pas intéressé</button>
      </div>
    </Modal>
  )
}
