import { usePref } from '../prefs'
import React, { useEffect, useMemo, useState } from 'react'
import { serveurAdmin, tauxUsd } from '../api'
import { nomPlan } from './Transactions'
import { OFFRES } from '../domain/offres'
import { Modal, toast, Stat, Pills, Seg } from '../ui'
import { norm } from '../filtre'

// clients-v2 — la page répond à une question : « qui dois-je contacter aujourd'hui, et pour lui dire quoi ? »
// Les chiffres du haut ne comptent que les vrais clients ; les comptes de l'équipe (tests, démo, admin) sont à part.
const ADBOARD = 'https://www.adstackofficial.com/adboard'
const JOUR = 86400000
// Les comptes de l'équipe sont désignés par le serveur (champ « interne », module comptes_equipe.js) : la même liste retire leurs achats de la Finance et des Transactions.
const OFFRE_DU_PLAN = { starter: 'perf', pro: 'growth', scale: 'scale' }
const SANTE = { vert: ['ok', 'Relation saine'], orange: ['wa', 'À surveiller'], rouge: ['red', 'À risque'], bleu: ['bl', 'Nouveau client'] }   // sante-nouveau-v1 : un client de moins de 7 jours n'est pas jugé
const wa = (t) => String(t || '').replace(/\D/g, '')
const prenom = (x) => String(x.nom || '').trim().split(/\s+/)[0] || ''

