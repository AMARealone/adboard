import React, { useState } from 'react'
import { useCrm } from '../store'
import { N, quand } from '../domain/notes'
import { closingDansListe, closingEnRetard, closingInfosIncompletes, closingJours, closingProchainJ } from '../domain/rules'
import { CLOSING_JOURS, CLOSING_LABELS } from '../domain/defaults'
import { closingMessage, lienOffreSuivi } from '../domain/messages'
import { OFFRES } from '../domain/offres'
import { useFiltre } from '../filtre'
import { Chip, Empty, toast } from '../ui'
import { Marque, Meta, InfosAppel, BtnNotes, BtnSupprimer, BtnCopierInfos, CaseEnvoye } from './common'

export function ClosingCard({ p }) {
  const { A, cfg } = useCrm(); const n = N(p), now = Date.now(), age = closingJours(n, now), pj = closingProchainJ(n)
  const [infos, setInfos] = useState(false)
  const envoyer = async (i) => {
    const { msg, manque } = closingMessage(p, i, cfg)
    if (manque.length) { toast('Il manque : ' + manque.join(', ')); setInfos(true); return }
    const rest = msg.match(/\[[^\]]{2,40}\]/); if (rest) { toast('Variable non remplie : ' + rest[0] + ' (vérifie Templates)'); return }
    const lien = await A.shorten(lienOffreSuivi(n.closing_offre, 'closing_j' + CLOSING_JOURS[i], 'closing', p.id), 'closing_j' + CLOSING_JOURS[i])
    const final = closingMessage(p, i, cfg, lien).msg
    await A.ouvrirCanal(p, final) // l'envoi n'est confirmé que quand tu coches « déjà envoyé »
  }
  const o = OFFRES[n.closing_offre]
  return (
    <div className={'cx-row' + (closingEnRetard(n, now) ? ' alert' : '')}>
      <div className="cx-main">
        <div className="cx-line"><Marque p={p} />{o && <Chip c="off" title="Offre discutée">{o.label}</Chip>}{closingInfosIncompletes(n) && <Chip c="wa">Infos de l'appel à compléter</Chip>}</div>
        <Meta p={p} />
        <div className="cx-when">Appel il y a {age} j{n.closing_mots ? <> · « {n.closing_mots} »</> : null}</div>
        <div className="cx-steps">{CLOSING_JOURS.map((j, i) => {
          const sent = !!n['closing_sent_j' + j], due = !sent && age >= j && pj === j
          return <div key={j} className={'cx-step' + (sent ? ' done' : due ? ' due' : '')}>
            <b>J+{j}</b><span>{CLOSING_LABELS[i]}</span>
            {sent ? <button className="cx-lnk" onClick={() => A.marquer(p.id, 'closing_sent_j' + j, false)}>✓ {quand(n['closing_sent_j' + j + '_at'])}</button>
              : <><button className={'cx-btn sm' + (due ? ' primary' : '')} onClick={() => envoyer(i)}>Envoyer</button>
                <CaseEnvoye onCheck={() => A.marquer(p.id, 'closing_sent_j' + j, true)} />
                {i < 2 && <button className="cx-ab" title="Version du texte" onClick={() => A.closingVersion(p.id, i === 0 ? 1 : 3, (i === 0 ? n.closing_ab1 : n.closing_ab3) === 'B' ? 'A' : 'B')}>{(i === 0 ? n.closing_ab1 : n.closing_ab3) === 'B' ? 'B' : 'A'}</button>}</>}
          </div>
        })}</div>
      </div>
      <div className="cx-acts">
        <button className="cx-btn sm" onClick={() => setInfos(true)}>Infos de l'appel</button>
        <button className="cx-btn ok sm" onClick={() => A.decision(p.id, 'paye')}>A payé</button>
        <button className="cx-btn ghost sm" onClick={() => A.decision(p.id, 'perdu')}>Pas intéressé</button>
        <button className="cx-btn sm" onClick={async () => { if (await A.reprogrammer(p.id)) toast('Retour dans Appels : programmez la date') }}>📞 Nouvel appel</button>
        <BtnNotes p={p} /><BtnCopierInfos p={p} /><BtnSupprimer p={p} />
      </div>
      {infos && <InfosAppel p={p} onClose={() => setInfos(false)} />}
    </div>
  )
}
export default function Closing() {
  const { prospects } = useCrm(); const now = Date.now()
  const l = prospects.filter(closingDansListe).sort((a, b) => (closingEnRetard(N(b), now) ? 1 : 0) - (closingEnRetard(N(a), now) ? 1 : 0) || closingJours(N(b), now) - closingJours(N(a), now))
  const F = useFiltre(l)
  return (<>
    {l.length > 0 && F.bar}
    {F.liste.length ? F.liste.map((p) => <ClosingCard key={p.id} p={p} />) : l.length ? <Empty t="Aucun résultat" s="Modifiez la recherche ou les filtres." /> : <Empty t="Aucune relance de closing" s="Un prospect arrive ici quand vous choisissez « À relancer » après l'appel." />}
  </>)
}
