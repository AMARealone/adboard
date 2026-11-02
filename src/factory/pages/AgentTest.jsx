import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { AGENTS } from './Agents'
import { useAgentMem, usePersist, useTick, setLive, isLive, memoriserSynthese, syntheseMemorisee, heureCourte } from '../agentStore'
import { COMP_FILES, SERVER, CT_IMAGES, loadSkills } from '../prod/state'
import * as V from '../prod/verbatim'
import { commandeToBrief, commandePhoto } from '../prod/engine'
import { prodv2State } from '../prod/state'
import { getCommandes } from '../api'
import { ctGetAll, ctGetBase64, loadCTImages, ctGalerieComplete, NIVEAUX_CLE } from '../ctApi'
import VideoPanel from './VideoPanel'
import { alertDlg, confirmDlg, toast } from '../ui'
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
  return { brief, photo: parseImg(brief.photo_produit, 'image/png'), logo: parseImg(brief.logo, 'image/png'), rctx: null, cles: [], briefName: file.name }
}
async function briefFromCommande(b) {
  const brief = commandeToBrief(b)
  const photo = await commandePhoto(b)
  let rctx = null
  const pid = (b.product || {}).id
  if (pid) { try { rctx = await (await fetch(`${SERVER}/products/${pid}/renewal-context`, { headers: { 'ngrok-skip-browser-warning': '1' } })).json() } catch (_) {} }
  // La synthèse vient avec la commande : celle de la commande, sinon la dernière hypothèse stockée pour ce produit.
  const synCmd = b.deliverables && b.deliverables.synthesis ? b.deliverables.synthesis : ''
  const synProd = rctx && rctx.syntheseExistante ? rctx.syntheseExistante : ''
  const cles = [pid && 'p' + pid, b.id != null && 'c' + b.id].filter(Boolean)
  const synTest = syntheseMemorisee(cles)   // v5.74 : l'hypothèse que tu viens de générer dans le test Analyste
  const syn = synTest ? synTest.texte : (synCmd || synProd)
  const synSrc = synTest ? ' · synthèse du dernier test Analyste reprise (' + heureCourte(synTest.t) + ')' : synCmd ? ' · synthèse de la commande reprise' : synProd ? ' · dernière synthèse du produit reprise' : ' · ⚠ aucune synthèse pour cette commande'
  return { brief, photo, logo: null, rctx, cles, briefName: `Commande · ${brief.produit || '?'}${brief.marque ? ' · ' + brief.marque : ''}${rctx && rctx.estRenouvellement ? ' (renouvellement)' : ''}${synSrc}`, syn }
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
    try { const r = await briefFromCommande(b); set({ ...r, synthese: r.syn || m.synthese || '', output: '', marche: '', outErr: false }); setList(null) } catch (e) { alertDlg(e.message) } finally { setBusy(false) }
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

// Le CT n'est plus choisi à la main : l'agent le choisit lui-même parmi toute la galerie (aperçu du choix + son raisonnement).
function CTAuto({ m }) {
  const [n, setN] = useState(null), nav = useNavigate()
  useEffect(() => { ctGetAll().then((l) => setN(l.length)).catch(() => setN(0)) }, [])
  return (
    <div className="fx-fld"><div className="fx-lab-row"><Lab>CT : CHOISI AUTOMATIQUEMENT PAR L'AGENT</Lab><button className="fx-link-btn" onClick={() => nav('/galerie')}>Gérer la galerie</button></div>
      <div className="fx-s">{n === null ? 'Chargement…' : n === 0 ? 'Galerie vide : ajoutez des CT avant de tester.' : 'L\'agent reçoit toute la galerie (' + n + ' CT : image, nom, description, balises) avec le brief, la synthèse et la consigne d\'angle, puis choisit un seul CT.'}</div>
      {m.ct && CT_IMAGES[m.ct] && <div className="fx-ctchoice"><img className="fx-minithumb" src={CT_IMAGES[m.ct]} alt="" /><div><b>{CT_IMAGES[m.ct + '_name'] || m.ct}</b>{m.ctRaison && <div className="fx-s wrap">{m.ctRaison}</div>}</div></div>}
    </div>
  )
}

function Output({ text, color }) {
  const cp = () => navigator.clipboard.writeText(text).then(() => toast('Copié'))
  return <div className="fx-out" style={color ? { color } : null}><button className="fx-btn sm copy" onClick={cp}>Copier</button><pre>{text}</pre></div>
}

const RUNS = {}   // slug -> { cancelled, ac } : permet d'annuler la génération en cours de cet agent
function StdTest({ a }) {
  const [m, set] = useAgentMem(a.slug, { brief: null, briefName: '', photo: null, logo: null, rctx: null, synthese: '', nb: 0, angle: 0, pos: 0, ct: null, ctRaison: '', output: '', marche: '', outErr: false, images: [], busy: false, t0: 0, dur: 0, prog: '', err: '' })
  const busy = !!m.busy, secLive = useTick(m.t0, busy), sec = busy ? secLive : (m.dur || 0)
  const isImg = a.kind === 'image', isAn = a.kind === 'analyst', isCopy = a.kind === 'copy'
  useEffect(() => { loadSkills(); loadCTImages() }, [])
  // Page rechargée pendant une génération : elle n'existe plus, on le dit sans rien effacer de ce qui est rempli.
  useEffect(() => { if (m.busy && !isLive(a.slug)) set({ busy: false, prog: '', err: 'La page a été rechargée pendant la génération : elle a été interrompue. Tout ce que tu avais rempli est conservé, relance simplement.' }) }, [])
  const angles = useMemo(() => (m.synthese.trim() ? V.prodv2ExtractAngles(m.synthese, 0) : []), [m.synthese])
  const nbProd = m.brief ? Math.max(2, Math.min(12, Math.round((Number(m.brief.quantite) || 6) / 3))) : 2
  const nbAngles = m.nb || nbProd
  const run = async () => {
    if (isLive(a.slug)) return   // v5.74 : une génération de cet agent tourne déjà (double clic, double lancement : ~1 $ chaque fois)
    if (isAn && !m.brief) return alertDlg('Charge un brief.json ou prends une commande.')
    if (isAn && !m.photo) return alertDlg('Ce brief n’a pas de photo produit : l’Analyste en a besoin.')
    if (isCopy && !m.synthese.trim()) return alertDlg('Colle la Synthèse (ou prends une commande déjà analysée).')
    if (isImg) {
      if (!m.photo || !m.brief) return alertDlg('Charge un brief.json ou prends une commande (photo produit nécessaire).')
      if (!m.synthese.trim()) return alertDlg("Colle la Synthèse produite par l'Analyste de Marché.")
    }
    const my = (RUNS[a.slug] = { cancelled: false, ac: new AbortController() }); const S = (x) => { if (!my.cancelled) set(x) }
    const t0 = Date.now(); setLive(a.slug, true)
    set({ busy: true, t0, dur: 0, err: '', prog: isImg ? 'Préparation…' : 'Génération en cours…' })
    try {
      await loadSkills()
      if (isAn) {
        // Entrée IDENTIQUE à celle de la production (date, nombre d'angles, URL, renouvellement, photos, logo, aspects…)
        const raw = await withProd({ brief: m.brief, productB64: m.photo.b64, productMime: m.photo.mime || 'image/png', logoB64: m.logo ? m.logo.b64 : null, logoMime: m.logo ? m.logo.mime : null, renewalContext: m.rctx }, async () => {
          const { analysteSystem, analysteParts } = await V.buildAnalysteInputs(nbAngles, nbAngles * 3)
          return V.apiAnalysteSynthese(analysteSystem, analysteParts, 64000, m.brief, undefined, true)
        })
        const { synthesisText, marche } = V.prodv2SplitSynthesisAndMarche(raw)
        S({ output: synthesisText, outErr: false, marche: marche ? JSON.stringify(marche, null, 2) : '', synthese: synthesisText, bal: V.dernierBalayage() })
        memoriserSynthese(m.cles, synthesisText, m.briefName)   // v5.74 : reprise automatique par les tests Image / Copywriter / Vidéo (même commande)
      } else if (isImg) {
        const productB64 = await V.compressImg(m.photo.b64, m.photo.mime || 'image/jpeg')
        const nbA = Math.max(angles.length, 2), ai = Math.min(m.angle, nbA - 1)
        // Consigne IDENTIQUE à la production : angle imposé + niveau de conscience selon la position dans l'angle
        const { creativeSystem, angleInstruction, briefTexte, assets } = await withProd({ brief: m.brief, angles: angles.length ? angles : ['Angle 1', 'Angle 2'] }, async () => ({ ...V.buildCreativeInstruction(ai, m.pos), briefTexte: V.prodv2BriefTextOnly(), assets: V.prodv2AssetsText() }))
        // ── Étape 1 : l'agent regarde TOUTE la galerie et choisit lui-même UN CT (aucune sélection manuelle) ──
        await loadCTImages()
        // Le niveau de conscience de la créative RESTREINT la galerie : Most Aware → seulement les CT balisés Most Aware, etc.
        const gal = await ctGalerieComplete((n, t) => S({ prog: `Préparation de la galerie pour l'agent : ${n} / ${t} CT…` }), { niveau: NIVEAUX_CLE[m.pos] })
        if (!gal.cts.length) throw new Error('La galerie CT est vide : ajoute des CT (page Galerie).')
        const libNiv = NIVEAUX[m.pos][0]
        S({ prog: gal.repli
          ? `⚠ Aucun CT de la galerie n'est balisé « ${libNiv} » : l'agent examine ${gal.envoyes} CT et prend la structure la plus proche. Ajoutez ou balisez des CT ${libNiv} dans la galerie.`
          : `Niveau imposé : ${libNiv}. L'agent examine les ${gal.envoyes} CT balisés ${libNiv}${gal.nbBalises > gal.envoyes ? ' (les ' + gal.envoyes + ' plus récents sur ' + gal.nbBalises + ')' : ''} (galerie : ${gal.total} CT) et choisit le meilleur pour cette créative…`, ct: null, ctRaison: '' })
        const rs = await fetch(SERVER + '/select-ct-agent', { signal: my.ac.signal, method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ briefTexte, synthese: m.synthese, angleInstruction, assets, productBase64: productB64, productMime: 'image/jpeg', cts: gal.cts, niveau: NIVEAUX_CLE[m.pos], isTest: true }) })
        const dsTxt = await rs.text(); let ds = null; try { ds = JSON.parse(dsTxt) } catch (_) {}
        if (!ds) throw new Error(rs.status === 404 ? "Choix du CT : le serveur Render n'a pas encore la nouvelle version (route /select-ct-agent introuvable, HTTP 404). Redéployez serveur.js." : 'Choix du CT : réponse inattendue du serveur (HTTP ' + rs.status + ') ' + dsTxt.slice(0, 120))
        if (!rs.ok || ds.error) throw new Error('Choix du CT : ' + (ds.error || 'HTTP ' + rs.status))
        if (!CT_IMAGES[ds.id]) throw new Error('Le CT choisi (' + ds.id + ') est introuvable dans la galerie.')
        S({ ct: ds.id, ctRaison: ds.raison || '', prog: `CT choisi par l'agent : ${CT_IMAGES[ds.id + '_name'] || ds.id}. Gemini 2.5 Pro raisonne et écrit le prompt → Gemini 3 Pro Image rend la créative…` })
        const ctB64 = await V.compressImg(await ctGetBase64(ds.id), CT_IMAGES[ds.id + '_mime'] || 'image/jpeg')
        const res = await fetch(SERVER + '/creative-prod', { signal: my.ac.signal, method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ systemPrompt: creativeSystem, synthese: m.synthese, brief: m.brief, angleInstruction, ctBase64: ctB64, ctMime: 'image/jpeg', productBase64: productB64, productMime: 'image/jpeg', isTest: true }) })
        const d = await res.json(); if (d.error) throw new Error(d.error)
        if (d.imageData) S((p) => ({ outErr: false, output: `✓ Générée — angle ${ai + 1} · ${NIVEAUX[m.pos][0]} · CT choisi par l'agent : ${CT_IMAGES[ds.id + '_name'] || ds.id} · angle choisi par l'agent : ${d.chosenAngle || 'n/a'}`, images: [...p.images, { src: `data:${d.imageMime};base64,${d.imageData}`, ct: CT_IMAGES[ds.id + '_name'] || ds.id, ctRaison: ds.raison, angle: d.chosenAngle, prompt: d.prompt, ts: Date.now() }] }))
        else S({ err: 'Aucune image reçue.' })
      } else {
        // Un angle à la fois, comme la production (même consigne, même lecture 5 hooks + description)
        const ai = Math.min(m.angle, Math.max(angles.length, 1) - 1)
        const { hooks, description } = await withProd({ synthesis: m.synthese, angles: angles.length ? angles : ['Angle 1'], brief: m.brief || {} }, () => V.prodv2GenerateOneCopyAttempt(ai))
        S({ outErr: false, output: `ANGLE ${ai + 1} — ${angles[ai] || ''}\n\n` + hooks.map((h, i) => `HOOK ${i + 1} : ${h}`).join('\n\n') + '\n\nDESCRIPTION :\n' + description })
      }
    } catch (err) { S({ err: err.message }) }
    finally { if (!my.cancelled) { setLive(a.slug, false); set({ busy: false, prog: '', dur: Math.round((Date.now() - t0) / 1000) }) } }
  }
  const annuler = async () => {
    if (!(await confirmDlg("Annuler la génération ? Le navigateur arrête d'attendre et ignore le résultat. Si le serveur avait déjà commencé un appel payant, il peut aller à son terme et être facturé.", { ok: 'Annuler la génération', danger: true }))) return
    const r = RUNS[a.slug]; if (r) { r.cancelled = true; try { r.ac.abort() } catch (_) {} }
    setLive(a.slug, false); set({ busy: false, prog: '', err: 'Génération annulée par toi. Tout ce que tu avais rempli est conservé.', dur: 0 })
  }
  const relancer = async () => {
    if (!(await confirmDlg('Relancer la génération avec les mêmes entrées ? Cela refait un appel complet (coût comme la première fois).', { ok: 'Régénérer' }))) return
    run()
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
      {isImg && <CTAuto m={m} />}
      <div className="fx-launch">{busy ? <button className="fx-btn danger big" onClick={annuler}>Annuler la génération</button> : <button className="fx-btn primary big" onClick={(m.output || (m.images && m.images.length)) ? relancer : run}>{(m.output || (m.images && m.images.length)) ? 'Régénérer' : 'Tester cet agent'}</button>}<span className="fx-s">{busy || sec ? sec + 's' : ''}{!busy && m.dur ? ' · dernière génération' : ''}</span></div>
      {isAn && m.bal && m.bal.scrapecreators && <div className="fx-hint" style={{ marginBottom: 8 }}>Balayage : {m.bal.scrapecreators.requetes} requêtes ScrapeCreators ({m.bal.scrapecreators.credits} crédits) · Reddit {m.bal.scrapecreators.reddit} · TikTok {m.bal.scrapecreators.tiktok_videos} vidéos / {m.bal.scrapecreators.tiktok_commentaires} commentaires · pubs Meta {m.bal.scrapecreators.pubs}{m.bal.scrapecreators.erreurs ? ' · ' + m.bal.scrapecreators.erreurs + ' erreur(s) (voir les logs Render)' : ''}</div>}
      {isAn && m.bal && !m.bal.scrapecreators && <div className="fx-hint" style={{ marginBottom: 8 }}>{m.bal.reutilise ? 'Hypothèse stockée réutilisée' : 'Balayage lancé'} — {m.bal.raison}. Aucune donnée ScrapeCreators reçue : voir les logs Render.</div>}
      {busy && m.prog && <div className="fx-hint" style={{ marginBottom: 8 }}>{m.prog}</div>}
      {m.err && <div className="fx-err" style={{ marginBottom: 8 }}>ERREUR : {m.err} <button className="fx-btn sm" onClick={() => set({ err: '' })}>Fermer</button></div>}
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
  const [tab, setTab] = usePersist('agenttab.' + slug, 'test')
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
