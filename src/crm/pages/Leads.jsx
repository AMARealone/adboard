import React, { useState } from 'react'
import { useCrm } from '../store'
import { N, quand } from '../domain/notes'
import { RELANCES, jDepuisLead, leadsARelancer, prochaineRelance, relanceEnvoyee, numeroWa } from '../domain/rules'
import { RELANCE_LABELS } from '../domain/defaults'
import { insererLien, lienRelance, relanceMessage } from '../domain/messages'
import { BoutonMajAds } from './MajAds'
import { Chip, Empty, toast, confirmDlg } from '../ui'
import { Marque, Meta, BtnNotes, BtnSupprimer, BtnLienDemo, BtnCopierInfos } from './common'

export function LeadCard({ p }) {
  const { A, cfg, mutate } = useCrm(); const n = N(p), j = jDepuisLead(p), pj = prochaineRelance(n), [busy, setBusy] = useState(false)
  const envoyer = async (i) => {
    const g = relanceMessage(p, i, cfg)
    if (g.avertir && !(await confirmDlg('Les ads de ' + (p.nom_marque || 'ce lead') + ' ne sont pas à jour (' + g.v.raison + ').\nEnvoyer quand même la version SANS chiffres ?', 'Envoyer sans chiffres'))) return
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
      const d = RELANCES[i]
      await mutate(p.id, { notes: { ['j' + d + '_envoye']: true, ['j' + d + '_envoye_at']: new Date().toISOString(), ...(i === 0 && g.trace ? { j3_variante: g.trace } : {}) } })
    } finally { setBusy(false) }
  }
  const retard = pj !== null && j > pj, aujourdhui = pj !== null && j === pj
  return (
    <div className={'cx-row' + (retard ? ' alert' : '')}>
      <div className="cx-main">
        <div className="cx-line"><Marque p={p} />{pj === null ? <Chip>SÉQUENCE TERMINÉE</Chip> : retard ? <Chip c="red">EN RETARD · J+{pj}</Chip> : aujourdhui ? <Chip c="bl">À ENVOYER AUJOURD'HUI · J+{pj}</Chip> : <Chip c="mu">prochaine : J+{pj} (dans {pj - j} j)</Chip>}{n.no_show_count ? <Chip c="wa">NO-SHOW</Chip> : null}</div>
        <Meta p={p} />
        <div className="cx-when">Lead depuis {j} j</div>
        <div className="cx-steps">{RELANCES.map((d, i) => {
          const sent = relanceEnvoyee(n, d), due = !sent && j >= d && pj === d
          return <div key={d} className={'cx-step' + (sent ? ' done' : due ? ' due' : '')}><b>J+{d}</b><span>{RELANCE_LABELS[i]}</span>
            {sent ? <button className="cx-lnk" onClick={() => mutate(p.id, { notes: { ['sent_j' + d]: undefined, ['j' + d + '_envoye']: undefined, ['j' + d + '_envoye_at']: undefined } })}>✓ {quand(n['j' + d + '_envoye_at']) || 'fait'}</button> : <button disabled={busy} className={'cx-btn sm' + (due ? ' primary' : '')} onClick={() => envoyer(i)}>Envoyer</button>}</div>
        })}</div>
      </div>
      <div className="cx-acts">
        <button className="cx-btn sm" onClick={() => A.reserver(p.id, null, '')}>A réservé un appel</button>
        <button className="cx-btn sm" onClick={async () => { if (await A.passerEcrit(p.id)) toast('Passé en Écrit') }}>💬 Reste sur WhatsApp</button>
        <button className="cx-btn ghost sm" onClick={async () => { if (await confirmDlg('Remettre ce lead en suivi ?')) mutate(p.id, { body: { statut: 'en_suivi', date_lead: null } }) }}>Remettre en suivi</button>
        <BtnLienDemo p={p} /><BtnNotes p={p} /><BtnCopierInfos p={p} /><BtnSupprimer p={p} />
      </div>
    </div>
  )
}
export default function Leads() {
  const { prospects } = useCrm()
  const l = leadsARelancer(prospects).map((p) => { const n = N(p), j = jDepuisLead(p), pj = prochaineRelance(n); return { p, s: pj === null ? -9999 : j - pj } }).sort((a, b) => b.s - a.s)
  const urgents = l.filter((x) => x.s >= 0).length
  return (<>
    <p className="cx-sub">Leads qualifiés à relancer : J+3 (pitch avec les ads du jour), J+10 (preuve), J+21 (alerte Andromeda). Les leads qui ont réservé un appel sont dans Appels, ceux qui restent sur WhatsApp dans Écrit.</p>
    <div style={{ marginBottom: 10 }}><BoutonMajAds /></div>
    {urgents > 0 && <div className="cx-banner">{urgents} relance{urgents > 1 ? 's' : ''} à envoyer maintenant</div>}
    {l.length ? l.map(({ p }) => <LeadCard key={p.id} p={p} />) : <Empty t="Aucun lead à relancer" />}
  </>)
}
