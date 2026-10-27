import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { AGENTS } from './Agents'
import { useAgentMem } from '../agentStore'
import { COMP_FILES, SERVER, CT_IMAGES, loadSkills } from '../prod/state'
import * as V from '../prod/verbatim'
import { commandeToBrief, commandePhoto } from '../prod/engine'
import { prodv2State } from '../prod/state'
import { getCommandes } from '../api'
import { ctGetAll, ctGetBase64, loadCTImages } from '../ctApi'
import VideoPanel from './VideoPanel'
import { alertDlg, toast } from '../ui'
import { writeSkills, getBackupDir } from '../backup'

const Lab = ({ children }) => <div className="fx-lab up">{children}</div>
const Seg = ({ value, options, onChange }) => <div className="fx-pills">{options.map(([v, l]) => <button key={v} type="button" className={'fx-pill' + (value === v ? ' on' : '')} onClick={() => onChange(v)}>{l}</button>)}</div>

function Competence({ a }) {
  const [text, setText] = useState(null)
  const [saved, setSaved] = useState(false)
  useEffect(() => { loadSkills().then(() => setText(COMP_FILES[a.file] || '')) }, [a.file])
  const save = async () => {
    COMP_FILES[a.file] = text; setSaved(true); setTimeout(() => setSaved(false), 1500)
    const r = await writeSkills({ [a.file]: text })
    toast(r.ok ? `Enregistrée pour cette session et dans le dossier de secours « ${r.dir} »` : r.reason === 'no-dir' ? 'Enregistrée pour cette session. Aucun dossier de secours choisi (page Agents).' : 'Enregistrée pour cette session, mais le dossier de secours n’a pas été mis à jour : ' + r.reason)
  }
  const dl = () => { const x = document.createElement('a'); x.href = URL.createObjectURL(new Blob([text || ''], { type: 'text/markdown' })); x.download = a.file; x.click() }
  return (
    <div className="fx-comp">
      <div className="fx-comp-bar"><span className="mono">{a.name.toUpperCase().replace(/ /g, '_')}.md</span>
        <span><button className="fx-btn sm" onClick={dl}>Télécharger</button> <button className="fx-btn sm primary" onClick={save}>{saved ? '✓' : 'Sauvegarder'}</button></span></div>
      <textarea className="fx-ta mono comp" value={text == null ? 'Chargement…' : text} disabled={text == null} onChange={(e) => setText(e.target.value)} />
      <p className="fx-s wrap">Les modifications s'appliquent à cette session du navigateur. Si un dossier de secours est choisi (page Agents), le fichier y est aussi mis à jour. Pour qu'elles deviennent permanentes dans Factory, il faut une mise à jour du code.</p>
    </div>
  )
}

const parseImg = (o, def) => (o && o.data ? { b64: o.data, mime: o.mime || def } : null)
// Un brief de test = exactement un brief de production (même contenu que celui envoyé aux agents en vrai).
async function readBrief(file) {
  const brief = JSON.parse(await file.text())
  return { brief, photo: parseImg(brief.photo_produit, 'image/png'), logo: parseImg(brief.logo, 'image/png'), rctx: null, briefName: file.name }
}
async function briefFromCommande(b) {
  const brief = commandeToBrief(b)
  const photo = await commandePhoto(b)
  let rctx = null
  const pid = (b.product || {}).id
  if (pid) { try { rctx = await (await fetch(`${SERVER}/products/${pid}/renewal-context`, { headers: { 'ngrok-skip-browser-warning': '1' } })).json() } catch (_) {} }
  const syn = b.deliverables && b.deliverables.synthesis ? b.deliverables.synthesis : ''
  return { brief, photo, logo: null, rctx, briefName: `Commande · ${brief.produit || '?'}${brief.marque ? ' · ' + brief.marque : ''}${rctx && rctx.estRenouvellement ? ' (renouvellement)' : ''}`, syn }
}
// Les agents de production lisent un état partagé : on le prête le temps du test, puis on le rend tel quel.
async function withProd(patch, fn) {
  if (prodv2State.ui.running) throw new Error('Une production est en cours : attends sa fin avant de tester un agent.')
  const old = {}; Object.keys(patch).forEach((k) => { old[k] = prodv2State[k] })
  Object.assign(prodv2State, patch)
  try { return await fn() } finally { Object.assign(prodv2State, old) }
}
const NIVEAUX = [['Solution Aware', 'Solution Aware (1re du lot)'], ['Product Aware', 'Product Aware (2e)'], ['Most Aware', 'Most Aware (3e)']]

