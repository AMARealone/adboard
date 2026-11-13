import React from 'react'
import { useCrm } from '../store'
import { N, quand } from '../domain/notes'
import { estAcheteur, dateAchat, jDepuisAchat, offreAchetee, offreSuivante, mrr, potentiel, etapeFaite, etapesDe, etapeDue } from '../domain/acheteurs'
import { acheteurMessage, lienOffreSuivi } from '../domain/messages'
import { OFFRES, fcfa } from '../domain/offres'
import { useFiltre } from '../filtre'
import { Chip, Empty, Pills, Stat, toast, confirmDlg } from '../ui'
import { usePref } from '../prefs'
import { Marque, Meta, BtnNotes, BtnSupprimer, BtnCopierInfos, CaseEnvoye } from './common'

export function AcheteurCard({ p }) {
  const { A, cfg } = useCrm(); const n = N(p), now = Date.now()
  const k = offreAchetee(p), o = OFFRES[k], suiv = OFFRES[offreSuivante(k)], j = jDepuisAchat(p, now), at = dateAchat(p)
  const etapes = etapesDe(k), due = etapeDue(p, now), gain = potentiel(k)
  const envoyer = async (e) => {
    const tab = A.preOuvrir(p) // onglet ouvert au clic : sinon le mobile bloque l'ouverture après le raccourcissement du lien
    const fin = (m) => { if (m) toast(m); if (tab) tab.close() }
    try {
      const { msg, manque } = acheteurMessage(p, e.cle, cfg)
      if (manque.length) { fin('Il manque : ' + manque.join(', ') + (manque.includes('Offre') ? ' (choisis l\'offre souscrite)' : '')); return }
      const rest = msg.match(/\[[^\]]{2,40}\]/); if (rest) { fin('Variable non remplie : ' + rest[0] + ' (vérifie Templates › Acheteurs)'); return }
      const lien = e.upsell && suiv ? await A.shorten(lienOffreSuivi(suiv.key, 'acheteur_' + e.cle, 'acheteur', p.id), 'acheteur_' + e.cle) : ''
      await A.ouvrirCanal(p, acheteurMessage(p, e.cle, cfg, lien).msg, tab) // l'envoi n'est confirmé que quand tu coches « déjà envoyé »
    } catch (err) { fin('Envoi impossible : ' + (err && err.message || err)) }
  }
  return (
    <div className="cx-row">
      <div className="cx-main">
        <div className="cx-line"><Marque p={p} />{o ? <Chip c="off" title="Offre souscrite">{o.label}</Chip> : <Chip c="wa">Offre à préciser</Chip>}{suiv ? <Chip c="bl" title="Prochaine marche de l'échelle">→ {suiv.label}</Chip> : o ? <Chip c="ok">Offre maximale</Chip> : null}</div>
        <Meta p={p} />
        <div className="cx-when">{at ? <>Acheté {quand(at)} · J+{j}</> : 'Date d\'achat inconnue'}{o ? (mrr(k) > 0 ? <> · {fcfa(mrr(k))} / mois</> : ' · achat unique') : null}{gain > 0 ? <> · potentiel +{fcfa(gain)} / mois</> : null}</div>
        <div className="cx-steps">{etapes.map((e) => {
          const sent = etapeFaite(n, e.cle), isDue = !sent && j >= e.jour
          return <div key={e.cle} className={'cx-step' + (sent ? ' done' : isDue ? ' due' : '')}>
            <b>J+{e.jour}</b><span title={e.aide}>{e.label}</span>
            {sent ? <><button className="cx-btn sm ghost" title="Déjà envoyé : rouvre le message pour tester. L'envoi enregistré et sa date ne changent pas." onClick={() => envoyer(e)}>✓ {quand(n['acheteur_sent_' + e.cle + '_at'])}</button>
                <button className="cx-lnk" title="Annuler l'envoi enregistré" onClick={async () => { if (await confirmDlg('Annuler l\'envoi enregistré de « ' + e.label + ' » ?\nSa date sera effacée.', 'Annuler l\'envoi')) A.marquer(p.id, 'acheteur_sent_' + e.cle, false) }}>↺</button></>
              : <><button className={'cx-btn sm' + (isDue ? ' primary' : '')} onClick={() => envoyer(e)}>Envoyer</button>
                <CaseEnvoye onCheck={() => A.marquer(p.id, 'acheteur_sent_' + e.cle, true)} />
                {!isDue && <span className="cx-dim">dans {e.jour - j} j</span>}</>}
          </div>
        })}</div>
      </div>
      <div className="cx-acts">
        <select className="cx-sel" value={k} onChange={(ev) => A.acheteurOffre(p.id, ev.target.value)} aria-label="Offre souscrite"><option value="">Offre souscrite ?</option>{Object.values(OFFRES).map((x) => <option key={x.key} value={x.key}>{x.label} · {fcfa(x.prix)}</option>)}</select>
        <button className="cx-btn ghost sm red" onClick={() => A.retirerAcheteur(p.id)}>Pas acheteur</button>
        <BtnNotes p={p} /><BtnCopierInfos p={p} /><BtnSupprimer p={p} />
      </div>
    </div>
  )
}
export default function Acheteurs() {
  const { prospects } = useCrm(); const now = Date.now()
  const l = prospects.filter(estAcheteur).sort((a, b) => (etapeDue(b, now) ? 1 : 0) - (etapeDue(a, now) ? 1 : 0) || (Date.parse(dateAchat(b) || '') || 0) - (Date.parse(dateAchat(a) || '') || 0))
  const F = useFiltre(l)
  const [vue, setVue] = usePref('acheteurs_vue', 'tous')
  const dues = new Set(l.filter((p) => etapeDue(p, now)).map((p) => p.id))
  const pousser = new Set(l.filter((p) => offreSuivante(offreAchetee(p))).map((p) => p.id))
  const revenu = l.reduce((s, p) => s + mrr(offreAchetee(p)), 0), pot = l.reduce((s, p) => s + potentiel(offreAchetee(p)), 0)
  const liste = F.liste.filter((p) => vue === 'tous' || (vue === 'dues' ? dues.has(p.id) : vue === 'pousser' ? pousser.has(p.id) : !pousser.has(p.id)))
  return (<>
    <div className="cx-stats"><Stat l="Acheteurs" v={l.length} /><Stat l="Revenu mensuel" v={fcfa(revenu)} t="ok" /><Stat l="Étape à faire" v={dues.size} t="hot" onClick={() => setVue('dues')} /><Stat l="Potentiel de montée en gamme" v={'+' + fcfa(pot) + ' / mois'} /></div>
    {l.length > 0 && <p className="cx-help">Parcours de départ : bienvenue, démarrage, premiers résultats, montée en gamme. Les messages se modifient dans Templates › Acheteurs ; les étapes et l'échelle des offres dans <code>domain/acheteurs.js</code>.</p>}
    {l.length > 0 && <div className="cx-tools" style={{ position: 'static' }}><Pills value={vue} onChange={setVue} options={[['tous', 'Tous', l.length], ['dues', 'Étape à faire', dues.size, 'hot'], ['pousser', 'À pousser vers une offre supérieure', pousser.size], ['max', 'Offre maximale', l.length - pousser.size]]} /></div>}
    {l.length > 0 && F.bar}
    {liste.length ? liste.map((p) => <AcheteurCard key={p.id} p={p} />) : l.length ? <Empty t="Aucun résultat" s="Modifiez la recherche ou les filtres." /> : <Empty t="Aucun acheteur pour l'instant" s="Un prospect arrive ici dès que vous cliquez « A payé » (après un appel, en closing, en écrit ou depuis sa fiche)." />}
  </>)
}
