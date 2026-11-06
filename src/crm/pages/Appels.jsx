import React, { useState } from 'react'
import { useCrm } from '../store'
import { N, quand, duree } from '../domain/notes'
import { appelAffiche, appelEcheance, appelEnRetard, appelProgrammeTs, closingInfosIncompletes } from '../domain/rules'
import { Chip, Empty, toast } from '../ui'
import { useFiltre } from '../filtre'
import { Marque, Meta, Decision, BtnNotes, BtnSupprimer, BtnLienDemo, BtnsContact } from './common'

const toLocal = (ms) => { const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16) }
export function AppelCard({ p }) {
  const { A } = useCrm(); const n = N(p), now = Date.now()
  const [dec, setDec] = useState(false)
  const e = appelEcheance(n), retard = appelEnRetard(n, now), pr = appelProgrammeTs(n)
  return (
    <div className={'cx-row' + (retard ? ' alert' : '')}>
      <div className="cx-main">
        <div className="cx-line"><Marque p={p} />{n.form_nom || n.appel_via === 'site' ? <Chip c="bl">FORMULAIRE SITE</Chip> : null}{n.no_show_count ? <Chip c="wa">NO-SHOW ×{n.no_show_count}</Chip> : null}{n.appel_fait && <Chip c="ok">APPEL FAIT</Chip>}</div>
        <Meta p={p} />
        <div className="cx-when">{pr !== null ? <>📅 Programmé {quand(n.appel_programme_at)}</> : <>Réservé {quand(n.appel_reserve_at)}</>}{e !== null && <span className={retard ? 'red' : ''}> · {retard ? 'en retard de ' + duree(now - e) : 'dans ' + duree(e - now)}</span>}</div>
        <div className="cx-inline"><input type="datetime-local" defaultValue={pr !== null ? toLocal(pr) : ''} onChange={(ev) => { const v = ev.target.value; if (v) A.programmer(p.id, new Date(v).toISOString()) }} /></div>
      </div>
      <div className="cx-acts">
        {!n.appel_fait ? <button className="cx-btn primary sm" onClick={async () => { await A.appelFait(p.id); setDec(true) }}>Appel fait</button> : <button className="cx-btn primary sm" onClick={() => setDec(true)}>Décider</button>}
        <button className="cx-btn sm" onClick={() => A.noShow(p.id)}>No-show</button>
        <button className="cx-btn ghost sm" onClick={() => A.annulerAppel(p.id)}>Annuler la réservation</button>
        <BtnsContact p={p} /><BtnLienDemo p={p} /><BtnNotes p={p} /><BtnSupprimer p={p} />
      </div>
      {dec && <Decision p={p} onClose={() => setDec(false)} />}
    </div>
  )
}
export default function Appels() {
  const { prospects } = useCrm()
  const l = prospects.filter(appelAffiche).sort((a, b) => (appelEcheance(N(a)) || 9e15) - (appelEcheance(N(b)) || 9e15))
  const F = useFiltre(l)
  return (<>
    {l.length > 0 && F.bar}
    {F.liste.length ? F.liste.map((p) => <AppelCard key={p.id} p={p} />) : l.length ? <Empty t="Aucun résultat" s="Modifiez la recherche ou les filtres." /> : <Empty t="Aucun appel en attente" s="Les réservations du site arrivent ici automatiquement." />}
  </>)
}
