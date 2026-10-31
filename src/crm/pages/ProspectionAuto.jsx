import React, { useCallback, useEffect, useRef, useState } from 'react'
import { serveurAdmin } from '../api'
import { useCrm } from '../store'
import { toast } from '../ui'

const couleur = (l) => (/✅|LEAD|Supabase OK/.test(l) ? 'ok' : /❌|erreur|Erreur/.test(l) ? 'ko' : /⚠️|ignore|Ignore/.test(l) ? 'wa' : /═|AdStack Prospector/.test(l) ? 'ti' : '')
const duree = (ms) => { const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return (h ? h + ' h ' : '') + (m ? m + ' min ' : '') + (s % 60) + ' s' }
export default function ProspectionAuto() {
  const { reload } = useCrm()
  const [st, setSt] = useState(null), [lignes, setLignes] = useState([]), [occ, setOcc] = useState(''), [debut, setDebut] = useState(null), [, tic] = useState(0)
  const since = useRef(0), vol = useRef(false), actif = useRef(true), minuteur = useRef(null), logEl = useRef(null), etaitEnCours = useRef(false)
  const statut = useCallback(async () => {
    if (vol.current) return null
    vol.current = true
    try {
      const d = await serveurAdmin('/prospector/status?since=' + since.current + '&_t=' + Date.now())
      if (!actif.current) return d
      // Un lot déjà reçu n'est jamais affiché deux fois
      if (typeof d.next_since === 'number') { if (d.logs && d.logs.length && d.next_since <= since.current) { setSt(d); return d } since.current = d.next_since }
      setSt(d)
      if (d.logs && d.logs.length) setLignes((l) => [...l, ...d.logs].slice(-1500))
      setDebut((x) => (d.running ? x || Date.now() : null))
      if (etaitEnCours.current && !d.running) { toast('Prospection terminée — prospects mis à jour'); reload() }
      etaitEnCours.current = !!d.running
      return d
    } catch (e) { if (actif.current) setSt((s) => ({ ...(s || {}), erreur: e.message })); return null } finally { vol.current = false }
  }, [reload])
  useEffect(() => {
    actif.current = true
    const boucle = async () => { if (!actif.current) return; await statut(); if (actif.current) minuteur.current = setTimeout(boucle, 4000) }
    boucle()
    const t = setInterval(() => tic((n) => n + 1), 1000)
    return () => { actif.current = false; clearTimeout(minuteur.current); clearInterval(t) }
  }, [statut])
  useEffect(() => { const e = logEl.current; if (e && e.scrollHeight - e.scrollTop <= e.clientHeight + 120) e.scrollTop = e.scrollHeight }, [lignes])
  const lancer = async () => {
    setOcc('start')
    try { const d = await serveurAdmin('/prospector/start', 'POST'); if (d.error) toast('Erreur : ' + d.error); else if (d.status === 'already_running') toast('Déjà en cours (PID ' + d.pid + ')'); else { toast('▶ Prospection démarrée'); since.current = 0; setLignes([]) } await statut() } catch (e) { toast('Erreur : ' + e.message) } setOcc('')
  }
  const arreter = async () => { setOcc('stop'); try { await serveurAdmin('/prospector/stop', 'POST'); toast('■ Prospection arrêtée'); await statut() } catch (e) { toast('Erreur : ' + e.message) } setOcc('') }
  const run = st && st.running
  return (<>
    {st && st.error && <div className="cx-banner warn">⚠ {st.error}</div>}
    {st && st.erreur && <div className="cx-banner">⚠ Statut indisponible — {st.erreur}</div>}
    <div className="cx-minis" style={{ marginBottom: 12 }}>
      <div className="cx-mini"><b style={{ color: run ? '#32ff7e' : undefined }}>{!st ? '…' : run ? 'En cours' : 'Arrêté'}</b><span>Statut</span></div>
      <div className="cx-mini"><b>{(st && st.new_leads) || 0}</b><span>Nouveaux prospects</span></div>
      <div className="cx-mini"><b>{run && debut ? duree(Date.now() - debut) : '—'}</b><span>Durée</span></div>
      <div className="cx-mini"><b>{(run && st.pid) || '—'}</b><span>PID</span></div>
    </div>
    <div className="cx-acts" style={{ marginBottom: 12 }}>
      {!run ? <button className="cx-btn primary" disabled={occ === 'start'} onClick={lancer}>{occ === 'start' ? 'Démarrage…' : '▶ Démarrer'}</button> : <button className="cx-btn" disabled={occ === 'stop'} onClick={arreter}>{occ === 'stop' ? 'Arrêt…' : '■ Arrêter'}</button>}
      <button className="cx-btn ghost" onClick={statut}>↻ Actualiser</button>
    </div>
    <p className="cx-note" style={{ marginBottom: 8 }}>Le programme tourne sur votre PC : il doit être allumé et le tunnel actif.</p>
    <pre ref={logEl} className="cx-log">{lignes.length ? lignes.map((l, i) => <span key={i} className={couleur(l)}>{l + '\n'}</span>) : 'Aucun journal pour l\'instant.'}</pre>
  </>)
}
