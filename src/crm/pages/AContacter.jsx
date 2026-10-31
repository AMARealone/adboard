import React, { useEffect, useMemo, useState } from 'react'
import { useCrm } from '../store'
import { introMessages } from '../domain/messages'
import { Chip, Empty, confirmDlg, toast } from '../ui'
import { BtnNotes, BtnSupprimer, BtnCopierInfos } from './common'

const PAYS = { SN: 'Sénégal', CI: "Côte d'Ivoire", CM: 'Cameroun', BJ: 'Bénin', BF: 'Burkina Faso', ML: 'Mali', TG: 'Togo', NE: 'Niger', CG: 'Congo-Brazzaville', GA: 'Gabon', TD: 'Tchad', CF: 'RCA', CD: 'RDC', GN: 'Guinée', MG: 'Madagascar', RW: 'Rwanda', BI: 'Burundi' }
const IG_MS = 45000
const lastIg = () => { try { return parseInt(localStorage.getItem('ig_last_send_at') || '0', 10) } catch (_) { return 0 } }

function Rythme() {
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t) }, [])
  const e = Date.now() - lastIg(), ok = !lastIg() || e >= IG_MS
  return <div className={'cx-pace' + (ok ? ' ok' : '')}>{ok ? '✓ Instagram : rythme OK' : '⏳ Instagram : attendez ' + Math.ceil((IG_MS - e) / 1000) + ' s avant le prochain envoi'}</div>
}

function Carte({ p, sel, onSel }) {
  const { A, cfg } = useCrm(), [menu, setMenu] = useState('')
  const msgs = introMessages(p, cfg), wa = p.lien_wa && !p.whatsapp_invalide, num = (p.lien_wa || '').replace('https://wa.me/', '').replace(/\D/g, '')
  const ouvrirWa = (m) => { A.canal(p.id, 'whatsapp'); window.open('https://wa.me/' + num + '?text=' + encodeURIComponent(m.texte), '_blank'); setMenu('') }
  const ouvrirIg = async (m) => {
    const e = Date.now() - lastIg()
    if (lastIg() && e < IG_MS && !(await confirmDlg('Dernier « Contacté » il y a ' + Math.round(e / 1000) + ' s seulement (recommandé : ' + IG_MS / 1000 + ' s entre deux messages, pour limiter le risque de restriction Instagram).\nContinuer quand même ?', 'Continuer'))) return
    let ok = false; try { await navigator.clipboard.writeText(m.texte); ok = true } catch (_) {}
    toast(ok ? 'Texte copié : collez-le dans la conversation Instagram' : 'Copie automatique impossible : copiez le texte à la main')
    A.canal(p.id, 'instagram'); window.open(p.lien_instagram, '_blank'); setMenu('')
  }
  return (
    <div className="cx-row">
      <label className="cx-pick"><input type="checkbox" checked={sel} onChange={(e) => onSel(e.target.checked)} aria-label="Sélectionner" /></label>
      <div className="cx-main">
        <div className="cx-line"><b>{p.nom_marque || '—'}</b>{p.pays && <Chip c="mu">{PAYS[p.pays] || p.pays}</Chip>}{p.nb_ads_actifs != null && <Chip c="mu" title="Ads actives">📊 {p.nb_ads_actifs} ads</Chip>}{p.anciennete_max_jours != null && <Chip c="mu" title="Ancienneté de la plus vieille ad active">⏱ {p.anciennete_max_jours} j</Chip>}</div>
        <div className="cx-when">{p.produit || '—'}{p.date_collecte ? ' · collecté le ' + p.date_collecte : ''}</div>
        <div className="cx-line" style={{ marginTop: 6 }}>{p.page_facebook && <a className="cx-lnk" href={p.page_facebook} target="_blank" rel="noreferrer">Page Facebook ↗</a>}{p.lien_ads && <a className="cx-lnk" href={p.lien_ads} target="_blank" rel="noreferrer">Ads ↗</a>}{p.image_produit_url && <a className="cx-lnk" href={p.image_produit_url} target="_blank" rel="noreferrer">Image produit ↗</a>}</div>
        {menu && <div className="cx-menu">
          {menu === 'wa' && msgs.map((m) => <button key={m.label} className="cx-btn sm" onClick={() => ouvrirWa(m)}>{m.label}</button>)}
          {menu === 'ig' && msgs.map((m) => <button key={m.label} className="cx-btn sm" onClick={() => ouvrirIg(m)}>{m.label}</button>)}
          <button className="cx-btn ghost sm red" onClick={() => { menu === 'wa' ? A.whatsappInvalide(p.id) : A.instagramInvalide(p.id); setMenu('') }}>🚫 Marquer {menu === 'wa' ? 'WhatsApp' : 'Instagram'} invalide</button>
        </div>}
      </div>
      <div className="cx-acts">
        <button className="cx-btn sm wa" disabled={!wa} onClick={() => setMenu(menu === 'wa' ? '' : 'wa')} title={wa ? '' : p.whatsapp_invalide ? 'WhatsApp marqué invalide' : 'Pas de numéro'}>WhatsApp ▾</button>
        <button className="cx-btn sm ig" disabled={!p.lien_instagram} onClick={() => setMenu(menu === 'ig' ? '' : 'ig')} title={p.lien_instagram ? '' : 'Pas de compte Instagram trouvé'}>Instagram ▾</button>
        <button className="cx-btn sm" disabled={!p.lien_wa} onClick={() => { A.canal(p.id, 'sms'); toast('Numéro marqué disponible pour SMS') }}>SMS</button>
        <button className="cx-btn ok sm" onClick={() => A.contacte(p.id)}>Contacté</button>
        <BtnNotes p={p} /><BtnCopierInfos p={p} /><BtnSupprimer p={p} />
      </div>
    </div>
  )
}

