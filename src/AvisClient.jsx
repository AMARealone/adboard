// « Votre regard » — le client dit ce qu'il aime, ce qu'il voudrait voir évoluer, sa sensibilité créative (avis-client-v1).
// Trois morceaux : la page « Votre regard », la fenêtre d'avis sur UNE créative (ouverte depuis la galerie), et le petit crochet qui parle au serveur.
// Chaque avis est lu par l'équipe : il devient la boussole personnelle du client et guide les agents. Le client ne voit jamais la mécanique, seulement qu'il est écouté.
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

const SERVER = 'https://adstack-server.onrender.com'
const T = {
  bg: '#0A0C11', card: '#12151C', card2: '#171B24', border: 'rgba(255,255,255,0.08)', borderM: 'rgba(255,255,255,0.16)',
  text: '#F2F4F8', sec: '#9AA3B2', muted: '#667085',
  accent: '#5B8DEF', accentS: 'rgba(91,141,239,0.14)', accentM: 'rgba(91,141,239,0.34)',
  warm: '#F2B766', warmS: 'rgba(242,183,102,0.13)', warmM: 'rgba(242,183,102,0.4)',
  mint: '#5FD4A3', mintS: 'rgba(95,212,163,0.13)', mintM: 'rgba(95,212,163,0.4)',
  amber: '#F2A65A', amberS: 'rgba(242,166,90,0.13)', amberM: 'rgba(242,166,90,0.4)',
}

// ── ce qu'on propose au client (libellés chaleureux ; les codes sont ceux du serveur) ──
export const AXES = [
  { k: 'ton', titre: 'Le ton', bas: 'Doux et rassurant', haut: 'Percutant et direct' },
  { k: 'audace', titre: "L'audace", bas: 'Classique et sûr', haut: 'Osé et surprenant' },
  { k: 'style', titre: 'Le style', bas: 'Épuré et sobre', haut: 'Riche et vivant' },
  { k: 'rendu', titre: 'Le rendu', bas: 'Naturel, comme un vrai client', haut: 'Soigné, façon studio' },
  { k: 'rythme', titre: 'Le rythme', bas: 'Posé', haut: 'Dynamique', video: true },
]
export const AIME = [
  { k: 'message', lib: "Le message et l'accroche" }, { k: 'style', lib: "Le style et l'ambiance" }, { k: 'couleurs', lib: 'Les couleurs' },
  { k: 'produit', lib: 'Le produit bien montré' }, { k: 'texte_ecran', lib: "Les textes à l'écran" }, { k: 'casting', lib: 'Les personnes' },
  { k: 'voix', lib: 'La voix', video: true }, { k: 'rythme', lib: 'Le rythme', video: true },
]
export const AFFINER = [
  { k: 'ton_fort', lib: 'Un ton trop fort' }, { k: 'ton_doux', lib: 'Pas assez percutant' }, { k: 'style', lib: "Pas assez dans l'univers de ma marque" },
  { k: 'trop_charge', lib: 'Trop chargé' }, { k: 'trop_sobre', lib: 'Pas assez riche' }, { k: 'couleurs', lib: 'Les couleurs' },
  { k: 'hors_sujet', lib: 'Ne parle pas assez de mon sujet' }, { k: 'produit_deforme', lib: 'Le produit paraît déformé' },
  { k: 'produit_double', lib: 'Un élément apparaît en double', video: true }, { k: 'texte_faux', lib: 'Un texte ou une orthographe à corriger' },
  { k: 'texte_chevauche', lib: 'Des textes qui se chevauchent' }, { k: 'visage', lib: 'Un visage ou une expression' },
  { k: 'geste', lib: 'Un geste ou un mouvement', video: true }, { k: 'coupe', lib: 'Les coupes entre les plans', video: true },
  { k: 'voix', lib: 'La voix ou le son', video: true }, { k: 'rythme', lib: 'Le rythme', video: true }, { k: 'autre', lib: 'Autre chose' },
]
export const VERDICTS = [
  { k: 'excellente', titre: 'Excellente', sous: "C'est exactement ça", c: T.mint, s: T.mintS, m: T.mintM, icone: 'heart' },
  { k: 'a_affiner', titre: 'Bonne base', sous: 'Quelques ajustements', c: T.accent, s: T.accentS, m: T.accentM, icone: 'sparkle' },
  { k: 'a_retravailler', titre: 'À retravailler', sous: 'Ça ne me ressemble pas encore', c: T.amber, s: T.amberS, m: T.amberM, icone: 'pencil' },
]
const verdictDe = (k) => VERDICTS.find((v) => v.k === k) || null
const libDe = (liste, k) => (liste.find((x) => x.k === k) || {}).lib || k
const estVideo = (c) => !!c && (c.type === 'video' || !!c.videoUrl)
const dateFr = (d) => { try { return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) } catch (_) { return '' } }

// ── icônes (autonomes : ce fichier ne dépend de rien d'autre) ──
const CHEMINS = {
  heart: <path d="M20.840 4.610a5.500 5.5 0 0 0-7.780 0L12 5.670l-1.060-1.060a5.500 5.5 0 0 0-7.780 7.780l1.060 1.060L12 21.230l7.780-7.780 1.060-1.060a5.500 5.5 0 0 0 0-7.780z" />,
  sparkle: <path d="M12 2.5l1.900 5.9 5.9 1.9-5.9 1.9L12 18.1l-1.9-5.9-5.9-1.9 5.9-1.9z" />,
  pencil: <><path d="M4 20l4.200-1 11-11a2.100 2.1 0 0 0-3-3l-11 11z" /><path d="M14.500 6.5l3 3" /></>,
  check: <path d="M5 12.5l4.500 4.5L19 7.5" />,
  x: <><path d="M6 6l12 12" /><path d="M18 6L6 18" /></>,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  chat: <path d="M4 5.5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H10l-5 3.5v-3.5H4a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1z" />,
  play: <path d="M8 5.5v13l11-6.5z" />,
  trash: <><path d="M4 7h16" /><path d="M9 7V4.500h6V7" /><path d="M6.500 7l1 13h9l1-13" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="M15.500 8.5l-2 5-5 2 2-5z" /></>,
}
const Ic = ({ n, s = 16, c = 'currentColor', w = 1.8, fill = false }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill={fill ? c : 'none'} stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>{CHEMINS[n]}</svg>
)

