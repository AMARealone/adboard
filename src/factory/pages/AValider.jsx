// candidats-ct-v1 — onglet « À valider » des galeries CT : les créatives trouvées pendant le balayage du marché.
import React, { useCallback, useEffect, useState } from 'react'
import { candListe, candRefuser, candAccepterImage, candAccepterVideo } from '../candApi'
import { toast, alertDlg } from '../ui'

const age = (j) => (j === null || j === undefined ? 'date inconnue' : j === 0 ? "aujourd'hui" : j < 60 ? 'il y a ' + j + ' j' : 'il y a ' + Math.round(j / 30) + ' mois')
const nf = (n) => Number(n || 0).toLocaleString('fr-FR')

// Compteur seul (pour l'onglet)
export function useNbAValider(type) {
  const [n, setN] = useState(null)
  const lire = useCallback(() => candListe(type).then((j) => setN(j.a_valider ? j.a_valider[type] : (j.candidats || []).length)).catch(() => setN(null)), [type])
  useEffect(() => { lire() }, [lire])
  return [n, lire]
}

export default function AValider({ type, onChange }) {
  const [liste, setListe] = useState([]), [load, setLoad] = useState(true), [err, setErr] = useState(''), [table, setTable] = useState(true), [busy, setBusy] = useState({})
  const charger = useCallback(async () => {
    setLoad(true)
    try { const j = await candListe(type); setListe(j.candidats || []); setTable(j.table !== false); setErr('') } catch (e) { setErr(e.message) }
    setLoad(false)
  }, [type])
  useEffect(() => { charger() }, [charger])
  const retirer = (id) => { setListe((l) => l.filter((x) => x.id !== id)); onChange && onChange() }

  const accepter = async (c) => {
    setBusy((b) => ({ ...b, [c.id]: 'Ajout à la galerie…' }))
    try {
      if (type === 'image') { await candAccepterImage(c, (t) => setBusy((b) => ({ ...b, [c.id]: t }))); toast('Ajoutée à la galerie CT image') }
      else { await candAccepterVideo(c); toast('Ajoutée à la galerie CT vidéo · analyse lancée (5 à 10 min)') }
      retirer(c.id)
    } catch (e) { await alertDlg('Impossible d\'ajouter : ' + e.message) }
    setBusy((b) => { const x = { ...b }; delete x[c.id]; return x })
  }
  const refuser = async (c) => {
    setBusy((b) => ({ ...b, [c.id]: 'Suppression…' }))
    try { await candRefuser(c); retirer(c.id) } catch (e) { await alertDlg('Échec : ' + e.message) }
    setBusy((b) => { const x = { ...b }; delete x[c.id]; return x })
  }

  if (load) return <div className="fx-gal">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="fx-skel" style={{ height: 320 }} />)}</div>
  if (err) return <div className="fx-err">{err}</div>
  if (!table) return <div className="fx-banner warn">La file n'existe pas encore : lancez le fichier <b>candidats_ct.sql</b> dans Supabase (SQL Editor), puis actualisez.</div>
  if (!liste.length) return <div className="fx-empty">Rien à valider pour l'instant. À chaque analyse de marché, les {type === 'image' ? 'images' : 'vidéos'} qui engagent nettement plus que les autres de leur recherche arrivent ici (6 au plus par balayage).</div>

  return (
    <>
      <p className="fx-s" style={{ margin: '0 0 12px' }}>{liste.length} {type === 'image' ? 'image(s)' : 'vidéo(s)'} trouvée(s) pendant les balayages du marché. « Ajouter » la range dans la galerie{type === 'video' ? ' et lance son analyse complète' : ' avec son nom et ses balises'} ; « Écarter » supprime le fichier.</p>
      <div className={'fx-gal' + (type === 'video' ? ' wide' : '')}>
        {liste.map((c) => {
          const m = c.metriques || {}
          return (
            <div key={c.id} className="fx-ct fx-cand">
              {c.media_url
                ? (type === 'image' ? <img src={c.media_url} alt="" loading="lazy" /> : <video src={c.media_url} poster={c.poster_url || undefined} controls preload="none" playsInline />)
                : <div className="fx-poster vide">Fichier non récupéré{c.erreur ? <><br /><small>{c.erreur}</small></> : null}</div>}
              <div className="b">
                <div className="fx-t wrap">{c.plateforme === 'tiktok' ? 'TikTok' : 'Pub Meta'}{c.auteur ? ' · ' + c.auteur : ''}</div>
                <div className="fx-chips">
                  <span className="fx-chip a">× {Number(c.score_relatif || 0).toLocaleString('fr-FR')} la norme</span>
                  <span className="fx-chip d">{age(c.age_jours)}</span>
                  {c.plateforme === 'tiktok' ? <span className="fx-chip">{nf(m.vues)} vues · {m.engagement_pct} % d'engagement</span> : <span className="fx-chip">active {m.jours_actifs ?? '?'} j{m.variantes > 1 ? ' · ' + m.variantes + ' variantes' : ''}</span>}
                </div>
                <div className="fx-s">Recherche « {c.recherche} »{c.produit ? ' · pour ' + c.produit : ''}{m.contenus_dans_la_recherche ? ' · comparée à ' + m.contenus_dans_la_recherche + ' contenus' : ''}</div>
                {c.texte && <div className="fx-meta">{c.texte}</div>}
                <div className="fx-ct-a">
                  {busy[c.id] ? <span className="fx-s">{busy[c.id]}</span> : <>
                    <button className="fx-btn sm primary" disabled={!c.media_url} onClick={() => accepter(c)}>Ajouter à la galerie</button>
                    <button className="fx-btn sm" onClick={() => refuser(c)}>Écarter</button>
                    {c.lien && <a className="fx-btn sm" href={c.lien} target="_blank" rel="noreferrer">Source</a>}
                  </>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