export default function AContacter() {
  const { prospects, A } = useCrm()
  const [q, setQ] = useState(''), [pays, setPays] = useState(''), [anc, setAnc] = useState(''), [canal, setCanal] = useState(''), [max, setMax] = useState(50), [sel, setSel] = useState(() => new Set())
  const base = useMemo(() => prospects.filter((p) => p.statut === 'a_contacter'), [prospects])
  const liste = useMemo(() => base.filter((p) => {
    if (q.trim() && ![p.nom_marque, p.produit].some((v) => (v || '').toLowerCase().includes(q.trim().toLowerCase()))) return false
    if (pays && p.pays !== pays) return false
    if (canal === 'ig' && !p.lien_instagram) return false
    if (canal === 'wa' && (!p.lien_wa || p.whatsapp_invalide)) return false
    if (canal === 'sms' && !p.lien_wa) return false
    if (canal === 'mail' && !p.email) return false
    if (anc && (p.anciennete_max_jours == null || p.anciennete_max_jours < parseInt(anc, 10))) return false
    return true
  }), [base, q, pays, anc, canal])
  const jour = new Date().toISOString().slice(0, 10)
  const ids = [...sel]
  const fin = (ok) => { if (ok) setSel(new Set()) }
  return (<>
    <p className="cx-sub">Envoyez le premier message (choisissez une version), puis marquez le prospect comme contacté.</p>
    <div className="cx-minis" style={{ marginBottom: 12 }}><div className="cx-mini"><b>{prospects.length}</b><span>Total base</span></div><div className="cx-mini"><b>{base.length}</b><span>À contacter</span></div><div className="cx-mini"><b>{prospects.filter((p) => p.statut === 'en_suivi').length}</b><span>En suivi</span></div><div className="cx-mini"><b>{prospects.filter((p) => p.date_collecte === jour).length}</b><span>Collectés aujourd'hui</span></div></div>
    <Rythme />
    <div className="cx-tools"><input className="cx-search" placeholder="Rechercher marque ou produit…" value={q} onChange={(e) => { setQ(e.target.value); setMax(50) }} />
      <div className="cx-tabs">
        <select value={pays} onChange={(e) => { setPays(e.target.value); setMax(50) }}><option value="">Tous les pays</option>{Object.entries(PAYS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select value={anc} onChange={(e) => setAnc(e.target.value)}><option value="">Toute ancienneté</option><option value="30">Winner confirmé (≥ 30 j)</option><option value="14">A passé la fatigue (≥ 14 j)</option></select>
        {[['ig', '📷 Instagram'], ['wa', '💬 WhatsApp'], ['sms', '📩 SMS'], ['mail', '✉ Email']].map(([k, l]) => <button key={k} className={'cx-tab' + (canal === k ? ' on' : '')} onClick={() => { setCanal(canal === k ? '' : k); setMax(50) }}>{l}</button>)}
      </div></div>
    <div className="cx-line" style={{ margin: '0 0 10px' }}><span className="cx-when">{liste.length} prospect{liste.length > 1 ? 's' : ''}</span>
      {liste.length > 0 && <button className="cx-btn ghost sm" onClick={() => setSel(sel.size ? new Set() : new Set(liste.slice(0, max).map((p) => p.id)))}>{sel.size ? 'Tout désélectionner' : 'Tout sélectionner (page)'}</button>}</div>
    {sel.size > 0 && <div className="cx-bulk"><b>{sel.size} sélectionné(s)</b>
      <button className="cx-btn ok sm" onClick={async () => fin(await A.contactePlus(ids))}>Déplacer vers Suivi</button>
      <button className="cx-btn sm" onClick={async () => fin(await A.waInvalidePlus(ids))}>🚫 Marquer WhatsApp invalide</button>
      <button className="cx-btn sm red" onClick={async () => fin(await A.retirerPlus(ids))}>Supprimer</button>
      <button className="cx-btn ghost sm" style={{ marginLeft: 'auto' }} onClick={() => setSel(new Set())}>Annuler la sélection</button></div>}
    {liste.length ? <>{liste.slice(0, max).map((p) => <Carte key={p.id} p={p} sel={sel.has(p.id)} onSel={(v) => setSel((s) => { const n = new Set(s); v ? n.add(p.id) : n.delete(p.id); return n })} />)}
      {liste.length > max && <button className="cx-btn" onClick={() => setMax(max + 50)}>Afficher plus ({liste.length - max} restants)</button>}</> : <Empty t="Aucun prospect" s="La liste est vide avec ces filtres." />}
  </>)
}
