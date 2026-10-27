import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ctGetAll, ctPut, ctDel, ctGetBase64, ctCompress, ctNameAI, loadCTImages } from '../ctApi'
import { vctGetAll, vctPutMeta, vctPutTexte, vctGetTexte, vctDel, vctAjouter, vctEnrichAll } from '../vctApi'
import { labFetch, labUrl } from '../lab'
import { confirmDlg, alertDlg, toast } from '../ui'

const LEVELS = ['Problem Aware', 'Solution Aware', 'Product Aware', 'Most Aware']
const csv = (s) => s.split(',').map((x) => x.trim()).filter(Boolean)

function Chips({ r }) {
  const niches = r.niches && r.niches.length ? r.niches : r.niche ? [r.niche] : []
  return (
    <div className="fx-chips">
      {(r.awareness || []).map((a) => <span key={a} className="fx-chip a">{a}</span>)}
      {(r.styleTags || []).map((a) => <span key={a} className="fx-chip">#{a}</span>)}
      {niches.slice(0, 3).map((n) => <span key={n} className="fx-chip n">{n}</span>)}
    </div>
  )
}
function Modal({ title, onClose, children, wide }) {
  useEffect(() => { const h = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h) }, [onClose])
  return (
    <div className="fx-modal-back" onClick={onClose}>
      <div className={'fx-modal' + (wide ? ' wide' : '')} onClick={(e) => e.stopPropagation()}>
        <div className="fx-drawer-h"><h3>{title}</h3><button className="fx-btn sm" onClick={onClose}>✕</button></div>
        {children}
      </div>
    </div>
  )
}
const Field = ({ l, children }) => <div className="fx-fld"><label className="fx-lab">{l}</label>{children}</div>
function AwarenessPick({ value, onChange }) {
  const all = [...new Set([...LEVELS, ...value])]
  return <div className="fx-pills">{all.map((a) => <button type="button" key={a} className={'fx-pill' + (value.includes(a) ? ' on' : '')} onClick={() => onChange(value.includes(a) ? value.filter((x) => x !== a) : [...value, a])}>{a}</button>)}</div>
}
function Toolbar({ list, q, setQ, aw, setAw, children }) {
  const all = useMemo(() => [...new Set([...LEVELS, ...list.flatMap((x) => x.awareness || [])])], [list])
  return (
    <div className="fx-tools">
      <input className="fx-in" placeholder="Rechercher un CT" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="fx-pills"><button className={'fx-pill' + (!aw ? ' on' : '')} onClick={() => setAw('')}>Tous</button>{all.map((a) => <button key={a} className={'fx-pill' + (aw === a ? ' on' : '')} onClick={() => setAw(aw === a ? '' : a)}>{a}</button>)}</div>
      {children}
    </div>
  )
}
const hay = (x) => [x.name, x.meta, x.niche, (x.styleTags || []).join(' '), x.produit_compatible, (x.angles_fit || []).join(' ')].join(' ').toLowerCase()

/* ───────── Galerie CT image ───────── */
export function GalerieImage() {
  const [list, setList] = useState([]), [loading, setLoading] = useState(true), [err, setErr] = useState('')
  const [q, setQ] = useState(''), [aw, setAw] = useState('')
  const [edit, setEdit] = useState(null), [light, setLight] = useState(null), [prog, setProg] = useState(null), [drag, setDrag] = useState(false)
  const fileRef = useRef(null)
  const load = useCallback(async () => { setLoading(true); try { setList(await ctGetAll()); setErr('') } catch (e) { setErr(e.message) } setLoading(false); loadCTImages() }, [])
  useEffect(() => { load() }, [load])

  const addFiles = async (files) => {
    const imgs = Array.from(files || []).filter((f) => f.type.startsWith('image/'))
    if (!imgs.length) return
    let ok = 0
    for (let i = 0; i < imgs.length; i++) {
      setProg({ label: `Analyse ${i + 1} / ${imgs.length}…`, pct: (i / imgs.length) * 100, sub: imgs[i].name })
      try {
        const c = await ctCompress(imgs[i])
        let ai = { name: 'CT ' + new Date().toLocaleDateString('fr-FR'), meta: '', awareness: [], styleTags: [], niche: '' }
        try { ai = await ctNameAI(c.b64, c.mime) } catch (e) { console.warn('[CT] nommage IA indisponible', e.message) }
        const id = 'ct_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
        await ctPut({ id, ...ai, b64: c.b64, mime: c.mime, addedAt: Date.now() }); ok++
      } catch (e) { console.error('[CT Upload]', imgs[i].name, e) }
    }
    setProg({ label: `${ok} CT ajouté${ok > 1 ? 's' : ''}`, pct: 100, sub: ok < imgs.length ? `${imgs.length - ok} en échec` : '' })
    setTimeout(() => setProg(null), 2500); load()
  }
  const renameAll = async () => {
    if (!list.length) return
    if (!(await confirmDlg(`Renommer et ré-analyser les ${list.length} CT avec Gemini ? Les noms, descriptions et balises actuels seront remplacés.`, { ok: 'Tout renommer' }))) return
    let s = 0, f = 0, last = ''
    for (let i = 0; i < list.length; i++) {
      const r = list[i]; setProg({ label: `Renommage ${i + 1} / ${list.length}`, pct: (i / list.length) * 100, sub: r.name })
      try { const ai = await ctNameAI(await ctGetBase64Url(r.url), r.mime); await ctPut({ ...r, ...ai }); s++ } catch (e) { f++; last = e.message }
    }
    setProg({ label: f ? `${s} renommés, ${f} échec(s)` : `${s} CT renommés`, pct: 100, sub: f ? 'Dernière erreur : ' + last : '' })
    setTimeout(() => setProg(null), f ? 6000 : 2500); load()
  }
  const l = list.filter((x) => (!q || hay(x).includes(q.toLowerCase())) && (!aw || (x.awareness || []).includes(aw)))
  return (
    <div className="fx-wrap" onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={(e) => { if (e.currentTarget === e.target) setDrag(false) }} onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files) }}>
      <div className="fx-h"><div><h1>Galerie CT image</h1><p>{list.length} créatives modèles · glisse des images n’importe où pour en ajouter</p></div>
        <div className="fx-acts"><button className="fx-btn" onClick={renameAll}>Renommer tout (IA)</button><button className="fx-btn" onClick={load}>Actualiser</button>
          <button className="fx-btn primary" onClick={() => fileRef.current.click()}>+ Ajouter des CT</button></div></div>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
      {prog && <div className="fx-progress"><div className="fx-progress-t"><b>{prog.label}</b><span>{prog.sub}</span></div><div className="fx-prog"><div style={{ width: prog.pct + '%' }} /></div></div>}
      <Toolbar list={list} q={q} setQ={setQ} aw={aw} setAw={setAw} />
      {err && <div className="fx-err">{err}</div>}
      {drag && <div className="fx-dropveil">Dépose tes images pour les ajouter</div>}
      {loading ? <div className="fx-gal">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="fx-skel" style={{ height: 300 }} />)}</div>
        : l.length ? <div className="fx-gal">{l.map((x) => (
          <div key={x.id} className="fx-ct"><img src={x.url} alt={x.name} loading="lazy" onClick={() => setLight(x)} />
            <div className="b"><div className="fx-t wrap">{x.name}</div>{x.meta && <div className="fx-meta">{x.meta}</div>}<Chips r={x} />
              <div className="fx-ct-a"><button className="fx-btn sm" onClick={() => setEdit(x)}>Modifier</button></div></div></div>))}</div>
          : <div className="fx-empty">{list.length ? 'Aucun CT ne correspond.' : 'Galerie vide — ajoute tes premières créatives modèles.'}</div>}
      {light && <div className="fx-light" onClick={() => setLight(null)}><img src={light.url} alt="" /><div>{light.name}</div></div>}
      {edit && <EditImage rec={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
    </div>
  )
}
async function ctGetBase64Url(url) {
  const blob = await (await fetch(url)).blob()
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob) })
}
function EditImage({ rec, onClose, onSaved }) {
  const [f, setF] = useState({ name: rec.name, meta: rec.meta || '', awareness: rec.awareness || [], tags: (rec.styleTags || []).join(', '), niche: rec.niche || '' })
  const [busy, setBusy] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const save = async () => {
    setBusy('save')
    try { await ctPut({ ...rec, name: f.name.trim() || rec.name, meta: f.meta.trim(), awareness: f.awareness, styleTags: csv(f.tags).map((t) => t.replace(/^#/, '')), niche: f.niche.trim() }); toast('CT enregistré'); onSaved() }
    catch (e) { await alertDlg('Échec : ' + e.message) } setBusy('')
  }
  const ai = async () => {
    setBusy('ai')
    try { const r = await ctNameAI(await ctGetBase64Url(rec.url), rec.mime); setF({ name: r.name, meta: r.meta, awareness: r.awareness, tags: r.styleTags.join(', '), niche: r.niche }); toast('Analyse IA appliquée — vérifie puis enregistre') }
    catch (e) { await alertDlg('Analyse impossible : ' + e.message + '\nLe serveur est-il en ligne ?') } setBusy('')
  }
  const del = async () => { if (!(await confirmDlg('Supprimer ce CT ?', { ok: 'Supprimer', danger: true }))) return; await ctDel(rec.id); toast('CT supprimé'); onSaved() }
  return (
    <Modal title="Modifier le CT" onClose={onClose}>
      <div className="fx-edit-img"><img src={rec.url} alt="" /></div>
      <Field l="Nom"><input className="fx-in full" value={f.name} onChange={set('name')} /></Field>
      <Field l="Méta-description"><textarea className="fx-ta" rows={4} value={f.meta} onChange={set('meta')} /></Field>
      <Field l="Niveau de conscience"><AwarenessPick value={f.awareness} onChange={(v) => setF({ ...f, awareness: v })} /></Field>
      <Field l="Balises de style (séparées par des virgules)"><input className="fx-in full" value={f.tags} onChange={set('tags')} /></Field>
      <Field l="Niche"><input className="fx-in full" value={f.niche} onChange={set('niche')} /></Field>
      <div className="fx-modal-act spread">
        <button className="fx-btn danger-o" onClick={del}>Supprimer</button>
        <span><button className="fx-btn" disabled={!!busy} onClick={ai}>{busy === 'ai' ? 'Analyse…' : 'Analyser avec l’IA'}</button> <button className="fx-btn primary" disabled={!!busy} onClick={save}>{busy === 'save' ? '…' : 'Enregistrer'}</button></span>
      </div>
    </Modal>
  )
}

/* ───────── Galerie CT vidéo ───────── */
export function GalerieVideo() {
  const [list, setList] = useState([]), [loading, setLoading] = useState(true), [err, setErr] = useState('')
  const [q, setQ] = useState(''), [aw, setAw] = useState(''), [status, setStatus] = useState({ t: '', err: false }), [edit, setEdit] = useState(null), [busy, setBusy] = useState(false)
  const fileRef = useRef(null)
  const st = (t, e = false) => setStatus({ t, err: e })
  const load = useCallback(async () => { setLoading(true); try { const l = await vctGetAll(); setList(l); setErr(''); return l } catch (e) { setErr(e.message); return [] } finally { setLoading(false) } }, [])
  useEffect(() => { load() }, [load])

  const addFiles = async (files) => {
    const fl = Array.from(files || []).filter((f) => /\.(md|txt)$/i.test(f.name))
    if (!fl.length) { st('Aucun fichier .md ou .txt reconnu.', true); return }
    setBusy(true); let ok = 0, ko = 0, sansMeta = 0
    for (let i = 0; i < fl.length; i++) {
      st(`Ajout ${i + 1}/${fl.length} : ${fl[i].name}…`)
      try { const t = await fl[i].text(); if (t.length < 500) throw new Error('fichier trop court (' + t.length + ' caractères)'); const rec = await vctAjouter(fl[i].name, t, fl[i].name); ok++; if (rec._enrichKo) sansMeta++ }
      catch (e) { ko++; console.error('[CT vidéo]', fl[i].name, e) }
    }
    st(`${ok} ajouté(s)` + (sansMeta ? ` (dont ${sansMeta} sans méta-description : le serveur n'a pas répondu, utilise « Enrichir »)` : '') + (ko ? ` · ${ko} refusé(s)` : '') + '.', ko > 0 || sansMeta > 0)
    setBusy(false); load()
  }
  const importLab = async () => {
    setBusy(true); st(`Lecture du labo (${labUrl()})…`)
    let cts
    try { const r = await labFetch('/cts'); if (r.status === 401) throw new Error('clé'); cts = await r.json() }
    catch (e) { st(e.message === 'clé' ? "Clé d'accès refusée par le service vidéo : saisis-la dans l'agent « Créative Vidéo »." : `Service vidéo injoignable (${labUrl()}) : lance-le ou vérifie l'adresse, puis réessaie.`, true); setBusy(false); return }
    const deja = new Set(list.map((x) => x.source))
    const nouveaux = (cts || []).filter((c) => !deja.has(c.file))
    if (!nouveaux.length) { st(`Rien de nouveau : les ${(cts || []).length} CT du labo sont déjà dans la galerie.`); setBusy(false); return }
    let ok = 0, ko = 0
    for (let i = 0; i < nouveaux.length; i++) {
      st(`Import ${i + 1}/${nouveaux.length} : ${nouveaux[i].file}…`)
      try { const t = await (await labFetch('/ct?f=' + encodeURIComponent(nouveaux[i].file))).text(); if (t.length < 500) throw new Error('trop court'); await vctAjouter(nouveaux[i].file, t, nouveaux[i].file); ok++ }
      catch (e) { ko++; console.error('[CT vidéo] import', nouveaux[i].file, e) }
    }
    st(`${ok} CT importé(s) du labo` + (ko ? ` · ${ko} en échec` : '') + '.', ko > 0); setBusy(false); load()
  }
  const enrich = async () => {
    setBusy(true)
    const r = await vctEnrichAll(list, (t) => st(t))
    if (!r.cibles) st(r.relus ? `${r.relus} CT complété(s) depuis leur fiche de sélection.` : 'Tous les CT sont déjà complets.')
    else st(`${r.ok} enrichi(s)` + (r.ko ? ` · ${r.ko} en échec (le serveur v5.67 est-il déployé ?)` : '') + '.', r.ko > 0)
    setBusy(false); load()
  }
  const sansMeta = list.filter((r) => !r.meta).length
  const l = list.filter((x) => (!q || hay(x).includes(q.toLowerCase())) && (!aw || (x.awareness || []).includes(aw)))
  return (
    <div className="fx-wrap">
      <div className="fx-h"><div><h1>Galerie CT vidéo</h1><p>{list.length} CT vidéo{sansMeta ? ` · ${sansMeta} sans méta-description` : ''}</p></div>
        <div className="fx-acts"><button className="fx-btn" disabled={busy} onClick={importLab}>Importer depuis le labo</button><button className="fx-btn" disabled={busy} onClick={enrich}>Enrichir les CT sans méta</button>
          <button className="fx-btn primary" disabled={busy} onClick={() => fileRef.current.click()}>+ Ajouter des CT vidéo</button></div></div>
      <input ref={fileRef} type="file" accept=".md,.txt" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
      {status.t && <div className={'fx-banner ' + (status.err ? 'warn' : 'info')}>{status.t}</div>}
      <Toolbar list={list} q={q} setQ={setQ} aw={aw} setAw={setAw} />
      {err && <div className="fx-err">{err}</div>}
      {loading ? <div className="fx-gal">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="fx-skel" style={{ height: 190 }} />)}</div>
        : l.length ? <div className="fx-gal wide">{l.map((x) => (
          <div key={x.id} className="fx-ct fx-vid">
            <div className="fx-t wrap">{x.name}</div>
            <div className={'fx-meta' + (x.meta ? '' : ' warn')}>{x.meta ? x.meta : 'Pas de méta-description : le sélecteur ne pourra pas bien choisir ce CT.'}</div>
            <div className="fx-chips">
              {x.duree_s ? <span className="fx-chip d">{x.duree_s} s</span> : <span className="fx-chip bad">durée ?</span>}
              {x.blocs ? <span className="fx-chip">{x.blocs} blocs</span> : null}
            </div>
            <Chips r={x} />
            <div className="fx-s">{x.source}{x.taille ? ' · ' + Math.round(x.taille / 1000) + ' Ko' : ''}</div>
            <div className="fx-ct-a"><button className="fx-btn sm" onClick={() => setEdit(x)}>Modifier</button></div>
          </div>))}</div>
          : <div className="fx-empty">{list.length ? 'Aucun CT ne correspond.' : 'Aucun CT vidéo — ajoute des fichiers .md ou importe ceux de ton labo.'}</div>}
      {edit && <EditVideo rec={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); load() }} />}
    </div>
  )
}
function EditVideo({ rec, onClose, onDone }) {
  const [f, setF] = useState({
    name: rec.name, meta: rec.meta || '', awareness: rec.awareness || [], tags: (rec.styleTags || []).join(', '),
    niche: (rec.niches && rec.niches.length ? rec.niches : rec.niche ? [rec.niche] : []).join(', '),
    duree: rec.duree_s || '', blocs: rec.blocs || '', mps: rec.mots_par_seconde || '', produit: rec.produit_compatible || '',
    angles: (rec.angles_fit || []).join(', '), lieux: (rec.lieux_interdits || []).join(', '), hook: rec.hook || '', chute: rec.chute || '', epic: rec.epic || '',
  })
  const [texte, setTexte] = useState(null), [busy, setBusy] = useState(false)
  useEffect(() => { vctGetTexte(rec.id).then(setTexte).catch((e) => { setTexte(''); toast(e.message) }) }, [rec.id])
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const num = (v) => { const n = Number(v); return isFinite(n) && n > 0 ? n : undefined }
  const save = async () => {
    if (texte == null || texte.length < 500) { await alertDlg("Le texte du CT est vide ou trop court : rien n'a été enregistré."); return }
    setBusy(true)
    const r = { ...rec, name: f.name.trim() || rec.name, meta: f.meta.trim(), awareness: f.awareness, styleTags: csv(f.tags).map((s) => s.replace(/^#/, '')), niche: f.niche.trim(), niches: csv(f.niche),
      duree_s: num(f.duree), blocs: num(f.blocs), mots_par_seconde: num(f.mps), produit_compatible: f.produit.trim(), angles_fit: csv(f.angles), lieux_interdits: csv(f.lieux), hook: f.hook.trim(), chute: f.chute.trim(), epic: f.epic.trim(), taille: texte.length }
    try { await vctPutTexte(r.id, texte); await vctPutMeta(r); toast('CT enregistré'); onDone() } catch (e) { await alertDlg('Échec : ' + e.message) }
    setBusy(false)
  }
  const del = async () => { if (!(await confirmDlg(`Supprimer le CT vidéo « ${rec.name} » ?`, { ok: 'Supprimer', danger: true }))) return; await vctDel(rec.id); toast('CT supprimé'); onDone() }
  return (
    <Modal title="Modifier le CT vidéo" onClose={onClose} wide>
      <div className="fx-two">
        <div>
          <Field l="Nom"><input className="fx-in full" value={f.name} onChange={set('name')} /></Field>
          <Field l="Méta-description"><textarea className="fx-ta" rows={3} value={f.meta} onChange={set('meta')} /></Field>
          <Field l="Niveau de conscience"><AwarenessPick value={f.awareness} onChange={(v) => setF({ ...f, awareness: v })} /></Field>
          <div className="fx-three">
            <Field l="Durée (s)"><input className="fx-in full" inputMode="numeric" value={f.duree} onChange={set('duree')} /></Field>
            <Field l="Blocs"><input className="fx-in full" inputMode="numeric" value={f.blocs} onChange={set('blocs')} /></Field>
            <Field l="Mots / seconde"><input className="fx-in full" inputMode="decimal" value={f.mps} onChange={set('mps')} /></Field>
          </div>
          <Field l="Balises de style"><input className="fx-in full" value={f.tags} onChange={set('tags')} /></Field>
          <Field l="Niches"><input className="fx-in full" value={f.niche} onChange={set('niche')} /></Field>
          <Field l="Produit compatible"><input className="fx-in full" value={f.produit} onChange={set('produit')} /></Field>
          <Field l="Angles adaptés"><input className="fx-in full" value={f.angles} onChange={set('angles')} /></Field>
          <Field l="Lieux interdits"><input className="fx-in full" value={f.lieux} onChange={set('lieux')} /></Field>
          <div className="fx-three">
            <Field l="Hook imposé"><input className="fx-in full" value={f.hook} onChange={set('hook')} /></Field>
            <Field l="Point de chute"><input className="fx-in full" value={f.chute} onChange={set('chute')} /></Field>
            <Field l="EPIC"><input className="fx-in full" value={f.epic} onChange={set('epic')} /></Field>
          </div>
        </div>
        <div><Field l="Texte du CT"><textarea className="fx-ta mono tall" value={texte == null ? 'Chargement…' : texte} disabled={texte == null} onChange={(e) => setTexte(e.target.value)} /></Field></div>
      </div>
      <div className="fx-modal-act spread"><button className="fx-btn danger-o" onClick={del}>Supprimer</button><button className="fx-btn primary" disabled={busy} onClick={save}>{busy ? '…' : 'Enregistrer'}</button></div>
    </Modal>
  )
}
