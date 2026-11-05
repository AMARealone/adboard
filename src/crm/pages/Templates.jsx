import React, { useEffect, useState } from 'react'
import { useCrm } from '../store'
import * as D from '../domain/defaults'
import { relanceTemplates, closingTemplates, ecritTemplates } from '../domain/messages'
import { Chip, confirmDlg, toast } from '../ui'

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)
function Editeur({ titre, aide, valeur, defaut, onSave, rows = 9 }) {
  const [v, setV] = useState(valeur), [busy, setBusy] = useState(false)
  useEffect(() => setV(valeur), [valeur])
  const change = v !== valeur
  return (
    <div className="cx-tpl">
      <div className="cx-tplh"><b>{titre}</b>{v === defaut && <Chip c="mu">modèle d'origine</Chip>}{change && <Chip c="wa">modifié, pas enregistré</Chip>}</div>
      {aide && <p className="cx-help">{aide}</p>}
      <textarea rows={rows} value={v} onChange={(e) => setV(e.target.value)} spellCheck="false" />
      <div className="cx-tpla">
        <button className="cx-btn primary sm" disabled={!change || busy} onClick={async () => { setBusy(true); await onSave(v); setBusy(false) }}>Enregistrer</button>
        <button className="cx-btn ghost sm" disabled={!change} onClick={() => setV(valeur)}>Annuler</button>
        <button className="cx-btn ghost sm" disabled={v === defaut && valeur === defaut} onClick={async () => { if (await confirmDlg('Revenir au modèle d\'origine pour « ' + titre + ' » ?\nVotre version actuelle sera remplacée.', 'Revenir au modèle')) { setBusy(true); await onSave(defaut); setBusy(false) } }}>Modèle d'origine</button>
      </div>
    </div>
  )
}
const VARS_RELANCE = 'Variables : [Marque] [Produit] [Pays]. Le site d\'Adstack dans le message est remplacé par un lien suivi et raccourci. Sans lien dans le message, rien n\'est ajouté.'
const VARS_CLOSING = 'Variables : [Prénom] [Marque] [Mots] [Objection] [Objectif] [Facture] et [Lien] (page de l\'offre discutée, raccourcie et suivie à l\'envoi).'
const VARS_ECRIT = 'Variables : [marque] [produit] [pays] [remarque] [facture] [delai] [n] et [lien] (page de l\'offre, suivie à l\'envoi pour « Bloc 3 » et « suite »).'

export default function Templates() {
  const { cfg, saveCfg } = useCrm()
  const [onglet, setOnglet] = useState('relances')
  const sauve = async (changes, ok) => { if (await saveCfg(changes)) toast(ok || 'Enregistré ✓') }
  const tab = (k, l) => <button className={'cx-tab' + (onglet === k ? ' on' : '')} onClick={() => setOnglet(k)}>{l}</button>
  const relances = relanceTemplates(cfg)
  const intros = Array.isArray(cfg.tpl_intros) && cfg.tpl_intros.length ? cfg.tpl_intros : D.DEFAULT_INTROS
  const closing = closingTemplates(cfg)
  const ecrit = ecritTemplates(cfg)
  const pd = { ...D.PITCH_DATA_DEFAUT, ...(cfg.pitch_data || {}) }
  return (<>
    <div className="cx-tools"><div className="cx-tabs">{tab('relances', 'Relances J+3 / J+10 / J+21')}{tab('closing', 'Closing')}{tab('ecrit', 'Closing par écrit')}{tab('intros', 'Premiers messages')}{tab('pitch', 'Pitch & audit')}</div></div>
    {onglet === 'relances' && D.RELANCE_LABELS.map((l, i) => <Editeur key={i} titre={'J+' + D.RELANCE_JOURS[i] + ' · ' + l} aide={VARS_RELANCE + (i === 0 ? ' Peut contenir [ads] [jours] [bonne_nouvelle] [mauvaise_nouvelle] [solution] (audit des ads).' : '')} valeur={relances[i] || ''} defaut={D.DEFAULT_RELANCES[i]} onSave={(v) => { const t = [...relances]; t[i] = v; return sauve({ tpl_relances: t }) }} />)}
    {onglet === 'closing' && D.CLOSING_SLOTS.map((x, i) => <Editeur key={i} titre={x.label} aide={VARS_CLOSING} valeur={closing[i] || ''} defaut={D.DEFAULT_CLOSING[i]} onSave={(v) => { const t = [...closing]; t[i] = v; return sauve({ tpl_closing: t }) }} />)}
    {onglet === 'ecrit' && Object.keys(D.DEFAULT_ECRIT).map((k) => <Editeur key={k} titre={D.ECRIT_TPL_LABELS[k] || k} aide={VARS_ECRIT} rows={k.startsWith('b1') || k === 'suite' ? 11 : 8} valeur={ecrit[k]} defaut={D.DEFAULT_ECRIT[k]} onSave={(v) => sauve({ tpl_ecrit2: { ...(cfg.tpl_ecrit2 || {}), [k]: v } })} />)}
    {onglet === 'intros' && <>
      <p className="cx-sub">Messages d'accroche envoyés en premier. Ils tournent pour ne pas se répéter. Variables : [Marque] [Produit].</p>
      {intros.map((t, i) => <Editeur key={i} titre={'Accroche ' + (i + 1)} valeur={t} defaut={D.DEFAULT_INTROS[i] || ''} rows={5} onSave={(v) => { const n = [...intros]; n[i] = v; return sauve({ tpl_intros: n }) }} />)}
      <button className="cx-btn sm" onClick={() => sauve({ tpl_intros: [...intros, 'Bonjour *[Marque]*,\n'] }, 'Accroche ajoutée')}>+ Ajouter une accroche</button>
    </>}
    {onglet === 'pitch' && <>
      <Editeur titre="Pitch (message après réponse)" aide="Variables : [Marque]. Le site d'Adstack dans le message est remplacé par un lien suivi (campagne « pitch »)." rows={14} valeur={cfg.tpl_pitch || D.DEFAULT_PITCH} defaut={D.DEFAULT_PITCH} onSave={(v) => sauve({ tpl_pitch: v })} />
      <div className="cx-tpl"><div className="cx-tplh"><b>Règles de l'audit des ads</b></div>
        <p className="cx-help">Choisit lequel des 4 cas utiliser selon le nombre d'ads et leur durée. Peu d'ads = au plus « seuil d'ads ». Durée courte = moins de « seuil de jours ».</p>
        <div className="cx-form cx-pd">{[['seuil_ads', "Seuil d'ads (peu / beaucoup)"], ['seuil_jours', 'Seuil de jours (courte / longue)'], ['fraicheur_j', 'Relevé valable (jours)']].map(([k, l]) => <label key={k}>{l}<input type="number" min="0" defaultValue={pd[k]} onBlur={(e) => { const v = parseInt(e.target.value, 10); if (Number.isFinite(v) && v >= 0 && v !== pd[k]) sauve({ pitch_data: { ...(cfg.pitch_data || {}), [k]: v } }) }} /></label>)}
          <label>Durée prise en compte<select defaultValue={pd.duree} onChange={(e) => sauve({ pitch_data: { ...(cfg.pitch_data || {}), duree: e.target.value } })}><option value="med">Médiane (recommandé)</option><option value="moy">Moyenne</option></select></label></div>
      </div>
      <Editeur titre="Message de repli (ads pas à jour)" aide="Utilisé pour J+3 quand les ads du prospect ne sont pas à jour." valeur={pd.repli} defaut={D.J3_REPLI_DEFAUT} onSave={(v) => sauve({ pitch_data: { ...(cfg.pitch_data || {}), repli: v } })} />
      {[1, 2, 3, 4].map((k) => { const c = (cfg.pitch_data && cfg.pitch_data.cas && cfg.pitch_data.cas[k]) || {}, dc = D.PITCH_DATA_DEFAUT.cas[k]; return (
        <div className="cx-tpl" key={k}><div className="cx-tplh"><b>Cas {k}</b><span className="cx-note">{D.PITCH_CAS_LABELS[k]}</span></div>
          <div className="cx-form cx-pd">{[['b', 'Bonne nouvelle'], ['m', 'Mauvaise nouvelle'], ['n', 'Mauvaise nouvelle en 2 mots'], ['s', 'Solution']].map(([f, l]) => <label key={f}>{l}<textarea rows="2" defaultValue={c[f] || dc[f]} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== (c[f] || dc[f])) sauve({ pitch_data: { ...(cfg.pitch_data || {}), cas: { ...((cfg.pitch_data || {}).cas || {}), [k]: { ...c, [f]: v } } } }) }} /></label>)}</div>
        </div>) })}
    </>}
  </>)
}
