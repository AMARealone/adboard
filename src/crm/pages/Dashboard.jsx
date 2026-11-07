import React, { useEffect, useMemo, useState } from 'react'
import { useCrm } from '../store'
import { fetchFunnel, fetchLiensCourts, fetchTransactions } from '../api'
import { calculer, fenetre } from '../domain/stats'
import { usePref } from '../prefs'
import { Card, Icon, Seg, Stat } from '../ui'
import { Area, Bars, Donut, Funnel, HBars, Spark } from '../charts'

const PERIODES = [[0, "Aujourd'hui"], [7, '7 j'], [30, '30 j'], [90, '90 j'], [9999, 'Tout']]
const f1 = (x) => (x === null || x === undefined ? '—' : (Math.round(x * 10) / 10).toString().replace('.', ',') + ' %')
const n0 = (x) => (x === null || x === undefined ? '—' : x)
const JOUR = 86400000
const jl = (d) => new Date(d).toLocaleDateString('sv-SE')
const delta = (a, b) => (b > 0 ? Math.round(((a - b) / b) * 100) : null)

export default function Dashboard() {
  const { prospects } = useCrm()
  const [per, setPer] = usePref('dash_per', 30), [de, setDe] = usePref('dash_de', ''), [a, setA] = usePref('dash_a', ''), [detail, setDetail] = usePref('dash_detail', false)
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
  const perso = !!(de || a)
  const w = useMemo(() => fenetre(perso ? { de, a } : { jours: per }), [per, de, a, perso])
  const s = useMemo(() => calculer({ prospects, liens: d.liens, funnel: d.funnel, tx: d.tx, w }), [prospects, d, w])
  // Période précédente de même durée, pour les variations
  const wPrec = useMemo(() => {
    if (!w.t0) return null
    const fin = isFinite(w.t1) ? w.t1 : Date.now(), len = fin - w.t0
    return { t0: w.t0 - len, t1: w.t0 - 1 }
  }, [w])
  const sPrec = useMemo(() => (wPrec ? calculer({ prospects, liens: d.liens, funnel: d.funnel, tx: d.tx, w: wPrec }) : null), [prospects, d, wPrec])
  const dl = (i) => (sPrec ? delta(s.hero[i].v, sPrec.hero[i].v) : null)

  const nbJ = perso ? Math.min(90, Math.max(7, Math.round(((a ? Date.parse(a) : Date.now()) - (de ? Date.parse(de) : Date.now() - 29 * JOUR)) / JOUR) + 1)) : per === 0 ? 14 : per >= 9999 ? 30 : Math.min(per, 60)
  const fin = a ? Date.parse(a + 'T12:00:00') : Date.now()
  const serieContacts = useMemo(() => {
    const m = {}; prospects.forEach((p) => { if (p.date_contact) { const k = jl(p.date_contact); m[k] = (m[k] || 0) + 1 } })
    const out = []; for (let k = nbJ - 1; k >= 0; k--) { const dd = new Date(fin - k * JOUR); out.push({ l: dd.getDate() + '/' + (dd.getMonth() + 1), v: m[jl(dd)] || 0, hl: jl(dd) === jl(Date.now()) }) }
    return out
  }, [prospects, nbJ, fin])
  const rep = useMemo(() => {
    const m = {}; prospects.forEach((p) => { if (p.a_repondu && p.date_contact) { const k = jl(p.date_contact); m[k] = (m[k] || 0) + 1 } })
    return serieContacts.map((x, i) => { const dd = new Date(fin - (serieContacts.length - 1 - i) * JOUR); return m[jl(dd)] || 0 })
  }, [prospects, serieContacts, fin])
  const acheteursJ = s.jours.map((x) => ({ l: x.j.slice(8) + '/' + x.j.slice(5, 7), v: x.v }))
  const sommeAcheteurs30 = s.jours.reduce((t, x) => t + x.v, 0)

  const groupes = [...new Set(s.lignes.map((x) => x.groupe))]
  const parGroupe = groupes.map((g) => ({ l: g, v: s.lignes.filter((x) => x.groupe === g && !x.sansEnvoi).reduce((t, x) => t + x.envoyes, 0) })).filter((x) => x.v > 0)
  const topMsg = [...s.lignes].filter((x) => !x.sansEnvoi && x.envoyes > 0).sort((x, y) => (y.clics || 0) - (x.clics || 0) || y.envoyes - x.envoyes).slice(0, 7)
  const exporter = () => {
    const v = (x, suf) => (x === null || x === undefined ? '—' : typeof x === 'number' ? x.toFixed(1) + (suf || '%') : x)
    const lib = perso ? (de || '…') + ' → ' + (a || '…') : (PERIODES.find((x) => x[0] === per) || [])[1] || per + ' j'
    let md = '# Dashboard AdStack — export\n\n**Période :** ' + lib + '\n**Généré le :** ' + new Date().toLocaleString('fr-FR') + '\n\n## Vue d\'ensemble\n\n| Étape | Valeur |\n|---|---|\n'
    s.hero.forEach((e) => { md += '| ' + e.l + ' | ' + e.v + ' |\n' })
    md += '\n## Performance par message\n\n| Message | Envoyés | Clics | CTR | Panier | Paiement | Achats |\n|---|---|---|---|---|---|---|\n'
    s.lignes.forEach((x) => { md += '| ' + x.label + ' | ' + (x.sansEnvoi ? '—' : x.envoyes) + ' | ' + v(x.clics, '') + ' | ' + v(x.ctr) + ' | ' + x.panier + ' | ' + x.paiement + ' | ' + x.achats + ' |\n' })
    const u = URL.createObjectURL(new Blob([md], { type: 'text/markdown;charset=utf-8' })), l = document.createElement('a')
    l.href = u; l.download = 'dashboard_adstack_' + new Date().toISOString().slice(0, 10) + '.md'; document.body.appendChild(l); l.click(); document.body.removeChild(l); URL.revokeObjectURL(u)
  }
  const H = s.hero
  return (<>
    <div className="cx-tools"><div className="cx-bar2">
      <Seg value={perso ? 'perso' : per} onChange={(v) => { setDe(''); setA(''); setPer(v) }} options={PERIODES} />
      <span className="cx-range" style={{ marginLeft: 0 }}><input type="date" value={de} onChange={(e) => setDe(e.target.value)} aria-label="Du" /><i>→</i><input type="date" value={a} onChange={(e) => setA(e.target.value)} aria-label="Au" /></span>
      <button className="cx-btn sm ghost" style={{ marginLeft: 'auto' }} onClick={exporter}><Icon n="down" s={14} /> Export</button>
    </div></div>
    {d.err.map((e) => <div key={e} className="cx-banner">⚠ Non chargé — {e}. Les chiffres concernés restent à 0 tant que ce n'est pas réglé.</div>)}
    {d.charge && <p className="cx-sub">Chargement des clics et des événements…</p>}

    <div className="cx-stats wrap">
      <Stat l="Contactés" v={H[0].v} d={dl(0)}><span className="sp"><Spark values={serieContacts.map((x) => x.v)} /></span></Stat>
      <Stat l="Réponses" v={H[1].v} d={dl(1)}><em>{f1(H[1].p)}</em><span className="sp"><Spark values={rep} color="var(--c2)" /></span></Stat>
      <Stat l="Intéressés" v={H[2].v} d={dl(2)}><em>{f1(H[2].p)}</em></Stat>
      <Stat l="Appels réservés" v={H[4].v} d={dl(4)} t="hot"><em>{s.appels.faits} faits · {s.appels.noShows} no-show</em></Stat>
      <Stat l="Acheteurs" v={H[5].v} d={dl(5)} t="ok"><em>{f1(H[5].p)} des contactés</em><span className="sp"><Spark values={s.jours.map((x) => x.v)} color="var(--ok)" /></span></Stat>
    </div>

    <div className="cx-g2">
      <Card t="Entonnoir" note="contactés de la période">
        <Funnel steps={H.map((e, i) => ({ l: e.l, v: e.v, accent: i === H.length - 1 }))} />
      </Card>
      <Card t="Contactés par jour" note={serieContacts.reduce((t, x) => t + x.v, 0) + ' sur ' + nbJ + ' j'}>
        <Bars data={serieContacts} h={150} />
      </Card>
    </div>

    <div className="cx-g3">
      <Card t="Acheteurs par jour" note={sommeAcheteurs30 + ' en 30 j'}><Area data={acheteursJ} color="var(--ok)" h={110} /></Card>
      <Card t="Appels"><Donut parts={[{ l: 'Via le site', v: s.appels.site, c: 'var(--ac)' }, { l: 'Ajoutés à la main', v: s.appels.manuel, c: 'var(--c3)' }]} centre={s.appels.reserves} sous="réservés" size={110} /></Card>
      <Card t="Messages envoyés"><Donut parts={parGroupe} centre={parGroupe.reduce((t, x) => t + x.v, 0)} sous="envois" size={110} /></Card>
    </div>

    <div className="cx-g2">
      <Card t="Closing après appel" note={s.closing.entres + ' entrés · ' + s.closing.payes + ' payés · ' + s.closing.perdus + ' pas intéressés'}>
        <Funnel steps={[{ l: 'Entrés', v: s.closing.entres }, ...s.closing.relances.map((r) => ({ l: 'Relance J+' + r.j, v: r.envoyes })), { l: 'Payés', v: s.closing.payes, accent: true }]} />
      </Card>
      <Card t="Closing par écrit" note={s.ecrit.entres + ' entrés · ' + s.ecrit.payes + ' payés'}>
        <Funnel steps={[{ l: 'Entrés', v: s.ecrit.entres }, { l: 'Bloc 1 · diagnostic', v: s.ecrit.b1 }, { l: 'Bloc 2 · plan', v: s.ecrit.b2 }, { l: 'Bloc 3 · étude de cas', v: s.ecrit.b3 }, { l: 'Bloc 4 · offre', v: s.ecrit.b4 }, { l: 'Payés', v: s.ecrit.payes, accent: true }]} />
      </Card>
    </div>

    <Card t="Messages qui font cliquer" note={s.achatsTx + ' achat' + (s.achatsTx > 1 ? 's' : '') + ' · ' + s.attribues + ' rattaché' + (s.attribues > 1 ? 's' : '') + ' à un message'}>
      {topMsg.length ? <HBars rows={topMsg.map((x) => ({ l: x.label, v: x.clics || 0, sub: x.ctr === null ? '' : f1(x.ctr) + ' · ' + x.envoyes + ' env.' }))} /> : <span className="cx-sub">Aucun message envoyé sur la période.</span>}
      <button className="cx-btn sm ghost" style={{ marginTop: 12 }} onClick={() => setDetail(!detail)}>{detail ? 'Masquer' : 'Voir'} le tableau détaillé</button>
      {detail && <div className="cx-scroll" style={{ marginTop: 10 }}><table className="cx-tbl">
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
      </table></div>}
    </Card>
  </>)
}
