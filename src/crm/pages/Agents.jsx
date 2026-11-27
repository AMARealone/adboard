import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCrm } from '../store'
import { N, quand } from '../domain/notes'
import { appelAffiche, appelEcheance, appelProgrammeTs } from '../domain/rules'
import { serveurAdminJson } from '../api'
import { Chip, Empty, Modal, Seg, toast } from '../ui'
import { infosProspect } from './common'
import { KhalilPortrait, AgentAVenir } from '../KhalilArt'

// khalil-crm-v1 (27 nov. 2026) — Section « Agents » d'AdStats : l'équipe commerciale. Khalil (Sales) mène les appels de vente
// dans Google Meet ; il connaît chaque prospect qui a réservé un appel (toute sa fiche). Deux autres agents suivront.

async function khalil(path, method = 'GET', body) {
  try { return await serveurAdminJson(path, method, body) }
  catch (e) { throw new Error(/HTTP 404|Unexpected token|not valid JSON/i.test(e.message) ? 'Le serveur ne connaît pas encore Khalil : déployez serveur.js et appel_khalil.js sur Render.' : e.message) }
}

export default function Agents() {
  const nav = useNavigate()
  const { prospects } = useCrm()
  const nAppels = prospects.filter(appelAffiche).length
  return (<>
    <p className="kh-intro">L'équipe commerciale d'AdStack. Chaque agent a accès aux données du CRM et travaille sur une partie de la vente.</p>
    <div className="kh-grille">
      <button className="kh-carte" onClick={() => nav('/agents/khalil')}>
        <div className="kh-art"><KhalilPortrait /></div>
        <div className="kh-corps">
          <div className="kh-tete"><b>Khalil</b><Chip c="bl">SALES</Chip></div>
          <div className="kh-role">Responsable collaborateur</div>
          <p>Mène les appels de vente sur Google Meet : découverte, présentation, objections, lien de paiement et première demande dans AdBoard.</p>
          <div className="kh-pied"><span>{nAppels} appel{nAppels > 1 ? 's' : ''} réservé{nAppels > 1 ? 's' : ''} à préparer</span><i>Ouvrir →</i></div>
        </div>
      </button>
      {[1, 2].map((i) => (
        <div key={i} className="kh-carte avenir">
          <div className="kh-art"><AgentAVenir /></div>
          <div className="kh-corps"><div className="kh-tete"><b>Bientôt</b></div><p>Un nouvel agent rejoindra l'équipe ici.</p></div>
        </div>))}
    </div>
  </>)
}

// ── Page de Khalil ─────────────────────────────────────────────────────────
const prenomDe = (n) => n.closing_prenom || String(n.form_nom || '').trim().split(/\s+/)[0] || ''
const offreDe = (n) => (/growth|scale/i.test(n.closing_offre || n.ecrit_offre || '') ? 'growth' : 'perf')

function corpsAppel(p, cfg, offre, meet) {
  const n = N(p)
  return { meet: meet || '', prenom: prenomDe(n), marque: p.nom_marque || '', produit: p.produit || '', page_produit: p.page_produit || '', pays: p.pays || '', offre, contexte: infosProspect(p, cfg) }
}

