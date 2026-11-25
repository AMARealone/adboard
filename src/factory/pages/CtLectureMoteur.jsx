// lecture-moteur-v1 (25 nov. 2026) — décision du fondateur : la vidéo source d'un CT est lue UNE fois (à l'import), plus jamais en production.
// Sur la carte de chaque CT vidéo :
//   · l'état de cette lecture (prête / à faire) ;
//   · « Lecture moteur » : la fait faire pour un CT déjà rangé (le texte du CT n'est pas touché) ;
//   · « ⬇ CT + lecture » : un zip avec la vidéo du CT, son texte, l'analyse d'import et la lecture du moteur, à envoyer à Claude pour vérification ;
//   · « ⤴ Remplacer la lecture » : dépose la lecture corrigée renvoyée par Claude (aucune analyse repayée).
import React, { useEffect, useRef, useState } from 'react'
import { SERVER } from '../api'
import { r2Put } from '../r2'
import { vctGetTexte, vctLireAnalyse, vctMetaUrl } from '../vctApi'
import { toast } from '../ui'

const R2PUB = 'https://images.adstackofficial.com'
const urlPack = (id) => `${R2PUB}/ct-video/fiches/${id}.json`

// ── zip minimal (sans compression) : aucune dépendance à installer ──
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 } return t })()
const crc32 = (u8) => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0 }
function zipper(fichiers) {   // [{ nom, data: Uint8Array }]
  const enc = new TextEncoder(), parts = [], centre = []; let off = 0
  const u16 = (v) => [v & 255, (v >>> 8) & 255], u32 = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]
  for (const f of fichiers) {
    const nom = enc.encode(f.nom), crc = crc32(f.data), n = f.data.length
    const loc = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(n), ...u32(n), ...u16(nom.length), ...u16(0)])
    parts.push(loc, nom, f.data)
    centre.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(n), ...u32(n), ...u16(nom.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), nom)
    off += loc.length + nom.length + n
  }
  const tailleC = centre.reduce((s, x) => s + x.length, 0)
  const fin = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(fichiers.length), ...u16(fichiers.length), ...u32(tailleC), ...u32(off), ...u16(0)])
  return new Blob([...parts, ...centre, fin], { type: 'application/zip' })
}
const propre = (s) => String(s || 'ct').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 50)
const tok = () => { try { return (JSON.parse(localStorage.getItem('factory_admin_sb_session') || 'null') || {}).access_token || '' } catch (_) { return '' } }

