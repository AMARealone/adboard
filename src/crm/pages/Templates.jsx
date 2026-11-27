import React, { useEffect, useState } from 'react'
import { useCrm } from '../store'
import * as D from '../domain/defaults'
import { relanceTemplates, acheteurTemplates } from '../domain/messages'
import { PARCOURS } from '../domain/acheteurs'
import { Chip, Icon, Seg, confirmDlg, toast } from '../ui'
import { usePref } from '../prefs'

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)
function Editeur({ titre, aide, valeur, defaut, onSave, rows = 9, ouvertDefaut = false }) {
  const [v, setV] = useState(valeur), [busy, setBusy] = useState(false), [ouv, setOuv] = useState(ouvertDefaut)
  useEffect(() => setV(valeur), [valeur])
  const change = v !== valeur
  const apercu = (valeur || '').replace(/\s+/g, ' ').trim()
  return (
    <div className={'cx-acc' + (ouv || change ? ' open' : '')}>
      <button onClick={() => setOuv(!ouv)} aria-expanded={ouv}><b>{titre}</b>{change ? <Chip c="wa">non enregistré</Chip> : valeur !== defaut && <Chip c="bl">personnalisé</Chip>}{!ouv && <span className="pv">{apercu}</span>}<Icon n="chev" s={16} /></button>
      {(ouv || change) && <div className="bd"><div className="cx-tpl">
        {aide && <p className="cx-help">{aide}</p>}
        <textarea rows={rows} value={v} onChange={(e) => setV(e.target.value)} spellCheck="false" />
        <div className="cx-tpla">
          <button className="cx-btn primary sm" disabled={!change || busy} onClick={async () => { setBusy(true); await onSave(v); setBusy(false) }}>Enregistrer</button>
          <button className="cx-btn ghost sm" disabled={!change} onClick={() => setV(valeur)}>Annuler</button>
          <button className="cx-btn ghost sm" disabled={v === defaut && valeur === defaut} onClick={async () => { if (await confirmDlg('Revenir au modèle d\'origine pour « ' + titre + ' » ?\nVotre version actuelle sera remplacée.', 'Revenir au modèle')) { setBusy(true); await onSave(defaut); setBusy(false) } }}>Modèle d'origine</button>
        </div>
      </div></div>}
    </div>
  )
}
const VARS_RELANCE = 'Variables : [Marque] [Produit] [Pays]. Le site d\'Adstack dans le message est remplacé par un lien suivi et raccourci. Sans lien dans le message, rien n\'est ajouté.'
const VARS_ACHETEUR = 'Variables : [Prénom] [Marque] [Offre] [Délai] [Offre_suivante] [Volume_suivant] [Délai_suivant] [Lien]. [Lien] = page de l\'offre suivante, suivie et raccourcie à l\'envoi (étape « Montée en gamme »). Sans prénom, le message s\'adresse à la marque.'

