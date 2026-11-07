import { usePref } from '../prefs'
import React, { useEffect, useMemo, useState } from 'react'
import { fetchEmailEvents, fetchEmailsEnvoyes, fetchFunnelCampagnes } from '../api'
import { LABELS, regrouper } from '../domain/emails'

const pc = (n, t) => (t > 0 ? Math.round((n / t) * 100) + ' %' : '—')
export default function Emails() {
  const [d, setD] = useState(null), [err, setErr] = useState([]), [anciennes, setAnc] = usePref('em_anc', false)
  useEffect(() => {
    const e = [], g = async (n, f) => { try { return await f() } catch (x) { e.push(n + ' : ' + x.message); return [] } }
    Promise.all([g('Envois', fetchEmailsEnvoyes), g('Ouvertures et clics', fetchEmailEvents), g('Événements panier / paiement', fetchFunnelCampagnes)]).then(([a, b, c]) => { setErr(e); setD({ a, b, c }) })
  }, [])
  const r = useMemo(() => (d ? regrouper(d.a, d.b, d.c) : null), [d])
  if (!r) return <p className="cx-sub">Chargement…</p>
  const liste = r.liste.filter((x) => anciennes || x.famille === 'Actives'), nbAnc = r.liste.filter((x) => x.famille !== 'Actives').length
  const max = Math.max(1, ...liste.slice(0, 8).map((x) => x.n))
  return (<>
    {err.map((x) => <div key={x} className="cx-banner">⚠ Non chargé — {x}</div>)}
    {!r.branche && <div className="cx-banner warn">Aucune ouverture, clic ni panier reçu pour l'instant : ces colonnes se rempliront avec les premiers événements réels. Un « — » ne veut pas dire zéro.</div>}
    <div className="cx-minis" style={{ marginBottom: 14 }}>
      <div className="cx-mini"><b>{r.tot.envoyes}</b><span>Envoyés</span></div><div className="cx-mini"><b>{pc(r.tot.ouverts, r.tot.envoyes)}</b><span>Ouverture</span><em>{r.branche ? r.tot.ouverts + ' ouverts' : 'en attente'}</em></div>
      <div className="cx-mini"><b>{pc(r.tot.clics, r.tot.envoyes)}</b><span>Clic</span><em>{r.branche ? r.tot.clics + ' clics' : 'en attente'}</em></div><div className="cx-mini"><b>{r.tot.conv}</b><span>Conversions</span><em>panier + paiement</em></div>
    </div>
    <section className="cx-bloc"><header><b>Volume d'envoi</b><span className="cx-note">top 8</span></header><div className="cx-pad">
      {liste.slice(0, 8).map((x) => <div key={x.cle} className="cx-bar"><span>{LABELS[x.cle] || x.cle}</span><div><i style={{ width: Math.max(2, (x.n / max) * 100) + '%' }} /></div><b>{x.n}</b></div>)}
      {!liste.length && <span className="cx-sub">Aucun envoi enregistré pour l'instant.</span>}
    </div></section>
    <section className="cx-bloc"><header><b>Toutes les campagnes</b>{nbAnc > 0 && <button className="cx-btn ghost sm" style={{ marginLeft: 'auto' }} onClick={() => setAnc(!anciennes)}>{anciennes ? 'Masquer' : 'Voir'} les {nbAnc} anciennes séquences (Pack supprimé)</button>}</header>
      <div className="cx-scroll"><table className="cx-tbl"><thead><tr><th>Campagne</th><th>Envoyés</th><th>Ouverture</th><th>Clic</th><th>Panier</th><th>Paiement</th><th>Dernier envoi</th></tr></thead><tbody>
        {liste.map((x) => <tr key={x.cle}><td>{(x.famille !== 'Actives' ? 'Ancien · ' : '') + (LABELS[x.cle] || x.cle)}</td><td>{x.n}</td><td>{pc(x.ouverts, x.n)}</td><td>{pc(x.clics, x.n)}</td><td>{x.panier || '—'}</td><td>{x.paiement || '—'}</td><td>{new Date(x.derniere).toLocaleDateString('fr-FR')}</td></tr>)}
      </tbody></table></div></section>
  </>)
}
