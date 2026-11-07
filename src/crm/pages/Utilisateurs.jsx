import { usePref } from '../prefs'
import React, { useEffect, useMemo, useState } from 'react'
import { serveurAdmin, tauxUsd } from '../api'
import { nomPlan } from './Transactions'
import { norm } from '../filtre'

const ADBOARD = 'https://www.adstackofficial.com/adboard'
export default function Utilisateurs() {
  const [u, setU] = useState(null), [err, setErr] = useState(''), [q, setQ] = usePref('us_q', ''), [taux, setTaux] = useState(1 / 600)
  useEffect(() => { serveurAdmin('/crm/utilisateurs').then((d) => setU(d.utilisateurs || [])).catch((e) => { setErr(e.message); setU([]) }); tauxUsd().then(setTaux) }, [])
  const usd = (f) => '$' + ((f || 0) * taux).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const liste = useMemo(() => (u || []).filter((x) => !q.trim() || norm(q).split(/\s+/).every((m) => norm((x.email || '') + ' ' + nomPlan(x.plan)).includes(m))).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)), [u, q])
  if (!u) return <p className="cx-sub">Chargement…</p>
  const tot = u.length, prod = u.filter((x) => x.nb_produits > 0).length, plan = u.filter((x) => x.plan_actif).length, rev = u.reduce((s, x) => s + (x.ltv_fcfa || 0), 0), pc = (n) => (tot ? Math.round((n / tot) * 100) : 0)
  return (<>
    {err && <div className="cx-banner">⚠ Non chargé — {err}</div>}
    <div className="cx-minis" style={{ marginBottom: 12 }}>
      <div className="cx-mini"><b>{tot}</b><span>Inscrits</span></div><div className="cx-mini"><b>{prod}</b><span>Avec produit créé</span><em>{pc(prod)} %</em></div>
      <div className="cx-mini"><b>{plan}</b><span>Abonnement actif</span><em>{pc(plan)} %</em></div><div className="cx-mini"><b>{usd(rev)}</b><span>Revenu net cumulé</span></div>
    </div>
    <div className="cx-tools"><input className="cx-search" type="search" placeholder="Rechercher un email ou un plan…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
    {!liste.length ? <div className="cx-empty"><b>{tot ? 'Aucun résultat' : 'Aucun utilisateur inscrit pour l\'instant'}</b></div> : liste.map((x) => <div key={x.email || x.created_at} className="cx-card" style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      <div style={{ minWidth: 0 }}><b style={{ wordBreak: 'break-all' }}>{x.email || '—'}</b><div className="cx-sub">Inscrit le {new Date(x.created_at).toLocaleDateString('fr-FR')} · {x.nb_produits} produit{x.nb_produits !== 1 ? 's' : ''} créé{x.nb_produits !== 1 ? 's' : ''}</div></div>
      <div className="cx-acts">{x.plan_actif ? <span className="cx-chip bl">{nomPlan(x.plan)}</span> : <span className="cx-chip mu">Aucun plan actif</span>}{x.a_achete ? <span className="cx-chip gr">{usd(x.ltv_fcfa)}</span> : <span className="cx-note">Jamais acheté</span>}
        {x.email && <a className="cx-btn ghost sm" href={ADBOARD + '/?impersonate=' + encodeURIComponent(x.email)} target="_blank" rel="noreferrer">👁 Son compte</a>}</div>
    </div>)}
  </>)
}
