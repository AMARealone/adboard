import React, { useState } from 'react'
import { useCrm } from './store'
import { N, quand } from './domain/notes'
import { OFFRES } from './domain/offres'
import { appelAffiche, closingDansListe, ecritActif, horsLeads } from './domain/rules'
import { pitchVariante } from './domain/messages'
import { Chip, Modal } from './ui'
import { InfosAppel, EcritInfos, Decision, BtnCopierInfos, BtnReserverAppel } from './pages/common'

// Parcours complet d'un prospect : tout ce qui lui est arrivé, dans l'ordre.
function parcours(p, cfg) {
  const n = N(p), L = []
  const add = (at, txt, c) => at && L.push({ at: Date.parse(at), txt, c })
  add(p.date_collecte || p.created_at, 'Collecté')
  add(p.date_contact, 'Premier contact' + (p.canal_contact ? ' (' + p.canal_contact + ')' : ''))
  add(p.date_lead, 'Devenu lead', 'ok')
  add(n.form_at || n.form_date, 'A rempli le formulaire du site' + (n.form_objectif ? ' · ' + n.form_objectif : ''), 'bl')
  ;[3, 10, 21].forEach((j) => add(n['j' + j + '_envoye_at'] || n['sent_j' + j + '_at'], 'Relance J+' + j + ' envoyée'))
  add(n.appel_reserve_at, 'Appel réservé' + (n.source === 'formulaire_site' || n.appel_via === 'site' ? ' (site)' : ''), 'bl')
  add(n.appel_programme_at, 'Appel programmé', 'bl')
  add(n.no_show_at, 'No-show', 'wa')
  add(n.appel_fait_at, 'Appel fait', 'ok')
  ;[1, 3, 4, 7, 11, 10, 21].forEach((j) => add(n['closing_sent_j' + j + '_at'], 'Closing J+' + j + ' envoyé'))
  add(n.ecrit_at, 'Passé en closing par écrit')
  ;['b1', 'b2', 'b3', 'suite'].forEach((e) => add(n['ecrit_sent_' + e + '_at'], 'Écrit : ' + e + ' envoyé'))
  add(n.pas_interesse_at, 'Pas intéressé', 'red')
  add(n.closing_paye_at || n.ecrit_paye_at || p.date_achat, 'A payé' + (n.closing_offre ? ' · ' + (OFFRES[n.closing_offre] || {}).label : ''), 'ok')
  return L.filter((x) => !isNaN(x.at)).sort((a, b) => a.at - b.at)
}
export default function Fiche() {
  const { prospects, ouvrirFiche, cfg, A } = useCrm(), p = prospects.find((x) => x.id === useCrm().fiche)
  const [sub, setSub] = useState('')
  if (!p) return null
  const n = N(p), v = pitchVariante(p, cfg), L = parcours(p, cfg)
  const etat = p.statut === 'acheteur' ? 'Client' : appelAffiche(p) ? 'Appel' : closingDansListe(p) ? 'Closing' : ecritActif(p) ? 'Écrit' : p.statut === 'lead' ? 'Lead' : p.statut
  return (<>
    <Modal wide title={p.nom_marque || '—'} onClose={() => ouvrirFiche(null)}>
      <div className="cx-line"><Chip c="bl">{etat}</Chip>{p.produit && <Chip c="mu">{p.produit}</Chip>}{p.pays && <Chip c="mu">{p.pays}</Chip>}{n.pas_interesse && <Chip c="red">Pas intéressé</Chip>}</div>
      <div className="cx-grid2">
        <div><h4>Contact</h4>
          {p.lien_wa && <a className="cx-lnk" href={p.lien_wa} target="_blank" rel="noreferrer">WhatsApp : {p.lien_wa.replace('https://wa.me/', '')}</a>}
          {p.lien_instagram && <a className="cx-lnk" href={p.lien_instagram} target="_blank" rel="noreferrer">Instagram</a>}
          {(n.form_nom || n.form_boutique) && <div className="cx-dim">{n.form_nom} {n.form_boutique && <a className="cx-lnk" href={n.form_boutique} target="_blank" rel="noreferrer">boutique</a>}</div>}
          {n.form_objectif && <div className="cx-dim">🎯 {n.form_objectif}{n.form_budget ? ' · 💰 ' + n.form_budget : ''}</div>}
        </div>
        <div><h4>Ads (relevé du PC)</h4>
          <div className="cx-dim">{v.cas === 0 ? '0 ad active · cas 0 · relevé il y a ' + v.age + ' j' : v.cas ? v.ads + ' ads · ' + v.jours + ' j · cas ' + v.cas + ' · relevé il y a ' + v.age + ' j' : v.raison}</div>
          {n.closing_prenom && <><h4>Infos de l'appel</h4><div className="cx-dim">{n.closing_prenom} · « {n.closing_mots || '—'} » · {n.closing_objectif || '—'}</div></>}
        </div>
      </div>
      <h4>Parcours</h4>
      <div className="cx-tl">{L.length ? L.map((x, i) => <div key={i} className={'cx-tli ' + (x.c || '')}><i />{<span>{quand(new Date(x.at).toISOString())}</span>}<b>{x.txt}</b></div>) : <div className="cx-dim">Pas encore d'historique.</div>}</div>
      <div className="cx-act wrap">
        {!appelAffiche(p) && !closingDansListe(p) && p.statut !== 'acheteur' && <BtnReserverAppel p={p} />}
        <BtnCopierInfos p={p} />
        {!ecritActif(p) && (p.statut === 'lead' || p.statut === 'en_suivi') && <button className="cx-btn sm" onClick={() => A.passerEcrit(p.id)}>💬 Passer en Écrit</button>}
        {(closingDansListe(p) || appelAffiche(p)) && <button className="cx-btn sm" onClick={() => setSub('infos')}>Infos de l'appel</button>}
        {ecritActif(p) && <button className="cx-btn sm" onClick={() => setSub('ecrit')}>Faille / offre</button>}
        {appelAffiche(p) && <button className="cx-btn sm primary" onClick={() => setSub('decision')}>Après l'appel</button>}
      </div>
    </Modal>
    {sub === 'infos' && <InfosAppel p={p} onClose={() => setSub('')} />}
    {sub === 'ecrit' && <EcritInfos p={p} onClose={() => setSub('')} />}
    {sub === 'decision' && <Decision p={p} onClose={() => setSub('')} />}
  </>)
}
