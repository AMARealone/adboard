import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useProd, CT_IMAGES } from '../prod/state'
import * as E from '../prod/engine'
import { useData } from '../data'
import { toast } from '../ui'

const esc = (s) => (s == null ? '' : String(s))
const AGENTS = [
  { n: 1, name: 'Analyste de Marché', model: 'gemini-3.1-pro' },
  { n: 2, name: 'Creative Image', model: 'gemini-2.5-pro + gemini-3-pro-image' },
  { n: 3, name: 'Copywriter', model: 'gemini-2.5-pro' },
]

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

function ManualSend({ scope, onClose }) {
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
    try { await E.manualDeliver({ scope, user, productId: pid, newName: newName.trim() }); toast(`Envoyé à ${user.email}.`); onClose() }
    catch (e) { toast("Erreur lors de l'envoi : " + e.message) } finally { setBusy(false) }
  }
  return (
    <div className="fx-modal-back" onClick={onClose}>
      <div className="fx-modal" onClick={(e) => e.stopPropagation()}>
        <div className="fx-drawer-h"><h3>Envoyer à un compte spécifique</h3><button className="fx-btn sm" onClick={onClose}>✕</button></div>
        <p className="fx-s" style={{ whiteSpace: 'normal' }}>Fonctionne même pour un compte qui n'a encore pris aucun forfait — juste connecté par email.</p>
        <label className="fx-lab">Compte client</label>
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
        <button className="fx-btn primary full" style={{ marginTop: 16 }} disabled={!ok || busy} onClick={send}>{busy ? 'Envoi en cours…' : 'Envoyer'}</button>
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

function Brief({ S, U }) {
  const fileRef = useRef(null), photoRef = useRef(null)
  const b = S.brief
  const [over, setOver] = useState(false)
  const autosaveOk = S.briefSource === 'commande' && !!S.commandeId
  const onDrop = (e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) E.loadBriefFile(f) }
  return (
    <section className="fx-card prod">
      <div className="fx-sec-h"><h2>Brief client</h2><span className="fx-step">Étape 1/3</span></div>
      <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => { E.loadBriefFile(e.target.files[0]); e.target.value = '' }} />
      <input ref={photoRef} type="file" accept="image/*" hidden onChange={(e) => { E.replacePhoto(e.target.files[0]); e.target.value = '' }} />
      <div className="fx-brief-grid">
        {!b ? (
          <div className={'fx-drop' + (over ? ' over' : '')} onClick={() => fileRef.current.click()} onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={onDrop}>
            <div className="fx-drop-t">Glisse <b>brief.json</b></div><div className="fx-s">ou clique pour parcourir — ou ouvre une commande depuis « Commandes »</div>
          </div>
        ) : (
          <div className="fx-bcard">
            <span className={'fx-pillstat ' + (autosaveOk ? 'ok' : 'warn')}>{autosaveOk ? 'Sauvegarde automatique active' : 'Pas de sauvegarde automatique (test)'}</span>
            <div className="fx-k">Brief reçu</div>
            <div className="fx-s" style={{ color: 'var(--ac)', whiteSpace: 'normal' }}>{autosaveOk ? `brief chargé automatiquement depuis la commande #${S.commandeId}` : 'brief.json chargé (fichier local)'}</div>
            <div className="fx-kv">
              <div>marque : <b>{b.marque || '—'}</b></div><div>produit : <b>{b.produit || '—'}</b></div><div>pays : <b>{b.pays || '—'}</b></div>
              <div>prix : <b className={b.pricing ? '' : 'miss'}>{b.pricing || 'non renseigné'}</b></div>
              {b.cible && <div>cible : <b>{b.cible}</b></div>}{b.utilite && <div>utilité : <b>{b.utilite}</b></div>}
              {b.couleurs && b.couleurs.length > 0 && <div>couleurs : {b.couleurs.map((c, i) => <i className="fx-dotc" key={i} style={{ background: c }} />)}</div>}
            </div>
            <button className="fx-btn sm" onClick={() => fileRef.current.click()}>Charger un autre brief</button>
          </div>
        )}
        <div className="fx-photo">
          <div className="fx-k">Photo produit</div>
          {S.productB64 ? (
            <><img src={`data:${S.productMime};base64,${S.productB64}`} alt="" />
              <div className="fx-row-b"><button className="fx-btn sm" onClick={() => photoRef.current.click()}>Remplacer</button><button className="fx-btn sm danger-o" onClick={E.removePhoto}>Supprimer</button></div></>
          ) : b ? (
            <div className="fx-nophoto"><span className="miss">Photo absente</span><button className="fx-btn sm" onClick={() => photoRef.current.click()}>Ajouter une photo</button></div>
          ) : <div className="fx-s" style={{ padding: '30px 0' }}>Aucun brief chargé</div>}
        </div>
      </div>
      <div className="fx-launch">
        <button className="fx-btn primary big" disabled={!b || !S.productB64 || U.running} onClick={E.launch}>{U.launchLabel}</button>
        {U.running && <button className="fx-btn big" onClick={E.cancel}>Annuler la production</button>}
      </div>
    </section>
  )
}