function Lancer({ titre, initial, onClose, onLance }) {
  const [v, setV] = useState(initial)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }))
  const go = async (test) => {
    if (!test && !/^https:\/\/meet\.google\.com\//.test(v.meet.trim())) { toast('Collez le lien Google Meet (https://meet.google.com/…)'); return }
    const fen = test ? window.open('about:blank', '_blank') : null   // ouverte tout de suite, sinon le navigateur bloque la fenêtre
    setBusy(true)
    try {
      const r = await khalil('/khalil/lancer', 'POST', { ...v, meet: test ? '' : v.meet.trim() })
      if (test) { if (fen) fen.location = r.page; else window.open(r.page, '_blank'); toast('Test ouvert : cliquez sur le bouton, autorisez le micro, et jouez le prospect.') }
      else toast('Khalil arrive dans le Meet : admettez-le quand il frappe à la porte.')
      onLance(r.session, test); onClose()
    } catch (e) { if (fen) fen.close(); toast(e.message, 7000) } finally { setBusy(false) }
  }
  return (
    <Modal title={titre} onClose={onClose}>
      <div className="kh-form">
        <label>Lien Google Meet <small>(pas besoin pour un test)</small></label><input value={v.meet} onChange={set('meet')} placeholder="https://meet.google.com/abc-defg-hij" />
        <div className="kh-2"><div><label>Prénom</label><input value={v.prenom} onChange={set('prenom')} /></div><div><label>Marque</label><input value={v.marque} onChange={set('marque')} /></div></div>
        <div className="kh-2"><div><label>Produit</label><input value={v.produit} onChange={set('produit')} /></div><div><label>Pays</label><input value={v.pays} onChange={set('pays')} /></div></div>
        <label>Page produit</label><input value={v.page_produit} onChange={set('page_produit')} placeholder="https://…" />
        <label>Présentation</label>
        <Seg value={v.offre} onChange={(o) => setV((s) => ({ ...s, offre: o }))} options={[['perf', 'PERF+ (réduite : ONE SHOT)'], ['growth', 'GROWTH (réduite : PERF+)']]} />
        <label>Ce que Khalil sait du prospect</label><textarea rows={7} value={v.contexte} onChange={set('contexte')} />
        <div className="cx-act">
          <button className="cx-btn" disabled={busy} onClick={() => go(true)}>Tester dans mon navigateur</button>
          <button className="cx-btn primary" disabled={busy} onClick={() => go(false)}>{busy ? 'Envoi…' : 'Envoyer Khalil dans le Meet'}</button>
        </div>
      </div>
    </Modal>
  )
}

