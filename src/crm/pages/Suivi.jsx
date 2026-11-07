import React, { useMemo, useState } from 'react'
import { usePref } from '../prefs'
import { correspond } from '../filtre'
import { useCrm } from '../store'
import { N } from '../domain/notes'
import { appelProgrammeTs, estInstagram, numeroWa, ecritActif } from '../domain/rules'
import { lienPitch, pitchMessage } from '../domain/messages'
import { Chip, Empty, Pills, Stat, confirmDlg, toast } from '../ui'
import { BtnNotes, BtnSupprimer, BtnCopierInfos, ModalDateAppel } from './common'

const CHECKS = [{ k: 'a_repondu', l: 'A répondu' }, { k: 'interesse', l: 'Intéressé' }, { k: 'lead_qualifie', l: 'Lead qualifié' }]
const jour = (iso) => (iso ? new Date(iso).toLocaleDateString('fr-FR') : '—')

function SuiviCard({ p }) {
  const { A, cfg, ouvrirFiche } = useCrm(), n = N(p), [busy, setBusy] = useState(false), [dateAppel, setDateAppel] = useState(false)
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
          <label className="cx-lbl"><input type="checkbox" checked={!!n.appel_reserve} onChange={(e) => (e.target.checked ? setDateAppel(true) : A.annulerAppel(p.id))} />A réservé un call</label>
          {n.appel_reserve && prog !== null && <div className="cx-when">📅 Appel programmé le {new Date(prog).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>}
        </div>}
      </div>
      <div className="cx-acts">
        {tout && <button className="cx-btn ok sm" onClick={() => A.versLead(p.id)}>Passer en Lead</button>}
        <button className="cx-btn sm" onClick={async () => { if (await A.passerEcrit(p.id)) toast('Passé en Closing par écrit') }}>💬 Closing par écrit</button>
        <BtnNotes p={p} /><BtnCopierInfos p={p} />
        {dateAppel && <ModalDateAppel p={p} onClose={() => setDateAppel(false)} />}
        <button className="cx-btn ghost sm" onClick={() => A.remettreAContacter(p.id)}>Annuler le suivi</button><BtnSupprimer p={p} />
      </div>
    </div>
  )
}

const FILTRES = {
  tous: () => true,
  sans: (p) => !p.a_repondu && !N(p).pas_interesse,
  repondu: (p) => !!p.a_repondu,
  pitch: (p) => !!p.a_repondu && !N(p).pitch_envoye && !N(p).pas_interesse,
  pitchok: (p) => !!N(p).pitch_envoye && !N(p).pas_interesse,
  interesse: (p) => !!p.interesse,
  call: (p) => !!N(p).appel_reserve,
  perdu: (p) => !!N(p).pas_interesse,
}
const TRIS = { ancien: 'Contactés en premier', recent: 'Plus récents', az: 'Nom A → Z' }

export default function Suivi() {
  const { prospects } = useCrm()
  const [q, setQ] = usePref('suivi_q', ''), [f, setF] = usePref('suivi_f', 'tous'), [tri, setTri] = usePref('suivi_tri', 'ancien'), [pays, setPays] = usePref('suivi_pays', ''), [date, setDate] = usePref('suivi_date', ''), [max, setMax] = useState(50)
  const base = useMemo(() => prospects.filter((p) => p.statut === 'en_suivi' && !ecritActif(p)), [prospects])
  const cnt = useMemo(() => Object.fromEntries(Object.keys(FILTRES).map((k) => [k, base.filter(FILTRES[k]).length])), [base])
  const listePays = useMemo(() => { const m = new Map(); base.forEach((p) => { if (p.pays) m.set(p.pays, (m.get(p.pays) || 0) + 1) }); return [...m].sort((a, b) => b[1] - a[1]) }, [base])
  const liste = useMemo(() => {
    const l = base.filter((p) => (FILTRES[f] || FILTRES.tous)(p) && (!pays || p.pays === pays) && (!date || (p.date_contact || '').slice(0, 10) === date) && correspond(p, q))
    const t = (p) => Date.parse(p.date_contact || 0) || 0
    return l.sort(tri === 'recent' ? (a, b) => t(b) - t(a) : tri === 'az' ? (a, b) => (a.nom_marque || '').localeCompare(b.nom_marque || '') : (a, b) => t(a) - t(b))
  }, [base, q, f, tri, pays, date])
  const c = base.length, pc = (x) => (c ? Math.round((x / c) * 100) + ' % des contactés' : '')
  const actif = q || f !== 'tous' || pays || date
  return (<>
    <div className="cx-stats">
      <Stat l="En suivi" v={c} />
      <Stat l="Ont répondu" v={cnt.repondu}><em>{pc(cnt.repondu)}</em></Stat>
      <Stat l="Pitch à envoyer" v={cnt.pitch} t="hot" onClick={() => setF('pitch')}><em>réponse sans pitch</em></Stat>
      <Stat l="Intéressés" v={cnt.interesse}><em>{pc(cnt.interesse)}</em></Stat>
      <Stat l="Call réservé" v={cnt.call} t="acc" onClick={() => setF('call')} />
    </div>
    <div className="cx-tools">
      <input className="cx-search" type="search" placeholder="Rechercher marque, produit, numéro…" value={q} onChange={(e) => { setQ(e.target.value); setMax(50) }} />
      <Pills value={f} onChange={(v) => { setF(v); setMax(50) }} options={[['tous', 'Tous', cnt.tous], ['sans', 'Sans réponse', cnt.sans], ['repondu', 'Ont répondu', cnt.repondu], ['pitch', 'Pitch à envoyer', cnt.pitch, 'hot'], ['pitchok', 'Pitch envoyé', cnt.pitchok], ['interesse', 'Intéressés', cnt.interesse], ['call', 'Call réservé', cnt.call], ['perdu', 'Pas intéressés', cnt.perdu]]} />
      <div className="cx-bar2">
        {listePays.length > 1 && <select value={pays} onChange={(e) => setPays(e.target.value)} aria-label="Pays" className="cx-sel"><option value="">Tous les pays</option>{listePays.map(([x, k]) => <option key={x} value={x}>{x} ({k})</option>)}</select>}
        <select value={tri} onChange={(e) => setTri(e.target.value)} aria-label="Trier" className="cx-sel">{Object.entries(TRIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <input type="date" className="cx-sel" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date de contact" />
        {actif && <button className="cx-btn ghost sm" onClick={() => { setQ(''); setF('tous'); setPays(''); setDate('') }}>Réinitialiser · {liste.length} résultat{liste.length > 1 ? 's' : ''}</button>}
      </div>
    </div>
    {liste.length ? <>{liste.slice(0, max).map((p) => <SuiviCard key={p.id} p={p} />)}{liste.length > max && <button className="cx-btn" style={{ width: '100%' }} onClick={() => setMax(max + 50)}>Afficher plus ({liste.length - max} restants)</button>}</> : <Empty t={base.length ? 'Aucun prospect avec ce filtre' : 'Aucun prospect en suivi'} s={base.length ? 'Change de filtre ou réinitialise.' : 'Contactez des prospects pour les voir apparaître ici.'} />}
  </>)
}
