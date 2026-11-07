import React, { useEffect, useState } from 'react'
import { useCrm } from '../store'
import * as D from '../domain/defaults'
import { relanceTemplates, closingTemplates, ecritTemplates } from '../domain/messages'
import { Chip, Icon, Pills, Seg, confirmDlg, toast } from '../ui'
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
const VARS_CLOSING = 'Variables : [Prénom] [Marque] [Objectif] [Problème] et [Lien] (page de l\'offre discutée, raccourcie et suivie à l\'envoi). J+4 se compte 3 jours après l\'envoi du J+1, J+11 sept jours après l\'envoi du J+4.'
const VARS_ECRIT = 'Variables : [marque] [produit] [pays] [remarque] [facture] [delai] [n] et [lien] (page de l\'offre, suivie à l\'envoi pour « Bloc 4 » et « suite »).'

const SIT_COURT = { reflechir: 'Il réfléchit', equipe: 'Équipe / associés', budget: 'Budget pas complet', stock: 'Attend du stock' }
const BLOCS_ECRIT = [['b1', 'Bloc 1 · diagnostic'], ['b2', 'Bloc 2 · plan'], ['b3', 'Bloc 3 · étude de cas'], ['b4', 'Bloc 4 · offre'], ['autre', 'Suite & autres']]
const blocDe = (k) => (k.startsWith('b1') ? 'b1' : k.startsWith('b2') ? 'b2' : k.startsWith('b3') ? 'b3' : k.startsWith('b4') ? 'b4' : 'autre')

export default function Templates() {
  const { cfg, saveCfg } = useCrm()
  const [onglet, setOnglet] = usePref('tpl_onglet', 'closing'), [sit, setSit] = usePref('tpl_sit', 'reflechir'), [bloc, setBloc] = usePref('tpl_bloc', 'b1'), [q, setQ] = usePref('tpl_q', '')
  const sauve = async (changes, ok) => { if (await saveCfg(changes)) toast(ok || 'Enregistré ✓') }
  const relances = relanceTemplates(cfg)
  const intros = Array.isArray(cfg.tpl_intros) && cfg.tpl_intros.length ? cfg.tpl_intros : D.DEFAULT_INTROS
  const closing = closingTemplates(cfg)
  const ecrit = ecritTemplates(cfg)
  const pd = { ...D.PITCH_DATA_DEFAUT, ...(cfg.pitch_data || {}) }
  const rech = q.trim().toLowerCase(), vu = (...t) => !rech || t.join(' ').toLowerCase().includes(rech)
  const ongs = [['closing', 'Closing après appel', D.CLOSING_SLOTS.length], ['relances', 'Relances leads', D.RELANCE_LABELS.length], ['ecrit', 'Closing écrit', Object.keys(D.DEFAULT_ECRIT).length], ['intros', 'Premiers messages', intros.length], ['pitch', 'Pitch & audit', null]]
  return (<>
    <div className="cx-tools">
      <div className="cx-bar2"><Seg value={onglet} onChange={setOnglet} options={ongs.map(([k, l, c]) => [k, l, c])} />
        {onglet !== 'pitch' && <input className="cx-search" style={{ flex: 1, minWidth: 160, maxWidth: 320 }} type="search" placeholder="Chercher dans les messages…" value={q} onChange={(e) => setQ(e.target.value)} />}</div>
      {onglet === 'closing' && !rech && <Pills value={sit} onChange={setSit} options={D.CLOSING_SITUATIONS.map((x) => [x.k, SIT_COURT[x.k] || x.label])} />}
      {onglet === 'ecrit' && !rech && <Pills value={bloc} onChange={setBloc} options={BLOCS_ECRIT.map(([k, l]) => [k, l, Object.keys(D.DEFAULT_ECRIT).filter((x) => blocDe(x) === k).length])} />}
    </div>
    {onglet === 'relances' && D.RELANCE_LABELS.map((l, i) => vu(l, relances[i]) && <Editeur key={i} titre={'J+' + D.RELANCE_JOURS[i] + ' · ' + l} aide={VARS_RELANCE + (i === 0 ? ' Peut contenir [ads] [jours] [bonne_nouvelle] [mauvaise_nouvelle] [mauvaise_nouvelle_en_2_mots] [solution] (audit des ads).' : i === 1 ? ' Peut contenir [cas_histoire] [cas_solution] [cas_resultat] [cas_slug] (étude de cas choisie d\'après le cas du J+3).' : '')} valeur={relances[i] || ''} defaut={D.DEFAULT_RELANCES[i]} onSave={(v) => { const t = [...relances]; t[i] = v; return sauve({ tpl_relances: t }) }} />)}
    {onglet === 'closing' && D.CLOSING_SLOTS.map((x, i) => (rech ? vu(x.label, closing[i]) : x.v === sit) && <Editeur key={i} titre={rech ? x.label : 'J+' + x.j} aide={VARS_CLOSING} valeur={closing[i] || ''} defaut={D.DEFAULT_CLOSING[i]} ouvertDefaut={!rech && x.j === 1} onSave={(v) => { const t = [...closing]; t[i] = v; return sauve({ tpl_closing: t }) }} />)}
    {onglet === 'ecrit' && Object.keys(D.DEFAULT_ECRIT).map((k) => (rech ? vu(D.ECRIT_TPL_LABELS[k] || k, ecrit[k]) : blocDe(k) === bloc) && <Editeur key={k} titre={D.ECRIT_TPL_LABELS[k] || k} aide={VARS_ECRIT} rows={k.startsWith('b1') || k.startsWith('b2') || k === 'suite' ? 11 : 8} valeur={ecrit[k]} defaut={D.DEFAULT_ECRIT[k]} onSave={(v) => sauve({ tpl_ecrit3: { ...(cfg.tpl_ecrit3 || {}), [k]: v } })} />)}
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
      <Editeur titre="Cas 0 — aucune ad active (message J+3)" aide="Utilisé pour J+3 quand le relevé montre 0 ad active. Variable : [Marque]. Le bloc 1 du closing par écrit a son propre texte (onglet « Closing par écrit »)." valeur={pd.cas0 || D.J3_CAS0_DEFAUT} defaut={D.J3_CAS0_DEFAUT} onSave={(v) => sauve({ pitch_data: { ...(cfg.pitch_data || {}), cas0: v } })} />
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