function BriefSource({ m, set }) {
  const ref = useRef(null)
  const [list, setList] = useState(null), [busy, setBusy] = useState(false)
  const onFile = async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return
    try { const r = await readBrief(f); set({ ...r, output: '', marche: '', outErr: false }) } catch (err) { alertDlg('JSON invalide : ' + err.message) }
  }
  const openList = async () => { setBusy(true); try { setList(await getCommandes()) } catch (e) { alertDlg('Commandes : ' + e.message) } finally { setBusy(false) } }
  const pick = async (id) => {
    const b = list.find((x) => String(x.id) === id); if (!b) return
    setBusy(true)
    try { const r = await briefFromCommande(b); set({ ...r, synthese: m.synthese || r.syn || '', output: '', marche: '', outErr: false }); setList(null) } catch (e) { alertDlg(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="fx-fld"><Lab>BRIEF CLIENT</Lab>
      <input ref={ref} type="file" accept="application/json" hidden onChange={onFile} />
      <div className="fx-btnrow">
        <button className="fx-btn" onClick={() => ref.current.click()}>Charger un brief.json</button>
        <button className="fx-btn" disabled={busy} onClick={openList}>{busy ? '…' : 'Prendre une commande'}</button>
      </div>
      {list && <select className="fx-in" defaultValue="" onChange={(e) => pick(e.target.value)}>
        <option value="" disabled>{list.length ? 'Choisis une commande…' : 'Aucune commande'}</option>
        {list.map((b) => <option key={b.id} value={b.id}>{(b.product || {}).nom || 'Produit'} · {(b.product || {}).marque || ''} · {b.quantity || 6} créatives · {b.status}</option>)}
      </select>}
      <div className="fx-s">{m.briefName ? m.briefName + (m.photo ? ' · photo produit chargée' : ' · ⚠ pas de photo produit') : 'Aucun brief chargé'}</div>
      {m.photo && <img className="fx-minithumb" src={`data:${m.photo.mime};base64,${m.photo.b64}`} alt="" />}
    </div>
  )
}

function CTPicker({ selected, onSelect }) {
  const [list, setList] = useState(null)
  const nav = useNavigate()
  useEffect(() => { ctGetAll().then((l) => { l.forEach((r) => { CT_IMAGES[r.id] = r.url; CT_IMAGES[r.id + '_mime'] = r.mime; CT_IMAGES[r.id + '_name'] = r.name }); setList(l.slice(0, 18)) }).catch(() => setList([])) }, [])
  return (
    <div>
      <div className="fx-lab-row"><Lab>18 CT RÉCENTS</Lab><button className="fx-link-btn" onClick={() => nav('/galerie')}>Gérer la galerie</button></div>
      {list === null ? <div className="fx-s">Chargement…</div> : !list.length ? <div className="fx-s">Galerie vide — <button className="fx-link-btn" onClick={() => nav('/galerie')}>ajouter des CT →</button></div> : (
        <div className="fx-ctpick">{list.map((r) => (
          <button key={r.id} type="button" className={'fx-ctp' + (selected === r.id ? ' on' : '')} title={[r.name, r.meta, r.awareness.length ? 'Conscience : ' + r.awareness.join('/') : ''].filter(Boolean).join('\n')} onClick={() => onSelect(r.id)}>
            <img src={r.url} alt="" loading="lazy" /><span>{r.name}</span></button>))}</div>)}
      <div className="fx-s" style={{ marginTop: 6 }}>{selected ? 'CT sélectionné : ' + (CT_IMAGES[selected + '_name'] || selected) : 'Aucun CT sélectionné'}</div>
    </div>
  )
}

function Output({ text, color }) {
  const cp = () => navigator.clipboard.writeText(text).then(() => toast('Copié'))
  return <div className="fx-out" style={color ? { color } : null}><button className="fx-btn sm copy" onClick={cp}>Copier</button><pre>{text}</pre></div>
}

function StdTest({ a }) {
  const [m, set] = useAgentMem(a.slug, { brief: null, briefName: '', photo: null, logo: null, rctx: null, synthese: '', nb: 0, angle: 0, pos: 0, ct: null, output: '', marche: '', outErr: false, images: [] })
  const [busy, setBusy] = useState(false), [sec, setSec] = useState(0)
  const isImg = a.kind === 'image', isAn = a.kind === 'analyst', isCopy = a.kind === 'copy'
  useEffect(() => { loadSkills(); loadCTImages() }, [])
  const angles = useMemo(() => (m.synthese.trim() ? V.prodv2ExtractAngles(m.synthese, 0) : []), [m.synthese])
  const nbProd = m.brief ? Math.max(2, Math.min(12, Math.round((Number(m.brief.quantite) || 6) / 3))) : 2
  const nbAngles = m.nb || nbProd
  const run = async () => {
    if (isAn && !m.brief) return alertDlg('Charge un brief.json ou prends une commande.')
    if (isAn && !m.photo) return alertDlg('Ce brief n’a pas de photo produit : l’Analyste en a besoin.')
    if (isCopy && !m.synthese.trim()) return alertDlg('Colle la Synthèse (ou prends une commande déjà analysée).')
    if (isImg) {
      if (!m.ct || !CT_IMAGES[m.ct]) return alertDlg('Sélectionne un CT dans la galerie.')
      if (!m.photo || !m.brief) return alertDlg('Charge un brief.json ou prends une commande (photo produit nécessaire).')
      if (!m.synthese.trim()) return alertDlg("Colle la Synthèse produite par l'Analyste de Marché.")
    }
    setBusy(true); setSec(0); const t0 = Date.now(); const iv = setInterval(() => setSec(Math.round((Date.now() - t0) / 1000)), 1000)
    set({ output: isImg ? 'Gemini 2.5 Pro raisonne et écrit le prompt → Gemini 3 Pro Image rend la créative…' : '', marche: '', outErr: false })
    try {
      await loadSkills()
      if (isAn) {
        // Entrée IDENTIQUE à celle de la production (date, nombre d'angles, URL, renouvellement, photos, logo, aspects…)
        const raw = await withProd({ brief: m.brief, productB64: m.photo.b64, productMime: m.photo.mime || 'image/png', logoB64: m.logo ? m.logo.b64 : null, logoMime: m.logo ? m.logo.mime : null, renewalContext: m.rctx }, async () => {
          const { analysteSystem, analysteParts } = await V.buildAnalysteInputs(nbAngles, nbAngles * 3)
          return V.apiAnalysteSynthese(analysteSystem, analysteParts, 64000, m.brief, undefined, true)
        })
        const { synthesisText, marche } = V.prodv2SplitSynthesisAndMarche(raw)
        set({ output: synthesisText, marche: marche ? JSON.stringify(marche, null, 2) : '', synthese: synthesisText })
      } else if (isImg) {
        const ctB64 = await V.compressImg(await ctGetBase64(m.ct), CT_IMAGES[m.ct + '_mime'] || 'image/jpeg')
        const productB64 = await V.compressImg(m.photo.b64, m.photo.mime || 'image/jpeg')
        const nbA = Math.max(angles.length, 2), ai = Math.min(m.angle, nbA - 1)
        // Consigne IDENTIQUE à la production : angle imposé + niveau de conscience selon la position dans l'angle
        const { creativeSystem, angleInstruction } = await withProd({ brief: m.brief, angles: angles.length ? angles : ['Angle 1', 'Angle 2'] }, async () => V.buildCreativeInstruction(ai, m.pos))
        const res = await fetch(SERVER + '/creative-prod', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ systemPrompt: creativeSystem, synthese: m.synthese, brief: m.brief, angleInstruction, ctBase64: ctB64, ctMime: 'image/jpeg', productBase64: productB64, productMime: 'image/jpeg', isTest: true }) })
        const d = await res.json(); if (d.error) throw new Error(d.error)
        if (d.imageData) set((p) => ({ output: `✓ Générée — angle ${ai + 1} · ${NIVEAUX[m.pos][0]} · angle choisi par l'agent : ${d.chosenAngle || 'n/a'}`, images: [...p.images, { src: `data:${d.imageMime};base64,${d.imageData}`, ct: CT_IMAGES[m.ct + '_name'] || m.ct, angle: d.chosenAngle, prompt: d.prompt, ts: Date.now() }] }))
        else set({ output: 'Aucune image reçue.', outErr: true })
      } else {
        // Un angle à la fois, comme la production (même consigne, même lecture 5 hooks + description)
        const ai = Math.min(m.angle, Math.max(angles.length, 1) - 1)
        const { hooks, description } = await withProd({ synthesis: m.synthese, angles: angles.length ? angles : ['Angle 1'], brief: m.brief || {} }, () => V.prodv2GenerateOneCopyAttempt(ai))
        set({ output: `ANGLE ${ai + 1} — ${angles[ai] || ''}\n\n` + hooks.map((h, i) => `HOOK ${i + 1} : ${h}`).join('\n\n') + '\n\nDESCRIPTION :\n' + description })
      }
    } catch (err) { set({ output: 'ERREUR : ' + err.message, outErr: true }) }
    finally { clearInterval(iv); setSec(Math.round((Date.now() - t0) / 1000)); setBusy(false) }
  }
  const dl = (img) => { const x = document.createElement('a'); x.href = img.src; x.download = 'adstack_' + img.ct + '_' + img.ts + '.png'; x.click() }
  const AngleSeg = () => angles.length ? <Seg value={m.angle} onChange={(v) => set({ angle: v })} options={angles.map((t, i) => [i, 'Angle ' + (i + 1)])} /> : <div className="fx-s">Colle une synthèse : les angles seront détectés automatiquement.</div>
  return (
    <div className="fx-test">
      {(isAn || isImg || isCopy) && <BriefSource m={m} set={set} />}
      {isAn && <div className="fx-fld"><Lab>NOMBRE D'ANGLES (comme la commande : 3 créatives par angle)</Lab>
        <Seg value={m.nb} onChange={(v) => set({ nb: v })} options={[[0, 'Selon le brief (' + nbProd + ')'], [2, '2'], [4, '4'], [6, '6'], [8, '8']]} />
        <div className="fx-s">{m.rctx && m.rctx.estRenouvellement ? 'Renouvellement détecté : le contexte (angle gagnant, cible actuelle, synthèse existante) est transmis comme en production.' : 'Entrée construite comme en production : date du jour, nombre d’angles, lien page produit, photos et aspects, logo.'}</div></div>}
      {(isImg || isCopy) && <div className="fx-fld"><Lab>SYNTHÈSE (de l'Analyste de Marché)</Lab><textarea className="fx-ta" rows={7} value={m.synthese} onChange={(e) => set({ synthese: e.target.value, angle: 0 })} placeholder="Colle ici la synthèse complète, ou prends une commande déjà livrée, ou teste l'Analyste d'abord…" /></div>}
      {(isImg || isCopy) && <div className="fx-fld"><Lab>ANGLE À PRODUIRE</Lab><AngleSeg />{angles[m.angle] && <div className="fx-s">{angles[m.angle]}</div>}</div>}
      {isImg && <div className="fx-fld"><Lab>NIVEAU DE CONSCIENCE (position de la créative dans l'angle)</Lab><Seg value={m.pos} onChange={(v) => set({ pos: v })} options={NIVEAUX.map(([, l], i) => [i, l])} /><div className="fx-s">En production, une créative par niveau pour chaque angle ; ici tu en testes une.</div></div>}
      {isImg && <div className="fx-fld"><CTPicker selected={m.ct} onSelect={(id) => set({ ct: id })} /></div>}
      <div className="fx-launch"><button className="fx-btn primary big" disabled={busy} onClick={run}>{busy ? 'Génération…' : 'Tester cet agent'}</button><span className="fx-s">{busy || sec ? sec + 's' : ''}</span></div>
      {m.output && <Output text={m.output} color={m.outErr ? 'var(--er)' : null} />}
      {isAn && m.marche && <div className="fx-fld"><Lab>DONNÉES MARCHÉ (JSON livré au client)</Lab><Output text={m.marche} /></div>}
      {m.images.length > 0 && <div className="fx-imgs">{m.images.map((img, i) => (
        <div className="fx-imgc" key={img.ts}><img src={img.src} alt="" />
          <div className="fx-imgc-a"><button className="fx-btn sm" onClick={() => dl(img)}>Télécharger</button><button className="fx-btn sm danger-o" onClick={() => set((p) => ({ images: p.images.filter((_, j) => j !== i) }))}>✕</button></div>
          <div className="fx-s">{img.ct} · {new Date(img.ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div></div>))}</div>}
    </div>
  )
}

export default function AgentTest() {
  const { slug } = useParams()
  const a = AGENTS.find((x) => x.slug === slug)
  const [tab, setTab] = useState('test')
  if (!a) return <Navigate to="/agents" replace />
  return (
    <div className="fx-wrap">
      <div className="fx-h"><div className="fx-agh"><span className="fx-badge-n lg" style={{ background: a.color + '28', color: a.color }}>{a.n}</span><div><h1>{a.name}</h1><p>{a.sub}</p></div></div><span className="fx-tag prod">En cours</span></div>
      <div className="fx-tabs"><button className={'fx-tab' + (tab === 'test' ? ' on' : '')} onClick={() => setTab('test')}>Tester</button>
        <button className={'fx-tab' + (tab === 'comp' ? ' on' : '')} onClick={() => setTab('comp')}>Compétence</button></div>
      <div className="fx-card">
        {tab === 'comp' ? (a.kind === 'video' ? <VideoPanel key="comp" competenceOnly /> : <Competence a={a} />) : a.kind === 'video' ? <VideoPanel key="test" /> : <StdTest a={a} key={a.slug} />}
      </div>
    </div>
  )
}
