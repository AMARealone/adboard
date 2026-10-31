import React, { useEffect, useMemo, useState } from 'react'
import { useCrm } from '../store'
import { fetchFunnel, fetchLiensCourts, fetchTransactions } from '../api'
import { calculer, fenetre } from '../domain/stats'

const PERIODES = [{ l: "Aujourd'hui", j: 0 }, { l: '7 jours', j: 7 }, { l: '30 jours', j: 30 }, { l: '90 jours', j: 90 }, { l: 'Tout', j: 9999 }]
const f1 = (x) => (x === null || x === undefined ? '—' : (Math.round(x * 10) / 10).toString().replace('.', ',') + ' %')
const n0 = (x) => (x === null || x === undefined ? '—' : x)

function Courbe({ jours }) {
  const max = Math.max(1, ...jours.map((x) => x.v)), W = 600, H = 70, dx = W / (jours.length - 1)
  const pts = jours.map((x, i) => (i * dx).toFixed(1) + ',' + (H - 6 - (x.v / max) * (H - 14)).toFixed(1)).join(' ')
  return <svg viewBox={'0 0 ' + W + ' ' + H} className="cx-curve" preserveAspectRatio="none" role="img" aria-label="Acheteurs par jour sur 30 jours"><polyline points={pts} fill="none" stroke="var(--ac)" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg>
}
function Bloc({ t, children, note }) { return <section className="cx-bloc"><header><b>{t}</b>{note && <span className="cx-note">{note}</span>}</header><div className="cx-pad">{children}</div></section> }
const Mini = ({ l, v, s }) => <div className="cx-mini"><b>{v}</b><span>{l}</span>{s && <em>{s}</em>}</div>