export function CtLectureMoteur({ rec }) {
  const [etat, setEtat] = useState(null)   // null = inconnu, { ok, date, taille }
  const [busy, setBusy] = useState('')
  const fic = useRef(null)
  const relire = async () => {
    try { const r = await fetch(urlPack(rec.id) + '?t=' + Date.now(), { method: 'HEAD' }); setEtat(r.ok ? { ok: true, date: r.headers.get('last-modified'), taille: Number(r.headers.get('content-length')) || 0 } : { ok: false }) }
    catch (_) { setEtat({ ok: false }) }
  }
  useEffect(() => { relire() }, [rec.id])

  const lancer = async () => {
    if (!rec.videoUrl) return toast('Ce CT n\'a pas de vidéo source.')
    setBusy('Lancement')
    try {
      const r = await fetch(SERVER + '/video-jobs/analyse-ct', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ct_id: rec.id, video_url: rec.videoUrl, nom: rec.name, lecture_seule: true, meta_url: vctMetaUrl(rec.id), forcer: true }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || j.error) throw new Error(j.error || 'HTTP ' + r.status)
      toast('Lecture du moteur lancée pour « ' + rec.name + ' » (5 à 10 min). Elle servira à toutes les productions de ce CT.', 8000)
      setTimeout(relire, 9 * 60000)
    } catch (e) { toast('Lancement impossible : ' + e.message, 9000) } finally { setBusy('') }
  }

  const telecharger = async () => {
    setBusy('Préparation du zip')
    const enc = new TextEncoder(), F = [], manques = []
    const base = propre(rec.name) + '_' + rec.id
    try {
      try { const rv = await fetch(rec.videoUrl); if (!rv.ok) throw new Error('HTTP ' + rv.status); F.push({ nom: base + '/CT_ORIGINE.' + ((rec.videoUrl.match(/\.(mp4|mov|webm)(\?|$)/i) || [])[1] || 'mp4'), data: new Uint8Array(await rv.arrayBuffer()) }) }
      catch (e) { manques.push('vidéo (' + e.message + ') : ' + rec.videoUrl) }
      try { F.push({ nom: base + '/texte_du_ct.md', data: enc.encode(await vctGetTexte(rec.id)) }) } catch (e) { manques.push('texte du CT') }
      const A = await vctLireAnalyse(rec.id); if (A) F.push({ nom: base + '/analyse_import.json', data: enc.encode(JSON.stringify(A, null, 1)) }); else manques.push('analyse d\'import')
      let pack = null; try { const rp = await fetch(urlPack(rec.id) + '?t=' + Date.now()); if (rp.ok) pack = await rp.json() } catch (_) { }
      if (pack) {
        F.push({ nom: base + '/lecture_moteur_PACK.json', data: enc.encode(JSON.stringify(pack)) })
        for (const f of pack.fichiers || []) { let t = f.contenu; try { t = JSON.stringify(JSON.parse(f.contenu), null, 1) } catch (_) { } F.push({ nom: base + '/lecture_moteur/' + f.nom, data: enc.encode(t) }) }
      } else manques.push('lecture du moteur (pas encore faite : bouton « Lecture moteur »)')
      F.push({ nom: base + '/LISEZMOI.txt', data: enc.encode('CT « ' + rec.name + ' » (' + rec.id + ')\nTéléchargé le ' + new Date().toLocaleString('fr-FR') + '\n\nContenu : la vidéo du CT, son texte, l\'analyse faite à l\'import et la lecture du moteur vidéo (une fiche par niveau de conscience + l\'écoute du son).\nlecture_moteur_PACK.json est le fichier exact relu par chaque production : c\'est lui qui se remplace avec le bouton « ⤴ Remplacer la lecture ».' + (manques.length ? '\n\nManquant : ' + manques.join(' ; ') : '') + '\n') })
      const blob = zipper(F), u = URL.createObjectURL(blob), a = document.createElement('a')
      a.href = u; a.download = base + '_lecture.zip'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000)
      toast('Zip prêt' + (manques.length ? ' (manque : ' + manques.join(' ; ') + ')' : '') + '.', 7000)
    } catch (e) { toast('Zip impossible : ' + e.message, 9000) } finally { setBusy('') }
  }

  const remplacer = async (f) => {
    if (!f) return
    setBusy('Envoi')
    try {
      const pack = JSON.parse(await f.text())
      if (!pack || !Array.isArray(pack.fichiers) || !pack.fichiers.length || !pack.fichiers.every((x) => x && /^[\w\-.]+\.json$/.test(x.nom || '') && typeof x.contenu === 'string')) throw new Error('ce fichier n\'est pas une lecture du moteur (lecture_moteur_PACK.json attendu)')
      if (pack.ct && pack.ct !== rec.id) throw new Error('cette lecture appartient à un autre CT (' + pack.ct + ')')
      pack.fichiers.forEach((x) => JSON.parse(x.contenu))   // chaque fiche doit être un JSON valide
      pack.ct = rec.id; pack.corrige_le = new Date().toISOString()
      await r2Put(new Blob([JSON.stringify(pack)], { type: 'application/json' }), 'ct-video/fiches/' + rec.id + '.json')
      toast('Lecture corrigée déposée : la prochaine production de « ' + rec.name + ' » l\'utilise, sans rien repayer.', 8000)
      relire()
    } catch (e) { toast('Remplacement impossible : ' + e.message, 9000) } finally { setBusy(''); if (fic.current) fic.current.value = '' }
  }

  return (
    <div className="fx-s" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
      <span style={{ color: etat && etat.ok ? '#22C55E' : '#F59E0B' }}>{etat == null ? 'Lecture moteur…' : etat.ok ? '✓ Lecture moteur prête' + (etat.date ? ' (' + new Date(etat.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ')' : '') : 'Lecture moteur à faire'}</span>
      {rec.videoUrl && <button className="fx-btn sm" disabled={!!busy} title="Lit la vidéo source une seule fois (fiche par niveau de conscience + son) : chaque production la relira sans coût. Le texte du CT n'est pas touché." onClick={lancer}>{busy === 'Lancement' ? 'Lancement…' : etat && etat.ok ? '↻ Relire' : '🔎 Lecture moteur'}</button>}
      <button className="fx-btn sm" disabled={!!busy} title="Télécharge la vidéo du CT et tout ce que le moteur en a compris, à envoyer à Claude pour vérification" onClick={telecharger}>{busy === 'Préparation du zip' ? 'Zip…' : '⬇ CT + lecture'}</button>
      <button className="fx-btn sm" disabled={!!busy} title="Dépose la lecture corrigée (lecture_moteur_PACK.json) renvoyée par Claude" onClick={() => fic.current && fic.current.click()}>{busy === 'Envoi' ? 'Envoi…' : '⤴ Remplacer la lecture'}</button>
      <input ref={fic} type="file" accept=".json,application/json" hidden onChange={(e) => remplacer(e.target.files && e.target.files[0])} />
    </div>
  )
}
