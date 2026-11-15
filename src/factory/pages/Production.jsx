import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useProd, CT_IMAGES, SERVER } from '../prod/state'
import * as E from '../prod/engine'
import { useData } from '../data'
import { etat } from '../api'
import { toast, confirmDlg } from '../ui'
import * as PL from '../prod/plan'

const esc = (s) => (s == null ? '' : String(s))
const nivLib = (c) => (c && (PL.LIB[c.niveau] || ['Solution Aware', 'Product Aware', 'Most Aware'][c.ctIdx])) || ''
const titreAngle = (S, a) => {
  const t = String(S.angles[a] || '').split('*')[0].replace(/^\s*angle\s*\d+\s*[:—–-]?\s*/i, '').trim()
  return t || 'Angle ' + (a + 1)
}
const dur = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ' min ' + String(s % 60).padStart(2, '0') + ' s' }
const heure = (t) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
const aLivrable = (c) => !!c && !!(c.imgB64 || c.url || c.videoUrl)
function useTick(actif) { const [, set] = useState(0); useEffect(() => { if (!actif) return; const t = setInterval(() => set((n) => n + 1), 1000); return () => clearInterval(t) }, [actif]) }

/* ───────── éléments réutilisés ───────── */
function SendMenu({ children, onClient, onOther, busy, title }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => { if (!open) return; const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h) }, [open])
  return (
    <span className="fx-menuwrap" ref={ref}>
      <button className="fx-btn sm" title={title} disabled={busy === 'busy'} onClick={() => setOpen(!open)}>{busy === 'busy' ? '…' : busy === 'ok' ? '✓' : children}</button>
      {open && <div className="fx-menu">
        <button onClick={() => { setOpen(false); onClient() }}>Au compte du client</button>
        <button onClick={() => { setOpen(false); onOther() }}>À un autre compte (test)…</button>
      </div>}
    </span>
  )
}

// Choix d'un compte : sert à « envoyer à un autre compte » et à mémoriser MON compte (onPicked)
function ManualSend({ scope, onClose, onPicked }) {
  const [q, setQ] = useState(''), [users, setUsers] = useState(null), [user, setUser] = useState(null)
  const [prods, setProds] = useState(null), [pid, setPid] = useState(null), [newName, setNewName] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => {
    if (q.trim().length < 2 || user) { setUsers(null); return }
    setUsers('load'); const t = setTimeout(async () => { try { setUsers(await E.searchUsers(q)) } catch (_) { setUsers('err') } }, 350)
    return () => clearTimeout(t)
  }, [q, user])
  const pick = async (u) => { setUser(u); setQ(u.email); setProds('load'); try { setProds(await E.userProducts(u.id)) } catch (_) { setProds('err') } }
  const ok = user && (pid || newName.trim())
  const send = async () => {
    setBusy(true)
    try {
      if (onPicked) { onPicked({ user: { id: user.id, email: user.email }, productId: pid || null, newName: pid ? null : newName.trim() }); onClose(); return }
      await E.manualDeliver({ scope, user, productId: pid, newName: newName.trim() }); toast(`Envoyé à ${user.email}.`); onClose()
    } catch (e) { toast("Erreur lors de l'envoi : " + e.message) } finally { setBusy(false) }
  }
  return (
    <div className="fx-modal-back" onClick={onClose}>
      <div className="fx-modal" onClick={(e) => e.stopPropagation()}>
        <div className="fx-drawer-h"><h3>{onPicked ? 'Mon compte de contrôle' : 'Envoyer à un compte spécifique'}</h3><button className="fx-btn sm" onClick={onClose}>✕</button></div>
        <p className="fx-s" style={{ whiteSpace: 'normal' }}>{onPicked ? 'Les livrables arrivent d\'abord ici pour que tu les vérifies comme le client les verra. Le compte est mémorisé : une seule fois à choisir.' : 'Fonctionne même pour un compte qui n\'a encore pris aucun forfait — juste connecté par email.'}</p>
        <label className="fx-lab">Compte</label>
        <input className="fx-in full" placeholder="Cherche par email…" value={q} onChange={(e) => { setQ(e.target.value); setUser(null); setPid(null) }} />
        {users === 'load' && <div className="fx-s">Recherche…</div>}
        {users === 'err' && <div className="fx-s" style={{ color: 'var(--er)' }}>Erreur de recherche.</div>}
        {Array.isArray(users) && (users.length ? <div className="fx-list">{users.map((u) => <button key={u.id} className="fx-li" onClick={() => pick(u)}>{u.email}</button>)}</div> : <div className="fx-s">Aucun compte trouvé.</div>)}
        {user && <>
          <label className="fx-lab">Produit</label>
          {prods === 'load' && <div className="fx-s">Chargement des produits…</div>}
          {prods === 'err' && <div className="fx-s" style={{ color: 'var(--er)' }}>Erreur de chargement.</div>}
          {Array.isArray(prods) && (prods.length ? <div className="fx-list">{prods.map((p) => <label key={p.id} className="fx-li radio"><input type="radio" name="mp" checked={pid === p.id} onChange={() => { setPid(p.id); setNewName('') }} /> {p.nom}</label>)}</div> : <div className="fx-s">Aucun produit existant pour ce compte — crée-en un ci-dessous.</div>)}
          <div className="fx-s" style={{ margin: '8px 0' }}>— ou —</div>
          <input className="fx-in full" placeholder="Créer un nouveau produit : nom…" value={newName} onChange={(e) => { setNewName(e.target.value); if (e.target.value.trim()) setPid(null) }} />
        </>}
        <button className="fx-btn primary full" style={{ marginTop: 16 }} disabled={!ok || busy} onClick={send}>{busy ? 'Envoi en cours…' : onPicked ? 'Mémoriser et envoyer' : 'Envoyer'}</button>
      </div>
    </div>
  )
}