export default function Templates() {
  const { cfg, saveCfg } = useCrm()
  const [ong, setOnglet] = usePref('tpl_onglet', 'relances'), [q, setQ] = usePref('tpl_q', '')
  const onglet = ong === 'closing' || ong === 'ecrit' ? 'relances' : ong   // onglets retirés le 27/11/2026
  const sauve = async (changes, ok) => { if (await saveCfg(changes)) toast(ok || 'Enregistré ✓') }
  const relances = relanceTemplates(cfg)
  const intros = Array.isArray(cfg.tpl_intros) && cfg.tpl_intros.length ? cfg.tpl_intros : D.DEFAULT_INTROS
  const acheteurs = acheteurTemplates(cfg)
  const pd = { ...D.PITCH_DATA_DEFAUT, ...(cfg.pitch_data || {}) }
  const rech = q.trim().toLowerCase(), vu = (...t) => !rech || t.join(' ').toLowerCase().includes(rech)
  const ongs = [['relances', 'Relances leads', D.RELANCE_LABELS.length], ['acheteurs', 'Acheteurs', PARCOURS.length], ['intros', 'Premiers messages', intros.length], ['pitch', 'Pitch & audit', null]]
  return (<>
    <div className="cx-tools">
      <div className="cx-bar2"><Seg value={onglet} onChange={setOnglet} options={ongs.map(([k, l, c]) => [k, l, c])} />
        {onglet !== 'pitch' && <input className="cx-search" style={{ flex: 1, minWidth: 160, maxWidth: 320 }} type="search" placeholder="Chercher dans les messages…" value={q} onChange={(e) => setQ(e.target.value)} />}</div>
    </div>
    {onglet === 'relances' && D.RELANCE_LABELS.map((l, i) => vu(l, relances[i]) && <Editeur key={i} titre={'J+' + D.RELANCE_JOURS[i] + ' · ' + l} aide={VARS_RELANCE + (i === 0 ? ' Peut contenir [ads] [jours] [bonne_nouvelle] [mauvaise_nouvelle] [mauvaise_nouvelle_en_2_mots] [solution] (audit des ads).' : i === 1 ? ' Peut contenir [cas_histoire] [cas_solution] [cas_resultat] [cas_slug] (étude de cas choisie d\'après le cas du J+3).' : '')} valeur={relances[i] || ''} defaut={D.DEFAULT_RELANCES[i]} onSave={(v) => { const t = [...relances]; t[i] = v; return sauve({ tpl_relances: t }) }} />)}
    {onglet === 'acheteurs' && PARCOURS.map((e, i) => vu(e.label, acheteurs[i]) && <Editeur key={e.cle} titre={'J+' + e.jour + ' · ' + e.label} aide={VARS_ACHETEUR + ' ' + e.aide} valeur={acheteurs[i] || ''} defaut={D.DEFAULT_ACHETEUR[i]} ouvertDefaut={!rech && i === 0} onSave={(v) => { const t = [...acheteurs]; t[i] = v; return sauve({ tpl_acheteur: t }) }} />)}
    {onglet === 'intros' && <>
      {intros.map((t, i) => vu(t) && <Editeur key={i} titre={'Accroche ' + (i + 1)} valeur={t} defaut={D.DEFAULT_INTROS[i] || ''} rows={5} onSave={(v) => { const n = [...intros]; n[i] = v; return sauve({ tpl_intros: n }) }} />)}
      <button className="cx-btn sm" onClick={() => sauve({ tpl_intros: [...intros, 'Bonjour *[Marque]*,\n'] }, 'Accroche ajoutée')}>+ Ajouter une accroche</button>
    </>}
    {onglet === 'pitch' && <>
      <Editeur titre="Pitch (message après réponse)" aide="Variables : [Marque]. Le site d'Adstack dans le message est remplacé par un lien suivi (campagne « pitch »)." rows={14} valeur={cfg.tpl_pitch || D.DEFAULT_PITCH} defaut={D.DEFAULT_PITCH} onSave={(v) => sauve({ tpl_pitch: v })} />
      <div className="cx-tpl"><div className="cx-tplh"><b>Règles de l'audit des ads</b></div>
        <p className="cx-help">Choisit lequel des 5 cas utiliser (cas 0 = aucune ad active) selon le nombre d'ads et leur durée. Peu d'ads = au plus « seuil d'ads ». Durée courte = moins de « seuil de jours ».</p>
        <div className="cx-form cx-pd">{[['seuil_ads', "Seuil d'ads (peu / beaucoup)"], ['seuil_jours', 'Seuil de jours (courte / longue)'], ['fraicheur_j', 'Relevé valable (jours)']].map(([k, l]) => <label key={k}>{l}<input type="number" min="0" defaultValue={pd[k]} onBlur={(e) => { const v = parseInt(e.target.value, 10); if (Number.isFinite(v) && v >= 0 && v !== pd[k]) sauve({ pitch_data: { ...(cfg.pitch_data || {}), [k]: v } }) }} /></label>)}
          <label>Durée prise en compte<select defaultValue={pd.duree} onChange={(e) => sauve({ pitch_data: { ...(cfg.pitch_data || {}), duree: e.target.value } })}><option value="med">Médiane (recommandé)</option><option value="moy">Moyenne</option></select></label></div>
      </div>
      <Editeur titre="Cas 0 — aucune ad active (message J+3)" aide="Utilisé pour J+3 quand le relevé montre 0 ad active. Variable : [Marque]." valeur={pd.cas0 || D.J3_CAS0_DEFAUT} defaut={D.J3_CAS0_DEFAUT} onSave={(v) => sauve({ pitch_data: { ...(cfg.pitch_data || {}), cas0: v } })} />
      {[1, 2, 3, 4].map((k) => { const c = (cfg.pitch_data && cfg.pitch_data.cas && cfg.pitch_data.cas[k]) || {}, dc = D.PITCH_DATA_DEFAUT.cas[k]; return (
        <div className="cx-tpl" key={k}><div className="cx-tplh"><b>Cas {k}</b><span className="cx-note">{D.PITCH_CAS_LABELS[k]}</span></div>
          <div className="cx-form cx-pd">{[['b', 'Bonne nouvelle'], ['m', 'Mauvaise nouvelle'], ['n', 'Mauvaise nouvelle en 2 mots'], ['s', 'Solution']].map(([f, l]) => <label key={f}>{l}<textarea rows="2" defaultValue={c[f] || dc[f]} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== (c[f] || dc[f])) sauve({ pitch_data: { ...(cfg.pitch_data || {}), cas: { ...((cfg.pitch_data || {}).cas || {}), [k]: { ...c, [f]: v } } } }) }} /></label>)}</div>
        </div>) })}
      <div className="cx-tpl"><div className="cx-tplh"><b>J+10 · études de cas</b></div>
        <p className="cx-help">Le J+10 reprend le cas relevé quand le J+3 a été envoyé, et choisit l'étude de cas : Veloce (cas 0 et 2), Saelia (cas 1 et 3), Vitalina (cas 4). Modèle du message : onglet « Relances leads ».</p></div>
      {Object.entries(D.J10_ETUDES).map(([cle, e]) => [['histoire', 'Histoire (qui est la marque, sa faille)'], ['solution', 'Solution'], ['resultat', 'Résultat']].map(([f, l]) => { const cur = ((pd.j10 || {})[cle] || {})[f] || e[f]; return <Editeur key={cle + f} titre={e.label.split(' · ')[0] + ' · ' + l} aide={'Variable du J+10 : [cas_' + f + ']. ' + e.label} rows={4} valeur={cur} defaut={e[f]} onSave={(v) => sauve({ pitch_data: { ...(cfg.pitch_data || {}), j10: { ...((cfg.pitch_data || {}).j10 || {}), [cle]: { ...(((cfg.pitch_data || {}).j10 || {})[cle] || {}), [f]: v } } } })} /> }))}
    </>}
  </>)
}