function Pipeline({ U }) {
  return (
    <section className="fx-card prod">
      <div className="fx-sec-h"><h2>Pipeline</h2><span className="fx-step">Étape 2/3</span></div>
      <div className="fx-pipe">{AGENTS.map((a) => { const s = U.agents[a.n]; return (
        <div key={a.n} className={'fx-agent ' + s.state}>
          <div className="fx-agent-h"><span className="fx-badge-n">{a.n}</span><b>{a.name}</b></div>
          <div className="fx-s">{a.model}</div>
          <div className="fx-prog"><div style={{ width: s.pct + '%' }} /></div>
          <div className="fx-agent-s">{s.text}</div>
        </div>) })}</div>
    </section>
  )
}

function CreaCard({ S, U, idx, onOther }) {
  const c = S.creatives[idx], ui = U.crea[idx] || { state: 'pending', text: 'En attente' }
  const src = c?.url || (c?.imgB64 ? `data:${c.imageMime || 'image/png'};base64,${c.imgB64}` : null)
  const ready = ui.state === 'done' && src
  const ctName = c?.ct ? (CT_IMAGES[c.ct + '_name'] || c.ct) : '?'
  return (
    <div className={'fx-crea ' + ui.state}>
      <div className="fx-crea-img">{src ? <img src={src} alt={'Créative ' + (idx + 1)} /> : ui.state === 'running' ? <div className="fx-spin" /> : <div className="fx-crea-empty" />}</div>
      <div className="fx-crea-b">
        <div className="fx-crea-m"><span className="fx-ct-n" title={ctName}>{ctName}</span><span className={'fx-st ' + ui.state}>{ui.text}</span></div>
        <div className={'fx-crea-d' + (ui.state === 'err' ? ' err' : '')}>{ui.state === 'err' ? ui.err : ready ? (c.desc || '') : 'Génération à venir…'}</div>
        <div className="fx-crea-a">
          <button className="fx-btn sm" disabled={!ready} onClick={() => E.downloadCrea(idx)}>Télécharger</button>
          <button className="fx-btn sm" title="Régénérer" disabled={ui.state === 'running' || (ui.state === 'pending' && !c?.imgB64 && !c?.url)} onClick={() => E.regenerateCrea(idx)}>↻</button>
          <SendMenu title="Envoyer cette créative" busy={U.sending['c' + idx]} onClient={() => E.sendOneCreative(idx)} onOther={() => onOther({ type: 'creative', index: idx })}>Envoyer</SendMenu>
        </div>
      </div>
    </div>
  )
}