function MarcheSummary({ marche, synthesis }) {
  const [raw, setRaw] = useState(false)
  const debug = <div className="fx-debug"><button className="fx-link-btn" onClick={() => setRaw(!raw)}>Voir la synthèse brute (debug)</button>{raw && <pre>{synthesis}</pre>}</div>
  if (!marche) return <><div className="fx-err">Extraction Données Marché échouée pour ce batch (voir console) — synthèse brute ci-dessous en repli.</div><pre className="fx-rawsyn">{synthesis}</pre></>
  const p = marche.positionnement || {}, persona = marche.persona || {}, angles = marche.angles || [], insights = marche.insights || []
  const direct = (p.concurrents_directs || []).map((c) => (typeof c === 'string' ? c : c?.nom || '')).filter(Boolean).join(', ') || '—'
  const indirect = (p.concurrents_indirects || []).length ? p.concurrents_indirects.join(', ') : null
  const Stat = ({ l, v }) => <div><div className="fx-k">{l}</div><div className="fx-v">{esc(v) || '—'}</div></div>
  return (
    <div>
      <div className="fx-stats4"><Stat l="Taille marché" v={p.taille_marche_personnes} /><Stat l="Valeur" v={p.taille_marche_revenus} /><Stat l="Tendance" v={p.taux_croissance} /><Stat l="Concurrence" v={p.concurrence} /></div>
      <p className="fx-sm"><span className="fx-k2">Concurrents directs :</span> {direct}</p>
      {indirect && <p className="fx-sm"><span className="fx-k2">Indirects :</span> {indirect}</p>}
      <p className="fx-sm"><span className="fx-k2">Positionnement prix :</span> {esc(p.positionnement_prix)}</p>
      <div className="fx-persona">
        <b>{esc(persona.nom)}{persona.age ? ', ' + persona.age : ''}</b>
        <div className="fx-sm">{esc(persona.role)}{persona.ville ? ' · ' + persona.ville : ''}</div>
        {persona.quote && <blockquote>« {persona.quote} »</blockquote>}
      </div>
      <div className="fx-k" style={{ margin: '14px 0 4px' }}>Angles ({angles.length})</div>
      {angles.map((a, i) => <div className="fx-ang" key={i}><b>{i + 1}. {esc(a.nom)}</b><div className="fx-sm">{esc(a.formulation_simple)}</div><div className="fx-k2">{esc(a.moteur)}</div></div>)}
      {insights.length > 0 && <><div className="fx-k" style={{ margin: '14px 0 4px' }}>Insights</div>{insights.map((x, i) => <div className="fx-sm" key={i}>→ {esc(x.t)}</div>)}</>}
      {debug}
    </div>
  )
}

function CopyPane({ S, U, a, onOther }) {
  const ui = U.copy[a] || { state: 'wait' }, d = S.copies[a]
  if (ui.state === 'err') return <div className="fx-copy"><div className="fx-err">Erreur copywriter : {ui.err}</div><button className="fx-btn sm" style={{ marginTop: 8 }} onClick={() => E.regenerateCopy(a)}>↻ Régénérer</button></div>
  if (!d) return <div className="fx-copy fx2-copywait">{ui.state === 'run' ? <span className="fx-spin sm" /> : <span className="fx2-dot" />} <span className="fx-s">{ui.state === 'run' ? 'Le copywriter écrit les 5 hooks et la description…' : 'Ad copy en attente'}</span></div>
  const fb = E.copyIsFallback(d)
  const cp = (t) => navigator.clipboard.writeText(t).then(() => toast('Copié'))
  return (
    <div className="fx-copy">
      <div className="fx-copy-s">
        <div className="fx-copy-l"><b>5 Hooks · variantes Meta Ads</b>
          <span><button className="fx-link-btn" disabled={ui.state === 'run'} onClick={() => E.regenerateCopy(a)}>{ui.state === 'run' ? 'régénération…' : '↻ régénérer'}</button> <button className="fx-link-btn" onClick={() => cp(d.hooks.join('\n\n'))}>copier tout</button>
            <SendMenu title="Envoyer cette ad copy" busy={U.sending['p' + a]} onClient={() => E.sendOneCopy(a)} onOther={() => onOther({ type: 'copy', index: a })}>Envoyer</SendMenu></span></div>
        {d.hooks.map((h, i) => <div className="fx-hook" key={i}><span>{h}</span><button className="fx-link-btn" onClick={() => cp(h)}>copier</button></div>)}
      </div>
      <div className="fx-copy-s">
        <div className="fx-copy-l"><b>Description · structure AIDA</b><button className="fx-link-btn" onClick={() => cp(d.description)}>copier</button></div>
        <div className={'fx-desc' + (fb ? ' err' : '')}>{d.description}</div>
        {fb && <button className="fx-btn sm" style={{ marginTop: 8 }} onClick={() => E.regenerateCopy(a)}>↻ Régénérer la description</button>}
      </div>
    </div>
  )
}

