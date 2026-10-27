import { COMP_FILES, loadSkills } from '../prod/state'
import React, { useEffect, useRef, useState } from 'react'
import { vctGetAll, vctGetTexte } from '../vctApi'
import { labFetch, labQuery, labUrl, labKey, saveLabUrl, saveLabKey } from '../lab'
import { useAgentMem } from '../agentStore'

const readFile = (f) => new Promise((r) => { const x = new FileReader(); x.onload = () => r({ data: String(x.result).split(',')[1], mime: f.type || 'image/jpeg' }); x.readAsDataURL(f) })
async function urlToB64(url) {
  const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status)
  const b = await r.blob()
  return new Promise((res) => { const x = new FileReader(); x.onload = () => res({ data: String(x.result).split(',')[1], mime: b.type || 'image/jpeg' }); x.readAsDataURL(b) })
}

export default function VideoPanel({ competenceOnly }) {
  const [m, set] = useAgentMem('creative-video', { ctId: '', syn: '', brief: null, briefInfo: '', model: 'auto', ref: 'complet', planOnly: false })
  const [url, setUrl] = useState(labUrl()), [key, setKey] = useState(labKey())
  const [ping, setPing] = useState({ s: 'wait', t: 'Service vidéo : vérification…' }), [models, setModels] = useState([])
  const [cts, setCts] = useState(null), [comp, setComp] = useState('Chargement…')
  const [photo, setPhoto] = useState(null), [aspects, setAspects] = useState([])
  const [run, setRun] = useState({ pid: null, busy: false, status: null, error: '', t0: 0, sec: 0 }), [histMsg, setHistMsg] = useState('')
  const timer = useRef(null)

  const doPing = async () => {
    try {
      const r = await labFetch('/models', { cache: 'no-store' })
      if (r.status === 401) { setPing({ s: 'warn', t: "Service vidéo joignable, mais la clé d'accès est absente ou fausse : saisis-la ci-contre." }); return false }
      if (!r.ok) throw new Error('HTTP ' + r.status)
      const mm = await r.json(); setModels(mm && typeof mm === 'object' ? Object.keys(mm) : [])
      setPing({ s: 'ok', t: `Service vidéo connecté (${labUrl()})` }); return true
    } catch (_) { setPing({ s: 'ko', t: `Service vidéo injoignable (${labUrl()}) : en local, lance « node lab_server.js » ; en ligne, vérifie l'adresse. Puis clique Tester.` }); return false }
  }
  useEffect(() => {
    doPing()
    if (competenceOnly) { const secours = async (why) => { await loadSkills(); setComp((COMP_FILES['COMPETENCE_CREATIVE_VIDEO.md'] || '') + '\n\n— ' + why) }; labFetch('/competence').then(async (r) => r.ok ? setComp(await r.text()) : secours('Version du dépôt (service vidéo : HTTP ' + r.status + ').')).catch(() => secours('Version du dépôt (service vidéo non lancé).')) }
    else vctGetAll().then((l) => { setCts(l); if (!m.ctId && l[0]) set({ ctId: l[0].id }) }).catch((e) => setCts({ error: e.message }))
    return () => clearInterval(timer.current)
  }, [])

  if (competenceOnly) return <div className="fx-comp"><textarea className="fx-ta mono comp" readOnly value={comp} /><p className="fx-s wrap">Compétence lue depuis le service vidéo (lecture seule).</p></div>

  const ct = Array.isArray(cts) ? cts.find((x) => x.id === m.ctId) : null
  const photosBrief = (() => { const b = m.brief || {}; const l = (b.product && b.product.photos_produit) || b.photos_produit || []; return Array.isArray(l) ? l.filter((x) => x && x.url && !x.exclue) : [] })()
  const onBrief = async (e) => { const f = e.target.files[0]; if (!f) return; try { const j = JSON.parse(await f.text()); set({ brief: j, briefInfo: 'brief chargé (' + (j.marque || j.produit || (j.product && j.product.nom) || f.name) + ')' }) } catch (_) { set({ brief: null, briefInfo: 'JSON illisible' }) } }

  const poll = async (pid, t0) => {
    setRun((r) => ({ ...r, sec: Math.round((Date.now() - t0) / 1000) }))
    try {
      const s = await (await labFetch('/pipe/' + pid, { cache: 'no-store' })).json()
      const finished = s.state && s.state !== 'running'
      if (finished) clearInterval(timer.current)
      setRun((r) => ({ ...r, status: s, busy: !finished, error: finished && s.error ? s.error : '', softError: '' }))
    } catch (e) { setRun((r) => ({ ...r, softError: `Le service ne répond plus (${e.message}). La production continue de son côté ; nouvel essai dans 4 s.` })) }
  }
  const start = async () => {
    const fail = (t) => setRun((r) => ({ ...r, error: t, busy: false, status: null }))
    const manque = [!m.syn.trim() && 'la synthèse', !m.ctId && 'le CT vidéo', !photo && !photosBrief.length && 'la photo produit (ou un brief qui en contient)'].filter(Boolean)
    if (manque.length) return fail('Il manque : ' + manque.join(', ') + '.')
    if (!(await doPing())) return fail("Le service vidéo n'est pas joignable. Lance-le (ou vérifie son adresse), puis réessaie.")
    setRun({ pid: null, busy: true, status: { stage: 'Préparation des entrées…' }, error: '', t0: Date.now(), sec: 0 }); setHistMsg('')
    try {
      const texte = await vctGetTexte(m.ctId)
      let produit, asp = []
      if (photo) { produit = await readFile(photo); asp = await Promise.all(aspects.slice(0, 5).map(readFile)) }
      else {
        const face = photosBrief.find((x) => x.aspect === 'face') || photosBrief[0]
        produit = await urlToB64(face.url)
        asp = (await Promise.all(photosBrief.filter((x) => x !== face).slice(0, 5).map((x) => urlToB64(x.url).catch(() => null)))).filter(Boolean)
      }
      const b = m.brief || {}
      const body = { ct: texte, synthese: m.syn, produit, aspects: asp, brief: b, model: m.model, planOnly: m.planOnly, refMode: m.ref, lien_page_produit: b.lien_page_produit || (b.product && (b.product.lien_page_produit || b.product.url)) || '' }
      const r = await labFetch('/pipeline', { method: 'POST', body: JSON.stringify(body) })
      const j = await r.json()
      if (!j.id) throw new Error(j.error || "le service n'a pas démarré la production")
      const t0 = Date.now(); setRun({ pid: j.id, busy: true, status: { stage: 'Démarrage…' }, error: '', t0, sec: 0 })
      clearInterval(timer.current); timer.current = setInterval(() => poll(j.id, t0), 4000); poll(j.id, t0)
    } catch (e) { fail('Échec au démarrage : ' + e.message) }
  }
  const download = async (avecImages) => {
    setHistMsg('Préparation du fichier…')
    try {
      const r = await labFetch('/pipe/' + run.pid + '/historique' + (avecImages ? '' : '?images=0'))
      if (!r.ok) throw new Error('HTTP ' + r.status)
      const blob = await r.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'historique_video_' + run.pid + (avecImages ? '' : '_texte') + '.json'
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 2000)
      setHistMsg(`Téléchargé (${Math.round(blob.size / 1024)} Ko). Envoie-moi ce fichier.`)
    } catch (e) { setHistMsg('Échec : ' + e.message) }
  }
  const s = run.status || {}, dernier = (s.log || []).slice(-1)[0] || ''
  const vUrl = s.montage ? (s.video_url ? s.video_url : labQuery('/video/' + s.montage)) : null
  const vDl = s.montage ? (s.video_url ? s.video_url + '?download=' + encodeURIComponent(s.montage) : labQuery('/video/' + s.montage, 'dl=1')) : null
  const finished = s.state && s.state !== 'running'
  return (
    <div className="fx-test">
      <div className="fx-labbar">
        <span className={'fx-dot ' + ({ ok: 'ok', ko: 'er', warn: 'wa' }[ping.s] || '')} /><span className="fx-s wrap" style={{ flex: '1 1 260px' }}>{ping.t}</span>
        <input className="fx-in sm" value={url} onChange={(e) => setUrl(e.target.value)} onBlur={() => { saveLabUrl(url); doPing() }} title="Adresse du service vidéo : http://localhost:8787 en local, ou l'adresse du service en ligne" />
        <input className="fx-in sm" type="password" autoComplete="off" placeholder="Clé d'accès (service en ligne)" value={key} onChange={(e) => setKey(e.target.value)} onBlur={() => { saveLabKey(key); doPing() }} />
        <button className="fx-btn sm" onClick={doPing}>Tester</button>
      </div>
      <div className="fx-fld"><div className="fx-lab up">CT VIDÉO</div>
        <select className="fx-in full" value={m.ctId} onChange={(e) => set({ ctId: e.target.value })}>
          {cts === null ? <option>Chargement de la galerie…</option> : !Array.isArray(cts) ? <option>Galerie illisible : {cts.error}</option> : !cts.length ? <option value="">Galerie CT vidéo vide : ajoutes-en dans « Galerie CT vidéo »</option> : cts.map((r) => <option key={r.id} value={r.id}>{r.name}{r.awareness.length ? '  ·  ' + r.awareness.join(', ') : ''}</option>)}
        </select>
        {ct && <div className="fx-hint">{ct.meta || '(pas de méta-description)'}</div>}</div>
      <div className="fx-fld"><div className="fx-lab up">SYNTHÈSE DE L'ANALYSTE</div><textarea className="fx-ta" rows={6} value={m.syn} onChange={(e) => set({ syn: e.target.value })} placeholder="Colle ici la synthèse complète produite par l'Analyste de Marché…" /></div>
      <div className="fx-two">
        <div className="fx-fld"><div className="fx-lab up">PHOTO PRODUIT</div><input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files[0] || null)} /></div>
        <div className="fx-fld"><div className="fx-lab up">AUTRES ASPECTS (facultatif, 5 max)</div><input type="file" accept="image/*" multiple onChange={(e) => setAspects(Array.from(e.target.files))} /></div>
      </div>
      <div className="fx-fld"><div className="fx-lab up">BRIEF CLIENT (JSON, facultatif : complète la photo, les aspects et le lien)</div><input type="file" accept="application/json" onChange={onBrief} /> <span className="fx-s">{m.briefInfo}</span></div>
      <details className="fx-det"><summary>Réglages</summary>
        <div className="fx-opts">
          <label>Modèle vidéo <select className="fx-in sm" value={m.model} onChange={(e) => set({ model: e.target.value })}><option value="auto">Automatique</option>{models.map((k) => <option key={k} value={k}>{k}</option>)}</select></label>
          <label>Références <select className="fx-in sm" value={m.ref} onChange={(e) => set({ ref: e.target.value })}><option value="complet">Complet (le plus fidèle)</option><option value="produit">Photo produit seule</option><option value="aucune">Aucune</option></select></label>
          <label className="chk"><input type="checkbox" checked={m.planOnly} onChange={(e) => set({ planOnly: e.target.checked })} /> Plan seulement (sans vidéo, presque gratuit)</label>
        </div></details>
      <div className="fx-launch"><button className="fx-btn primary big" disabled={run.busy} onClick={start}>Générer la vidéo</button><span className="fx-s">{run.busy ? run.sec + ' s' : ''}</span></div>
      {run.error && !run.status && <div className="fx-err">{run.error}</div>}
      {run.status && <div className="fx-vprog"><div><b>Étape :</b> {s.stage || '…'}</div>
        {dernier && <div className="fx-s wrap">{String(dernier).slice(0, 220)}</div>}
        {s.cost != null && typeof s.cost !== 'object' && <div className="fx-s">Coût estimé : {s.cost} $</div>}
        {run.softError && <div className="fx-s" style={{ color: 'var(--wa)' }}>{run.softError}</div>}
        {finished && run.error && <div style={{ color: 'var(--er)', marginTop: 6 }}>Erreur : {run.error}</div>}
        {finished && !run.error && !s.montage && <div className="fx-s wrap" style={{ marginTop: 6 }}>Terminé sans vidéo montée{m.planOnly ? ' (mode « plan seulement »)' : ''}. Télécharge l'historique pour voir le détail.</div>}</div>}
      {vUrl && <div className="fx-vres"><video src={vUrl} controls playsInline /><div><a className="fx-btn primary" href={vDl} download={s.montage}>Télécharger la vidéo</a></div></div>}
      {finished && <div className="fx-hist"><div className="fx-s wrap">Journaux, planches, images refaites, coûts : tout est enregistré. Télécharge l'historique et envoie-le moi pour corriger.</div>
        <div className="fx-acts"><button className="fx-btn" onClick={() => download(true)}>Historique complet (avec images)</button><button className="fx-btn" onClick={() => download(false)}>Texte seul (léger)</button><span className="fx-s">{histMsg}</span></div></div>}
    </div>
  )
}
