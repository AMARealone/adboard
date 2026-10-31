import React, { useState } from 'react'
import { useCrm } from '../store'
import { N, quand } from '../domain/notes'
import { ecritActif, ecritB1Saute, ecritProchaine } from '../domain/rules'
import { ECRIT_ETAPES, ECRIT_FAILLES } from '../domain/defaults'
import { BoutonMajAds } from './MajAds'
import { ecritMessage, lienOffreSuivi, pitchVariante } from '../domain/messages'
import { OFFRES } from '../domain/offres'
import { Chip, Empty, toast } from '../ui'
import { Marque, Meta, EcritInfos } from './common'

export function EcritCard({ p }) {
  const { A, cfg } = useCrm(); const n = N(p), prochaine = ecritProchaine(n)
  const [infos, setInfos] = useState(false)
  const envoyer = async (etape) => {
    const { msg, manque } = ecritMessage(p, etape, cfg)
    if (manque.length) { toast('Il manque : ' + manque.join(', ')); if (manque.some((x) => x === 'faille' || x === 'offre')) setInfos(true); return }
    const rest = msg.match(/\[[^\]]{2,40}\]/); if (rest) { toast('Variable non remplie : ' + rest[0] + ' (vérifie Templates)'); return }
    let final = msg
    if ((etape === 'b3' || etape === 'suite') && n.ecrit_offre) {
      const camp = 'ecrit_' + etape
      const lien = await A.shorten(lienOffreSuivi(n.ecrit_offre, camp, 'ecrit', p.id), camp)
      final = ecritMessage(p, etape, cfg, lien).msg
    }
    if (await A.ouvrirCanal(p, final)) A.marquer(p.id, 'ecrit_sent_' + etape, true)
  }
  const v = pitchVariante(p, cfg)
  return (
    <div className="cx-row">
      <div className="cx-main">
        <div className="cx-line"><Marque p={p} />{n.ecrit_offre && <Chip c="off">{OFFRES[n.ecrit_offre]?.label}</Chip>}{n.ecrit_faille && <Chip c="mu" title="Faille">{ECRIT_FAILLES[n.ecrit_faille]}</Chip>}</div>
        <Meta p={p} />
        <div className="cx-when">{ecritB1Saute(n) ? 'Audit déjà envoyé par les relances (bloc 1 sauté)' : v.cas ? '✅ ads à jour : ' + v.ads + ' ads · ' + v.jours + ' j · cas ' + v.cas : (v.maj ? '○ ' : '⚠ ') + 'ads : ' + v.raison}</div>
        <div className="cx-steps">{ECRIT_ETAPES.map((e) => {
          const cle = e.key, label = e.label
          const skip = cle === 'b1' && ecritB1Saute(n), sent = !!n['ecrit_sent_' + cle], due = !sent && !skip && prochaine === cle
          return <div key={cle} className={'cx-step' + (sent || skip ? ' done' : due ? ' due' : '')}><b>{String(label).split('·')[0]}</b>
            {skip ? <span>sauté</span> : sent ? <button className="cx-lnk" onClick={() => A.marquer(p.id, 'ecrit_sent_' + cle, false)}>✓ {quand(n['ecrit_sent_' + cle + '_at'])}</button> : <button className={'cx-btn sm' + (due ? ' primary' : '')} onClick={() => envoyer(cle)}>Envoyer</button>}</div>
        })}</div>
      </div>
      <div className="cx-acts">
        <button className="cx-btn sm" onClick={() => setInfos(true)}>Faille / offre</button>
        <button className="cx-btn ok sm" onClick={() => A.decision(p.id, 'paye')}>A payé</button>
        <button className="cx-btn ghost sm" onClick={() => A.decision(p.id, 'perdu')}>Pas intéressé</button>
        <button className="cx-btn ghost sm" onClick={() => A.decision(p.id, 'relances')}>Retour aux relances</button>
      </div>
      {infos && <EcritInfos p={p} onClose={() => setInfos(false)} />}
    </div>
  )
}
export default function Ecrit() {
  const { prospects } = useCrm(); const l = prospects.filter(ecritActif)
  return (<>
    <p className="cx-sub">Prospects qui préfèrent discuter par écrit sur WhatsApp : audit (bloc 1), plan (bloc 2), offre (bloc 3), puis lien et suite. Le bloc 1 a besoin des ads à jour.</p>
    <div style={{ marginBottom: 10 }}><BoutonMajAds /></div>
    {l.length ? l.map((p) => <EcritCard key={p.id} p={p} />) : <Empty t="Personne en closing par écrit" s="Depuis Leads, « Reste sur WhatsApp » envoie un prospect ici." />}
  </>)
}
