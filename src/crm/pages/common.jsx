import React, { useState } from 'react'
import { Modal, toast } from '../ui'
import { useCrm } from '../store'
import { OFFRES, OFFRE_KEYS } from '../domain/offres'
import { CLOSING_SITUATIONS } from '../domain/defaults'
import { N } from '../domain/notes'
import { pitchVariante } from '../domain/messages'
import { appelProgrammeTs } from '../domain/rules'

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
  const [v, setV] = useState({ prenom: n.closing_prenom || (n.form_nom || '').split(/\s+/)[0] || '', mots: n.closing_mots || '', objectif: n.closing_objectif || n.form_objectif || '', situation: n.closing_situation || 'reflechir', offre: n.closing_offre || '' })
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value })
  return (
    <Modal title={'Infos de l\'appel · ' + (p.nom_marque || '')} onClose={onClose}>
      <div className="cx-form">
        <label>Prénom<input value={v.prenom} onChange={set('prenom')} /></label>
        <label>Son problème (groupe nominal, suit « l'enjeu, c'est… »)<textarea value={v.mots} onChange={set('mots')} placeholder="plus de créatives, sans y passer votre temps" /></label>
        <label>Son objectif (verbe à l'infinitif, suit « pour… »)<input value={v.objectif} onChange={set('objectif')} placeholder="atteindre 1 000 000 FCFA par semaine" /></label>
        <div className="cx-grp">Où il en est (choisit les relances)<div className="cx-offres">{CLOSING_SITUATIONS.map((s) => <button type="button" key={s.k} className={'cx-opt' + (v.situation === s.k ? ' on' : '')} onClick={() => setV({ ...v, situation: s.k })}>{s.label}</button>)}</div></div>
        <div className="cx-grp">Offre discutée<OffrePick value={v.offre} onChange={(o) => setV({ ...v, offre: o })} /></div>
      </div>
      <div className="cx-act"><button className="cx-btn" onClick={onClose}>Annuler</button><button className="cx-btn primary" onClick={async () => { if (await A.infosAppel(p.id, v)) { toast('Infos enregistrées'); onClose() } }}>Enregistrer</button></div>
    </Modal>
  )
}
export function EcritInfos({ p, onClose }) {
  const { A } = useCrm(); const n = N(p)
  const [v, setV] = useState({ offre: n.ecrit_offre || '', remarque: n.ecrit_remarque || '' })
  return (
    <Modal title={'Écrit · ' + (p.nom_marque || '')} onClose={onClose}>
      <div className="cx-form">
        <div className="cx-grp">Offre à lui proposer<OffrePick value={v.offre} onChange={(o) => setV({ ...v, offre: o })} /></div>
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

// ── Boutons repris de l'ancien CRM ──
export function BtnNotes({ p }) {
  const { A } = useCrm(), [ouvert, setOuvert] = useState(false), n = N(p), [t, setT] = useState(''), [busy, setBusy] = useState(false)
  return (<>
    <button className="cx-btn ghost sm" onClick={() => { setT(n.note_texte || ''); setOuvert(true) }}>{n.note_texte ? '📝 Notes' : 'Notes'}</button>
    {ouvert && <Modal title={'Notes · ' + (p.nom_marque || '')} onClose={() => setOuvert(false)}>
      <textarea style={{ width: '100%', minHeight: 140 }} value={t} onChange={(e) => setT(e.target.value)} placeholder="Notes libres sur ce prospect…" autoFocus />
      <div className="cx-act"><button className="cx-btn" onClick={() => setOuvert(false)}>Annuler</button><button className="cx-btn primary" disabled={busy} onClick={async () => { setBusy(true); const ok = await A.note(p.id, t); setBusy(false); if (ok) { toast('Note sauvegardée'); setOuvert(false) } }}>{busy ? '…' : 'Sauvegarder'}</button></div>
    </Modal>}
  </>)
}
export function BtnSupprimer({ p, label = 'Supprimer' }) {
  const { A } = useCrm()
  return <button className="cx-btn ghost sm red" onClick={() => A.retirer(p.id)}>{label}</button>
}
const fd = (iso) => { const t = Date.parse(iso || ''); return isNaN(t) ? '' : new Date(t).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
// Toutes les infos connues sur un prospect, prêtes à coller (préparer un appel).
export function infosProspect(p, cfg) {
  const n = N(p), L = []
  const add = (k, v) => { if (v !== undefined && v !== null && String(v).trim() !== '') L.push(k + ' : ' + String(v).trim()) }
  add('Marque', p.nom_marque); add('Produit', p.produit); add('Pays', p.pays)
  add('Contact (formulaire)', n.form_nom); add('Email', p.email || n.form_email)
  add('WhatsApp', p.lien_wa); add('Instagram', p.lien_instagram)
  L.push('')
  add('Page produit', p.page_produit || p.lien_ads); add('Bibliothèque publicitaire', p.lien_ads); add('Page Facebook', p.page_facebook); add('Image produit', p.image_produit_url)
  const a = p.ads_j10
  if (a && a.maj_at) {
    let v = {}; try { v = pitchVariante(p, cfg) || {} } catch (_) {}
    add('Ads actives', a.nb); add('Durée moyenne des ads (jours)', a.moy); add('Durée médiane des ads (jours)', a.med); add('Cas ads', v.cas != null ? 'cas ' + v.cas : ''); add('Relevé ads du', fd(a.maj_at))
  }
  L.push('')
  add('Objectif', n.form_objectif || n.closing_objectif); add('Budget', n.form_budget); add('Son problème', n.closing_mots); add('Où il en est', (CLOSING_SITUATIONS.find((s) => s.k === n.closing_situation) || {}).label); add('Offre discutée', n.closing_offre || n.ecrit_offre)
  add('Statut', p.statut); add('Premier contact', fd(p.date_contact)); add('Lead depuis', fd(p.date_lead))
  add('A répondu', p.a_repondu ? 'oui' : ''); add('Intéressé', p.interesse ? 'oui' : ''); add('Pitch envoyé', fd(n.pitch_envoye_at))
  const pr = appelProgrammeTs(n)
  add('Appel Google Meet', pr !== null ? fd(new Date(pr).toISOString()) : (n.appel_reserve ? 'réservé, date à programmer' : ''))
  add('No-show', n.no_show_count); add('Notes', n.note_texte)
  return L.filter((x, i, t) => x !== '' || (i > 0 && t[i - 1] !== '')).join('\n').trim()
}
export function BtnCopierInfos({ p }) {
  const { cfg } = useCrm()
  return <button className="cx-btn ghost sm" title="Copier toutes les infos du prospect (pour préparer un appel)" onClick={async () => { try { await navigator.clipboard.writeText(infosProspect(p, cfg)); toast('Toutes les infos copiées') } catch (_) { toast('Copie automatique impossible') } }}>📋 Copier infos</button>
}
// « A réservé un appel » : demande la date/heure du Google Meet (facultatif) avant de l'envoyer dans Appels.
export function BtnReserverAppel({ p, className = 'cx-btn sm', label = 'A réservé un appel' }) {
  const [ouvert, setOuvert] = useState(false)
  return (<>
    <button className={className} onClick={() => setOuvert(true)}>{label}</button>
    {ouvert && <ModalDateAppel p={p} onClose={() => setOuvert(false)} />}
  </>)
}
export function ModalDateAppel({ p, onClose }) {
  const { A } = useCrm(), [d, setD] = useState('')
  return (
    <Modal title={'Appel Google Meet · ' + (p.nom_marque || '')} onClose={onClose}>
      <p className="cx-p">Date et heure du Google Meet (vous pouvez aussi la mettre plus tard dans Appels).</p>
      <input type="datetime-local" value={d} onChange={(e) => setD(e.target.value)} style={{ width: '100%' }} autoFocus />
      <div className="cx-act"><button className="cx-btn" onClick={onClose}>Annuler</button>
        <button className="cx-btn primary" onClick={async () => { const ok = await A.reserver(p.id, d ? new Date(d).toISOString() : null, ''); if (ok !== false) { toast(d ? 'Appel programmé, envoyé dans Appels' : 'Envoyé dans Appels : programmez la date'); onClose() } }}>{d ? 'Programmer' : 'Envoyer dans Appels sans date'}</button></div>
    </Modal>
  )
}
export function BtnLienDemo({ p }) {
  const l = N(p).lien_demo; if (!l) return null
  return <button className="cx-btn ghost sm" onClick={async () => { try { await navigator.clipboard.writeText(l); toast('Lien démo copié') } catch (_) { toast('Copie automatique impossible') } }}>Copier lien démo</button>
}
export function BtnsContact({ p }) {
  const num = (p.lien_wa || '').replace('https://wa.me/', '').split('?')[0].replace(/\D/g, '')
  if (!num && !p.lien_instagram) return <span className="cx-note">Aucun contact enregistré</span>
  return <>{num && <a className="cx-btn sm wa" href={'https://wa.me/' + num} target="_blank" rel="noreferrer">📱 WhatsApp</a>}{p.lien_instagram && <a className="cx-btn sm ig" href={p.lien_instagram} target="_blank" rel="noreferrer">📷 Instagram</a>}</>
}

// Case « déjà envoyé » : pour cocher à la main un message parti hors du CRM (copié, envoyé depuis le téléphone…).
export function CaseEnvoye({ onCheck, disabled }) {
  return <label className="cx-sentbox" title="J'ai déjà envoyé ce message : le marquer comme envoyé"><input type="checkbox" checked={false} disabled={disabled} onChange={() => onCheck()} /><span>déjà envoyé</span></label>
}