/* ───────── 1. choix de la commande ───────── */
function Picker({ S, U }) {
  const { cmd } = useData()
  const nav = useNavigate()
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(null), [over, setOver] = useState(false)
  const ouvertes = useMemo(() => (cmd.list || []).filter((b) => b.status === 'pending' || b.status === 'in_production').sort((a, b) => etat(a).rang - etat(b).rang || new Date(b.created_at) - new Date(a.created_at)), [cmd.list])
  const ouvrir = async (id) => { setBusy(id); try { await E.openCommande(id) } finally { setBusy(null) } }
  const onDrop = (e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) E.loadBriefFile(f) }
  return (
    <section className="fx2-card">
      <div className="fx2-h"><span className="fx2-n">1</span><div><h2>Choisis la commande à produire</h2><p>Brief, photo produit et réglages client sont repris automatiquement.</p></div></div>
      {cmd.loading && <div className="fx-s" style={{ padding: 16 }}><span className="fx-spin sm" /> Chargement des commandes…</div>}
      {cmd.error && <div className="fx-err">{cmd.error}</div>}
      {!cmd.loading && !ouvertes.length && <div className="fx-empty" style={{ padding: 24 }}>Aucune commande ouverte. <button className="fx-link-btn" onClick={() => nav('/commandes')}>Voir toutes les commandes</button></div>}
      <div className="fx2-picks">
        {ouvertes.map((b) => {
          const e = etat(b), photo = b.photo_nobg || b.product?.photo_base64 || b.product?.photo_url, sel = S.commandeId === b.id
          return (
            <button key={b.id} className={'fx2-pick' + (sel ? ' on' : '')} disabled={!!busy} onClick={() => ouvrir(b.id)}>
              {photo ? <img src={photo} alt="" onError={(x) => (x.currentTarget.style.visibility = 'hidden')} /> : <span className="fx2-pick-ph">—</span>}
              <span className="fx2-pick-b"><b>{b.product?.nom || 'Produit'}</b><small>{b.product?.marque || ''}{b.product?.marque ? ' · ' : ''}{b.client?.email || ''}</small>
                <small>{(b.client?.plan || '').toUpperCase()} · {b.quantity || 6} créatives</small></span>
              <span className={'fx-tag ' + e.key}>{busy === b.id ? '…' : e.label}</span>
            </button>)
        })}
      </div>
      <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => { E.loadBriefFile(e.target.files[0]); e.target.value = '' }} />
      <div className={'fx2-drop' + (over ? ' over' : '')} onClick={() => fileRef.current.click()} onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={onDrop}>
        <span>ou glisse un <b>brief.json</b> (test, sans vidéo automatique)</span>
      </div>
      {U.resuming && <div className="fx-banner info" style={{ marginTop: 12 }}><span className="fx-spin sm" /> Reprise de la commande en cours…</div>}
    </section>
  )
}

