import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { AGENTS } from './Agents'
import { useAgentMem } from '../agentStore'
import { COMP_FILES, SERVER, CT_IMAGES, loadSkills } from '../prod/state'
import { compressImg, apiAnalysteSynthese, apiCopywriter } from '../prod/verbatim'
import { ctGetAll, ctGetBase64, loadCTImages } from '../ctApi'
import VideoPanel from './VideoPanel'
import { alertDlg, toast } from '../ui'

const Lab = ({ children }) => <div className="fx-lab up">{children}</div>
const Seg = ({ value, options, onChange }) => <div className="fx-pills">{options.map(([v, l]) => <button key={v} type="button" className={'fx-pill' + (value === v ? ' on' : '')} onClick={() => onChange(v)}>{l}</button>)}</div>

function Competence({ a }) {
  const [text, setText] = useState(null)
  const [saved, setSaved] = useState(false)
  useEffect(() => { loadSkills().then(() => setText(COMP_FILES[a.file] || '')) }, [a.file])
  const save = () => { COMP_FILES[a.file] = text; setSaved(true); toast('Compétence enregistrée pour cette session'); setTimeout(() => setSaved(false), 1500) }
  const dl = () => { const x = document.createElement('a'); x.href = URL.createObjectURL(new Blob([text || ''], { type: 'text/markdown' })); x.download = a.file; x.click() }
  return (
    <div className="fx-comp">
      <div className="fx-comp-bar"><span className="mono">{a.name.toUpperCase().replace(/ /g, '_')}.md</span>
        <span><button className="fx-btn sm" onClick={dl}>Télécharger</button> <button className="fx-btn sm primary" onClick={save}>{saved ? '✓' : 'Sauvegarder'}</button></span></div>
      <textarea className="fx-ta mono comp" value={text == null ? 'Chargement…' : text} disabled={text == null} onChange={(e) => setText(e.target.value)} />
      <p className="fx-s wrap">Les modifications s'appliquent à cette session du navigateur (comme dans l'ancien Factory) ; télécharge le fichier pour le conserver.</p>
    </div>
  )
}