function Suivi({ session, test, onFermer }) {
  const [d, setD] = useState(null), [err, setErr] = useState('')
  const boite = useRef(null)
  useEffect(() => {
    let vivant = true
    const tour = () => khalil('/khalil/suivi?session=' + encodeURIComponent(session)).then((j) => { if (vivant) { setD(j); setErr('') } }).catch((e) => vivant && setErr(e.message))
    tour(); const t = setInterval(tour, 4000)
    return () => { vivant = false; clearInterval(t) }
  }, [session])
  useEffect(() => { if (boite.current) boite.current.scrollTop = 1e9 }, [d])
  const fini = d && (d.journal || []).some((l) => /fin de l'appel/.test(l))
  return (
    <section className="cx-bloc kh-suivi">
      <header><b>{test ? 'Test en cours' : 'Appel en cours'}{d && d.ctx ? ' · ' + (d.ctx.marque || d.ctx.prenom || '') : ''}</b>
        <span className="cx-note">{fini ? 'terminé' : 'en direct'}{d && d.statut_bot ? ' · bot : ' + [].concat(d.statut_bot).join(' → ') : ''}</span>
        <button className="cx-btn ghost sm" onClick={onFermer}>Fermer</button></header>
      <div className="kh-journal" ref={boite}>{err ? err : d ? (d.journal || []).map((l, i) => <div key={i} className={/Khalil :/.test(l) ? 'k' : /Prospect :/.test(l) ? 'p' : 's'}>{l}</div>) : 'Chargement…'}</div>
    </section>
  )
}

// khalil-v2 — les appels et tests passés, avec leur transcription : Amar relit, copie, et l'envoie pour corriger Khalil.
function Transcriptions() {
  const [liste, setListe] = useState(null), [err, setErr] = useState('')
  const [vue, setVue] = useState(null)   // { id, texte, resume }
  const charger = () => khalil('/khalil/conversations').then((j) => { setListe(j.conversations || []); setErr('') }).catch((e) => setErr(e.message))
  useEffect(() => { charger() }, [])
  const ouvrir = async (c) => { try { setVue({ id: c.id, texte: 'Chargement…' }); setVue(await khalil('/khalil/conversation?id=' + encodeURIComponent(c.id))) } catch (e) { setVue(null); toast(e.message, 7000) } }
  const duree = (s) => Math.floor(s / 60) + ' min ' + String(s % 60).padStart(2, '0')
  return (<>
    <h3 className="kh-h3">Appels et tests passés {liste && <span>{liste.length}</span>}<button className="cx-btn ghost sm" style={{ marginLeft: 'auto' }} onClick={charger}>Actualiser</button></h3>
    {err ? <Empty t="Transcriptions indisponibles" s={err} /> : !liste ? <Empty t="Chargement…" /> : !liste.length ? <Empty t="Aucun appel pour l'instant" s="Chaque test et chaque appel apparaît ici avec sa transcription." />
      : liste.map((c) => (
        <div key={c.id} className="cx-row">
          <div className="cx-main"><div className="cx-line"><b>{c.debut ? quand(new Date(c.debut).toISOString()) : 'Appel'}</b><Chip>{duree(c.duree_s)}</Chip><Chip>{c.messages} messages</Chip></div>{c.resume && <div className="cx-meta"><span>{c.resume}</span></div>}</div>
          <div className="cx-acts"><button className="cx-btn sm" onClick={() => ouvrir(c)}>Voir la transcription</button></div>
        </div>))}
    {vue && <Modal title="Transcription" onClose={() => setVue(null)} wide>
      {vue.resume && <p className="kh-resume">{vue.resume}</p>}
      <div className="kh-journal kh-transcrit">{String(vue.texte || '').split('\n').map((l, i) => <div key={i} className={/ Khalil :/.test(l) ? 'k' : 'p'}>{l}</div>)}</div>
      <div className="cx-act"><button className="cx-btn primary" onClick={async () => { try { await navigator.clipboard.writeText(vue.texte || ''); toast('Transcription copiée : collez-la à Claude avec vos remarques.') } catch (_) { toast('Copie impossible : sélectionnez le texte à la main.') } }}>Copier la transcription</button></div>
    </Modal>}
  </>)
}

export function AgentKhalil() {
  const { prospects, cfg } = useCrm()
  const [etat, setEtat] = useState(null), [maj, setMaj] = useState(false)
  const [ouvert, setOuvert] = useState(null)       // { titre, initial }
  const [suivi, setSuivi] = useState(null)         // { session, test }
  const appels = useMemo(() => prospects.filter(appelAffiche).sort((a, b) => (appelEcheance(N(a)) || 9e15) - (appelEcheance(N(b)) || 9e15)), [prospects])
  const charger = () => khalil('/khalil/etat').then(setEtat).catch((e) => setEtat({ erreur: e.message }))
  useEffect(() => { charger() }, [])
  const mettreAJour = async () => {
    setMaj(true)
    try { const r = await khalil('/khalil/agent', 'POST', {}); toast('Khalil est à jour chez ElevenLabs.'); charger(); return r } catch (e) { toast(e.message, 7000) } finally { setMaj(false) }
  }
  const pret = etat && !etat.erreur && etat.elevenlabs && etat.recall
  return (<>
    <section className="kh-hero">
      <div className="kh-hero-art"><KhalilPortrait parle={!!suivi} /></div>
      <div className="kh-hero-txt">
        <div className="kh-kicker">Agent · Sales</div>
        <h1>Khalil</h1>
        <div className="kh-role">Responsable collaborateur d'AdStack</div>
        <p>Il mène l'appel de vente de bout en bout dans Google Meet : il partage la page produit du prospect puis vos slides, pose les questions, répond aux objections, envoie le lien de paiement dans le chat et accompagne jusqu'à la première demande dans AdBoard. Il connaît toute la fiche du prospect.</p>
        <div className="kh-etat">
          {!etat ? <Chip>Vérification…</Chip> : etat.erreur ? <Chip c="red">{etat.erreur}</Chip> : <>
            <Chip c={etat.elevenlabs ? 'ok' : 'red'}>{etat.elevenlabs ? 'VOIX ELEVENLABS ✓' : 'CLÉ ELEVENLABS MANQUANTE'}</Chip>
            <Chip c={etat.voix_choisie ? 'ok' : 'wa'}>{etat.voix_choisie ? 'VOIX KHALIL ✓' : 'VOIX PAR DÉFAUT'}</Chip>
            <Chip c={etat.recall ? 'ok' : 'red'}>{etat.recall ? 'MEET (RECALL) ✓' : 'CLÉ RECALL MANQUANTE'}</Chip>
            <Chip c={etat.agent ? 'bl' : 'mu'}>{etat.agent ? 'AGENT INSTALLÉ' : 'AGENT À INSTALLER'}</Chip>
            {etat.cerveau && <Chip title="Modèle qui raisonne">CERVEAU · {etat.cerveau}</Chip>}{etat.voix_modele && <Chip title="Modèle de voix">VOIX · {etat.voix_modele}</Chip>}</>}
        </div>
        <div className="kh-boutons">
          <button className="cx-btn primary" disabled={!pret} onClick={() => setOuvert({ titre: 'Test libre avec Khalil', initial: { meet: '', prenom: '', marque: '', produit: '', page_produit: '', pays: '', offre: 'perf', contexte: '' } })}>Test libre</button>
          <button className="cx-btn" disabled={maj || !(etat && etat.elevenlabs)} onClick={mettreAJour}>{maj ? 'Mise à jour…' : 'Mettre à jour Khalil'}</button>
        </div>
      </div>
    </section>

    {suivi && <Suivi session={suivi.session} test={suivi.test} onFermer={() => setSuivi(null)} />}

    <h3 className="kh-h3">Appels réservés <span>{appels.length}</span></h3>
    {appels.length ? appels.map((p) => {
      const n = N(p), pr = appelProgrammeTs(n)
      return (
        <div key={p.id} className="cx-row">
          <div className="cx-main">
            <div className="cx-line"><b className="kh-marque">{p.nom_marque || '—'}</b>{prenomDe(n) && <Chip>{prenomDe(n)}</Chip>}<Chip c={offreDe(n) === 'growth' ? 'off' : 'bl'}>{offreDe(n) === 'growth' ? 'GROWTH' : 'PERF+'}</Chip></div>
            <div className="cx-meta">{p.produit && <span>{p.produit}</span>}{p.pays && <span>{p.pays}</span>}{p.page_produit ? <a href={p.page_produit} target="_blank" rel="noreferrer">Page produit ↗</a> : <span className="red">pas de page produit</span>}</div>
            <div className="cx-when">{pr !== null ? <>📅 {quand(n.appel_programme_at)}</> : <>Réservé {quand(n.appel_reserve_at)} · date à programmer</>}</div>
          </div>
          <div className="cx-acts">
            <button className="cx-btn sm" disabled={!pret} onClick={() => setOuvert({ titre: 'Test · ' + (p.nom_marque || ''), initial: corpsAppel(p, cfg, offreDe(n), '') })}>Tester avec ce prospect</button>
            <button className="cx-btn primary sm" disabled={!pret} onClick={() => setOuvert({ titre: 'Appel · ' + (p.nom_marque || ''), initial: corpsAppel(p, cfg, offreDe(n), n.lien_meet || '') })}>Envoyer dans le Meet</button>
          </div>
        </div>)
    }) : <Empty t="Aucun appel réservé" s="Les réservations du site et du CRM arrivent ici : Khalil connaît déjà leur fiche." />}

    {etat && etat.elevenlabs && <Transcriptions />}

    {ouvert && <Lancer titre={ouvert.titre} initial={ouvert.initial} onClose={() => setOuvert(null)} onLance={(session, test) => setSuivi({ session, test })} />}
  </>)
}