/* ───────── 2. préparation + lancement ───────── */
function useDiagVideo() {
  const [d, setD] = useState({ s: 'load' })
  useEffect(() => {
    let ok = true
    fetch(SERVER + '/video-jobs/diag').then(async (r) => {
      const j = await r.json().catch(() => ({}))
      if (!ok) return
      setD(r.status === 404 ? { s: 'ko', msg: 'le serveur Render n\'a pas encore le module vidéo cloud' } : j.peut_lancer ? { s: 'ok', j } : { s: 'ko', msg: 'droits manquants pour lancer le job vidéo', cmd: j.commande_autorisation })
    }).catch(() => ok && setD({ s: 'ko', msg: 'serveur injoignable' }))
    return () => { ok = false }
  }, [])
  return d
}
function Launch({ S, U }) {
  const b = S.brief, n = E.angleCount(), diag = useDiagVideo()
  const lie = S.briefSource === 'commande' && !!S.commandeId
  const prets = !!b && !!S.productB64
  const fait = S.creatives.some(aLivrable) || S.copies.some(Boolean)
  const checks = [
    { ok: !!b, t: 'Brief client chargé' },
    { ok: !!S.productB64, t: 'Photo produit', warn: 'ajoute-la ci-dessus' },
    { ok: lie, t: 'Commande liée (sauvegarde automatique)', warn: 'brief de test : ni sauvegarde ni vidéo automatique' },
    { ok: diag.s === 'ok', load: diag.s === 'load', t: 'Moteur vidéo cloud', warn: diag.msg },
  ]
  return (
    <section className="fx2-card">
      <div className="fx2-h"><span className="fx2-n">2</span><div><h2>{fait ? 'Relancer la production' : 'Génère tous les livrables en un clic'}</h2><p>Hypothèse, données marché, ad copies, images et vidéos se fabriquent en parallèle.</p></div></div>
      <div className="fx2-plan">
        <div><b>1</b><span>hypothèse<br />+ données marché</span></div>
        <div><b>{n}</b><span>sets d'ad copy<br />5 hooks + description</span></div>
        <div><b>{n * 2}</b><span>images<br />Solution + Product Aware</span></div>
        <div><b>{n}</b><span>vidéos<br />{n > 1 ? n + ' CT différents' : '1 CT'} choisis par l'agent</span></div>
      </div>
      <div className="fx2-niv">
        <b>Niveaux de conscience</b>
        <span>Chaque angle suit un parcours : <em>Problème → Solution → Produit</em> ou <em>Solution → Produit → Most Aware</em>. Le lot contient toujours au moins une créative Solution, une Produit et une Most Aware. L'agent choisit selon le marché, le code vérifie.</span>
        <b>Budget</b>
        <span>{E.budgetHorsVideo(n * 3).toFixed(2)} $ pour l'hypothèse, les ad copies, les {n * 2} images et leurs corrections automatiques · jusqu'à {E.BUDGET_VIDEO_MAX} $ par vidéo, tous les plans animés en Veo Fast.</span>
      </div>
      <ul className="fx2-checks">{checks.map((c, i) => <li key={i} className={c.ok ? 'ok' : c.load ? 'load' : 'ko'}><i>{c.ok ? '✓' : c.load ? '…' : '!'}</i><span>{c.t}{!c.ok && !c.load && c.warn ? <em> — {c.warn}</em> : null}</span></li>)}</ul>
      {diag.s === 'ko' && diag.cmd && <div className="fx2-cmd"><span>À coller une seule fois dans Cloud Shell pour autoriser Render à lancer les vidéos :</span><code>{diag.cmd}</code><button className="fx-btn sm" onClick={() => navigator.clipboard.writeText(diag.cmd).then(() => toast('Commande copiée'))}>Copier</button></div>}
      <div className="fx2-go">
        <button className="fx2-cta" disabled={!prets || U.running} onClick={E.launch}>{U.running ? 'Production en cours…' : fait ? 'Relancer tous les livrables' : 'Générer tous les livrables'}</button>
        <span className="fx-s" style={{ whiteSpace: 'normal' }}>Durée habituelle : 30 à 45 minutes, dominée par les vidéos. Tu peux fermer l'onglet : tout est sauvegardé et le suivi reprend à la réouverture.</span>
      </div>
    </section>
  )
}

function BriefCard({ S }) {
  const b = S.brief
  const photoRef = useRef(null)
  if (!b) return null
  return (
    <section className="fx2-brief">
      <div className="fx2-brief-photo">{S.productB64 ? <img src={`data:${S.productMime};base64,${S.productB64}`} alt="" /> : <span>Pas de photo</span>}</div>
      <div className="fx2-brief-b">
        <div className="fx2-brief-t"><b>{b.produit || '—'}</b><span className={'fx-pillstat ' + (S.briefSource === 'commande' ? 'ok' : 'warn')}>{S.briefSource === 'commande' ? 'Sauvegarde automatique' : 'Test : pas de sauvegarde'}</span></div>
        <div className="fx-s" style={{ whiteSpace: 'normal' }}>{[b.marque, b.pays, b.pricing].filter(Boolean).join(' · ') || 'Brief sans marque ni prix'}{b.cible ? ' · cible : ' + b.cible : ''}</div>
        {b.utilite && <div className="fx-s" style={{ whiteSpace: 'normal' }}>{b.utilite}</div>}
      </div>
      <input ref={photoRef} type="file" accept="image/*" hidden onChange={(e) => { E.replacePhoto(e.target.files[0]); e.target.value = '' }} />
      <button className="fx-btn sm" onClick={() => photoRef.current.click()}>{S.productB64 ? 'Changer la photo' : 'Ajouter une photo'}</button>
    </section>
  )
}