// Ce que la carte recommande de faire, déduit des chiffres du client et des raisons du score de santé (serveur).
function lire(x, now) {
  const r = (x.sante && x.sante.raisons) || []
  const total = x.credits_total || 0, used = x.credits_used || 0
  const pct = total > 0 ? used / total : 0
  const jours = x.expires_at ? Math.ceil((new Date(x.expires_at).getTime() - now) / JOUR) : null
  const p = prenom(x), bonjour = 'Bonjour' + (p ? ' ' + p : '') + ', '
  let a
  if (!x.active) a = { rang: 1, ton: 'red', titre: 'Réactiver le client', detail: 'Son forfait est terminé' + (x.expires_at ? ' depuis le ' + new Date(x.expires_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '') + '.', msg: bonjour + 'votre forfait AdStack est arrivé à son terme. Vous voulez qu\'on relance une production sur votre prochain produit ?' }
  else if (total > 0 && used >= total) a = { rang: 2, ton: 'bl', titre: 'Forfait épuisé : proposer le renouvellement', detail: used + ' / ' + total + ' crédits utilisés' + (jours != null && jours > 0 ? ', ' + jours + ' j avant la fin de la période' : '') + '. Il ne peut plus lancer de production sans renouveler ; l\'offre au-dessus est l\'autre option.', msg: bonjour + 'vous avez utilisé toutes les créatives de votre forfait. Pour lancer les prochaines, on peut renouveler dès maintenant, ou passer à l\'offre au-dessus pour avoir plus de créatives chaque mois. Laquelle vous convient ?' }
  else if (r.some((t) => /Nouveau client/.test(t))) a = { rang: 2, ton: 'bl', titre: 'Accueillir et lancer sa première production', detail: 'Client depuis ' + (x.started_at ? new Date(x.started_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'peu') + ' : aucune demande encore.', msg: bonjour + 'bienvenue chez AdStack ! Pour lancer vos premières créatives, ajoutez votre produit dans votre espace AdBoard. Sur quel produit voulez-vous qu\'on commence ?' }
  else if (r.some((t) => /Fin de forfait proche/.test(t))) a = { rang: 3, ton: 'red', titre: 'Relancer avant la fin du forfait', detail: 'Le forfait se termine dans ' + Math.max(0, jours) + ' j et aucune demande récente.', msg: bonjour + 'il vous reste quelques jours sur votre forfait AdStack. Envoyez-moi votre prochain produit, on lance les créatives avant l\'échéance.' }
  else if (jours != null && jours <= 7) a = { rang: 4, ton: 'wa', titre: 'Préparer le renouvellement', detail: 'Le forfait se termine dans ' + Math.max(0, jours) + ' j.', msg: bonjour + 'votre forfait AdStack se renouvelle bientôt. Quels résultats avez-vous eus avec les dernières créatives ? On ajuste la suite selon ça.' }
  else if (r.some((t) => /offre supérieure/.test(t))) a = { rang: 5, ton: 'bl', titre: 'Proposer l\'offre supérieure', detail: 'Il a utilisé ' + Math.round(pct * 100) + ' % de ses crédits.', msg: bonjour + 'vous utilisez bien votre forfait. L\'offre au-dessus vous donnerait plus de créatives et un délai plus court : je vous explique ?' }
  else if (r.some((t) => /Aucune demande|Utilise peu/.test(t))) a = { rang: 6, ton: 'wa', titre: 'Le relancer pour sa prochaine production', detail: r.filter((t) => /Aucune demande|Utilise peu/.test(t)).join(' · ') + '.', msg: bonjour + 'il vous reste des créatives sur votre forfait AdStack. Sur quel produit voulez-vous qu\'on travaille cette semaine ?' }
  else a = { rang: 9, ton: 'ok', titre: 'Rien à faire', detail: 'Le client utilise son forfait normalement.', msg: '' }
  return { pct, jours, a, autres: r.filter((t) => !a.detail.includes(t)) }
}

const Anneau = ({ s }) => {
  if (!s || !SANTE[s.couleur]) return null
  const c = s.couleur === 'vert' ? 'var(--ok)' : s.couleur === 'orange' ? 'var(--wa)' : s.couleur === 'bleu' ? '#5B8DEF' : 'var(--er)', R = 19, L = 2 * Math.PI * R
  return <div className="cl-ring" title={SANTE[s.couleur][1] + ' · ' + (s.raisons || []).join(' · ')}>
    <svg width="50" height="50" viewBox="0 0 50 50"><circle cx="25" cy="25" r={R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="5" /><circle cx="25" cy="25" r={R} fill="none" stroke={c} strokeWidth="5" strokeLinecap="round" strokeDasharray={L} strokeDashoffset={L * (1 - Math.min(100, s.score) / 100)} transform="rotate(-90 25 25)" /></svg>
    <b style={{ color: c }}>{s.score}</b><span>{SANTE[s.couleur][1]}</span>
  </div>
}
const Avatar = ({ x }) => {
  const k = String(x.email || x.nom || '?'), h = [...k].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 360, 7)
  const ini = (String(x.nom || x.email || '?').split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((m) => m[0]).join('') || '?').toUpperCase()
  return x.avatar ? <img className="cl-av" src={x.avatar} alt="" referrerPolicy="no-referrer" /> : <div className="cl-av" style={{ background: `linear-gradient(135deg,hsl(${h} 70% 45%),hsl(${(h + 40) % 360} 70% 32%))` }}>{ini}</div>
}

export default function Clients() {
  const [c, setC] = useState(null), [err, setErr] = useState(''), [q, setQ] = usePref('cl_q', ''), [taux, setTaux] = useState(1 / 600), [det, setDet] = useState(null)
  const [vue, setVue] = usePref('cl_vue', 'action'), [tri, setTri] = usePref('cl_tri', 'priorite')
  useEffect(() => { serveurAdmin('/crm/clients').then((d) => setC(Array.isArray(d) ? d : d.clients || [])).catch((e) => { setErr(e.message); setC([]) }); tauxUsd().then(setTaux) }, [])
  const usd = (f) => '$' + ((f || 0) * taux).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const usd0 = (f) => '$' + Math.round((f || 0) * taux).toLocaleString('en-US')
  const date = (d) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

  const now = Date.now()
  const tous = useMemo(() => (c || []).map((x) => ({ ...x, _i: !!x.interne, _l: lire(x, now) })), [c])   // eslint-disable-line react-hooks/exhaustive-deps
  const reels = tous.filter((x) => !x._i), actifs = reels.filter((x) => x.active)
  const mrr = actifs.reduce((s, x) => { const o = OFFRES[OFFRE_DU_PLAN[x.plan]]; return s + (x.type !== 'pack' && o ? o.prix : 0) }, 0)
  const encaisse = reels.reduce((s, x) => s + (x.total_depense_fcfa || 0), 0), achats = reels.reduce((s, x) => s + (x.nb_achats || 0), 0)
  const credT = actifs.reduce((s, x) => s + (x.credits_total || 0), 0), credU = actifs.reduce((s, x) => s + Math.min(x.credits_used || 0, x.credits_total || 0), 0)
  const F = {
    action: (x) => !x._i && x._l.a.rang < 9, risque: (x) => !x._i && x.sante && x.sante.couleur === 'rouge', surveiller: (x) => !x._i && x.sante && x.sante.couleur === 'orange',
    sains: (x) => !x._i && x.sante && x.sante.couleur === 'vert', renouv: (x) => !x._i && x.active && x._l.jours != null && x._l.jours <= 7, tous: (x) => !x._i, internes: (x) => x._i,
  }
  const n = (k) => tous.filter(F[k]).length
  const liste = useMemo(() => {
    const qq = norm(q).split(/\s+/).filter(Boolean)
    const l = tous.filter(F[vue] || F.tous).filter((x) => !qq.length || qq.every((m) => norm((x.nom || '') + ' ' + (x.email || '') + ' ' + (x.telephone_whatsapp || '') + ' ' + nomPlan(x.plan)).includes(m)))
    const sc = (x) => x._l.a.rang * 1000 + ((x.sante && x.sante.score) || 0)
    return l.sort(tri === 'depense' ? (a, b) => (b.total_depense_fcfa || 0) - (a.total_depense_fcfa || 0) : tri === 'recent' ? (a, b) => new Date(b.started_at) - new Date(a.started_at) : (a, b) => sc(a) - sc(b))
  }, [tous, vue, tri, q])   // eslint-disable-line react-hooks/exhaustive-deps

  if (!c) return <p className="cx-sub">Chargement…</p>
  const copier = async (x) => { const t = ['Nom : ' + (x.nom || '—'), 'Email : ' + (x.email || '—'), 'WhatsApp : ' + (x.telephone_whatsapp || '—'), 'Plan : ' + nomPlan(x.plan) + (x.cycle ? ' (' + x.cycle + ')' : ''), 'Statut : ' + (x.active ? 'actif' : 'inactif'), 'Santé : ' + (x.sante ? x.sante.score + '/100 — ' + (x.sante.raisons || []).join(', ') : '—'), 'Crédits : ' + x.credits_used + ' / ' + x.credits_total, 'Total dépensé : ' + usd(x.total_depense_fcfa) + ' (' + x.nb_achats + ' achat' + (x.nb_achats > 1 ? 's' : '') + ')', 'Client depuis : ' + date(x.started_at), 'Fin du forfait : ' + date(x.expires_at), 'À faire : ' + x._l.a.titre].join('\n'); try { await navigator.clipboard.writeText(t); toast('Infos copiées') } catch (_) { toast('Copie automatique impossible') } }
  const lienWa = (x, msg) => 'https://wa.me/' + wa(x.telephone_whatsapp) + (msg ? '?text=' + encodeURIComponent(msg) : '')

  return (<>
    {err && <div className="cx-banner">⚠ Non chargé — {err}</div>}
    <div className="cx-stats">
      <Stat t="acc" l="Clients actifs" v={actifs.length}><em>{reels.length - actifs.length} terminé{reels.length - actifs.length > 1 ? 's' : ''} · {n('internes')} compte{n('internes') > 1 ? 's' : ''} équipe à part</em></Stat>
      <Stat l="Revenu mensuel récurrent" v={usd0(mrr)}><em>abonnements actifs, prix de l'offre</em></Stat>
      <Stat l="Encaissé" v={usd0(encaisse)}><em>{achats} achat{achats > 1 ? 's' : ''} · panier {achats ? usd0(encaisse / achats) : '—'}</em></Stat>
      <Stat l="Crédits consommés" v={credT ? Math.round((100 * credU) / credT) + ' %' : '—'}><em>{credU} / {credT} sur les forfaits actifs</em></Stat>
      <Stat t={n('action') ? 'hot' : 'ok'} l="À contacter" v={n('action')} onClick={() => setVue('action')}><em>{n('risque')} à risque · {n('renouv')} fin ≤ 7 j</em></Stat>
    </div>
    <div className="cx-tools">
      <div className="cl-bar">
        <Pills value={vue} onChange={setVue} options={[['action', 'À contacter', n('action'), 'hot'], ['risque', 'À risque', n('risque'), 'red'], ['surveiller', 'À surveiller', n('surveiller')], ['sains', 'Sains', n('sains')], ['renouv', 'Fin ≤ 7 j', n('renouv')], ['tous', 'Tous les clients', n('tous')], ['internes', 'Comptes équipe', n('internes')]]} />
        <Seg value={tri} onChange={setTri} options={[['priorite', 'Priorité'], ['depense', 'Dépense'], ['recent', 'Récents']]} />
      </div>
      <input className="cx-search" type="search" placeholder="Rechercher un nom, un email, un plan, un numéro…" value={q} onChange={(e) => setQ(e.target.value)} />
    </div>
    {!liste.length ? <div className="cx-empty"><b>{!c.length ? 'Aucun client pour l\'instant' : vue === 'action' && !q ? 'Personne à contacter aujourd\'hui' : 'Aucun résultat'}</b><div>{!c.length ? 'Ils apparaissent ici dès qu\'un abonnement est activé.' : vue === 'action' && !q ? 'Tous les clients utilisent leur forfait normalement.' : 'Changez de filtre ou de recherche.'}</div></div>
      : <div className="cl-list">{liste.map((x) => { const L = x._l, a = L.a, depasse = x.credits_total > 0 && x.credits_used >= x.credits_total, w = Math.min(100, Math.round(L.pct * 100)); return (
      <article key={x.user_id || x.email} className={'cl-card' + (x._i ? ' int' : '') + (!x.active ? ' off' : '')}>
        <div className="cl-top">
          <Avatar x={x} />
          <div className="cl-id">
            <b>{x.nom || x.email || 'Sans nom'}</b>
            <span>{x.email}</span>
            <div className="cl-tags"><span className="cx-chip bl">{nomPlan(x.plan)}{x.cycle ? ' · ' + x.cycle : ''}</span>{!x.active && <span className="cx-chip red">Terminé</span>}{x._i && <span className="cx-chip off">Compte équipe</span>}</div>
          </div>
          {!x._i && <Anneau s={x.sante} />}
        </div>
        <div className="cl-kpi">
          <div><span>Crédits</span><b className={depasse ? 'wa' : ''}>{x.credits_used}<small> / {x.credits_total}</small></b><div className={'cl-gauge' + (depasse ? ' over' : L.pct >= 0.75 ? ' hi' : '')}><i style={{ width: w + '%' }} /></div></div>
          <div><span>Dépensé</span><b>{usd(x.total_depense_fcfa)}</b><small>{x.nb_achats} achat{x.nb_achats > 1 ? 's' : ''}</small></div>
          <div><span>{x.active ? 'Fin du forfait' : 'Terminé le'}</span><b className={x.active && L.jours != null && L.jours <= 7 ? 'wa' : ''}>{x.active && L.jours != null ? (L.jours <= 0 ? 'Aujourd\'hui' : 'dans ' + L.jours + ' j') : date(x.expires_at)}</b><small>client depuis {date(x.started_at)}</small></div>
        </div>
        {!x._i && <div className={'cl-do ' + a.ton}>
          <div className="cl-do-t"><b>{a.titre}</b><span>{a.detail}</span>{L.autres.length > 0 && <div className="cl-why">{L.autres.map((t, i) => <em key={i}>{t}</em>)}</div>}</div>
          {a.msg && wa(x.telephone_whatsapp) && <a className="cx-btn sm cl-go" href={lienWa(x, a.msg)} target="_blank" rel="noreferrer" title={a.msg}>Écrire sur WhatsApp</a>}
          {a.msg && !wa(x.telephone_whatsapp) && x.email && <a className="cx-btn sm cl-go" href={'mailto:' + x.email + '?subject=' + encodeURIComponent('Votre forfait AdStack') + '&body=' + encodeURIComponent(a.msg)}>Écrire un email</a>}
        </div>}
        <div className="cl-acts">
          {wa(x.telephone_whatsapp) && <a className="cx-btn ghost sm" href={lienWa(x, '')} target="_blank" rel="noreferrer">WhatsApp</a>}
          {x.email && <a className="cx-btn ghost sm" href={'mailto:' + x.email}>✉ Email</a>}
          {x.email && <a className="cx-btn ghost sm" href={ADBOARD + '/?impersonate=' + encodeURIComponent(x.email)} target="_blank" rel="noreferrer">👁 Son compte</a>}
          <button className="cx-btn ghost sm" onClick={() => copier(x)}>📋 Copier</button>
          <button className="cx-btn ghost sm" onClick={() => setDet(x)}>Détail</button>
        </div>
      </article>) })}</div>}
    {det && <Modal title={det.nom || det.email} onClose={() => setDet(null)}><div style={{ fontSize: 13, lineHeight: 1.9 }}>
      <div><b>Email :</b> {det.email || '—'}</div><div><b>WhatsApp :</b> {det.telephone_whatsapp || '—'}</div><div><b>Plan :</b> {nomPlan(det.plan)} {det.cycle ? '(' + det.cycle + ')' : ''}{det.type ? ' · ' + det.type : ''}</div>
      <div><b>Statut :</b> {det.active ? '✅ Actif' : '❌ Terminé'}{det._i ? ' · compte de l\'équipe' : ''}</div>
      {det.sante && <div><b>Santé de la relation :</b> {det.sante.score}/100 — {SANTE[det.sante.couleur] ? SANTE[det.sante.couleur][1] : ''}{(det.sante.raisons || []).length > 0 && <ul style={{ margin: '4px 0 0 18px', padding: 0, lineHeight: 1.6 }}>{det.sante.raisons.map((r, i) => <li key={i}>{r}</li>)}</ul>}</div>}
      <div><b>À faire :</b> {det._l.a.titre} — {det._l.a.detail}</div>
      {det._l.a.msg && <div style={{ background: 'var(--card2)', border: '1px solid var(--bd)', borderRadius: 10, padding: '8px 12px', margin: '6px 0', lineHeight: 1.5 }}><small style={{ color: 'var(--sec)' }}>Message proposé</small><div>{det._l.a.msg}</div><button className="cx-lnk" onClick={async () => { try { await navigator.clipboard.writeText(det._l.a.msg); toast('Message copié') } catch (_) { toast('Copie automatique impossible') } }}>Copier le message</button></div>}
      <div><b>Client depuis :</b> {det.started_at ? new Date(det.started_at).toLocaleString('fr-FR') : '—'}</div><div><b>Fin du forfait :</b> {det.expires_at ? new Date(det.expires_at).toLocaleString('fr-FR') : '—'}</div>
      <div><b>Crédits :</b> {det.credits_used} / {det.credits_total}</div><div><b>Total dépensé :</b> {usd(det.total_depense_fcfa)} ({det.nb_achats} achat{det.nb_achats > 1 ? 's' : ''})</div><div><b>Premier achat :</b> {date(det.premier_achat)}</div><div><b>ID compte :</b> <code style={{ fontSize: 11 }}>{det.user_id}</code></div></div></Modal>}
  </>)
}
