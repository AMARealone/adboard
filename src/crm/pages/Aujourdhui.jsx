import React from 'react'
import { useCrm } from '../store'
import { aFaire, closingEnRetard, ecritB1Saute } from '../domain/rules'
import { ECRIT_ETAPES } from '../domain/defaults'
import { N, duree } from '../domain/notes'
import { pitchVariante } from '../domain/messages'
import { BoutonMajAds } from './MajAds'
import { Chip, Empty } from '../ui'
import { useNavigate } from 'react-router-dom'

export default function Aujourdhui() {
  const { prospects, cfg, ouvrirFiche, A } = useCrm(), nav = useNavigate()
  const t = aFaire(prospects, cfg)
  const adsAMajour = prospects.filter((p) => { const n = N(p); return n.ecrit_etat === 'actif' && !n.ecrit_sent_b1 && !ecritB1Saute(n) && !pitchVariante(p, cfg).maj }).length
  const total = t.appels.length + t.noshow.length + t.closing.length + t.ecrit.length + t.relances.length
  const Bloc = ({ titre, to, items, children }) => items.length > 0 && (
    <section className="cx-bloc"><header><b>{titre}</b><Chip c="bl">{items.length}</Chip><button className="cx-lnk" onClick={() => nav(to)}>Ouvrir la section →</button></header>{children}</section>)
  const Ligne = ({ p, chips, action }) => <div className="cx-li"><button className="cx-name" onClick={() => ouvrirFiche(p.id)}>{p.nom_marque || '—'}</button><span className="cx-meta">{p.produit}</span>{chips}{action}</div>
  return (<>
    <div className="cx-kpis">
      <div><b>{total}</b><span>à faire maintenant</span></div>
      <div><b>{t.appels.length + t.noshow.length}</b><span>appels</span></div>
      <div><b>{t.closing.length}</b><span>closing</span></div>
      <div><b>{t.ecrit.length}</b><span>écrit</span></div>
      <div><b>{t.relances.length}</b><span>relances</span></div>
    </div>
    {adsAMajour > 0 && <div className="cx-banner wa">{adsAMajour} prospect{adsAMajour > 1 ? 's' : ''} en Écrit {adsAMajour > 1 ? 'ont' : 'a'} besoin des ads à jour avant l'audit : lance « Ads J+3 » sur ton PC. <BoutonMajAds compact /></div>}
    {total === 0 && <Empty t="Rien d'urgent 🎉" s="Tout ce qui est dû aujourd'hui est traité." />}
    <Bloc titre="No-show à appliquer" to="/appels" items={t.noshow}>{t.noshow.map(({ p, depuis }) => <Ligne key={p.id} p={p} chips={<Chip c="wa">programmé il y a {duree(depuis)}</Chip>} action={<button className="cx-btn sm" onClick={() => A.noShow(p.id, true)}>Marquer no-show</button>} />)}</Bloc>
    <Bloc titre="Appels du jour" to="/appels" items={t.appels}>{t.appels.map(({ p, retard, at }) => <Ligne key={p.id} p={p} chips={retard ? <Chip c="red">en retard de {duree(Date.now() - at)}</Chip> : <Chip c="bl">{new Date(at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Chip>} />)}</Bloc>
    <Bloc titre="Closing à envoyer" to="/closing" items={t.closing}>{t.closing.map(({ p, j, age }) => <Ligne key={p.id} p={p} chips={<Chip c="red">J+{j} · appel il y a {age} j</Chip>} />)}</Bloc>
    <Bloc titre="Écrit : prochain bloc" to="/ecrit" items={t.ecrit}>{t.ecrit.map(({ p, etape, depuis }) => <Ligne key={p.id} p={p} chips={<Chip c="bl">{(ECRIT_ETAPES.find((e) => e.key === etape) || {}).label}</Chip>} />)}</Bloc>
    <Bloc titre="Relances Leads" to="/leads" items={t.relances}>{t.relances.map(({ p, j, retard }) => <Ligne key={p.id} p={p} chips={<Chip c={retard > 0 ? 'red' : 'bl'}>J+{j}{retard > 0 ? ' · ' + retard + ' j de retard' : ''}</Chip>} />)}</Bloc>
  </>)
}