/* ───────── 3. tableau de bord en direct ───────── */
const LANES = [
  { n: 1, t: 'Hypothèse & marché', i: '◎' }, { n: 3, t: 'Ad copies', i: '✎' }, { n: 2, t: 'Images', i: '▣' }, { n: 4, t: 'Vidéos', i: '▶' },
]
function Board({ S, U }) {
  useTick(U.running)
  const n = U.nbAngles
  const total = 1 + n * 3 + n
  const pretes = (S.synthesis ? 1 : 0) + S.creatives.filter(aLivrable).length + S.copies.filter(Boolean).length
  const pct = Math.min(100, Math.round(Math.min(pretes, total) / total * 100))
  const ecoule = U.etapeDebut ? (U.running ? Date.now() : (U.finiLe || Date.now())) - U.etapeDebut : 0
  return (
    <section className="fx2-board">
      <div className="fx2-board-h">
        <div><b>{U.running ? 'Production en cours' : pretes >= total ? 'Production terminée' : 'Production à compléter'}</b><span>{Math.min(pretes, total)} / {total} livrables prêts{U.running && U.etapeDebut ? ' · ' + dur(ecoule) : ''}{S.budget ? ' · hors vidéo ' + S.budget.depense.toFixed(2) + ' / ' + S.budget.total.toFixed(2) + ' $' : ''}</span></div>
        {U.running ? <button className="fx-btn sm" onClick={E.cancel}>Annuler</button> : <button className="fx-btn sm" onClick={E.launch}>↻ Relancer tous les livrables</button>}
      </div>
      <div className="fx2-bar"><div style={{ width: pct + '%' }} /></div>
      <div className="fx2-lanes">{LANES.map((l) => { const a = U.agents[l.n] || { state: 'pending', text: '', pct: 0 }; return (
        <div key={l.n} className={'fx2-lane ' + a.state}>
          <div className="fx2-lane-h"><span className="fx2-lane-i">{l.i}</span><b>{l.t}</b><span className="fx2-lane-s">{a.state === 'done' ? '✓' : a.state === 'error' ? '!' : a.state === 'active' ? <span className="fx-spin sm" /> : ''}</span></div>
          <div className="fx-prog"><div style={{ width: (a.pct || 0) + '%' }} /></div>
          <div className="fx2-lane-t">{a.text}</div>
        </div>) })}</div>
      {U.banner && <div className={'fx-banner ' + U.banner.kind} style={{ marginTop: 12, marginBottom: 0 }}>{U.banner.text}</div>}
    </section>
  )
}

