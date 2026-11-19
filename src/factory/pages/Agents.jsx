import React, { useEffect, useState } from 'react'
import { COMP_FILES, loadSkills } from '../prod/state'
import { labFetch } from '../lab'
import { backupSupported, getBackupDir, pickBackupDir, writeSkills } from '../backup'
import { useNavigate } from 'react-router-dom'
import { SERVER } from '../api'
import { AgentArt } from '../Art'
export const AGENTS = [
  { slug: 'analyst', n: 1, name: 'Analyste de Marché', role: 'Étudie le marché du produit : cible, deux facettes, désirs, freins et prix, puis constitue un stock de 10 angles réutilisé tout le mois.', entree: 'Brief client', sortie: 'Hypothèse + données marché', sub: 'Brief client → hypothèse S0→S12, cible + 2 facettes + stock de 10 angles', model: 'Gemini 3.1 Pro · ScrapeCreators', file: 'COMPETENCE_ANALYSTE.md', color: '#6EA8FF', kind: 'analyst', maxTokens: 64000,
    prompt: 'DONNÉES BRUTES :\n[Sources externes (Gemini/Trends/YouTube/Jumia/CSE) non connectées pour ce test — applique RÈGLE #1/#2/#3 de ta compétence : marque chaque point qui en dépendrait par [NON TROUVÉ DANS DONNÉES BRUTES].]\n\nProduis la Synthèse complète S0→S7 selon ta compétence.' },
  { slug: 'creative-prod', n: 2, name: 'Creative Image', role: 'Choisit lui-même le CT le plus adapté dans toute la galerie, puis produit la static ad Meta 4:5 fidèle à la marque.', entree: 'Synthèse + photos produit', sortie: 'Static ad 4:5', sub: 'Synthèse + photos → choix du CT dans la galerie → static ad Meta 4:5', model: 'Gemini 3.1 Pro · Gemini 3 Pro Image', file: 'COMPETENCE_CREATIVE_PROD.md', color: '#3DD6B5', kind: 'image', maxTokens: 8000 },
  { slug: 'copywriter', n: 3, name: 'Copywriter', role: 'Écrit les ad copies de chaque angle : 5 hooks variés et une description AIDA, en registre Most Aware.', entree: 'Synthèse', sortie: '5 hooks + 1 description par angle', sub: 'Synthèse → chaque angle × (5 hooks + 1 description AIDA)', model: 'Gemini 3.1 Pro', file: 'COMPETENCE_COPYWRITER_PROD.md', color: '#FFB547', kind: 'copy', maxTokens: 8000,
    prompt: 'Produis les Ad Copy complets pour TOUS les angles présents dans la synthèse selon ta compétence — 5 hooks variés + 1 description AIDA paragraphée par angle, registre Most Aware.' },
  { slug: 'creative-video', n: 4, name: 'Créative Vidéo', role: 'Monte la vidéo à partir d’un CT vidéo, des photos du produit et de la synthèse, dans un budget de 15 $ maximum.', entree: 'Synthèse + CT vidéo + photos', sortie: 'Vidéo montée 9:16', sub: 'Synthèse + CT vidéo + photos → vidéo montée (moteur vidéo)', model: 'Gemini 3.1 Pro · Veo 3.1 · ElevenLabs', file: 'COMPETENCE_CREATIVE_VIDEO.md', color: '#FF6F91', kind: 'video' },
]
function Secours({ onClose }) {
  const [dir, setDir] = useState(null), [msg, setMsg] = useState('')
  useEffect(() => { getBackupDir().then((h) => setDir(h ? h.name : null)) }, [])
  const choose = async () => { try { const h = await pickBackupDir(); setDir(h.name); setMsg('') } catch (e) { if (e.name !== 'AbortError') setMsg(e.message) } }
  const saveAll = async () => {
    setMsg('Enregistrement…')
    await loadSkills()
    const files = {}; AGENTS.filter((a) => a.file).forEach((a) => { files[a.file] = COMP_FILES[a.file] })
    try { const r = await labFetch('/competence'); if (r.ok) files['COMPETENCE_CREATIVE_VIDEO.md'] = await r.text() } catch (_) {}
    const r = await writeSkills(files)
    setMsg(r.ok ? `✓ ${r.n} compétences écrites dans « ${r.dir} ».` : r.reason === 'no-dir' ? 'Choisis d’abord le dossier.' : 'Échec : ' + r.reason)
  }
  return (
    <div className="fx-modal-back" onClick={onClose}>
      <div className="fx-modal sm" onClick={(e) => e.stopPropagation()}>
        <h3>Sauvegarde locale des compétences</h3>
        {!backupSupported() ? <p className="fx-s wrap">Disponible dans Chrome ou Edge sur ordinateur.</p> : <>
          <p className="fx-s wrap">Dossier de secours sur cet ordinateur : {dir ? <b>{dir}</b> : 'aucun choisi'}. Chaque modification d’une compétence y est recopiée ; le bouton écrit les 4 compétences d’un coup.</p>
          <div className="fx-btnrow" style={{ marginTop: 10 }}><button className="fx-btn" onClick={choose}>{dir ? 'Changer de dossier' : 'Choisir le dossier'}</button><button className="fx-btn primary" disabled={!dir} onClick={saveAll}>Sauvegarder les 4 compétences</button></div>
          {msg && <div className="fx-s wrap" style={{ marginTop: 6 }}>{msg}</div>}</>}
        <div className="fx-modal-act"><button className="fx-btn" onClick={onClose}>Fermer</button></div>
      </div>
    </div>
  )
}
function Couts({ onClose }) {
  const [d, setD] = useState(null), [err, setErr] = useState('')
  useEffect(() => { fetch(SERVER + '/couts').then((r) => r.json()).then(setD).catch((e) => setErr('Serveur injoignable : ' + e.message)) }, [])
  const $ = (n) => (n == null ? '—' : n.toFixed(2) + ' $')
  return (
    <div className="fx-modal-back" onClick={onClose}>
      <div className="fx-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Coût par agent</h3>
        {err && <p className="fx-s wrap">{err}</p>}
        {!d && !err && <p className="fx-s">Chargement…</p>}
        {d && <>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead><tr style={{ textAlign: 'left' }}><th>Agent</th><th>Total</th><th>Dernière prod.</th><th>Moyenne / prod.</th><th>Appels</th></tr></thead>
            <tbody>{d.agents.length ? d.agents.map((l) => (
              <tr key={l.agent}><td>{l.agent}</td><td>{$(l.total_usd)}</td><td>{l.productions ? $(l.derniere_production_usd) : '—'}</td><td>{$(l.moyenne_par_production_usd)}</td><td>{l.appels}</td></tr>)) : <tr><td colSpan="5">Aucun appel depuis le dernier démarrage du serveur.</td></tr>}</tbody>
          </table>
          <p className="fx-s wrap" style={{ marginTop: 8 }}>Total : <b>{$(d.total_usd)}</b>. Plafond d’une hypothèse : <b>{d.plafond_hypothese_usd} $</b>. {d.note}</p></>}
        <div className="fx-modal-act"><button className="fx-btn" onClick={onClose}>Fermer</button></div>
      </div>
    </div>
  )
}
export default function Agents() {
  const nav = useNavigate()
  const [sec, setSec] = useState(false), [cou, setCou] = useState(false)
  return (
    <div className="fx-wrap">
      <div className="fx-h"><div><div className="fx-kicker">La chaîne de production</div><h1>Agents</h1><p>Quatre spécialistes : l’Analyste ouvre la voie, les trois autres produisent.</p></div>
        <div className="fx-btnrow"><button className="fx-btn" onClick={() => setCou(true)}>Coût par agent</button><button className="fx-btn" onClick={() => setSec(true)}>Sauvegarde des compétences</button></div></div>
      <div className="fx-ag">{AGENTS.map((a) => (
        <button key={a.slug} className="fx-agc" style={{ '--c': a.color }} onClick={() => nav('/agents/' + a.slug)}>
          <AgentArt slug={a.slug} color={a.color} />
          <div className="fx-agc-b">
            <div className="fx-agc-h"><span className="fx-agc-n">{String(a.n).padStart(2, '0')}</span><span className="fx-agc-t">{a.name}</span></div>
            <p className="fx-agc-r">{a.role}</p>
            <div className="fx-flow"><span>{a.entree}</span><i>→</i><span className="o">{a.sortie}</span></div>
            <div className="fx-agc-f"><span className="fx-model">{a.model}</span></div>
            <span className="fx-agc-go">Ouvrir l’agent <i>→</i></span>
          </div>
        </button>))}</div>
      {sec && <Secours onClose={() => setSec(false)} />}
      {cou && <Couts onClose={() => setCou(false)} />}
    </div>
  )
}
