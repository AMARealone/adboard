import React, { useMemo, useState } from 'react'
import { useCrm } from '../store'
import { N } from '../domain/notes'
import { appelProgrammeTs, estInstagram, numeroWa } from '../domain/rules'
import { lienPitch, pitchMessage } from '../domain/messages'
import { Chip, Empty, confirmDlg, toast } from '../ui'
import { BtnNotes, BtnSupprimer, BtnCopierInfos } from './common'

const CHECKS = [{ k: 'a_repondu', l: 'A répondu' }, { k: 'interesse', l: 'Intéressé' }, { k: 'lead_qualifie', l: 'Lead qualifié' }]
const jour = (iso) => (iso ? new Date(iso).toLocaleDateString('fr-FR') : '—')

function SuiviCard({ p }) {
  const { A, cfg, ouvrirFiche } = useCrm(), n = N(p), [busy, setBusy] = useState(false)
  const tout = p.a_repondu && p.interesse && p.lead_qualifie, insta = estInstagram(p)
  const pitch = async () => {
    setBusy(true)
    const tab = !insta && numeroWa(p) ? window.open('', '_blank') : null
    try {
      const lien = await A.shorten(lienPitch(p.id), 'pitch'), msg = pitchMessage(p, cfg, lien)
      const num = numeroWa(p)
      if (tab && num) tab.location.href = 'https://wa.me/' + num + '?text=' + encodeURIComponent(msg)
      else { if (tab) tab.close(); if (!(await A.ouvrirCanal(p, msg))) return }
    } finally { setBusy(false) }
  }
  const prog = appelProgrammeTs(n)
  return (
    <div className="cx-row" style={n.pas_interesse ? { opacity: 0.65 } : null}>
      <div className="cx-main">
        <div className="cx-line"><button className="cx-name" onClick={() => ouvrirFiche(p.id)}>{p.nom_marque || '—'}</button>{p.pays && <Chip c="mu">{p.pays}</Chip>}{n.pas_interesse && <Chip c="red">Pas intéressé</Chip>}{insta && <Chip c="mu">Instagram</Chip>}</div>
        <div className="cx-when">{p.produit || '—'} · contacté le {jour(p.date_contact)}</div>
        <div className="cx-checks">{CHECKS.map((c) => <button key={c.k} className={'cx-chk' + (p[c.k] ? ' on' : '')} onClick={() => A.setCheck(p.id, c.k, !p[c.k])} aria-pressed={!!p[c.k]}><i>{p[c.k] ? '✓' : ''}</i>{c.l}</button>)}</div>
        {p.a_repondu && (numeroWa(p) || p.lien_instagram) && <div className="cx-sub2">
          <b>Réponse · pitch</b>
          <div className="cx-line"><button className="cx-btn sm primary" disabled={busy} onClick={pitch}>{busy ? 'Préparation…' : insta ? 'Envoyer le pitch (Instagram)' : 'Envoyer le pitch (WhatsApp)'}</button>
            <label className="cx-lbl"><input type="checkbox" checked={!!n.pitch_envoye} onChange={(e) => A.pitchEnvoye(p.id, e.target.checked)} />Pitch envoyé{n.pitch_envoye_at ? ' · ' + jour(n.pitch_envoye_at) : ''}</label>
            {((n.pitch_envoye && !p.interesse) || n.pas_interesse) && <label className="cx-lbl red"><input type="checkbox" checked={!!n.pas_interesse} onChange={(e) => A.pasInteresse(p.id, e.target.checked)} />Pas intéressé</label>}</div>
        </div>}
        {p.interesse && <div className="cx-sub2 wa"><b>Intéressé · appel</b>
          <label className="cx-lbl"><input type="checkbox" checked={!!n.appel_reserve} onChange={(e) => (e.target.checked ? A.reserver(p.id, null, '') : A.annulerAppel(p.id))} />A réservé un call</label>
          {n.appel_reserve && prog !== null && <div className="cx-when">📅 Appel programmé le {new Date(prog).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>}
        </div>}
      </div>
      <div className="cx-acts">
        {tout && <button className="cx-btn ok sm" onClick={() => A.versLead(p.id)}>Passer en Lead</button>}
        <BtnNotes p={p} /><BtnCopierInfos p={p} />
        <button className="cx-btn ghost sm" onClick={() => A.remettreAContacter(p.id)}>Annuler le suivi</button><BtnSupprimer p={p} />
      </div>
    </div>
  )
}

export default function Suivi() {
  const { prospects } = useCrm()
  const [q, setQ] = useState(''), [rep, setRep] = useState(false), [date, setDate] = useState('')
  const base = useMemo(() => prospects.filter((p) => p.statut === 'en_suivi'), [prospects])
  const liste = useMemo(() => base.filter((p) => (!rep || p.a_repondu) && (!date || (p.date_contact || '').slice(0, 10) === date) && (!q.trim() || [p.nom_marque, p.produit, p.pays].some((v) => (v || '').toLowerCase().includes(q.trim().toLowerCase())))).sort((a, b) => Date.parse(a.date_contact || 0) - Date.parse(b.date_contact || 0)), [base, q, rep, date])
  const c = base.length, r = base.filter((p) => p.a_repondu).length, i = base.filter((p) => p.interesse).length, l = base.filter((p) => p.lead_qualifie).length
  const pc = (x) => (c ? Math.round((x / c) * 100) + '%' : '—')
  return (<>
    <p className="cx-sub">Cochez l'évolution : les 3 cases cochées donnent le bouton « Passer en Lead ».</p>
    <div className="cx-hero" style={{ marginBottom: 10 }}>{[['En suivi', c, null], ['Réponses', r, pc(r)], ['Intéressés', i, pc(i)], ['Leads qualifiés', l, pc(l)]].map(([lb, v, p], k) => <React.Fragment key={lb}>{k > 0 && <span className="cx-arrow">›</span>}<div className={k === 3 ? 'acc' : ''}><b>{v}</b><span>{lb}{p ? ' · ' + p : ''}</span></div></React.Fragment>)}</div>
    <div className="cx-tools"><input className="cx-search" placeholder="Rechercher un prospect…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="cx-tabs"><button className={'cx-tab' + (!rep ? ' on' : '')} onClick={() => setRep(false)}>Tous <i>{c}</i></button><button className={'cx-tab' + (rep ? ' on' : '')} onClick={() => setRep(true)}>Ont répondu <i>{r}</i></button>
        <span className="cx-range"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date de contact" />{date && <button className="cx-btn ghost sm" onClick={() => setDate('')}>✕</button>}</span></div></div>
    {liste.length ? liste.map((p) => <SuiviCard key={p.id} p={p} />) : <Empty t="Aucun prospect en suivi" s="Contactez des prospects pour les voir apparaître ici." />}
  </>)
}