/* ───────── 4. une ligne par angle ───────── */
function Ring({ pct }) {
  const r = 26, c = 2 * Math.PI * r
  return <svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r={r} className="fx2-ring-bg" /><circle cx="32" cy="32" r={r} className="fx2-ring" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, pct || 0) / 100)} transform="rotate(-90 32 32)" /><text x="32" y="36" textAnchor="middle" className="fx2-ring-t">{Math.round(pct || 0)}%</text></svg>
}
function Qa({ qa }) {
  const ok = qa.verdict === 'ok'
  const titre = (qa.defauts || []).map((d) => (d.gravite === 'bloquant' ? '■ ' : '· ') + d.detail).join('\n') || qa.resume || ''
  return <div className={'fx2-qa ' + (ok ? 'ok' : qa.verdict === 'corriger' ? 'ko' : 'na')} title={titre}>
    {ok ? 'Contrôle qualité ✓' : qa.verdict === 'corriger' ? '⚠ ' + String(((qa.defauts || []).find((d) => d.gravite === 'bloquant') || (qa.defauts || [])[0] || {}).detail || 'défaut signalé').slice(0, 90) : 'Contrôle indisponible'}
    {qa.score != null && <em> · {qa.score}/10</em>}{qa.corrections ? <em> · {qa.corrections} correction{qa.corrections > 1 ? 's' : ''}</em> : null}{qa.budget_atteint ? <em> · budget atteint</em> : null}
  </div>
}
function VideoTile({ S, U, idx, onOther }) {
  const c = S.creatives[idx], ui = U.crea[idx] || { state: 'pending', text: 'En attente de la synthèse' }
  const ref = useRef(null)
  const [log, setLog] = useState(false)
  const [lien, setLien] = useState(null)
  const job = (c && c.job) || null
  const pret = !!c?.videoUrl && ui.state !== 'running'
  const lignes = (U.vjournal && U.vjournal[idx]) || []
  const peut = !!S.synthesis && !!c && S.briefSource === 'commande'
  return (
    <div className={'fx2-tile vid ' + (pret ? 'done' : ui.state)}>
      <input ref={ref} type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" hidden onChange={(e) => { E.importerVideo(idx, e.target.files[0]); e.target.value = '' }} />
      <div className="fx2-media v">
        {pret ? <video src={c.videoUrl} poster={c.thumbUrl || undefined} controls playsInline preload="metadata" />
          : ui.state === 'running' ? <div className="fx2-run" style={job && job.poster ? { backgroundImage: `linear-gradient(rgba(10,12,17,.78),rgba(10,12,17,.9)),url(${job.poster})` } : undefined}><Ring pct={ui.pct} /><div className="fx2-run-t">{String(ui.text).replace(/ · \d+ %$/, '')}</div>{job && <div className="fx2-run-s">{job.ctNom}</div>}</div>
          : ui.state === 'err' ? <div className="fx2-run err"><div className="fx2-big">!</div><div className="fx2-run-t">Échec de la vidéo</div><div className="fx2-run-s">{ui.err}</div></div>
          : <div className="fx2-run idle"><div className="fx2-big">▶</div><div className="fx2-run-t">{peut ? 'Vidéo à lancer' : 'Vidéo de l\'angle ' + ((c && c.angleIdx + 1) || '')}</div><div className="fx2-run-s">{peut ? 'Le CT est choisi automatiquement' : 'Démarre après la synthèse'}</div></div>}
      </div>
      <div className="fx2-tile-b">
        <div className="fx2-tile-m"><b>Vidéo{c && c.niveau ? ' · ' + nivLib(c) : ''}</b><span className={'fx-st ' + (pret ? 'done' : ui.state === 'running' ? 'running' : ui.state === 'err' ? 'err' : 'pending')}>{pret ? 'Prête' : ui.state === 'running' ? 'Cloud' : ui.state === 'err' ? 'Échec' : 'À lancer'}</span></div>
        {job && <div className="fx2-ct" title={job.raison || ''}><span>CT</span> {job.ctNom || c.ct}{job.cout_usd != null && job.cout_usd !== '' ? <em> · {Number(job.cout_usd).toFixed(2)} $</em> : null}{job.monteur ? <em> · {job.monteur === 'hyperframes' ? 'HyperFrames' : 'ffmpeg'}</em> : null}</div>}
        {job && job.raison && <div className="fx2-why">{job.raison}</div>}
        {job && job.direction && <div className="fx2-why" title={Object.values(job.direction).join(' · ')}>Direction : {[job.direction.lieux, job.direction.tenue, job.direction.lumiere].filter(Boolean).join(' · ')}</div>}
        <div className="fx2-links">
          {job && job.historiqueUrl && <a href={job.historiqueUrl} target="_blank" rel="noopener noreferrer">Historique</a>}
          {job && job.dossierUrl && <a href={job.dossierUrl} target="_blank" rel="noopener noreferrer">Dossier complet</a>}
          {lignes.length > 0 && <button className="fx-link-btn" onClick={() => setLog(!log)}>{log ? 'Masquer le journal' : 'Journal'}</button>}
        </div>
        {log && <pre className="fx2-log">{lignes.join('\n')}</pre>}
        {lien !== null && <div className="fx2-lien"><input className="fx-in" placeholder="https://…/video.mp4" value={lien} onChange={(e) => setLien(e.target.value)} /><button className="fx-btn sm primary" onClick={() => { if (E.attacherLienVideo(idx, lien)) setLien(null); else toast('Lien invalide : il doit commencer par https:// et finir par .mp4, .mov ou .webm') }}>Rattacher</button></div>}
        <div className="fx-crea-a">
          {(pret || ui.state === 'err' || ui.state === 'video' || ui.state === 'pending') && <button className="fx-btn sm" disabled={!peut} onClick={() => E.relancerVideo(idx)}>{pret ? '↻ Refaire' : ui.state === 'err' ? '↻ Relancer' : '▶ Lancer'}</button>}
          {(pret || ui.state === 'err') && <button className="fx-btn sm" disabled={!peut} title="Un autre concept vidéo (CT jamais utilisé dans cette commande)" onClick={() => E.relancerVideo(idx, { autreCT: true })}>⇄ Autre CT</button>}
          {ui.state !== 'running' && <button className="fx-btn sm" disabled={!c} onClick={() => ref.current.click()}>{pret ? 'Remplacer' : 'Importer'}</button>}
          {ui.state !== 'running' && !pret && <button className="fx-btn sm" disabled={!c} title="Rattacher une vidéo déjà produite (lien .mp4)" onClick={() => setLien(lien === null ? '' : null)}>Lien</button>}
          {pret && <button className="fx-btn sm" onClick={() => E.retirerVideo(idx)}>Retirer</button>}
          {pret && <SendMenu title="Envoyer cette vidéo" busy={U.sending['c' + idx]} onClient={() => E.sendOneCreative(idx)} onOther={() => onOther({ type: 'creative', index: idx })}>Envoyer</SendMenu>}
        </div>
      </div>
    </div>
  )
}
function ImageTile({ S, U, idx, onOther }) {
  const c = S.creatives[idx], ui = U.crea[idx] || { state: 'pending', text: 'En attente' }
  const src = c?.url || (c?.imgB64 ? `data:${c.imageMime || 'image/png'};base64,${c.imgB64}` : null)
  const ready = ui.state === 'done' && src
  const ctName = c?.ct ? (CT_IMAGES[c.ct + '_name'] || c.ct) : null
  return (
    <div className={'fx2-tile ' + ui.state}>
      <div className="fx2-media i">{src ? <img src={src} alt={'Créative ' + (idx + 1)} /> : ui.state === 'running' ? <div className="fx2-run"><div className="fx-spin" /><div className="fx2-run-t">{ui.text}</div></div> : ui.state === 'err' ? <div className="fx2-run err"><div className="fx2-big">!</div><div className="fx2-run-s">{ui.err}</div></div> : <div className="fx2-run idle"><div className="fx2-run-s">En attente</div></div>}</div>
      <div className="fx2-tile-b">
        <div className="fx2-tile-m"><b>Image · {nivLib(c)}</b><span className={'fx-st ' + ui.state}>{ready ? 'Prête' : ui.state === 'running' ? 'En cours' : ui.state === 'err' ? 'Erreur' : 'Attente'}</span></div>
        <div className="fx2-ct" title={c?.ctRaison || ''}>{ctName ? <><span>CT</span> {ctName}</> : <span>CT choisi par l'agent</span>}</div>
        {ready && c?.qa && <Qa qa={c.qa} />}
        <div className="fx-crea-a">
          <button className="fx-btn sm" disabled={!ready} onClick={() => E.downloadCrea(idx)}>Télécharger</button>
          <button className="fx-btn sm" title="Régénérer avec le même CT" disabled={ui.state === 'running' || (ui.state === 'pending' && !c?.imgB64 && !c?.url)} onClick={() => E.regenerateCrea(idx)}>↻</button>
          <button className="fx-btn sm" title="Régénérer avec un AUTRE CT" disabled={ui.state === 'running' || !S.synthesis} onClick={() => E.regenerateCreaAutreCT(idx)}>⇄ Autre CT</button>
          <SendMenu title="Envoyer cette créative" busy={U.sending['c' + idx]} onClient={() => E.sendOneCreative(idx)} onOther={() => onOther({ type: 'creative', index: idx })}>Envoyer</SendMenu>
        </div>
      </div>
    </div>
  )
}
function AngleRow({ S, U, a, onOther }) {
  const [open, setOpen] = useState(true)
  const prets = [0, 1, 2].filter((k) => aLivrable(S.creatives[a * 3 + k])).length + (S.copies[a] ? 1 : 0)
  return (
    <section className="fx2-angle">
      <button className="fx2-angle-h" onClick={() => setOpen(!open)}>
        <span className="fx2-angle-n">{a + 1}</span>
        <span className="fx2-angle-t"><b>{titreAngle(S, a)}</b><small>{prets} / 4 livrables prêts{S.planNiveaux && S.planNiveaux[a] ? ' · parcours ' + S.planNiveaux[a].niveaux.map((x) => PL.COURT[x]).join(' → ') : ''}</small></span>
        <span className={'fx-arrow' + (open ? ' open' : '')}>›</span>
      </button>
      {open && <>
        <div className="fx2-tiles">
          <VideoTile S={S} U={U} idx={a * 3} onOther={onOther} />
          <ImageTile S={S} U={U} idx={a * 3 + 1} onOther={onOther} />
          <ImageTile S={S} U={U} idx={a * 3 + 2} onOther={onOther} />
        </div>
        <CopyPane S={S} U={U} a={a} onOther={onOther} />
      </>}
    </section>
  )
}

function Marche({ S, U, onOther }) {
  const n = U.nbAngles
  return (
    <section className="fx2-card slim">
      <div className="fx-syn-h" onClick={() => { U.synOpen = !U.synOpen; E.refresh() }}>
        <span className={'fx-arrow' + (U.synOpen ? ' open' : '')}>›</span><b>Hypothèse & Données Marché · {n} angles</b>
        <span className="fx-s" style={{ flex: 1 }}>{S.synthesis ? `${Math.round(S.synthesis.length / 1000)}K` : 'en cours…'}</span>
        <span onClick={(e) => e.stopPropagation()}><button className="fx-btn sm" style={{ marginRight: 6 }} disabled={U.running || U.sending.ana === 'busy'} onClick={E.regenerateAnalyse}>{U.sending.ana === 'busy' ? 'Analyse…' : '↻ Refaire'}</button><SendMenu title="Envoyer les Données Marché" busy={U.sending.m} onClient={E.sendMarche} onOther={() => onOther({ type: 'marche', index: null })}>Envoyer</SendMenu></span>
      </div>
      {U.synOpen && <div className="fx-syn-b">{S.synthesis ? <MarcheSummary marche={S.marche} synthesis={S.synthesis} /> : <div className="fx-s">En cours…</div>}</div>}
    </section>
  )
}

// Historique de toutes les vidéos : la matière pour améliorer l'agent Créative Vidéo
function HistoriqueVideos({ S }) {
  const v = S.creatives.filter((c) => E.estSlotVideo(c))
  if (!v.length) return null
  return (
    <section className="fx2-card slim">
      <div className="fx2-h" style={{ marginBottom: 8 }}><div><h2 style={{ fontSize: 14 }}>Historique des vidéos</h2><p>Journal complet, plans, prompts, coûts et clips de chaque production, conservés pour améliorer l'agent Créative Vidéo.</p></div></div>
      <div className="fx2-hist">
        {v.map((c) => { const j = c.job || {}; return (
          <div key={c.angleIdx} className="fx2-hist-r">
            <b>Angle {c.angleIdx + 1}</b><span>{j.ctNom || c.ct || '—'}</span>
            <span>{c.videoUrl ? 'Prête' : j.etat === 'echec' ? 'Échec' : j.execution ? 'En cours' : 'Non lancée'}</span>
            <span>{j.cout_usd != null && j.cout_usd !== '' ? Number(j.cout_usd).toFixed(2) + ' $' : '—'}</span>
            <span className="fx2-links">{j.historiqueUrl ? <a href={j.historiqueUrl} target="_blank" rel="noopener noreferrer">Historique</a> : <em>—</em>}{j.dossierUrl && <a href={j.dossierUrl} target="_blank" rel="noopener noreferrer">Dossier complet</a>}</span>
          </div>) })}
      </div>
    </section>
  )
}

/* ───────── 5. barre d'envoi ───────── */
function ActionBar({ S, U, setCompte }) {
  const { reload } = useData()
  const n = U.nbAngles
  const total = n * 3 + n
  const pretes = S.creatives.filter(aLivrable).length + S.copies.filter(Boolean).length
  const moi = E.monCompte()
  void U.compteV
  const envoyeMoi = !!U.envoyeMoi
  const clientOk = S.briefSource === 'commande' && !!S.commandeId
  const versClient = async () => {
    if (!envoyeMoi && !(await confirmDlg("Tu n'as pas encore envoyé ces livrables sur ton compte de contrôle.\n\nEnvoyer quand même directement au client ?", { ok: 'Envoyer au client' }))) return
    E.sendClient(reload)
  }
  return (
    <div className="fx2-bar-send">
      <div className="fx2-bar-i"><b>{Math.min(pretes, total)} / {total} livrables prêts</b><span>{envoyeMoi ? 'Envoyé sur ton compte à ' + heure(U.envoyeMoi) + ' ✓' : moi ? 'Compte de contrôle : ' + moi.user.email : 'Vérifie d\'abord sur ton propre compte'}</span></div>
      <div className="fx2-bar-a">
        {moi && <button className="fx-link-btn" onClick={() => setCompte(true)}>changer de compte</button>}
        <button className={'fx-btn' + (envoyeMoi ? '' : ' primary')} disabled={!pretes || U.sending.moi === 'busy'} onClick={() => { if (!E.monCompte()) setCompte(true); else E.envoyerSurMonCompte() }}>{U.sending.moi === 'busy' ? 'Envoi…' : U.sending.moi === 'ok' ? '✓ Envoyé' : envoyeMoi ? 'Renvoyer sur mon compte' : '1 · Envoyer sur mon compte'}</button>
        <button className={'fx-btn' + (envoyeMoi ? ' primary' : '')} disabled={!pretes || !clientOk || U.sending.all === 'busy'} title={clientOk ? '' : 'Production non liée à une commande'} onClick={versClient}>{U.sendLabel || '2 · Envoyer au client'}</button>
      </div>
    </div>
  )
}

export default function Production() {
  const S = useProd(), U = S.ui
  const [sp, setSp] = useSearchParams()
  const nav = useNavigate()
  const [manual, setManual] = useState(undefined)   // undefined = fermé, null = tout, objet = ciblé
  const [compte, setCompte] = useState(false)
  const cmd = sp.get('cmd')
  useEffect(() => E.installUnloadSave(), [])
  useEffect(() => { if (cmd) { E.openCommande(cmd).then(() => setSp({}, { replace: true })) } else E.checkResume() }, [cmd])
  const charge = !!S.brief
  const nAng = U.nbAngles
  const changer = () => { S.brief = null; S.commandeId = null; S.briefSource = null; S.creatives = []; S.copies = []; S.synthesis = null; S.angles = []; S.marche = null; U.launched = false; U.banner = null; E.refresh() }
  return (
    <div className="fx-wrap fx2">
      <div className="fx-h"><div><h1>Production</h1><p>Une commande, un clic : tous les livrables, puis ton compte, puis le client.</p></div>
        <div style={{ display: 'flex', gap: 8 }}>{charge && !U.running && <button className="fx-btn" onClick={changer}>Changer de commande</button>}<button className="fx-btn" onClick={() => nav('/commandes')}>Commandes</button></div></div>
      {U.resumeError && <div className="fx-banner err">{U.resumeError}</div>}
      {U.renewal && <div className={'fx-banner ' + U.renewal.kind}>{U.renewal.text}</div>}
      {!charge && <Picker S={S} U={U} />}
      {charge && <BriefCard S={S} />}
      {charge && !U.launched && U.banner && <div className={'fx-banner ' + U.banner.kind}>{U.banner.text}</div>}
      {charge && !U.launched && <Launch S={S} U={U} />}
      {charge && U.launched && <Board S={S} U={U} />}
      {charge && U.launched && nAng > 0 && <>
        <Marche S={S} U={U} onOther={setManual} />
        {Array.from({ length: nAng }, (_, a) => <AngleRow key={a} S={S} U={U} a={a} onOther={setManual} />)}
        <HistoriqueVideos S={S} />
        <ActionBar S={S} U={U} setCompte={setCompte} />
      </>}
      {manual !== undefined && <ManualSend scope={manual} onClose={() => setManual(undefined)} />}
      {compte && <ManualSend scope={null} onClose={() => setCompte(false)} onPicked={(m) => { E.setMonCompte(m); setTimeout(() => E.envoyerSurMonCompte(), 50) }} />}
    </div>
  )
}