// ── styles partagés (une seule fois dans la page) ──
const CSS = `
.vr-rise{animation:vrRise .5s cubic-bezier(.2,.7,.2,1) both}
@keyframes vrRise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes vrNeedle{0%,100%{transform:rotate(-16deg)}50%{transform:rotate(22deg)}}
@keyframes vrSheet{from{opacity:0;transform:translateY(24px) scale(.985)}to{opacity:1;transform:none}}
@keyframes vrPop{0%{transform:scale(.6);opacity:0}60%{transform:scale(1.08);opacity:1}100%{transform:scale(1)}}
@keyframes vrRing{from{stroke-dashoffset:176}to{stroke-dashoffset:0}}
.vr-needle{transform-origin:50% 50%;animation:vrNeedle 7s ease-in-out infinite}
.vr-chip{transition:background .15s,border-color .15s,color .15s,transform .12s}
.vr-chip:hover{border-color:${T.borderM}}
.vr-chip:active{transform:scale(.97)}
.vr-btn{transition:transform .12s,box-shadow .2s,opacity .2s,background .2s}
.vr-btn:hover:not(:disabled){transform:translateY(-1px)}
.vr-btn:active:not(:disabled){transform:scale(.98)}
.vr-btn:focus-visible,.vr-chip:focus-visible,.vr-step:focus-visible,.vr-card:focus-visible{outline:2px solid ${T.accent};outline-offset:2px}
.vr-area{transition:border-color .15s,box-shadow .15s}
.vr-area:focus{outline:none;border-color:${T.accentM};box-shadow:0 0 0 3px ${T.accentS}}
.vr-scroll{scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.18) transparent}
.vr-scroll::-webkit-scrollbar{width:6px;height:6px}.vr-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,.16);border-radius:6px}
@media (prefers-reduced-motion:reduce){.vr-rise,.vr-needle,.vr-sheet{animation:none!important}.vr-chip,.vr-btn{transition:none!important}}
`
const StyleOnce = () => <style>{CSS}</style>

// ── parler au serveur ──
async function appel(path, { method = 'GET', body, getToken, timeoutMs = 20000 }) {
  let tok = null
  try { tok = await getToken() } catch (_) { tok = null }
  if (!tok) return { ok: false, status: 401, error: 'connexion_requise' }
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const r = await fetch(SERVER + path, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal })
    let data = {}
    try { data = await r.json() } catch (_) { data = {} }
    return { ok: r.ok, status: r.status, data, error: r.ok ? null : (data.error || 'reseau') }
  } catch (_) { return { ok: false, status: 0, error: 'reseau' } } finally { clearTimeout(t) }
}
const messageErreur = (r) => r.status === 401 ? 'Votre session a expiré : reconnectez-vous, votre texte est conservé.'
  : r.status === 429 ? "Vous avez partagé beaucoup de choses en peu de temps. Reprenez dans quelques minutes, c'est précieux pour nous."
  : r.status === 400 ? "Dites-nous au moins une chose, même un simple « j'adore » nous aide."
  : "Votre avis n'a pas pu partir pour l'instant. Réessayez dans un instant : votre texte est conservé."

// Le crochet commun : une seule instance dans la page, partagée par la galerie et la page « Votre regard ».
export function useAvis({ user, getToken, owner }) {
  const [avis, setAvis] = useState([])
  const [etat, setEtat] = useState('init')
  const uid = user && user.id
  const propre = owner && owner !== uid ? owner : null
  const getRef = useRef(getToken); getRef.current = getToken
  const recharger = useCallback(async () => {
    if (!uid) { setAvis([]); setEtat('init'); return }
    const r = await appel('/avis' + (propre ? '?owner=' + encodeURIComponent(propre) : ''), { getToken: () => getRef.current() })
    if (r.ok) { setAvis(r.data.avis || []); setEtat('charge') } else setEtat('indisponible')
  }, [uid, propre])
  useEffect(() => { recharger() }, [recharger])
  const enregistrer = useCallback(async (payload) => {
    const r = await appel('/avis', { method: 'POST', body: { ...payload, owner: propre || undefined }, getToken: () => getRef.current() })
    if (r.ok) await recharger()
    return r
  }, [propre, recharger])
  const retirer = useCallback(async (id) => {
    const r = await appel('/avis/retirer', { method: 'POST', body: { id, owner: propre || undefined }, getToken: () => getRef.current() })
    if (r.ok) await recharger()
    return r
  }, [propre, recharger])
  const parCreative = useMemo(() => { const m = {}; avis.forEach((a) => { if (a.creative_id && !m[a.creative_id]) m[a.creative_id] = a }); return m }, [avis])
  return { avis, etat, parCreative, recharger, enregistrer, retirer }
}