export default function Dashboard() {
  const { prospects } = useCrm()
  const [per, setPer] = useState(30), [de, setDe] = useState(''), [a, setA] = useState('')
  const [d, setD] = useState({ liens: [], funnel: [], tx: [], err: [], charge: true })
  useEffect(() => {
    let vivant = true
    ;(async () => {
      const err = []
      const g = async (nom, f) => { try { return await f() } catch (e) { err.push(nom + ' : ' + e.message); return [] } }
      const [liens, funnel, tx] = await Promise.all([g('Liens courts (clics)', () => fetchLiensCourts()), g('Événements panier / paiement', () => fetchFunnel()), g('Transactions', fetchTransactions)])
      if (vivant) setD({ liens, funnel, tx, err, charge: false })
    })()
    return () => { vivant = false }
  }, [])
  const w = useMemo(() => fenetre(de || a ? { de, a } : { jours: per }), [per, de, a])
  const s = useMemo(() => calculer({ prospects, liens: d.liens, funnel: d.funnel, tx: d.tx, w }), [prospects, d, w])
  const groupes = [...new Set(s.lignes.map((x) => x.groupe))]
  const exporter = () => {
    const v = (x, suf) => (x === null || x === undefined ? '—' : typeof x === 'number' ? x.toFixed(1) + (suf || '%') : x)
    const lib = de || a ? (de || '…') + ' → ' + (a || '…') : (PERIODES.find((x) => x.j === per) || {}).l || per + ' j'
    let md = '# Dashboard AdStack — export\n\n**Période :** ' + lib + '\n**Généré le :** ' + new Date().toLocaleString('fr-FR') + '\n\n## Vue d\'ensemble\n\n| Étape | Valeur |\n|---|---|\n'
    s.hero.forEach((e) => { md += '| ' + e.l + ' | ' + e.v + ' |\n' })
    md += '\n## Performance par message\n\n| Message | Envoyés | Clics | CTR | Panier | Paiement | Achats |\n|---|---|---|---|---|---|---|\n'
    s.lignes.forEach((x) => { md += '| ' + x.label + ' | ' + (x.sansEnvoi ? '—' : x.envoyes) + ' | ' + v(x.clics, '') + ' | ' + v(x.ctr) + ' | ' + x.panier + ' | ' + x.paiement + ' | ' + x.achats + ' |\n' })
    const u = URL.createObjectURL(new Blob([md], { type: 'text/markdown;charset=utf-8' })), l = document.createElement('a')
    l.href = u; l.download = 'dashboard_adstack_' + new Date().toISOString().slice(0, 10) + '.md'; document.body.appendChild(l); l.click(); document.body.removeChild(l); URL.revokeObjectURL(u)
  }
  return (<>
    <div className="cx-tools"><div className="cx-tabs">
      {PERIODES.map((p) => <button key={p.j} className={'cx-tab' + (!de && !a && per === p.j ? ' on' : '')} onClick={() => { setDe(''); setA(''); setPer(p.j) }}>{p.l}</button>)}
      <span className="cx-range"><input type="date" value={de} onChange={(e) => setDe(e.target.value)} aria-label="Du" /><i>→</i><input type="date" value={a} onChange={(e) => setA(e.target.value)} aria-label="Au" /></span>
      <button className="cx-tab" onClick={exporter}>⬇ Télécharger (.md)</button>
    </div></div>
    {d.err.map((e) => <div key={e} className="cx-banner">⚠ Non chargé — {e}. Les chiffres concernés restent à 0 tant que ce n'est pas réglé.</div>)}
    {d.charge && <p className="cx-sub">Chargement des clics et des événements…</p>}

    <div className="cx-hero">{s.hero.map((e, i) => <React.Fragment key={e.l}>{i > 0 && <span className="cx-arrow">›</span>}<div className={e.accent ? 'acc' : ''}><b>{e.v}</b><span>{e.l}{i > 0 ? ' · ' + Math.round(e.p || 0) + '%' : ''}</span></div></React.Fragment>)}</div>
    <p className="cx-sub">Entonnoir calculé sur les prospects contactés pendant la période (vraie date de contact). Appels : réservations de la période. Acheteurs : vraies transactions.</p>

    <Bloc t="Acheteurs par jour" note="30 derniers jours · transactions">
      <Courbe jours={s.jours} />
    </Bloc>

    <Bloc t="Performance par message" note="Clics = liens courts · panier / paiement = événements de la page · achats = compte rattaché au lien">
      <div className="cx-scroll"><table className="cx-tbl">
        <thead><tr><th>Message</th><th>Envoyés</th><th>Clics</th><th>CTR</th><th>Panier</th><th>Paiement</th><th>Achats</th><th>Clic → achat</th></tr></thead>
        <tbody>{groupes.map((g) => <React.Fragment key={g}>
          <tr className="cx-g"><td colSpan="8">{g}</td></tr>
          {s.lignes.filter((x) => x.groupe === g).map((x) => <tr key={x.cle}>
            <td>{x.label}{x.lien === false && <small> · sans lien</small>}</td>
            <td>{x.sansEnvoi ? '—' : x.envoyes}</td><td>{n0(x.clics)}</td><td>{f1(x.ctr)}</td>
            <td>{x.clics ? x.panier + ' · ' + f1(x.tPanier) : '—'}</td><td>{x.clics ? x.paiement + ' · ' + f1(x.tPaiement) : '—'}</td>
            <td>{x.achats}</td><td>{f1(x.tAchat)}</td>
          </tr>)}
        </React.Fragment>)}</tbody>
        <tfoot><tr><td>Total messages</td><td>{s.tot.envoyes}</td><td>{s.tot.clics}</td><td>{f1(s.tot.ctr)}</td><td>{s.tot.panier}</td><td>{s.tot.paiement}</td><td>{s.tot.achats}</td><td>{f1(s.tot.clics ? (s.tot.achats / s.tot.clics) * 100 : null)}</td></tr></tfoot>
      </table></div>
      <p className="cx-foot-note">{s.achatsTx} achat{s.achatsTx > 1 ? 's' : ''} au total sur la période, dont <b>{s.attribues}</b> rattaché{s.attribues > 1 ? 's' : ''} à un message{s.nonAttribues > 0 ? ' et ' + s.nonAttribues + ' sans lien suivi (accès direct, ancien lien, autre appareil).' : '.'}</p>
    </Bloc>

    <div className="cx-grid2">
      <Bloc t="Appels">
        <div className="cx-minis"><Mini l="Réservés" v={s.appels.reserves} /><Mini l="Via le site" v={s.appels.site} /><Mini l="Ajoutés à la main" v={s.appels.manuel} /><Mini l="Faits" v={s.appels.faits} /><Mini l="No-show" v={s.appels.noShows} /></div>
      </Bloc>
      <Bloc t="Closing après appel">
        <div className="cx-minis"><Mini l="Entrés" v={s.closing.entres} /><Mini l="Payés" v={s.closing.payes} /><Mini l="Pas intéressés" v={s.closing.perdus} /></div>
        <table className="cx-tbl sm"><thead><tr><th>Version</th><th>J+1 envoyés</th><th>payés</th><th>J+3 envoyés</th><th>payés</th></tr></thead><tbody>
          {['A', 'B'].map((v) => { const a1 = s.closing.j1.find((x) => x.v === v), a3 = s.closing.j3.find((x) => x.v === v); return <tr key={v}><td>{v}</td><td>{a1.envoyes}</td><td>{a1.payes}</td><td>{a3.envoyes}</td><td>{a3.payes}</td></tr> })}
        </tbody></table>
        <p className="cx-foot-note">Les « payés » comptent les prospects devenus acheteurs, quelle que soit la relance qui les a convaincus.</p>
      </Bloc>
    </div>
    <Bloc t="Closing par écrit">
      <div className="cx-minis"><Mini l="Entrés" v={s.ecrit.entres} /><Mini l="Bloc 1 · audit" v={s.ecrit.b1} /><Mini l="Bloc 2 · plan" v={s.ecrit.b2} /><Mini l="Bloc 3 · offre" v={s.ecrit.b3} /><Mini l="Suite" v={s.ecrit.suite} /><Mini l="Payés" v={s.ecrit.payes} /><Mini l="Perdus" v={s.ecrit.perdus} s="depuis toujours" /></div>
    </Bloc>
    <p className="cx-foot-note">Les coûts API de l'ancien Dashboard ne sont pas encore repris ici : ils restent dans l'ancien CRM.</p>
  </>)
}