async function readBrief(file) {
  const brief = JSON.parse(await file.text())
  const out = { marque: brief.marque || '', produit: brief.produit || '', pays: brief.pays || '', lien_page_produit: brief.lien_page_produit || '' }
  const labels = { marque: 'MARQUE', produit: 'PRODUIT', pays: 'PAYS', lien_page_produit: 'LIEN_PAGE_PRODUIT', cible_principale: 'CIBLE_PRINCIPALE', pricing: 'PRICING', offre_promo: 'OFFRE_PROMO', couleurs_marque: 'COULEURS_MARQUE' }
  const lines = ['BRIEF CLIENT (JSON) :', '']
  Object.entries(labels).forEach(([k, label]) => { const v = brief[k]; if (v !== undefined && v !== null && v !== '') lines.push(label + ' : ' + (Array.isArray(v) ? v.join(', ') : v)) })
  lines.push('', 'DONNÉES BRUTES :', '[Sources externes (Gemini/Trends/YouTube/Jumia/CSE) non connectées pour ce test — applique RÈGLE #1/#2/#3 : marque chaque point qui en dépendrait par [NON TROUVÉ DANS DONNÉES BRUTES].]')
  return {
    lastBrief: out, input: lines.join('\n'),
    photo: brief.photo_produit && brief.photo_produit.data ? { b64: brief.photo_produit.data, mime: brief.photo_produit.mime || 'image/png' } : null,
    logo: brief.logo && brief.logo.data ? { b64: brief.logo.data, mime: brief.logo.mime || 'image/png' } : null,
    briefName: file.name + (brief.logo && brief.logo.data ? ' (logo inclus)' : ''),
  }
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
  const [m, set] = useAgentMem(a.slug, { input: '', synthese: '', briefName: '', lastBrief: null, photo: null, logo: null, angle: 'auto', sa: 'auto', sd: 'auto', ct: null, output: '', outErr: false, images: [] })
  const [busy, setBusy] = useState(false), [sec, setSec] = useState(0)
  const briefRef = useRef(null)
  const isImg = a.kind === 'image', isAn = a.kind === 'analyst'
  useEffect(() => { loadSkills(); loadCTImages() }, [])
  const onBrief = async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return
    try { const r = await readBrief(f); set({ ...r, output: '', outErr: false }) } catch (err) { alertDlg('JSON invalide : ' + err.message) }
  }
  const run = async () => {
    if (a.kind === 'analyst' && !m.input.trim()) return alertDlg("Charge le brief.json d'abord.")
    if (a.kind === 'copy' && !m.input.trim()) return alertDlg('Champ vide — colle la Synthèse.')
    if (isImg) {
      if (!m.ct || !CT_IMAGES[m.ct]) return alertDlg('Sélectionne un CT dans la galerie.')
      if (!m.photo) return alertDlg('Charge le brief.json (la photo produit en sera extraite).')
      if (!m.synthese.trim()) return alertDlg("Colle la Synthèse S0→S7 produite par l'Analyste de Marché.")
    }
    setBusy(true); setSec(0); const t0 = Date.now(); const iv = setInterval(() => setSec(Math.round((Date.now() - t0) / 1000)), 1000)
    set({ output: isImg ? 'Gemini 2.5 Pro raisonne et écrit le prompt → Gemini 3 Pro Image rend la créative…' : '', outErr: false })
    try {
      await loadSkills()
      if (isImg) {
        const ctB64 = await compressImg(await ctGetBase64(m.ct), CT_IMAGES[m.ct + '_mime'] || 'image/jpeg')
        const productB64 = await compressImg(m.photo.b64, m.photo.mime || 'image/jpeg')
        const subDesireLabels = { A: 'premier (A)', B: 'deuxième (B)', C: 'troisième (C)' }
        let angleInstruction = ''
        if (m.angle && m.angle !== 'auto') angleInstruction = `\n⛔ ANGLE IMPOSÉ EN TEST : Force l'angle ${m.angle} (ignore la phase de sélection automatique d'angle).`
        if (m.sd && m.sd !== 'auto') {
          const sd = subDesireLabels[m.sd] || m.sd
          angleInstruction += `\n\nROUTAGE MATRICE — TEST MANUEL :\nSUB-DESIRE IMPOSÉ : utilise le ${sd} sub-desire${m.angle && m.angle !== 'auto' ? ` (label ${m.angle}.${m.sd})` : ''} listé dans S2 de la synthèse${m.angle && m.angle !== 'auto' ? `, sous la section Angle ${m.angle}` : ''}.\nLe sub-avatar à utiliser est celui couplé à ce sub-desire dans S2 de la synthèse.`
        }
        if (m.sa && m.sa !== 'auto') angleInstruction += `\n\nSUB-AVATAR IMPOSÉ : utilise le Sub-avatar ${m.sa} de S1 de la synthèse (extrais ses informations complètes : nom court, journée type, psychographie, verbatim douleur, quadrant EPIC).`
        if (angleInstruction) angleInstruction += `\n\n✅ Dans le bloc ===META===, déclare toujours ANGLE CHOISI, NIVEAU DE CONSCIENCE CHOISI, MOTEUR DOMINANT et VARIABLE UNIQUE.`
        const res = await fetch(SERVER + '/creative-prod', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ systemPrompt: COMP_FILES['COMPETENCE_CREATIVE_PROD.md'] || '', synthese: m.synthese, brief: m.lastBrief || {}, angleInstruction, ctBase64: ctB64, ctMime: 'image/jpeg', productBase64: productB64, productMime: 'image/jpeg', isTest: true }) })
        const d = await res.json(); if (d.error) throw new Error(d.error)
        if (d.imageData) set((p) => ({ output: '✓ Générée — angle choisi : ' + (d.chosenAngle || 'n/a'), images: [...p.images, { src: `data:${d.imageMime};base64,${d.imageData}`, ct: CT_IMAGES[m.ct + '_name'] || m.ct, angle: d.chosenAngle, prompt: d.prompt, ts: Date.now() }] }))
        else set({ output: 'Aucune image reçue.', outErr: true })
      } else {
        const system = COMP_FILES[a.file] || ''
        const parts = []
        if (m.photo) parts.push({ inline_data: { mime_type: 'image/jpeg', data: await compressImg(m.photo.b64, m.photo.mime) } })
        if (isAn && m.logo) parts.push({ inline_data: { mime_type: 'image/jpeg', data: await compressImg(m.logo.b64, m.logo.mime) } })
        parts.push({ text: m.input + '\n\n---\n' + (a.prompt || 'Produis le rapport complet.') })
        const result = a.kind === 'copy' ? await apiCopywriter(system, parts, a.maxTokens, undefined, true) : await apiAnalysteSynthese(system, parts, a.maxTokens, m.lastBrief, undefined, true)
        set({ output: result })
      }
    } catch (err) { set({ output: 'ERREUR : ' + err.message, outErr: true }) }
    finally { clearInterval(iv); setSec(Math.round((Date.now() - t0) / 1000)); setBusy(false) }
  }
  const dl = (img) => { const x = document.createElement('a'); x.href = img.src; x.download = 'adstack_' + img.ct + '_' + img.ts + '.png'; x.click() }
  return (
    <div className="fx-test">
      {(isAn || isImg) && <div className="fx-fld"><Lab>BRIEF CLIENT (JSON)</Lab>
        <input ref={briefRef} type="file" accept="application/json" hidden onChange={onBrief} />
        <button className="fx-btn" onClick={() => briefRef.current.click()}>Charger le brief.json</button> <span className="fx-s">{m.briefName}</span>
        {m.photo && <img className="fx-minithumb" src={`data:${m.photo.mime};base64,${m.photo.b64}`} alt="" />}</div>}
      {isImg && <>
        <div className="fx-fld"><Lab>SYNTHÈSE S0→S7 (de l'Analyste de Marché)</Lab><textarea className="fx-ta" rows={7} value={m.synthese} onChange={(e) => set({ synthese: e.target.value })} placeholder="Colle ici la Synthèse complète produite par l'Analyste de Marché..." /></div>
        <div className="fx-fld"><Lab>FORCER UN ANGLE (optionnel — sinon l'agent choisit)</Lab><Seg value={m.angle} onChange={(v) => set({ angle: v })} options={[['auto', 'Auto'], ['1', 'Angle 1'], ['2', 'Angle 2'], ['3', 'Angle 3']]} /></div>
        <div className="fx-fld"><CTPicker selected={m.ct} onSelect={(id) => set({ ct: id })} /></div>
        <div className="fx-fld"><Lab>SUB-AVATAR (optionnel — sinon l'agent choisit depuis S2)</Lab><Seg value={m.sa} onChange={(v) => set({ sa: v })} options={[['auto', 'Auto'], ['1', 'Sub-avatar 1'], ['2', 'Sub-avatar 2'], ['3', 'Sub-avatar 3']]} /></div>
        <div className="fx-fld"><Lab>SUB-DESIRE (position dans l'angle — optionnel)</Lab><Seg value={m.sd} onChange={(v) => set({ sd: v })} options={[['auto', 'Auto'], ['A', 'Position A'], ['B', 'Position B'], ['C', 'Position C']]} /><div className="fx-s">A/B/C = 1er/2ème/3ème sub-desire de l'angle dans la synthèse S2</div></div>
      </>}
      {a.kind === 'copy' && <div className="fx-fld"><Lab>SYNTHÈSE S0→S7</Lab><textarea className="fx-ta" rows={9} value={m.input} onChange={(e) => set({ input: e.target.value })} placeholder="Colle ici la Synthèse complète produite par l'Analyste de Marché..." /></div>}
      {isAn && m.input && <div className="fx-fld"><Lab>ENTRÉE ENVOYÉE À L'AGENT (modifiable)</Lab><textarea className="fx-ta mono" rows={8} value={m.input} onChange={(e) => set({ input: e.target.value })} /></div>}
      <div className="fx-launch"><button className="fx-btn primary big" disabled={busy} onClick={run}>{busy ? 'Génération…' : 'Tester cet agent'}</button><span className="fx-s">{busy || sec ? sec + 's' : ''}</span></div>
      {m.output && <Output text={m.output} color={m.outErr ? 'var(--er)' : null} />}
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