// ── petits éléments ──
const Chip = ({ actif, couleur = T.accent, fond = T.accentS, onClick, children }) => (
  <button type="button" className="vr-chip" aria-pressed={!!actif} onClick={onClick}
    style={{ padding: '9px 14px', minHeight: 40, borderRadius: 999, border: `1px solid ${actif ? couleur : T.border}`, background: actif ? fond : 'rgba(255,255,255,0.03)', color: actif ? T.text : T.sec, fontSize: 13, fontWeight: actif ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
    {actif && <Ic n="check" s={13} c={couleur} w={2.4} />}{children}
  </button>
)
const Zone = ({ valeur, onChange, placeholder, rows = 3, max = 1200, label }) => (
  <div>
    <textarea className="vr-area" aria-label={label} value={valeur} onChange={(e) => onChange(e.target.value.slice(0, max))} placeholder={placeholder} rows={rows}
      style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12, border: `1px solid ${T.border}`, background: 'rgba(255,255,255,0.03)', color: T.text, fontSize: 16, lineHeight: 1.5, fontFamily: 'inherit', resize: 'vertical', minHeight: 54 }} />
    {valeur.length > max * 0.8 && <div style={{ fontSize: 11, color: T.muted, textAlign: 'right', marginTop: 4 }}>{valeur.length}/{max}</div>}
  </div>
)
// Curseur de sensibilité : cinq pas, jamais obligatoire.
const Axe = ({ axe, valeur, onChange }) => (
  <div style={{ padding: '14px 0', borderTop: `1px solid ${T.border}` }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10, gap: 8 }}>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{axe.titre}</span>
      {valeur ? <button type="button" onClick={() => onChange(null)} className="vr-chip" style={{ background: 'none', border: 'none', color: T.muted, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 2px' }}>Je ne sais pas</button>
        : <span style={{ fontSize: 12, color: T.muted }}>Facultatif</span>}
    </div>
    <div role="radiogroup" aria-label={axe.titre} style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((i) => {
        const actif = valeur === i, proche = valeur && Math.abs(valeur - i) === 1
        return <button key={i} type="button" role="radio" aria-checked={actif} aria-label={`${axe.titre} : ${i} sur 5`} className="vr-step" onClick={() => onChange(actif ? null : i)}
          style={{ height: 44, borderRadius: 12, border: `1px solid ${actif ? T.accent : T.border}`, background: actif ? `linear-gradient(135deg, ${T.accent}, #7B6CF0)` : (proche ? T.accentS : 'rgba(255,255,255,0.03)'), cursor: 'pointer', transition: 'background .15s,transform .12s', boxShadow: actif ? `0 6px 18px ${T.accentS}` : 'none', transform: actif ? 'scale(1.04)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ width: actif ? 10 : 6, height: actif ? 10 : 6, borderRadius: '50%', background: actif ? '#fff' : T.muted, transition: 'all .15s' }} />
        </button>
      })}
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 8, fontSize: 12, color: T.sec, lineHeight: 1.35 }}>
      <span style={{ maxWidth: '46%' }}>{axe.bas}</span><span style={{ maxWidth: '46%', textAlign: 'right' }}>{axe.haut}</span>
    </div>
  </div>
)
const Boussole = ({ taille = 120 }) => (
  <svg width={taille} height={taille} viewBox="0 0 120 120" aria-hidden="true" style={{ flexShrink: 0, filter: `drop-shadow(0 10px 30px ${T.accentS})` }}>
    <defs>
      <linearGradient id="vrAig" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={T.warm} /><stop offset="1" stopColor="#F28C66" /></linearGradient>
      <radialGradient id="vrFond" cx="50%" cy="40%" r="70%"><stop offset="0" stopColor="#1E2536" /><stop offset="1" stopColor="#0E1118" /></radialGradient>
    </defs>
    <circle cx="60" cy="60" r="56" fill="url(#vrFond)" stroke={T.borderM} strokeWidth="1.5" />
    <circle cx="60" cy="60" r="46" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="1.5 5" />
    {[0, 90, 180, 270].map((a) => <rect key={a} x="58.5" y="8" width="3" height="9" rx="1.5" fill={a === 0 ? T.warm : 'rgba(255,255,255,0.35)'} transform={`rotate(${a} 60 60)`} />)}
    {[45, 135, 225, 315].map((a) => <rect key={a} x="59.2" y="9" width="1.6" height="6" rx=".8" fill="rgba(255,255,255,0.2)" transform={`rotate(${a} 60 60)`} />)}
    <g className="vr-needle"><path d="M60 22 L67 60 L60 98 L53 60 Z" fill="rgba(255,255,255,0.1)" /><path d="M60 22 L67 60 L53 60 Z" fill="url(#vrAig)" /></g>
    <circle cx="60" cy="60" r="5" fill="#0E1118" stroke={T.warm} strokeWidth="2" />
  </svg>
)

function useVerrou() {
  useEffect(() => {
    let avant = ''
    try { avant = document.body.style.overflow; document.body.style.overflow = 'hidden' } catch (_) { /* rien */ }
    return () => { try { document.body.style.overflow = avant } catch (_) { /* rien */ } }
  }, [])
}