function CopyPane({ S, U, a, onOther }) {
  const ui = U.copy[a] || { state: 'wait' }, d = S.copies[a]
  if (ui.state === 'err') return <div className="fx-copy"><div className="fx-err">Erreur copywriter : {ui.err}</div><button className="fx-btn sm" style={{ marginTop: 8 }} onClick={() => E.regenerateCopy(a)}>↻ Régénérer</button></div>
  if (!d) return <div className="fx-copy"><div className="fx-s">{ui.state === 'run' ? 'Génération des hooks et de la description…' : 'En attente'}</div></div>
  const fb = E.copyIsFallback(d)
  const cp = (t) => navigator.clipboard.writeText(t).then(() => toast('Copié'))
  return (
    <div className="fx-copy">
      <div className="fx-copy-s">
        <div className="fx-copy-l"><b>5 Hooks · variantes Meta Ads</b>
          <span><button className="fx-link-btn" onClick={() => cp(d.hooks.join('\n\n'))}>copier tout</button>
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

function Deliverables({ S, U, setManual }) {
  const { reload } = useData()
  const n = U.nbAngles
  const active = Math.min(S.activeAngle, n - 1)
  const tab = (i) => { const a = S.angles[i] || 'Angle ' + (i + 1); const short = a.length > 50 ? a.slice(0, 47) + '…' : a; return `Angle ${i + 1} · ${short.replace(/^[Aa]ngle\s*\d\s*[:—–-]?\s*/, '')}` }
  return (
    <section className="fx-card prod">
      <div className="fx-sec-h"><h2>Livrables · Synthèse + {n * 3} créatives + {n} sets ad copy</h2><span className="fx-step">Étape 3/3</span></div>
      <div className="fx-syn">
        <div className="fx-syn-h" onClick={() => { U.synOpen = !U.synOpen; E.refresh() }}>
          <span className={'fx-arrow' + (U.synOpen ? ' open' : '')}>›</span><b>Données Marché · {n} angles</b>
          <span className="fx-s" style={{ flex: 1 }}>{S.synthesis ? `${Math.round(S.synthesis.length / 1000)}K${S.startTime ? ' · ' + Math.round((Date.now() - S.startTime) / 1000) + 's' : ''}` : '—'}</span>
          <span onClick={(e) => e.stopPropagation()}><SendMenu title="Envoyer les Données Marché" busy={U.sending.m} onClient={E.sendMarche} onOther={() => setManual({ type: 'marche', index: null })}>Envoyer</SendMenu></span>
        </div>
        {U.synOpen && <div className="fx-syn-b">{S.synthesis ? <MarcheSummary marche={S.marche} synthesis={S.synthesis} /> : <div className="fx-s">En cours…</div>}</div>}
      </div>
      <div className="fx-tabs">{Array.from({ length: n }, (_, i) => <button key={i} className={'fx-tab' + (i === active ? ' on' : '')} onClick={() => { S.activeAngle = i; E.refresh() }}>{tab(i)}</button>)}</div>
      <div className="fx-crea-grid">{[0, 1, 2].map((c) => <CreaCard key={active * 3 + c} S={S} U={U} idx={active * 3 + c} onOther={setManual} />)}</div>
      <CopyPane S={S} U={U} a={active} onOther={setManual} />
      <div className="fx-footer">
        <button className="fx-btn primary" disabled={U.sending.all === 'busy'} onClick={() => E.sendClient(reload)}>{U.sendLabel || 'Envoyer au client'}</button>
        <button className="fx-btn" onClick={() => E.hasAnyDeliverable() ? setManual(null) : toast("Aucun livrable généré pour l'instant — rien à envoyer.")}>Envoyer à un autre compte…</button>
      </div>
    </section>
  )
}

export default function Production() {
  const S = useProd(), U = S.ui
  const [sp, setSp] = useSearchParams()
  const nav = useNavigate()
  const [manual, setManual] = useState(undefined)   // undefined = fermé, null = tout, objet = ciblé
  const cmd = sp.get('cmd')
  useEffect(() => E.installUnloadSave(), [])
  useEffect(() => {
    if (cmd) { E.openCommande(cmd).then(() => setSp({}, { replace: true })) }
    else E.checkResume()
  }, [cmd])
  return (
    <div className="fx-wrap">
      <div className="fx-h"><div><h1>Production</h1><p>Brief → Analyste → Créatives + Ad copies → envoi au client</p></div>
        <button className="fx-btn" onClick={() => nav('/commandes')}>Commandes</button></div>
      {U.resuming && <div className="fx-banner info"><span className="fx-spin sm" /> Reprise d'une commande en cours — récupération des données déjà générées…</div>}
      {U.resumeError && <div className="fx-banner err">{U.resumeError}</div>}
      {U.renewal && <div className={'fx-banner ' + U.renewal.kind}>{U.renewal.text}</div>}
      {U.banner && <div className={'fx-banner ' + U.banner.kind}>{U.banner.text}</div>}
      <Brief S={S} U={U} />
      {U.launched && <Pipeline U={U} />}
      {U.launched && U.nbAngles > 0 && <Deliverables S={S} U={U} setManual={setManual} />}
      {manual !== undefined && <ManualSend scope={manual} onClose={() => setManual(undefined)} />}
    </div>
  )
}
