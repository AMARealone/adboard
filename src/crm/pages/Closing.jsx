import React, { useState } from 'react'
import { useCrm } from '../store'
import { N, quand } from '../domain/notes'
import { closingDansListe, closingEcheance, closingEnRetard, closingEnvoye, closingInfosIncompletes, closingJours, closingProchainJ } from '../domain/rules'
import { CLOSING_JOURS, CLOSING_LABELS } from '../domain/defaults'
import { closingMessage, lienOffreSuivi } from '../domain/messages'
import { OFFRES } from '../domain/offres'
import { useFiltre } from '../filtre'
import { Chip, Empty, Pills, Stat, toast, confirmDlg } from '../ui'
import { usePref } from '../prefs'
import { Marque, Meta, InfosAppel, BtnNotes, BtnSupprimer, BtnCopierInfos, CaseEnvoye } from './common'

export function ClosingCard({ p }) {
  const { A, cfg } = useCrm(); const n = N(p), now = Date.now(), age = closingJours(n, now), pj = closingProchainJ(n), ech = closingEcheance(n, now)
  const [infos, setInfos] = useState(false)
  const envoyer = async (i) => {
    const tab = A.preOuvrir(p) // onglet ouvert au clic : sinon le mobile bloque l'ouverture après le raccourcissement du lien
    const fin = (m) => { if (m) toast(m); if (tab) tab.close() }
    try {
      const { msg, manque } = closingMessage(p, i, cfg)
      if (manque.length) { fin('Il manque : ' + manque.join(', ')); setInfos(true); return }
      const rest = msg.match(/\[[^\]]{2,40}\]/); if (rest) { fin('Variable non remplie : ' + rest[0] + ' (vérifie Templates)'); return }
      const lien = await A.shorten(lienOffreSuivi(n.closing_offre, 'closing_j' + CLOSING_JOURS[i], 'closing', p.id), 'closing_j' + CLOSING_JOURS[i])
      const final = closingMessage(p, i, cfg, lien).msg
      await A.ouvrirCanal(p, final, tab) // l'envoi n'est confirmé que quand tu coches « déjà envoyé »
    } catch (e) { fin('Envoi impossible : ' + (e && e.message || e)) }
  }
  const o = OFFRES[n.closing_offre]
  return (
    <div className={'cx-row' + (closingEnRetard(n, now) ? ' alert' : '')}>
      <div className="cx-main">
        <div className="cx-line"><Marque p={p} />{o && <Chip c="off" title="Offre discutée">{o.label}</Chip>}{closingInfosIncompletes(n) && <Chip c="wa">Infos de l'appel à compléter</Chip>}</div>
        <Meta p={p} />
        <div className="cx-when">Appel il y a {age} j{n.closing_mots ? <> · « {n.closing_mots} »</> : null}</div>
        <div className="cx-steps">{CLOSING_JOURS.map((j, i) => {
          const sent = closingEnvoye(n, j), due = !sent && pj === j && !!ech && ech.reste <= 0
          return <div key={j} className={'cx-step' + (sent ? ' done' : due ? ' due' : '')}>
            <b>J+{j}</b><span>{CLOSING_LABELS[i]}</span>
            {sent ? <><button className="cx-btn sm ghost" title="Déjà envoyé : rouvre le message pour tester. L'envoi enregistré et sa date ne changent pas." onClick={() => envoyer(i)}>✓ {quand(n['closing_sent_j' + j + '_at'])}</button>
                <button className="cx-lnk" title="Annuler l'envoi enregistré" onClick={async () => { if (await confirmDlg('Annuler l\'envoi enregistré de J+' + j + ' ?\nSa date sera effacée et les relances suivantes se recalculeront.', 'Annuler l\'envoi')) A.marquer(p.id, 'closing_sent_j' + j, false) }}>↺</button></>
              : <><button className={'cx-btn sm' + (due ? ' primary' : '')} onClick={() => envoyer(i)}>Envoyer</button>
                <CaseEnvoye onCheck={() => A.marquer(p.id, 'closing_sent_j' + j, true)} />
                {!due && pj === j && ech && ech.reste > 0 && <span className="cx-dim">dans {ech.reste} j</span>}</>}
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
  const [vue, setVue] = usePref('closing_vue', 'tous')
  const dues = new Set(l.filter((p) => closingEnRetard(N(p), now)).map((p) => p.id))
  const liste = F.liste.filter((p) => vue === 'tous' || (vue === 'dues' ? dues.has(p.id) : !dues.has(p.id)))
  return (<>
    <div className="cx-stats"><Stat l="En closing" v={l.length} /><Stat l="Relance à envoyer" v={dues.size} t="hot" onClick={() => setVue('dues')} /><Stat l="En attente" v={l.length - dues.size} /></div>
    {l.length > 0 && <div className="cx-tools" style={{ position: 'static' }}><Pills value={vue} onChange={setVue} options={[['tous', 'Tous', l.length], ['dues', 'À relancer maintenant', dues.size, 'hot'], ['attente', 'En attente', l.length - dues.size]]} /></div>}
    {l.length > 0 && F.bar}
    {liste.length ? liste.map((p) => <ClosingCard key={p.id} p={p} />) : l.length ? <Empty t="Aucun résultat" s="Modifiez la recherche ou les filtres." /> : <Empty t="Aucune relance de closing" s="Un prospect arrive ici quand vous choisissez « À relancer » après l'appel." />}
  </>)
}