// ── bouton et pastille utilisés dans la galerie ──
export const BoutonAvis = ({ existing, onClick }) => {
  const v = existing && verdictDe(existing.verdict)
  return (
    <button type="button" onClick={onClick} className="vr-btn" data-testid="btn-avis"
      style={{ width: '100%', minHeight: 46, padding: '0 16px', borderRadius: 13, border: `1px solid ${v ? v.m : T.warmM}`, background: `linear-gradient(135deg, ${v ? v.s : T.warmS}, rgba(255,255,255,0.04))`, color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
      <Ic n={v ? v.icone : 'heart'} s={16} c={v ? v.c : T.warm} fill={!v || v.icone === 'heart'} />
      {existing ? <span>Votre avis : {v ? v.titre : 'partagé'} <span style={{ opacity: 0.6, fontWeight: 500 }}>· Modifier</span></span> : 'Donner mon avis sur cette créative'}
    </button>
  )
}
export const PastilleAvis = ({ avis }) => {
  const v = verdictDe(avis && avis.verdict)
  return <div aria-label="Vous avez donné votre avis" title="Vous avez donné votre avis" style={{ position: 'absolute', right: 6, bottom: 6, width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(8,10,14,0.72)', backdropFilter: 'blur(3px)', border: `1px solid ${v ? v.m : T.warmM}`, zIndex: 3, pointerEvents: 'none' }}><Ic n={v && v.icone !== 'heart' ? v.icone : 'heart'} s={11} c={v ? v.c : T.warm} fill={!v || v.icone === 'heart'} /></div>
}

// ── la fenêtre d'avis sur UNE créative ──
export const AvisCreativeModal = ({ creative, produitNom, existing, onSave, onRetirer, onClose, isMobile }) => {
  useVerrou()
  const video = estVideo(creative)
  const e0 = existing || {}
  const [verdict, setVerdict] = useState(e0.verdict || null)
  const [aime, setAime] = useState(e0.aime || [])
  const [aimeTexte, setAimeTexte] = useState(e0.aime_texte || '')
  const [affiner, setAffiner] = useState(e0.affiner || [])
  const [affinerTexte, setAffinerTexte] = useState(e0.affiner_texte || '')
  const [axes, setAxes] = useState(e0.axes || {})
  const [axesOuverts, setAxesOuverts] = useState(!!(e0.axes && Object.keys(e0.axes).length))
  const [etat, setEtat] = useState('edition')   // edition | envoi | ok
  const [erreur, setErreur] = useState('')
  const [retrait, setRetrait] = useState(false)
  const dirty = !!(verdict || aime.length || aimeTexte || affiner.length || affinerTexte) && etat === 'edition' && !existing
  const fermer = () => { if (etat !== 'envoi') onClose() }
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') fermer() }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  })
  const bascule = (liste, set, k) => set(liste.includes(k) ? liste.filter((x) => x !== k) : [...liste, k])
  const envoyer = async () => {
    const ax = {}; AXES.forEach((a) => { if (axes[a.k] && (!a.video || video)) ax[a.k] = axes[a.k] })
    if (!verdict && !aime.length && !aimeTexte.trim() && !affiner.length && !affinerTexte.trim() && !Object.keys(ax).length) { setErreur("Dites-nous au moins une chose, même un simple « j'adore » nous aide."); return }
    setErreur(''); setEtat('envoi')
    const r = await onSave({ product_id: creative.productId, creative_id: creative.id, verdict, aime, aime_texte: aimeTexte.trim(), affiner, affiner_texte: affinerTexte.trim(), axes: ax })
    if (r && r.ok) setEtat('ok'); else { setErreur(messageErreur(r || {})); setEtat('edition') }
  }
  const retirerAvis = async () => {
    if (!existing || !onRetirer) return
    setEtat('envoi'); const r = await onRetirer(existing.id)
    if (r && r.ok) onClose(); else { setErreur('Impossible de retirer pour le moment.'); setEtat('edition'); setRetrait(false) }
  }
  const vignette = creative.thumbUrl || creative.imageUrl
  const titre = String(creative.angle || '').split('*')[0].trim()
  const ChipsAime = AIME.filter((x) => !x.video || video), ChipsAff = AFFINER.filter((x) => !x.video || video)

  const apercu = (
    <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', background: '#0B0D12', border: `1px solid ${T.border}`, aspectRatio: video ? '9/16' : '4/5', maxHeight: isMobile ? 'none' : 'min(62vh, 540px)', margin: '0 auto', width: '100%' }}>
      {vignette ? <img src={vignette} alt={titre} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        : (video && creative.videoUrl) ? <video src={creative.videoUrl + '#t=0.1'} preload="metadata" muted playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
      {video && <div style={{ position: 'absolute', left: 10, bottom: 10, display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 11, fontWeight: 700 }}><Ic n="play" s={10} c="#fff" fill />Vidéo</div>}
    </div>
  )

  const contenu = etat === 'ok' ? (
    <div style={{ textAlign: 'center', padding: isMobile ? '40px 8px 20px' : '70px 20px' }} className="vr-rise">
      <svg width="76" height="76" viewBox="0 0 64 64" aria-hidden="true" style={{ animation: 'vrPop .5s ease both' }}>
        <circle cx="32" cy="32" r="28" fill={T.mintS} stroke={T.mint} strokeWidth="2.5" strokeDasharray="176" style={{ animation: 'vrRing .7s ease both' }} />
        <path d="M20 33l8 8 16-17" fill="none" stroke={T.mint} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <h3 style={{ fontSize: 22, fontWeight: 800, color: T.text, margin: '18px 0 8px', letterSpacing: -0.3 }}>{existing ? 'Votre avis est mis à jour' : "Merci, c'est noté"}</h3>
      <p style={{ fontSize: 14.5, lineHeight: 1.6, color: T.sec, margin: '0 auto 26px', maxWidth: 360 }}>Votre équipe s'en souviendra pour vos prochaines créatives. Plus vous nous dites, plus elles vous ressemblent.</p>
      <button type="button" className="vr-btn" onClick={onClose} style={{ minHeight: 46, padding: '0 28px', borderRadius: 12, border: `1px solid ${T.borderM}`, background: 'rgba(255,255,255,0.06)', color: T.text, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Fermer</button>
    </div>
  ) : (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: isMobile ? 8 : 10 }} role="radiogroup" aria-label="Votre impression générale">
        {VERDICTS.map((v) => {
          const actif = verdict === v.k
          return <button key={v.k} type="button" role="radio" aria-checked={actif} className="vr-chip" onClick={() => setVerdict(actif ? null : v.k)}
            style={{ textAlign: isMobile ? 'center' : 'left', padding: isMobile ? '12px 6px' : '13px 14px', minHeight: isMobile ? 84 : 82, borderRadius: 14, border: `1.5px solid ${actif ? v.c : T.border}`, background: actif ? v.s : 'rgba(255,255,255,0.03)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: isMobile ? 'center' : 'flex-start', justifyContent: isMobile ? 'center' : 'flex-start', gap: isMobile ? 6 : 8, boxShadow: actif ? `0 8px 24px ${v.s}` : 'none' }}>
            <span style={{ width: 32, height: 32, borderRadius: 10, background: actif ? v.s : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Ic n={v.icone} s={17} c={actif ? v.c : T.sec} fill={v.icone === 'heart'} /></span>
            <span><span style={{ display: 'block', fontSize: isMobile ? 13 : 14, fontWeight: 800, color: actif ? T.text : '#D7DCE6' }}>{v.titre}</span>{!isMobile && <span style={{ display: 'block', fontSize: 12, color: T.sec, marginTop: 2 }}>{v.sous}</span>}</span>
          </button>
        })}
      </div>

      <section style={{ marginTop: 26 }}>
        <h4 style={{ fontSize: 14.5, fontWeight: 800, color: T.text, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}><Ic n="heart" s={15} c={T.warm} fill />Ce que vous aimez</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>{ChipsAime.map((x) => <Chip key={x.k} actif={aime.includes(x.k)} couleur={T.mint} fond={T.mintS} onClick={() => bascule(aime, setAime, x.k)}>{x.lib}</Chip>)}</div>
        <Zone valeur={aimeTexte} onChange={setAimeTexte} rows={3} label="Ce que vous aimez" placeholder="Avec vos mots : ce qui vous plaît, ce qu'on doit garder…" />
      </section>

      <section style={{ marginTop: 26 }}>
        <h4 style={{ fontSize: 14.5, fontWeight: 800, color: T.text, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}><Ic n="pencil" s={15} c={T.accent} />Ce que vous aimeriez voir évoluer</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>{ChipsAff.map((x) => <Chip key={x.k} actif={affiner.includes(x.k)} onClick={() => bascule(affiner, setAffiner, x.k)}>{x.lib}</Chip>)}</div>
        <Zone valeur={affinerTexte} onChange={setAffinerTexte} rows={3} label="Ce que vous aimeriez voir évoluer" placeholder="Dites-nous tout : ce qui vous gêne, ce que vous voudriez à la place…" />
      </section>

      <section style={{ marginTop: 22 }}>
        <button type="button" onClick={() => setAxesOuverts((o) => !o)} className="vr-chip" aria-expanded={axesOuverts}
          style={{ width: '100%', minHeight: 48, padding: '0 14px', borderRadius: 13, border: `1px solid ${T.border}`, background: 'rgba(255,255,255,0.03)', color: T.text, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}><Ic n="compass" s={16} c={T.warm} />Régler votre boussole <span style={{ color: T.muted, fontWeight: 500 }}>(facultatif)</span></span>
          <span style={{ transform: axesOuverts ? 'rotate(180deg)' : 'none', transition: 'transform .2s', color: T.sec }}>⌄</span>
        </button>
        {axesOuverts && <div style={{ marginTop: 6 }}>{AXES.filter((a) => !a.video || video).map((a) => <Axe key={a.k} axe={a} valeur={axes[a.k] || null} onChange={(v) => setAxes((o) => { const n = { ...o }; if (v) n[a.k] = v; else delete n[a.k]; return n })} />)}</div>}
      </section>
      {erreur && <div role="alert" style={{ marginTop: 16, padding: '11px 14px', borderRadius: 12, background: T.amberS, border: `1px solid ${T.amberM}`, color: '#F6D2AE', fontSize: 13, lineHeight: 1.5 }}>{erreur}</div>}
    </>
  )

  const pied = etat === 'ok' ? null : (
    <div style={{ padding: isMobile ? '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))' : '14px 24px', borderTop: `1px solid ${T.border}`, background: T.card, display: 'flex', gap: 10, alignItems: 'center', flexWrap: isMobile ? 'nowrap' : 'wrap' }}>
      {existing && onRetirer && (retrait
        ? <><button type="button" className="vr-btn" onClick={retirerAvis} disabled={etat === 'envoi'} style={{ minHeight: 46, padding: '0 14px', borderRadius: 12, border: `1px solid ${T.amberM}`, background: T.amberS, color: '#F6D2AE', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Oui, retirer</button>
            <button type="button" className="vr-btn" onClick={() => setRetrait(false)} style={{ minHeight: 46, padding: '0 12px', borderRadius: 12, border: 'none', background: 'none', color: T.sec, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Non</button></>
        : <button type="button" className="vr-btn" onClick={() => setRetrait(true)} aria-label="Retirer mon avis" style={{ minHeight: 46, minWidth: 46, borderRadius: 12, border: `1px solid ${T.border}`, background: 'rgba(255,255,255,0.03)', color: T.sec, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ic n="trash" s={16} /></button>)}
      {!isMobile && <span style={{ flex: 1 }} />}
      <button type="button" className="vr-btn" onClick={fermer} style={{ minHeight: 46, padding: '0 18px', borderRadius: 12, border: `1px solid ${T.border}`, background: 'transparent', color: T.sec, fontWeight: 600, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>Plus tard</button>
      <button type="button" className="vr-btn" onClick={envoyer} disabled={etat === 'envoi'} data-testid="avis-envoyer"
        style={{ minHeight: 46, padding: '0 24px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${T.accent}, #7B6CF0)`, color: '#fff', fontWeight: 800, fontSize: 14, cursor: etat === 'envoi' ? 'default' : 'pointer', opacity: etat === 'envoi' ? 0.7 : 1, fontFamily: 'inherit', boxShadow: `0 10px 28px ${T.accentS}`, flex: isMobile ? '1 1 0' : '0 0 auto', minWidth: 0 }}>
        {etat === 'envoi' ? 'Envoi…' : existing ? 'Mettre à jour' : 'Envoyer à mon équipe'}
      </button>
    </div>
  )

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Votre avis sur cette créative" data-testid="avis-modal" onClick={() => { if (!dirty) fermer() }}
      style={{ position: 'fixed', inset: 0, zIndex: 100010, background: 'rgba(4,5,9,0.78)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 24 }}>
      <StyleOnce />
      <div className="vr-sheet" onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: isMobile ? 'none' : 940, height: isMobile ? 'min(94dvh, 100%)' : 'auto', maxHeight: isMobile ? '94dvh' : 'min(90vh, 860px)', background: T.card, border: `1px solid ${T.borderM}`, borderRadius: isMobile ? '22px 22px 0 0' : 22, boxShadow: '0 40px 120px rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'vrSheet .35s cubic-bezier(.2,.7,.2,1) both', position: 'relative' }}>
        <div aria-hidden="true" style={{ position: 'absolute', top: -90, right: -60, width: 280, height: 280, borderRadius: '50%', background: `radial-gradient(circle, ${T.warmS}, transparent 68%)`, pointerEvents: 'none' }} />
        <div style={{ position: 'relative', padding: isMobile ? '16px 16px 12px' : '20px 24px 14px', display: 'flex', alignItems: 'flex-start', gap: 12, borderBottom: etat === 'ok' ? 'none' : `1px solid ${T.border}` }}>
          {isMobile && vignette && <img src={vignette} alt="" style={{ width: 46, height: video ? 70 : 58, objectFit: 'cover', borderRadius: 9, border: `1px solid ${T.border}`, flexShrink: 0 }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.4, color: T.warm, textTransform: 'uppercase' }}>Votre regard</div>
            <h3 style={{ fontSize: isMobile ? 18 : 21, fontWeight: 800, color: T.text, margin: '4px 0 3px', letterSpacing: -0.3, lineHeight: 1.2 }}>Votre avis sur cette créative</h3>
            <div style={{ fontSize: 12.5, color: T.sec, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[video ? 'Vidéo' : 'Image', titre, produitNom].filter(Boolean).join(' · ')}</div>
          </div>
          <button type="button" onClick={fermer} aria-label="Fermer" className="vr-btn" style={{ width: 44, height: 44, borderRadius: '50%', border: `1px solid ${T.border}`, background: 'rgba(255,255,255,0.05)', color: T.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Ic n="x" s={16} /></button>
        </div>
        <div className="vr-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: isMobile || etat === 'ok' ? 'block' : 'grid', gridTemplateColumns: '300px minmax(0,1fr)', gap: 28, padding: isMobile ? '16px 16px 24px' : '22px 24px 26px', position: 'relative' }}>
          {!isMobile && etat !== 'ok' && <div style={{ position: 'sticky', top: 0, alignSelf: 'start' }}>{apercu}<p style={{ fontSize: 12.5, lineHeight: 1.55, color: T.sec, margin: '14px 4px 0' }}>Il n'y a pas de mauvaise réponse : dites-nous tout, le positif comme ce que vous aimeriez voir évoluer.</p></div>}
          <div style={{ minWidth: 0 }}>
            {isMobile && etat !== 'ok' && <p style={{ fontSize: 13, lineHeight: 1.55, color: T.sec, margin: '0 0 16px' }}>Il n'y a pas de mauvaise réponse : dites-nous tout, le positif comme ce que vous aimeriez voir évoluer.</p>}
            {contenu}
          </div>
        </div>
        {pied}
      </div>
    </div>, document.body)
}

// ── la page « Votre regard » ──
export const VotreRegard = ({ products = [], user, isMobile, avisStore, notify, onNeedLogin }) => {
  const [produitId, setProduitId] = useState('')
  const [axes, setAxes] = useState({})
  const [aime, setAime] = useState([]); const [aimeTexte, setAimeTexte] = useState('')
  const [affiner, setAffiner] = useState([]); const [affinerTexte, setAffinerTexte] = useState('')
  const [choisies, setChoisies] = useState([])
  const [etat, setEtat] = useState('edition'); const [erreur, setErreur] = useState('')
  const [modifier, setModifier] = useState(null); const [aRetirer, setARetirer] = useState(null)
  const formRef = useRef(null)
  const avis = (avisStore && avisStore.avis) || []
  const creaParId = useMemo(() => { const m = {}; products.forEach((p) => (p.creatives || []).forEach((c) => { if (c && c.id) m[c.id] = { ...c, productId: c.productId || p.id, _produit: p.nom || '' } })); return m }, [products])
  const produitDe = (id) => (products.find((p) => String(p.id) === String(id)) || {}).nom || ''
  const recentes = useMemo(() => Object.values(creaParId).filter((c) => c.imageUrl || c.thumbUrl || c.videoUrl).filter((c) => !produitId || String(c.productId) === String(produitId)).slice(0, 36), [creaParId, produitId])
  const nbAdorees = Object.values((avisStore && avisStore.parCreative) || {}).filter((a) => a.verdict === 'excellente').length
  const bascule = (liste, set, k) => set(liste.includes(k) ? liste.filter((x) => x !== k) : [...liste, k])
  const vide = () => { setAxes({}); setAime([]); setAimeTexte(''); setAffiner([]); setAffinerTexte(''); setChoisies([]) }
  const envoyer = async () => {
    if (!user) { onNeedLogin && onNeedLogin(); return }
    const ax = {}; AXES.forEach((a) => { if (axes[a.k]) ax[a.k] = axes[a.k] })
    if (!aime.length && !aimeTexte.trim() && !affiner.length && !affinerTexte.trim() && !Object.keys(ax).length) { setErreur("Dites-nous au moins une chose : un curseur, un mot, une case. Tout nous aide."); return }
    setErreur(''); setEtat('envoi')
    const r = await avisStore.enregistrer({ product_id: produitId || undefined, creative_ids: choisies, aime, aime_texte: aimeTexte.trim(), affiner, affiner_texte: affinerTexte.trim(), axes: ax })
    if (r.ok) { setEtat('ok'); vide(); notify && notify('Merci, votre équipe a bien reçu votre regard', 'success') } else { setErreur(messageErreur(r)); setEtat('edition') }
  }
  const nbCreatives = Object.keys((avisStore && avisStore.parCreative) || {}).length
  const carte = { background: `linear-gradient(160deg, ${T.card2}, ${T.card})`, border: `1px solid ${T.border}`, borderRadius: 20, padding: isMobile ? 18 : 26, position: 'relative', overflow: 'hidden' }
  const titreSection = (n, t, sous) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
      <span style={{ width: 28, height: 28, borderRadius: 9, background: T.accentS, color: T.accent, fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</span>
      <div><h2 style={{ fontSize: 17, fontWeight: 800, color: T.text, margin: 0, letterSpacing: -0.2 }}>{t}</h2>{sous && <div style={{ fontSize: 12.5, color: T.muted, marginTop: 2 }}>{sous}</div>}</div>
    </div>)

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: isMobile ? 16 : 20, paddingBottom: 40 }}>
      <StyleOnce />
      <section className="vr-rise" style={{ ...carte, padding: isMobile ? '24px 18px' : '36px 38px', background: `radial-gradient(120% 140% at 100% 0%, rgba(123,108,240,0.20), transparent 55%), radial-gradient(90% 120% at 0% 100%, ${T.warmS}, transparent 60%), ${T.card}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 18 : 34, flexDirection: isMobile ? 'column-reverse' : 'row', textAlign: isMobile ? 'center' : 'left' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: 1.6, color: T.warm, textTransform: 'uppercase', marginBottom: 10 }}>Votre regard</div>
            <h1 style={{ fontSize: isMobile ? 26 : 34, fontWeight: 800, color: T.text, margin: 0, letterSpacing: -0.8, lineHeight: 1.12, textWrap: 'balance' }}>Votre regard façonne <span style={{ background: `linear-gradient(90deg, ${T.warm}, #F28C66)`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>vos prochaines créatives</span></h1>
            <p style={{ fontSize: isMobile ? 14 : 15.5, lineHeight: 1.65, color: T.sec, margin: '14px 0 0', maxWidth: 520 }}>Ce que vous adorez, ce que vous aimeriez voir évoluer, votre sensibilité : votre équipe retient chaque mot et s'en sert à chaque production.</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 22, justifyContent: isMobile ? 'center' : 'flex-start' }}>
              <button type="button" className="vr-btn" onClick={() => formRef.current && formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })} style={{ minHeight: 48, padding: '0 24px', borderRadius: 13, border: 'none', background: `linear-gradient(135deg, ${T.accent}, #7B6CF0)`, color: '#fff', fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit', boxShadow: `0 12px 32px ${T.accentS}` }}>Partager mon ressenti</button>
              {avis.length > 0 && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12.5, color: T.sec, padding: '8px 13px', borderRadius: 999, border: `1px solid ${T.border}`, background: 'rgba(255,255,255,0.03)' }}><b style={{ color: T.text }}>{avis.length}</b> remarque{avis.length > 1 ? 's' : ''} partagée{avis.length > 1 ? 's' : ''}</span>
                {nbAdorees > 0 && <span style={{ fontSize: 12.5, color: T.sec, padding: '8px 13px', borderRadius: 999, border: `1px solid ${T.mintM}`, background: T.mintS }}><b style={{ color: T.mint }}>{nbAdorees}</b> créative{nbAdorees > 1 ? 's' : ''} adorée{nbAdorees > 1 ? 's' : ''}</span>}
              </div>}
            </div>
          </div>
          <Boussole taille={isMobile ? 104 : 150} />
        </div>
      </section>

      {!user ? (
        <section style={{ ...carte, textAlign: 'center' }}>
          <p style={{ fontSize: 15, color: T.text, fontWeight: 700, margin: '0 0 6px' }}>Connectez-vous pour partager votre regard</p>
          <p style={{ fontSize: 13.5, color: T.sec, margin: '0 0 18px' }}>Vos remarques sont rattachées à votre espace et suivent chacune de vos productions.</p>
          <button type="button" className="vr-btn" onClick={() => onNeedLogin && onNeedLogin()} style={{ minHeight: 46, padding: '0 24px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${T.accent}, #7B6CF0)`, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Se connecter</button>
        </section>
      ) : (
        <div ref={formRef} style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 16 : 20, scrollMarginTop: 12 }}>
          {etat === 'ok' ? (
            <section className="vr-rise" data-testid="avis-merci" style={{ ...carte, textAlign: 'center', padding: isMobile ? '34px 18px' : '50px 30px' }}>
              <svg width="72" height="72" viewBox="0 0 64 64" aria-hidden="true" style={{ animation: 'vrPop .5s ease both' }}><circle cx="32" cy="32" r="28" fill={T.mintS} stroke={T.mint} strokeWidth="2.5" strokeDasharray="176" style={{ animation: 'vrRing .7s ease both' }} /><path d="M20 33l8 8 16-17" fill="none" stroke={T.mint} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: T.text, margin: '16px 0 8px' }}>Merci, c'est noté</h2>
              <p style={{ fontSize: 14.5, color: T.sec, lineHeight: 1.6, margin: '0 auto 22px', maxWidth: 420 }}>Votre équipe s'en souviendra pour vos prochaines créatives.</p>
              <button type="button" className="vr-btn" onClick={() => setEtat('edition')} style={{ minHeight: 46, padding: '0 24px', borderRadius: 12, border: `1px solid ${T.borderM}`, background: 'rgba(255,255,255,0.06)', color: T.text, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Ajouter autre chose</button>
            </section>
          ) : (<>
            <section className="vr-rise" style={carte}>
              {titreSection(1, 'Votre sensibilité créative')}
              {products.length > 1 && (
                <div className="vr-scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 6 }} role="group" aria-label="Pour quel produit">
                  <Chip actif={!produitId} onClick={() => setProduitId('')}>Toute ma marque</Chip>
                  {products.map((p) => <Chip key={p.id} actif={String(produitId) === String(p.id)} onClick={() => setProduitId(String(p.id))}>{p.nom || 'Produit'}</Chip>)}
                </div>)}
              <div>{AXES.map((a) => <Axe key={a.k} axe={a} valeur={axes[a.k] || null} onChange={(v) => setAxes((o) => { const n = { ...o }; if (v) n[a.k] = v; else delete n[a.k]; return n })} />)}</div>
            </section>

            <section className="vr-rise" style={carte}>
              {titreSection(2, 'Avec vos mots')}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 26 : 30 }}>
                <div>
                  <h3 style={{ fontSize: 14.5, fontWeight: 800, color: T.text, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}><Ic n="heart" s={15} c={T.warm} fill />Ce que vous adorez</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>{AIME.map((x) => <Chip key={x.k} actif={aime.includes(x.k)} couleur={T.mint} fond={T.mintS} onClick={() => bascule(aime, setAime, x.k)}>{x.lib}</Chip>)}</div>
                  <Zone valeur={aimeTexte} onChange={setAimeTexte} rows={4} label="Ce que vous adorez" placeholder="Ce qui vous ressemble, ce qu'on doit toujours garder…" />
                </div>
                <div>
                  <h3 style={{ fontSize: 14.5, fontWeight: 800, color: T.text, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}><Ic n="pencil" s={15} c={T.accent} />Ce que vous aimeriez voir évoluer</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>{AFFINER.map((x) => <Chip key={x.k} actif={affiner.includes(x.k)} onClick={() => bascule(affiner, setAffiner, x.k)}>{x.lib}</Chip>)}</div>
                  <Zone valeur={affinerTexte} onChange={setAffinerTexte} rows={4} label="Ce que vous aimeriez voir évoluer" placeholder="Une envie, une idée, une gêne : on vous écoute…" />
                </div>
              </div>
            </section>

            {recentes.length > 0 && (
              <section className="vr-rise" style={carte}>
                {titreSection(3, 'À propos de créatives en particulier', 'Facultatif')}
                <div className="vr-scroll" style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 10 }}>
                  {recentes.map((c) => {
                    const sel = choisies.includes(c.id), v = estVideo(c)
                    return <button key={c.id} type="button" className="vr-card" aria-pressed={sel} onClick={() => setChoisies((l) => l.includes(c.id) ? l.filter((x) => x !== c.id) : l.length >= 6 ? l : [...l, c.id])}
                      style={{ position: 'relative', flex: '0 0 auto', width: isMobile ? 82 : 96, aspectRatio: '4/5', borderRadius: 12, overflow: 'hidden', padding: 0, border: `2px solid ${sel ? T.accent : T.border}`, background: '#0B0D12', cursor: 'pointer', transform: sel ? 'scale(.96)' : 'none', transition: 'transform .15s,border-color .15s' }}>
                      {(c.thumbUrl || c.imageUrl) && <img src={c.thumbUrl || c.imageUrl} alt={c.angle || ''} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                      {v && <span style={{ position: 'absolute', left: 5, bottom: 5, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ic n="play" s={8} c="#fff" fill /></span>}
                      {sel && <span style={{ position: 'absolute', top: 5, right: 5, width: 20, height: 20, borderRadius: '50%', background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ic n="check" s={12} c="#fff" w={2.6} /></span>}
                    </button>
                  })}
                </div>
                {choisies.length > 0 && <div style={{ fontSize: 12.5, color: T.sec, marginTop: 4 }}>{choisies.length} créative{choisies.length > 1 ? 's' : ''} jointe{choisies.length > 1 ? 's' : ''} à votre message</div>}
              </section>)}

            {erreur && <div role="alert" style={{ padding: '12px 16px', borderRadius: 13, background: T.amberS, border: `1px solid ${T.amberM}`, color: '#F6D2AE', fontSize: 13.5, lineHeight: 1.5 }}>{erreur}</div>}
            <div style={{ display: 'flex', justifyContent: isMobile ? 'stretch' : 'flex-end' }}>
              <button type="button" className="vr-btn" onClick={envoyer} disabled={etat === 'envoi'} data-testid="regard-envoyer"
                style={{ minHeight: 52, padding: '0 34px', borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${T.accent}, #7B6CF0)`, color: '#fff', fontWeight: 800, fontSize: 15, cursor: etat === 'envoi' ? 'default' : 'pointer', opacity: etat === 'envoi' ? 0.7 : 1, fontFamily: 'inherit', boxShadow: `0 14px 36px ${T.accentS}`, width: isMobile ? '100%' : 'auto' }}>
                {etat === 'envoi' ? 'Envoi…' : 'Envoyer à mon équipe'}
              </button>
            </div>
          </>)}
        </div>
      )}

      {user && (
        <section style={carte} aria-label="Vos remarques">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: T.text, margin: 0 }}>Vos remarques</h2>
            {nbCreatives > 0 && <span style={{ fontSize: 12.5, color: T.muted }}>{nbCreatives} créative{nbCreatives > 1 ? 's' : ''} commentée{nbCreatives > 1 ? 's' : ''}</span>}
          </div>
          {avis.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '26px 10px 14px', color: T.sec }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Boussole taille={64} /></div>
              <p style={{ fontSize: 14, lineHeight: 1.6, margin: 0, maxWidth: 380, marginInline: 'auto' }}>Votre première remarque guidera déjà votre prochaine production. Vous pouvez aussi donner votre avis directement depuis la galerie, en ouvrant une créative.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {avis.slice(0, 30).map((a) => {
                const c = a.creative_id ? creaParId[a.creative_id] : null, v = verdictDe(a.verdict)
                const texte = a.aime_texte || a.affiner_texte || ''
                const pastilles = [...(a.aime || []).map((k) => ({ k: 'a' + k, lib: libDe(AIME, k), c: T.mint })), ...(a.affiner || []).map((k) => ({ k: 'f' + k, lib: libDe(AFFINER, k), c: T.accent }))].slice(0, 4)
                return (
                  <article key={a.id} style={{ display: 'flex', gap: 14, padding: 14, borderRadius: 15, border: `1px solid ${T.border}`, background: 'rgba(255,255,255,0.025)', alignItems: 'flex-start' }}>
                    {c && (c.thumbUrl || c.imageUrl) ? <img src={c.thumbUrl || c.imageUrl} alt="" style={{ width: 54, aspectRatio: '4/5', objectFit: 'cover', borderRadius: 10, border: `1px solid ${T.border}`, flexShrink: 0 }} />
                      : <span style={{ width: 54, aspectRatio: '4/5', borderRadius: 10, background: T.warmS, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Ic n={a.portee === 'creative' ? 'heart' : 'chat'} s={18} c={T.warm} fill={a.portee === 'creative'} /></span>}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                        {v && <span style={{ fontSize: 11.5, fontWeight: 800, color: v.c, background: v.s, border: `1px solid ${v.m}`, padding: '3px 10px', borderRadius: 999 }}>{v.titre}</span>}
                        <span style={{ fontSize: 12.5, color: T.muted }}>{a.creative_id ? (String(a.angle || (c && c.angle) || 'Créative').split('*')[0]) : (a.product_id ? produitDe(a.product_id) || 'Un produit' : 'Toute ma marque')} · {dateFr(a.date)}</span>
                      </div>
                      {texte && <p style={{ fontSize: 14, lineHeight: 1.55, color: '#D7DCE6', margin: '0 0 8px', overflowWrap: 'anywhere', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{texte}</p>}
                      {pastilles.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{pastilles.map((p) => <span key={p.k} style={{ fontSize: 11.5, color: T.sec, padding: '3px 9px', borderRadius: 999, border: `1px solid ${T.border}` }}>{p.lib}</span>)}</div>}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: T.mint, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Ic n="check" s={12} c={T.mint} w={2.4} />Mémorisé par votre équipe</span>
                        {c && <button type="button" onClick={() => setModifier({ creative: c, avis: a })} style={{ background: 'none', border: 'none', color: T.accent, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: '8px 0' }}>Modifier</button>}
                        {aRetirer === a.id
                          ? <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center', fontSize: 12.5 }}><button type="button" onClick={async () => { await avisStore.retirer(a.id); setARetirer(null) }} style={{ background: 'none', border: 'none', color: T.amber, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: '8px 0' }}>Oui, retirer</button><button type="button" onClick={() => setARetirer(null)} style={{ background: 'none', border: 'none', color: T.sec, cursor: 'pointer', fontFamily: 'inherit', padding: '8px 0' }}>Non</button></span>
                          : <button type="button" onClick={() => setARetirer(a.id)} style={{ background: 'none', border: 'none', color: T.muted, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', padding: '8px 0' }}>Retirer</button>}
                      </div>
                    </div>
                  </article>)
              })}
            </div>)}
        </section>)}

      {modifier && <AvisCreativeModal creative={modifier.creative} produitNom={produitDe(modifier.creative.productId)} existing={modifier.avis} isMobile={isMobile} onSave={avisStore.enregistrer} onRetirer={avisStore.retirer} onClose={() => setModifier(null)} />}
    </div>
  )
}
