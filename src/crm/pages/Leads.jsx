import React, { useState } from 'react'
import { useCrm } from '../store'
import { N, quand } from '../domain/notes'
import { RELANCES, jDepuisLead, leadsARelancer, etatRelances, relanceEnvoyee, numeroWa } from '../domain/rules'
import { RELANCE_LABELS } from '../domain/defaults'
import { insererLien, lienRelance, relanceMessage } from '../domain/messages'
import { BoutonMajAds } from './MajAds'
import { useFiltre } from '../filtre'
import { Chip, Empty, Pills, Stat, toast, confirmDlg } from '../ui'
import { usePref } from '../prefs'
import { Marque, Meta, BtnNotes, BtnSupprimer, BtnLienDemo, BtnCopierInfos, BtnReserverAppel, CaseEnvoye } from './common'

export function LeadCard({ p }) {
  const { A, cfg, mutate } = useCrm(); const n = N(p), j = jDepuisLead(p), er = etatRelances(p), pj = er.pj, [busy, setBusy] = useState(false)
  const envoyer = async (i) => {
    const g = relanceMessage(p, i, cfg)
    if (g.bloque) { toast('Mets d\'abord à jour les ads de ' + (p.nom_marque || 'ce lead') + ' (' + g.bloque + ') : bouton « Mettre à jour ses ads »'); return }
    setBusy(true)
    const tab = (!p.canal_contact || p.canal_contact !== 'instagram') && numeroWa(p) ? window.open('', '_blank') : null
    try {
      // Pas de lien dans le message (ex. J+3) : rien à suivre, rien à raccourcir.
      const aLien = /adstackofficial\.com/i.test(g.msg) || /\[lien(_demo)?\]/i.test(g.msg)
      const msg = aLien ? insererLien(g.msg, await A.shorten(lienRelance(i, p.id, g.chemin), ['j3', 'j10', 'j21'][i])) : g.msg
      const rest = msg.match(/\[[^\]]{2,40}\]/)
      if (rest) { toast('Variable non remplie : ' + rest[0] + ' (vérifie Templates)'); if (tab) tab.close(); return }
      const num = numeroWa(p)
      if (tab && num) tab.location.href = 'https://wa.me/' + num + '?text=' + encodeURIComponent(msg)
      else if (!(await A.ouvrirCanal(p, msg))) { if (tab) tab.close(); return }
      // On n'auto-confirme PAS l'envoi : c'est toi qui coches « déjà envoyé ». On garde seulement la variante utilisée.
      if (i === 0 && g.trace && !relanceEnvoyee(n, RELANCES[0])) await mutate(p.id, { notes: { j3_variante: g.trace, j3_cas: g.v && Number.isInteger(g.v.cas) ? g.v.cas : undefined } }) // le J+10 reprend ce cas
    } finally { setBusy(false) }
  }
  const retard = pj !== null && er.retard > 0, aujourdhui = pj !== null && er.reste === 0
  return (
    <div className={'cx-row' + (retard ? ' alert' : '')}>
      <div className="cx-main">
        <div className="cx-line"><Marque p={p} />{pj === null ? <Chip>SÉQUENCE TERMINÉE</Chip> : retard ? <Chip c="red">EN RETARD · J+{pj} · {er.retard} j</Chip> : aujourdhui ? <Chip c="bl">À ENVOYER AUJOURD'HUI · J+{pj}</Chip> : <Chip c="mu">prochaine : J+{pj} (dans {er.reste} j)</Chip>}{n.no_show_count ? <Chip c="wa">NO-SHOW</Chip> : null}</div>
        <Meta p={p} />
        <div className="cx-when">Lead depuis {j} j</div>
        <div className="cx-steps">{RELANCES.map((d, i) => {
          const sent = relanceEnvoyee(n, d), due = !sent && pj === d && er.reste <= 0
          return <div key={d} className={'cx-step' + (sent ? ' done' : due ? ' due' : '')}><b>J+{d}</b><span>{RELANCE_LABELS[i]}</span>
            {sent ? <><button disabled={busy} className="cx-btn sm ghost" title="Déjà envoyé : rouvre le message pour tester. L'envoi enregistré et sa date ne changent pas." onClick={() => envoyer(i)}>✓ {quand(n['j' + d + '_envoye_at']) || 'fait'}</button>
              <button className="cx-lnk" title="Annuler l'envoi enregistré" onClick={async () => { if (await confirmDlg('Annuler l\'envoi enregistré de J+' + d + ' ?\nSa date sera effacée et les relances suivantes se recalculeront.', 'Annuler l\'envoi')) mutate(p.id, { notes: { ['sent_j' + d]: undefined, ['j' + d + '_envoye']: undefined, ['j' + d + '_envoye_at']: undefined } }) }}>↺</button></> : <button disabled={busy} className={'cx-btn sm' + (due ? ' primary' : '')} onClick={() => envoyer(i)}>Envoyer</button>}
            {!sent && <CaseEnvoye disabled={busy} onCheck={() => mutate(p.id, { notes: { ['j' + d + '_envoye']: true, ['j' + d + '_envoye_at']: new Date().toISOString() } })} />}</div>
        })}</div>
      </div>
      <div className="cx-acts">
        <BtnReserverAppel p={p} />
        <button className="cx-btn sm" onClick={async () => { if (await A.passerEcrit(p.id)) toast('Passé en Écrit') }}>💬 Reste sur WhatsApp</button>
        <button className="cx-btn ghost sm" onClick={async () => { if (await confirmDlg('Remettre ce lead en suivi ?')) mutate(p.id, { body: { statut: 'en_suivi', date_lead: null } }) }}>Remettre en suivi</button>
        <BtnLienDemo p={p} /><BtnNotes p={p} /><BtnCopierInfos p={p} /><BtnSupprimer p={p} />
      </div>
    </div>
  )
}
export default function Leads() {
  const { prospects } = useCrm()
  const l = leadsARelancer(prospects).map((p) => { const e = etatRelances(p); return { p, s: e.pj === null ? -9999 : -e.reste } }).sort((a, b) => b.s - a.s)
  const urgents = l.filter((x) => x.s >= 0).length
  const F = useFiltre(l.map((x) => x.p))
  const [vue, setVue] = usePref('leads_vue', 'tous')
  const dues = new Set(l.filter((x) => x.s >= 0).map((x) => x.p.id))
  const liste = F.liste.filter((p) => vue === 'tous' || (vue === 'dues' ? dues.has(p.id) : !dues.has(p.id)))
  return (<>
    <div className="cx-stats"><Stat l="Leads à relancer" v={l.length} /><Stat l="À relancer maintenant" v={urgents} t="hot" onClick={() => setVue('dues')} /><Stat l="En attente" v={l.length - urgents} /></div>
    <div style={{ marginBottom: 10 }}><BoutonMajAds /></div>
    {l.length > 0 && <div className="cx-tools" style={{ position: 'static' }}><Pills value={vue} onChange={setVue} options={[['tous', 'Tous', l.length], ['dues', 'À relancer maintenant', urgents, 'hot'], ['attente', 'En attente', l.length - urgents]]} /></div>}
    {l.length > 0 && F.bar}
    {liste.length ? liste.map((p) => <LeadCard key={p.id} p={p} />) : l.length ? <Empty t="Aucun résultat" s="Modifiez la recherche ou les filtres." /> : <Empty t="Aucun lead à relancer" />}
  </>)
}
