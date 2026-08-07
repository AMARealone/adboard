import { useState, useEffect, useRef, Fragment } from "react";
import { createPortal } from "react-dom";

// ── Supabase Auth ──────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://mifljhsusidgzelnswma.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZmxqaHN1c2lkZ3plbG5zd21hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MjI2MzQsImV4cCI6MjA5MzQ5ODYzNH0.AX4Xu0sP2tgjLhZSbCKhtw4Q3sd7GRMJ2aMKK3GfzUc';

// ── Web Push (notifications navigateur) ─────────────────────────────────────
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

// Détecte l'état actuel : 'unsupported' | 'denied' | 'default' | 'enabled'
async function getPushStatus() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'default';
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return 'default';
    const sub = await reg.pushManager.getSubscription();
    return sub ? 'enabled' : 'default';
  } catch(e) { return 'default'; }
}

// Identifiant anonyme persistant — permet d'activer les notifs AVANT la connexion Google.
// Relié au vrai compte automatiquement dès que la personne se connecte (voir mergeAnonPush).
function getAnonId() {
  let id = localStorage.getItem('adstack_anon_id');
  if (!id) {
    id = 'anon_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem('adstack_anon_id', id);
  }
  return id;
}

// Déclenché explicitement (toggle) — demande la permission navigateur en réponse directe au clic
async function registerPushSubscription(userId) {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    if (Notification.permission === 'denied') return false;

    const reg = await navigator.serviceWorker.register('/sw.js');
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return false;

    const keyRes = await fetch('https://adstack-server.onrender.com/push-vapid-key');
    const { key } = await keyRes.json();
    if (!key) return false;

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });

    // Avec un compte connu, ou avec un identifiant anonyme si pas encore connecté
    const body = userId
      ? { user_id: userId, subscription: sub.toJSON() }
      : { anon_id: getAnonId(), subscription: sub.toJSON() };

    await fetch('https://adstack-server.onrender.com/push-subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return true;
  } catch(e) { return false; }
}

// Supabase Auth helpers (sans SDK — fetch natif)
// Déclenche une notif push+in-app pour une action côté client (fire-and-forget, ne bloque jamais l'action)
function notifyAction(userId, action, name) {
  if (!userId) return;
  fetch('https://adstack-server.onrender.com/notify-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, action, name })
  }).catch(()=>{});
}

const sbAuth = {
  signInWithGoogle: () => {
    const redirectTo = encodeURIComponent(window.location.origin + '/adboard');
    window.location.href = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${redirectTo}&prompt=select_account`;
  },
  // Connexion email/mot de passe "intelligente" — un seul champ, un seul bouton, comme demandé :
  // 1ère visite = compte créé automatiquement, visites suivantes = connexion. Jamais de choix
  // "s'inscrire vs se connecter" à faire soi-même, jamais d'email de confirmation à attendre
  // (nécessite que "Confirm email" soit désactivé côté Supabase Auth settings).
  signInWithPassword: async (email, password) => {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON },
      body: JSON.stringify({ email, password })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error_description || d.msg || 'Identifiants incorrects');
    const session = { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Date.now() + (d.expires_in * 1000) };
    localStorage.setItem('sb_session', JSON.stringify(session));
    localStorage.setItem('sb_user', JSON.stringify(d.user));
    return d.user;
  },
  signUp: async (email, password) => {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON },
      body: JSON.stringify({ email, password })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error_description || d.msg || d.error || 'Erreur de création de compte');
    if (!d.access_token) throw new Error('NO_SESSION'); // "Confirm email" encore actif côté Supabase
    const session = { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Date.now() + (d.expires_in * 1000) };
    localStorage.setItem('sb_session', JSON.stringify(session));
    localStorage.setItem('sb_user', JSON.stringify(d.user));
    return d.user;
  },
  smartSignIn: async (email, password) => {
    try {
      return await sbAuth.signInWithPassword(email, password);
    } catch (signInErr) {
      // Échec connexion : soit le compte n'existe pas encore (1ère visite), soit mauvais mot de passe.
      try {
        return await sbAuth.signUp(email, password);
      } catch (signUpErr) {
        if (signUpErr.message === 'NO_SESSION') {
          throw new Error('Compte créé — vérifie ta boîte mail pour confirmer ton adresse avant de te connecter.');
        }
        const msg = (signUpErr.message || '').toLowerCase();
        if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('user already')) {
          // Le compte existe déjà (confirmé par l'échec de création) → le souci est bien le mot de passe.
          throw new Error('Mot de passe incorrect.');
        }
        throw signUpErr;
      }
    }
  },
  signOut: async () => {
    const session = JSON.parse(localStorage.getItem('sb_session') || 'null');
    if (session?.access_token) {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method:'POST', headers:{ Authorization:`Bearer ${session.access_token}`, apikey: SUPABASE_ANON }
      }).catch(()=>{});
    }
    localStorage.removeItem('sb_session');
    localStorage.removeItem('sb_user');
  },
  getSession: () => {
    try { return JSON.parse(localStorage.getItem('sb_session') || 'null'); } catch(e){ return null; }
  },
  getUser: () => {
    try { return JSON.parse(localStorage.getItem('sb_user') || 'null'); } catch(e){ return null; }
  },
  // Mémorise la devise détectée sur le compte — pour que les emails automatiques (sans navigateur ouvert)
  // sachent dans quelle devise s'adresser à la personne.
  updateUserMetadata: async (data) => {
    try {
      const session = JSON.parse(localStorage.getItem('sb_session') || 'null');
      if (!session?.access_token) return;
      const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_ANON },
        body: JSON.stringify({ data })
      });
      if (r.ok) { const updated = await r.json(); localStorage.setItem('sb_user', JSON.stringify(updated)); }
    } catch(e) {}
  },
  // Rafraîchit le token si expiré, retourne une session valide
  refreshSession: async () => {
    try {
      const session = JSON.parse(localStorage.getItem('sb_session') || 'null');
      if (!session) return null;
      // Vérifier si le token est encore valide (marge de 60s)
      if (session.expires_at && Date.now() < session.expires_at - 60000) return session;
      // Rafraîchir via refresh_token
      const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON },
        body: JSON.stringify({ refresh_token: session.refresh_token })
      });
      if (!r.ok) { localStorage.removeItem('sb_session'); localStorage.removeItem('sb_user'); return null; }
      const data = await r.json();
      const newSession = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + (data.expires_in * 1000),
      };
      localStorage.setItem('sb_session', JSON.stringify(newSession));
      if (data.user) localStorage.setItem('sb_user', JSON.stringify(data.user));
      return newSession;
    } catch(e) { return null; }
  },
  handleCallback: () => {
    const hash = window.location.hash;
    if (!hash.includes('access_token')) return false;
    const params = new URLSearchParams(hash.replace('#',''));
    const session = {
      access_token: params.get('access_token'),
      refresh_token: params.get('refresh_token'),
      expires_at: Date.now() + (parseInt(params.get('expires_in') || '3600') * 1000),
    };
    // Fetch user info
    fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers:{ Authorization:`Bearer ${session.access_token}`, apikey: SUPABASE_ANON }
    }).then(r=>r.json()).then(user => {
      localStorage.setItem('sb_session', JSON.stringify(session));
      localStorage.setItem('sb_user', JSON.stringify(user));
      // Événement Lead — uniquement à la toute première connexion sur cet appareil
      try {
        if (!localStorage.getItem('adstack_lead_sent') && window.fbq) {
          window.fbq('track', 'Lead', { content_name: 'Google Login' });
          localStorage.setItem('adstack_lead_sent', '1');
        }
      } catch(e) {}
      // Email de bienvenue — uniquement pour un compte réellement nouveau (créé il y a <2min)
      try {
        const createdAt = new Date(user.created_at).getTime();
        if (Date.now() - createdAt < 2 * 60 * 1000) {
          fetch('https://adstack-server.onrender.com/send-welcome-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email, name: user.user_metadata?.full_name }),
            keepalive: true, // survit à la navigation immédiate qui suit (window.location.replace)
          }).catch(()=>{});
        }
      } catch(e) {}
      // Fusion de l'identifiant anonyme (souscription push faite avant connexion) avec le vrai compte
      try {
        const anonId = localStorage.getItem('adstack_anon_id');
        if (anonId) {
          fetch('https://adstack-server.onrender.com/push-merge-anon', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ anon_id: anonId, user_id: user.id }),
            keepalive: true,
          }).catch(()=>{});
        }
      } catch(e) {}
      // Attribution CRM — attache le prospect + le message d'origine (démo/J+3/J+10/J+21) au
      // compte dès la connexion, pour qu'on sache automatiquement, au moment d'un futur achat,
      // quel prospect et quel message ont mené à la conversion — sans rien cocher manuellement.
      try {
        const attribution = JSON.parse(localStorage.getItem('crm_attribution') || 'null');
        if (attribution?.prospect_id) {
          sbAuth.updateUserMetadata({
            crm_prospect_id: attribution.prospect_id,
            crm_last_campaign: attribution.campagne,
          });
        }
      } catch(e) {}
      window.location.replace('/adboard');
    }).catch(()=>{ window.location.replace('/adboard'); });
    return true;
  }
};

const C = {
  bg:'#0A0C11',    sidebar:'#0D1016',    card:'#12151C',
  border:'rgba(255,255,255,0.07)',        borderM:'rgba(255,255,255,0.16)',
  accent:'#5B8DEF', accentS:'rgba(91,141,239,0.11)', accentM:'rgba(91,141,239,0.22)',
  white:'#FFFFFF', whiteS:'rgba(255,255,255,0.06)',
  gray:'#8891A0',  grayS:'rgba(255,255,255,0.06)',
  text:'#F2F4F8',  sec:'#8891A0',        muted:'#626B7A',
};

const CLIENT = { name:'', brand:'', plan:'', avatar:'', total:0 };

const PLAN_QUANTITY = { 'Conversion Starter':9, 'Conversion Pro':18, 'Conversion Scale':36 };

const ANGLES = [];

const CREA = [];

const INITIAL_PRODUCTS = [];


const NAV = [
  {id:'produits',icon:'box',label:'Mes Produits', group:'Ressources'},
  {id:'galerie',icon:'grid',label:'Galerie Créatives', group:'Ressources'},
  {id:'copies',icon:'document',label:'Ad Copies', group:'Ressources'},
  {id:'marche',icon:'chart',label:'Données Marché', group:'Ressources'},
  {id:'suivi',icon:'clock',label:'Suivi Demande', group:'Suivi'},
  {id:'notifications',icon:'bell',label:'Notifications', group:'Suivi'},
  {id:'tarifs',icon:'tag',label:'Nos Tarifs', group:'Compte'},
  {id:'commentaires',icon:'document',label:'Commentaires', group:'Aide'},
  {id:'faq',icon:'help',label:'FAQ & Aide', group:'Aide'},
];

const cs = (extra={}) => ({background:C.card, border:`1px solid ${C.border}`, borderRadius:14, boxShadow:'0 1px 2px rgba(0,0,0,0.25)', ...extra});

const MOBILE_BREAKPOINT = 768;
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isMobile;
};


const Logo = ({size=28}) => (
  <div style={{width:size,height:size,borderRadius:Math.round(size*0.25),background:'#0B0F1A',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
    <svg width={size*0.6} height={size*0.6} viewBox="0 0 100 100">
      <g transform="translate(50,50)">
        <path d="M -21 17 L -21 6 L -7.5 -12 L 6 4 L 21 -19 L 21 -8" fill="none" stroke="#5B8DEF" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M 12 -19 L 21 -19 L 21 -10" fill="none" stroke="#5B8DEF" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"/>
      </g>
    </svg>
  </div>
);

// Marque visuelle propre à Ava (assistante) — volontairement distincte du logo AdStack (flèche
// de croissance). Cœur plein + un seul anneau ouvert, épais et net — reste lisible même en
// très petite taille (contrairement à un motif à plusieurs arcs fins, illisible une fois réduit).
const AvaMark = ({size=20}) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="30" fill="none" stroke="#5B8DEF" strokeWidth="9" strokeLinecap="round" strokeDasharray="150 189" transform="rotate(-90 50 50)"/>
    <circle cx="50" cy="50" r="11" fill="#5B8DEF"/>
  </svg>
);

const Icon = ({name, size=16, color='currentColor', strokeWidth=1.8}) => {
  const filled = name==='sparkle' || name==='bolt';
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    document: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></>,
    chart: <><path d="M3 3v18h18"/><rect x="7" y="13" width="3" height="5"/><rect x="12" y="9" width="3" height="9"/><rect x="17" y="5" width="3" height="13"/></>,
    sparkle: <path d="M12 2l1.8 5.6L19.5 9.5l-5.7 1.9L12 17l-1.8-5.6L4.5 9.5l5.7-1.9z"/>,
    tag: <><path d="M20.59 13.41L13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="6.5" cy="6.5" r="1"/></>,
    lock: <><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></>,
    search: <><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16" y2="16"/></>,
    calendar: <><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="9" x2="21" y2="9"/></>,
    download: <><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></>,
    x: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    check: <polyline points="20 6 9 17 4 12"/>,
    bulb: <><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a6 6 0 0 0-4 10.5c.6.5 1 1.3 1 2.1V16h6v-1.4c0-.8.4-1.6 1-2.1A6 6 0 0 0 12 2z"/></>,
    person: <><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></>,
    card: <><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></>,
    phone: <><rect x="6" y="2" width="12" height="20" rx="2"/><line x1="10" y1="19" x2="14" y2="19"/></>,
    arrow: <><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></>,
    bolt: <polygon points="13 2 3 14 11 14 11 22 21 10 13 10 13 2"/>,
    box: <><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    upload: <><path d="M12 3v13"/><path d="M7 8l5-5 5 5"/><path d="M5 21h14"/></>,
    pencil: <><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></>,
    menu: <><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></>,
    eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
    bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
    package: <><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><line x1="12" y1="22" x2="12" y2="12"/><path d="M3.27 6.96L12 12l8.73-5.04"/></>,
    camera: <><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></>,
    alerttriangle: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    creditcard: <><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></>,
    help: <><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2 2-2.5 3.2"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    chevron: <polyline points="6 9 12 15 18 9"/>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled?color:'none'} stroke={filled?'none':color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
};

const Tag = ({ch, color='red'}) => {
  const m = {
    red:{bg:C.accentS,c:C.accent,b:'rgba(45,127,249,0.2)'},
    gray:{bg:'rgba(255,255,255,0.05)',c:C.sec,b:C.border},
    white:{bg:'rgba(255,255,255,0.08)',c:C.text,b:'rgba(255,255,255,0.16)'},
  };
  const t = m[color]||m.red;
  return <span style={{padding:'2px 8px',borderRadius:4,fontSize:10,fontWeight:700,letterSpacing:'0.4px',background:t.bg,color:t.c,border:`1px solid ${t.b}`}}>{ch}</span>;
};

// Modale de confirmation stylisée AdBoard — remplace les window.confirm() natifs du navigateur,
// jugés hors identité visuelle. Réutilisable partout (déconnexion, annulation, suppression...).
const ConfirmModal = ({title, message, confirmLabel='Confirmer', cancelLabel='Annuler', danger=true, onConfirm, onCancel}) => (
  <div onClick={onCancel} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',zIndex:900,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
    <div onClick={e=>e.stopPropagation()} style={{width:'100%',maxWidth:360,borderRadius:14,background:C.card,border:`1px solid ${C.borderM}`,padding:24}}>
      <div style={{width:44,height:44,borderRadius:12,background:danger?'rgba(229,80,80,0.12)':'rgba(45,127,249,0.12)',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:16}}>
        <Icon name="alerttriangle" size={22} color={danger?'#E55050':C.accent}/>
      </div>
      <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:8}}>{title}</div>
      <div style={{fontSize:12.5,color:C.sec,lineHeight:1.5,marginBottom:20}}>{message}</div>
      <div style={{display:'flex',gap:10}}>
        <button onClick={onCancel} style={{flex:1,padding:'10px',borderRadius:8,border:`1px solid ${C.border}`,background:'rgba(255,255,255,0.05)',color:C.text,fontSize:12.5,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>{cancelLabel}</button>
        <button onClick={onConfirm} style={{flex:1,padding:'10px',borderRadius:8,border:'none',background:danger?'#E55050':C.accent,color:'#fff',fontSize:12.5,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>{confirmLabel}</button>
      </div>
    </div>
  </div>
);

const LockOverlay = () => (
  <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,backdropFilter:'blur(6px)',background:'rgba(11,15,26,0.90)',borderRadius:10,zIndex:10,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:10}}>
    <Icon name="lock" size={26} color={C.sec}/>
    <div style={{fontSize:13,fontWeight:700,color:C.text}}>Réservé aux abonnés</div>
    <div style={{fontSize:11,color:C.sec,textAlign:'center',maxWidth:200,lineHeight:1.5}}>Abonnez-vous pour accéder à toutes vos données</div>
    <button style={{marginTop:6,padding:'9px 22px',borderRadius:7,border:'none',background:C.accent,color:'#fff',fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:6}}>
      Voir les offres <Icon name="arrow" size={13} color="#fff"/>
    </button>
  </div>
);

const Sidebar = ({active, set, isDemo, setDemo, collapsed, setCollapsed, isMobile, mobileOpen, setMobileOpen, user, setUser, convertPrice=((f)=>f.toLocaleString('fr-FR')+' FCFA'), unreadCount=0, subscription=null, activeBriefsCount=0, onOpenPayment=null, onOpenLogin=null, sectionBadges={}}) => {
  const showCollapsed = collapsed && !isMobile;
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState({}); // {groupName: true} si replié — tout ouvert par défaut

  const navClick = (id) => {
    set(id);
    if (isMobile) setMobileOpen(false);
  };

  const asideStyle = isMobile
    ? {
        position:'fixed',top:0,left:0,height:'100%',zIndex:500,
        width: mobileOpen ? 'min(80vw,272px)' : 52,
        background:'linear-gradient(180deg, #10131c 0%, #0a0c12 100%)',
        borderRight:`1px solid ${C.border}`,
        display:'flex',flexDirection:'column',overflow:'hidden',
        transition:'width 0.22s cubic-bezier(.4,0,.2,1)',
        boxShadow: mobileOpen ? '8px 0 30px rgba(0,0,0,0.5)' : '2px 0 12px rgba(0,0,0,0.3)'
      }
    : {width:showCollapsed?64:222,flexShrink:0,background:C.sidebar,borderRight:`1px solid ${C.border}`,display:'flex',flexDirection:'column',overflow:'hidden',transition:'width 0.2s ease',boxShadow:'4px 0 28px rgba(0,0,0,0.5)'};

  return (
  <aside style={asideStyle}>
    <div style={{padding:'12px',paddingTop:isMobile?'calc(12px + env(safe-area-inset-top, 0px))':'12px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',gap:9,minHeight:52}}>
      {(showCollapsed || (isMobile && !mobileOpen)) ? (
        /* Mode icônes seulement : bouton ☰ centré à la place du logo */
        <button
          onClick={() => isMobile ? setMobileOpen(true) : setCollapsed(false)}
          title="Ouvrir le menu"
          style={{width:28,height:28,borderRadius:7,border:'none',background:'rgba(255,255,255,0.07)',color:C.sec,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto'}}
        >
          <Icon name="menu" size={15} color={C.sec}/>
        </button>
      ) : (
        /* Mode étendu : logo + titre + bouton fermer */
        <>
          <div style={{position:'relative',flexShrink:0}}>
            <div style={{position:'absolute',inset:-6,borderRadius:'50%',background:'radial-gradient(circle, rgba(45,127,249,0.25), transparent 70%)',pointerEvents:'none'}}/>
            <div style={{position:'relative'}}><Logo size={28}/></div>
          </div>
          <div style={{overflow:'hidden',flex:1}}>
            <div style={{fontSize:14,fontWeight:800,color:C.text,lineHeight:1,whiteSpace:'nowrap'}}>AdBoard</div>
            <div style={{fontSize:9,color:C.sec,letterSpacing:'1px',textTransform:'uppercase',whiteSpace:'nowrap'}}>AdStack</div>
          </div>
          <button
            onClick={() => isMobile ? setMobileOpen(false) : setCollapsed(true)}
            title={isMobile ? 'Fermer' : 'Réduire'}
            style={{width:28,height:28,borderRadius:7,border:'none',background:'rgba(255,255,255,0.07)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}
          >
            <Icon name={isMobile ? 'x' : 'menu'} size={13} color={C.sec}/>
          </button>
        </>
      )}
    </div>

    <div style={{padding:showCollapsed?'12px 0':'12px 16px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:showCollapsed?'center':'flex-start',gap:10}}>
      {user?.user_metadata?.avatar_url
        ? <img src={user.user_metadata.avatar_url} style={{width:32,height:32,borderRadius:8,flexShrink:0,objectFit:'cover',border:`1px solid ${C.border}`}}/>
        : <div style={{width:32,height:32,borderRadius:8,flexShrink:0,background:'rgba(255,255,255,0.06)',border:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'center'}}>
            {user
              ? <span style={{fontSize:13,color:C.sec,fontWeight:700}}>{(user.user_metadata?.full_name||user.email||'?')[0].toUpperCase()}</span>
              : <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            }
          </div>
      }
      {!showCollapsed && !(isMobile && !mobileOpen) && user && (
        <div style={{overflow:'hidden',flex:1}}>
          <div style={{fontSize:12,fontWeight:600,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{user.user_metadata?.full_name || user.email}</div>
          <div style={{fontSize:10,color:C.accent}}>Connecté</div>
        </div>
      )}
      {!showCollapsed && !(isMobile && !mobileOpen) && !user && (
        <button onClick={onOpenLogin} style={{flex:1,display:'flex',alignItems:'center',gap:7,padding:'6px 8px',borderRadius:8,border:`1px solid ${C.border}`,background:'rgba(255,255,255,0.09)',cursor:'pointer',fontFamily:'inherit',textAlign:'left',transition:'background 0.15s'}}
          onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.08)'}
          onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.04)'}>
          <svg width="13" height="13" viewBox="0 0 24 24" style={{flexShrink:0}}><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:C.text,lineHeight:1.2}}>Se connecter</div>
            <div style={{fontSize:9,color:C.sec}}>optionnel</div>
          </div>
        </button>
      )}
      {!showCollapsed && !(isMobile && !mobileOpen) && user && (
        <button onClick={()=>setShowLogoutConfirm(true)} title="Se déconnecter"
          style={{width:24,height:24,borderRadius:6,border:'none',background:'rgba(255,255,255,0.07)',color:C.sec,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <Icon name="x" size={11} color={C.sec}/>
        </button>
      )}
      {showLogoutConfirm && (
        <ConfirmModal
          title="Se déconnecter ?"
          message="Tu devras te reconnecter pour retrouver tes produits et tes visuels."
          confirmLabel="Se déconnecter" cancelLabel="Rester connecté" danger={true}
          onCancel={()=>setShowLogoutConfirm(false)}
          onConfirm={()=>{ sbAuth.signOut(); setUser(null); setShowLogoutConfirm(false); }}
        />
      )}
    </div>

    <nav style={{flex:1,padding:'10px',overflow:'auto'}}>
      {NAV.map((n, i) => {
        const isTarifs = n.id === 'tarifs';
        const showGroupHeader = (i === 0 || NAV[i-1].group !== n.group) && !(showCollapsed || (isMobile && !mobileOpen));
        const groupIsCollapsed = !!collapsedGroups[n.group];
        if (groupIsCollapsed && !showGroupHeader) return null; // items masqués si le groupe est replié
        return (
        <Fragment key={n.id}>
        {showGroupHeader && (
          <button onClick={() => setCollapsedGroups(g => ({...g, [n.group]: !g[n.group]}))}
            style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 10px 6px',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit'}}>
            <span style={{fontSize:10,fontWeight:700,letterSpacing:'0.6px',textTransform:'uppercase',color:C.muted}}>{n.group}</span>
            <span style={{display:'flex',transform:groupIsCollapsed?'rotate(-90deg)':'rotate(0deg)',transition:'transform 0.2s'}}>
              <Icon name="chevron" size={11} color={C.muted} strokeWidth={2.2}/>
            </span>
          </button>
        )}
        {!groupIsCollapsed && (
        <button onClick={() => navClick(n.id)} title={(showCollapsed || (isMobile && !mobileOpen)) ? n.label : undefined} style={{
          width:'100%',display:'flex',alignItems:'center',justifyContent:(showCollapsed || (isMobile && !mobileOpen))?'center':'flex-start',
          gap:(showCollapsed || (isMobile && !mobileOpen))?0:10,padding:(showCollapsed || (isMobile && !mobileOpen))?'10px 0':'9px 10px',
          borderRadius:7,border:'none',cursor:'pointer',
          background: isTarifs
            ? (active===n.id ? C.accentS : 'linear-gradient(90deg, rgba(45,127,249,0.06), rgba(91,143,255,0.14), rgba(45,127,249,0.06))')
            : (active===n.id?C.accentS:'transparent'),
          backgroundSize: isTarifs && active!==n.id ? '250% auto' : undefined,
          animation: isTarifs && active!==n.id ? 'navGradientFlow 3.5s ease infinite' : undefined,
          color:active===n.id?C.accent:(isTarifs?'#5B8DEF':C.sec),
          fontSize:12,fontWeight:isTarifs?700:600,fontFamily:'inherit',
          borderLeft:active===n.id?`2px solid ${C.accent}`:'2px solid transparent',
          boxShadow:active===n.id?'0 0 16px rgba(45,127,249,0.15), inset 0 0 0 1px rgba(45,127,249,0.1)':'none',
          transition:'all 0.15s',textAlign:'left',marginBottom:1,whiteSpace:'nowrap',
        }}>
          {isTarifs && (
            <style>{`@keyframes navGradientFlow{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}`}</style>
          )}
          <div style={{position:'relative',display:'inline-flex',alignItems:'center',justifyContent:'center'}}>
            <Icon name={n.icon} size={14} color={active===n.id?C.accent:(isTarifs?'#5B8DEF':C.sec)}/>
            {n.id==='notifications' && unreadCount>0 && (showCollapsed || (isMobile && !mobileOpen)) && (
              <span style={{position:'absolute',top:-5,right:-5,background:'#E55050',color:'#fff',borderRadius:'50%',minWidth:14,height:14,fontSize:8,fontWeight:900,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 2px',lineHeight:1}}>
                {unreadCount>9?'9+':unreadCount}
              </span>
            )}
            {['galerie','copies','marche'].includes(n.id) && sectionBadges[n.id]>0 && (showCollapsed || (isMobile && !mobileOpen)) && (
              <span style={{position:'absolute',top:-5,right:-5,background:'#E55050',color:'#fff',borderRadius:'50%',minWidth:14,height:14,fontSize:8,fontWeight:900,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 2px',lineHeight:1}}>
                {sectionBadges[n.id]>9?'9+':sectionBadges[n.id]}
              </span>
            )}
            {n.id==='suivi' && activeBriefsCount>0 && (showCollapsed || (isMobile && !mobileOpen)) && (
              <span style={{position:'absolute',top:-3,right:-3,width:8,height:8,borderRadius:'50%',background:'#22C55E',boxShadow:'0 0 6px #22C55E'}}/>
            )}
          </div>
          {!(showCollapsed || (isMobile && !mobileOpen)) && <span style={{flex:1}}>{n.label}</span>}
          {!(showCollapsed || (isMobile && !mobileOpen)) && n.id==='notifications' && unreadCount>0 && (
            <span style={{background:'#E55050',color:'#fff',borderRadius:10,padding:'1px 6px',fontSize:9,fontWeight:900,minWidth:16,textAlign:'center',marginLeft:'auto'}}>
              {unreadCount>9?'9+':unreadCount}
            </span>
          )}
          {!(showCollapsed || (isMobile && !mobileOpen)) && ['galerie','copies','marche'].includes(n.id) && sectionBadges[n.id]>0 && (
            <span style={{background:'#E55050',color:'#fff',borderRadius:10,padding:'1px 6px',fontSize:9,fontWeight:900,minWidth:16,textAlign:'center',marginLeft:'auto'}}>
              {sectionBadges[n.id]>9?'9+':sectionBadges[n.id]}
            </span>
          )}
          {!(showCollapsed || (isMobile && !mobileOpen)) && n.id==='suivi' && activeBriefsCount>0 && (
            <span style={{display:'flex',alignItems:'center',gap:4,background:'rgba(34,197,94,0.14)',border:'1px solid rgba(34,197,94,0.35)',color:'#22C55E',borderRadius:20,padding:'2px 8px',fontSize:9,fontWeight:800,marginLeft:'auto',letterSpacing:'0.3px',boxShadow:'0 0 8px rgba(34,197,94,0.25)'}}>
              <span style={{width:5,height:5,borderRadius:'50%',background:'#22C55E'}}/> EN COURS
            </span>
          )}
        </button>
        )}
        </Fragment>
      );})}
    </nav>

    <div style={{padding:showCollapsed?'12px 0 calc(12px + env(safe-area-inset-bottom, 0px))':'12px 14px calc(12px + env(safe-area-inset-bottom, 0px))',borderTop:`1px solid ${C.border}`}}>
      <button onClick={() => set('demo')} title={showCollapsed||(isMobile&&!mobileOpen)?'Voir la démo':undefined} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:(showCollapsed||(isMobile&&!mobileOpen))?0:7,padding:'8px',borderRadius:7,background:active==='demo'?C.accentS:'rgba(255,255,255,0.07)',border:`1px solid ${active==='demo'?'rgba(45,127,249,0.28)':C.border}`,color:active==='demo'?C.accent:C.sec,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit',marginBottom:(showCollapsed||(isMobile&&!mobileOpen))?0:10,whiteSpace:'nowrap'}}>
        <Icon name="image" size={12} color={active==='demo'?C.accent:C.sec}/> {!(showCollapsed||(isMobile&&!mobileOpen)) && 'VOIR DEMO'}
      </button>
      {!showCollapsed && !(isMobile && !mobileOpen) && subscription?.plan !== 'scale' && (() => {
        const nextPlanId = !subscription?.active ? 'starter' : subscription.plan === 'starter' ? 'pro' : 'scale';
        const nextPlan = PLANS.find(pl => pl.id === nextPlanId);
        if (!nextPlan) return null;
        const cycleData = nextPlan.monthly;
        return (
          <div style={{padding:'13px',borderRadius:8,background:'rgba(45,127,249,0.08)',border:'1px solid rgba(45,127,249,0.18)',marginTop:10}}>
            <div style={{fontSize:11,color:C.accent,fontWeight:700,marginBottom:2}}>{nextPlan.name}</div>
            <div style={{fontSize:10,color:C.sec,lineHeight:1.4,marginBottom:7}}>{nextPlan.imagesPerWeek} images / semaine · {nextPlan.produitsPerWeek} produit{nextPlan.produitsPerWeek!=='1'?'s':''}</div>
            <div style={{fontSize:15,color:C.text,fontWeight:700,marginBottom:8}}>{convertPrice(cycleData.price)}<span style={{fontSize:10,color:C.sec,fontWeight:400}}>/mois</span></div>
            <button onClick={() => {
              const productId = PLAN_CHECKOUT_IDS[`${nextPlan.id}-monthly`];
              if (onOpenPayment && productId) { startCheckout(productId, onOpenPayment); return; }
              const popup = window.open('', '_blank') || window;
              popup.location.href = cycleData.checkout;
            }}
              style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,width:'100%',padding:'8px',borderRadius:6,border:'none',background:C.accent,color:'#fff',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
              {subscription?.active ? 'Upgrader' : 'Commencer'} <Icon name="arrow" size={11} color="#fff"/>
            </button>
          </div>
        );
      })()}
    </div>
  </aside>
  );
};

const EMPTY_PRODUCT = {
  nom:'', pricing:'', promo:'', lien:'', utilite:'', cible:'', pays:'', notes:'',
  couleur1:'', couleur2:'', couleur3:'', photo:null, logo:null, deliveries:[], marche:null,
};

// Field extrait hors du composant Produits pour éviter la perte de focus (re-mount à chaque keystroke)
const Field = ({label, k, required, textarea, placeholder, type='text', form, setForm, errors, C}) => {
  const err = errors?.[k];
  const [focused, setFocused] = useState(false);
  const common = {
    value: form[k] || '',
    onChange: e => setForm(f=>({...f,[k]:e.target.value})),
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    placeholder: placeholder || '',
    style:{
      width:'100%', padding:'9px 11px', borderRadius:8,
      background: focused ? 'rgba(45,127,249,0.05)' : 'rgba(255,255,255,0.04)',
      border:`1px solid ${err?C.accent:focused?'rgba(45,127,249,0.5)':C.border}`,
      boxShadow: focused ? '0 0 0 3px rgba(45,127,249,0.1)' : 'none',
      color:C.text,
      fontSize:13,
      fontFamily:'inherit', outline:'none', resize:'vertical', boxSizing:'border-box',
      transition:'border-color 0.15s, box-shadow 0.15s, background 0.15s',
      WebkitAppearance:'none', WebkitTextSizeAdjust:'100%',
    },
  };
  return (
    <div>
      <label style={{fontSize:11,color:C.sec,fontWeight:600,marginBottom:6,display:'block'}}>
        {label}{required && <span style={{color:C.accent}}> *</span>}
      </label>
      {textarea ? <textarea rows={2} {...common}/> : <input type={type} {...common}/>}
    </div>
  );
};

// ── Supabase Products API ──────────────────────────────────────────────────
const sbProducts = {
  async load(session) {
    if (!session?.access_token) return [];
    const r = await fetch(`${SUPABASE_URL}/rest/v1/products?select=*&order=created_at.asc`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${session.access_token}` }
    });
    if (!r.ok) return [];
    const rows = await r.json();
    return rows.map(p => ({ ...p, photo: p.photo_url }));
  },
  async uploadPhoto(session, base64DataUrl) {
    if (!base64DataUrl || !base64DataUrl.startsWith('data:')) {
      console.warn('[Photo] Pas de base64 valide');
      return null;
    }
    try {
      console.log('[Photo] Conversion base64 → blob...');
      const blob = await fetch(base64DataUrl).then(r => r.blob());
      console.log(`[Photo] Blob: ${blob.type}, ${(blob.size/1024).toFixed(1)}KB`);
      const ext = blob.type.split('/')[1] || 'jpg';
      const filename = `${Date.now()}.${ext}`;
      const url = `${SUPABASE_URL}/storage/v1/object/product-photos/${filename}`;
      console.log('[Photo] Upload vers:', url);
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: SUPABASE_ANON,
          'Content-Type': blob.type,
          'x-upsert': 'true',
        },
        body: blob
      });
      const responseText = await r.text();
      console.log(`[Photo] Réponse Supabase: ${r.status}`, responseText);
      if (!r.ok) return null;
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/product-photos/${filename}`;
      console.log('[Photo] ✅ URL publique:', publicUrl);
      return publicUrl;
    } catch(e) {
      console.error('[Photo] Erreur:', e);
      return null;
    }
  },
  async save(session, product) {
    if (!session?.access_token) { console.warn('[Save] Pas de session'); return null; }
    const user = sbAuth.getUser();
    const userId = user?.id;
    if (!userId) { console.warn('[Save] Pas de user_id'); return null; }

    let photoUrl = product.photo || null;
    console.log('[Save] Photo initiale:', photoUrl ? `base64 (${(photoUrl.length/1024).toFixed(0)}KB)` : 'null');
    if (photoUrl && photoUrl.startsWith('data:')) {
      photoUrl = await sbProducts.uploadPhoto(session, photoUrl);
      console.log('[Save] Photo URL après upload:', photoUrl);
    }
    const body = {
      user_id: userId,
      nom: product.nom, pricing: product.pricing, promo: product.promo||'',
      lien: product.lien||'', utilite: product.utilite||'', cible: product.cible||'',
      pays: product.pays, couleur1: product.couleur1||'', couleur2: product.couleur2||'',
      couleur3: product.couleur3||'', photo_url: photoUrl,
    };
    console.log('[Save] Body envoyé à Supabase:', JSON.stringify({...body, photo_url: photoUrl ? '(url)' : null}));
    const r = await fetch(`${SUPABASE_URL}/rest/v1/products`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(body)
    });
    if (!r.ok) {
      const err = await r.text();
      console.error('sbProducts.save error:', err);
      return null;
    }
    const rows = await r.json();
    return { ...rows[0], photo: rows[0].photo_url };
  },
  async update(session, id, product) {
    if (!session?.access_token) return false;
    let photoUrl = product.photo || null;
    if (photoUrl && photoUrl.startsWith('data:')) {
      photoUrl = await sbProducts.uploadPhoto(session, photoUrl);
    }
    const body = {
      nom: product.nom, pricing: product.pricing, promo: product.promo||'',
      lien: product.lien||'', utilite: product.utilite||'', cible: product.cible||'',
      pays: product.pays, couleur1: product.couleur1||'', couleur2: product.couleur2||'',
      couleur3: product.couleur3||'', photo_url: photoUrl,
      updated_at: new Date().toISOString(),
    };
    const r = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${id}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return r.ok;
  },
  async delete(session, id) {
    if (!session?.access_token) return false;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${id}`, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${session.access_token}` }
    });
    return r.ok;
  }
};

// ── Supabase Briefs API ────────────────────────────────────────────────────
const sbBriefs = {
  async loadForProducts(session, productIds) {
    if (!session?.access_token || !productIds.length) return [];
    const ids = productIds.map(id => `"${id}"`).join(',');
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/briefs?product_id=in.(${ids})&status=neq.cancelled&order=created_at.desc`,
      { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${session.access_token}` } }
    );
    return r.ok ? r.json() : [];
  },
  async create(session, productId, quantity=9) {
    if (!session?.access_token) return null;
    const user = sbAuth.getUser();
    if (!user?.id) return null;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/briefs`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ user_id: user.id, product_id: productId, quantity, status: 'pending', credits_used: quantity })
    });
    if (!r.ok) return null;
    const rows = await r.json();
    return rows[0];
  },
  async cancel(session, briefId) {
    if (!session?.access_token) return false;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/briefs?id=eq.${briefId}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    });
    return r.ok;
  }
};

// ── Supabase Subscription API ──────────────────────────────────────────────
const PLAN_CREDITS = { starter: 9, pro: 18, scale: 36 };

const sbSub = {
  async load(session) {
    if (!session?.access_token) return null;
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/subscriptions?select=*&active=eq.true&limit=1`,
      { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${session.access_token}` } }
    );
    if (!r.ok) return null;
    const rows = await r.json();
    return rows[0] || null;
  }
};

// Calcule les images publicitaires disponibles dynamiquement
function computeCredits(sub, allBriefs) {
  if (!sub || !sub.active) return { total: 0, used: 0, available: 0, nextCreditDate: null };
  const started = new Date(sub.started_at);
  const now = new Date();
  // Rechargement à minuit (jour civil), pas à l'heure exacte de l'abonnement — plus prévisible pour l'utilisateur
  const startedMidnight = new Date(started.getFullYear(), started.getMonth(), started.getDate());
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysElapsed = Math.floor((nowMidnight - startedMidnight) / msPerDay);
  const weeksActive = Math.floor(daysElapsed / 7) + 1;
  const total = weeksActive * sub.credits_per_week;
  const used = allBriefs
    .filter(b => b.status !== 'cancelled')
    .reduce((sum, b) => sum + (b.credits_used || 9), 0);
  const nextCreditDate = new Date(startedMidnight.getTime() + weeksActive * 7 * msPerDay);
  return { total, used, available: Math.max(0, total - used), nextCreditDate };
}

// ── Supabase Subscription & Credits ───────────────────────────────────────
const sbSubs = {
  async load(session) {
    if (!session?.access_token) return null;
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/subscriptions?select=*&limit=1`,
      { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${session.access_token}` } }
    );
    if (!r.ok) return null;
    const rows = await r.json();
    const sub = rows[0] || null;
    if (!sub) return null;
    // Sécurité : même si la DB dit active=true, on vérifie l'expiration réelle côté client
    if (sub.expires_at && new Date(sub.expires_at) < new Date()) {
      return { ...sub, active: false, expired: true };
    }
    return sub;
  }
};

// Calcule les images publicitaires disponibles dynamiquement
function calcCredits(subscription, briefs) {
  if (!subscription || !subscription.active) return { earned: 0, used: 0, available: 0, plan: null };
  const now = Date.now();
  const started = new Date(subscription.started_at).getTime();
  const weeksActive = Math.floor((now - started) / (7 * 24 * 60 * 60 * 1000)) + 1;
  const earned = weeksActive * subscription.credits_per_week;
  const used = Object.values(briefs)
    .filter(b => b.status !== 'cancelled')
    .reduce((sum, b) => sum + (b.credits_used || 9), 0);
  return { earned, used, available: Math.max(0, earned - used), plan: subscription.plan };
}

const PLAN_LABELS = { starter: 'Starter', pro: 'Pro', scale: 'Scale' };
const PLAN_COLORS = { starter: '#8A90B2', pro: '#5B8DEF', scale: '#22C55E' };

// ── Modal de paiement — widget Chariow Snap intégré, sans quitter la plateforme ──
const PREPURCHASE_QUESTIONS = [
  "Aujourd'hui, qu'est-ce qui te frustre le plus avec tes pubs ou tes visuels ?",
  "Si tout se passait bien pour ton business dans 6 mois, à quoi ça ressemblerait ?",
  "Qu'est-ce que t'as déjà essayé pour améliorer tes ventes, et qu'est-ce qui n'a pas marché ?",
  "D'après toi, qu'est-ce qui ferait vraiment la différence pour toi en ce moment ?",
  "Si une solution te faisait gagner plusieurs heures chaque semaine, ça changerait quoi pour toi concrètement ?",
  "Qu'est-ce qui te ferait hésiter à essayer une nouvelle solution pour tes visuels ?",
  "Comment tu décrirais, avec tes mots, ce qui bloque vraiment tes ventes ?",
  "T'as déjà entendu parler d'autres solutions ou agences pour ce genre de besoin ? T'en penses quoi ?",
  "Qu'est-ce que tu serais prêt à changer pour vraiment débloquer tes ventes ?",
  "Pourquoi c'est important pour toi de régler ça maintenant ?",
];

const POSTPURCHASE_QUESTIONS = [
  "Avant qu'on te contacte, tu connaissais déjà des solutions comme la nôtre ?",
  "Qu'est-ce qui a fait la différence pour toi, ce qui t'a décidé à te lancer ?",
  "Y a-t-il eu un moment où t'as failli ne pas continuer ?",
  "Qu'est-ce qui t'a rassuré si jamais t'avais un doute avant de valider ?",
  "Qu'est-ce que t'aimerais voir en plus sur la plateforme, même si ça n'existe pas encore ?",
  "Où t'en es avec ton business — tu débutes, ou ça fait un moment que tu vends ?",
  "Qu'est-ce qui a fait que tu passes à l'action maintenant plutôt que dans un mois ?",
  "Qu'est-ce qui te ferait dire, dans quelques semaines, que c'était le bon choix ?",
  "Le prix, ça t'a semblé juste, cher, ou une bonne affaire vu ce que t'en attends ?",
  "Tu connais d'autres vendeurs qui galèrent avec le même souci que toi ?",
];

// Formulaire partagé — pré-achat (obligatoire, code promo) et post-achat (facultatif, dismissible)
const InsightForm = ({ mode, user, onClose, C }) => {
  const isPre = mode === 'prepurchase';
  const questions = isPre ? PREPURCHASE_QUESTIONS : POSTPURCHASE_QUESTIONS;
  const [step, setStep] = useState('teaser'); // 'teaser' → 'form' → (promoCode affiché si pré-achat)
  const [answers, setAnswers] = useState(Array(10).fill(''));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [promoCode, setPromoCode] = useState(null);
  const [copied, setCopied] = useState(false);

  const submit = async () => {
    if (isPre && answers.some(a => !a.trim())) {
      setError('Réponds à toutes les questions pour valider — ça ne prend que quelques minutes.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const filled = questions.map((q, i) => ({ question: q, answer: answers[i] })).filter(a => a.answer.trim());
      const r = await fetch('https://adstack-server.onrender.com/save-form-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user?.id || null,
          email: user?.email || null,
          source: isPre ? 'prepurchase_form' : 'postpurchase_form',
          answers: filled,
        })
      });
      const data = await r.json();
      if (!r.ok) {
        if (data.error === 'low_effort') { setError(data.message); setSubmitting(false); return; }
        throw new Error(data.error || 'unknown');
      }
      try { localStorage.setItem(isPre ? 'adstack_prepurchase_form_done' : 'adstack_postpurchase_form_done', '1'); } catch(e) {}
      if (isPre && data.promo_code) { setPromoCode(data.promo_code); }
      else { onClose(); }
    } catch(e) {
      setError("Un souci technique est survenu — réessaie dans un instant.");
    }
    setSubmitting(false);
  };

  const copyCode = () => {
    navigator.clipboard?.writeText(promoCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Champs anti-zoom mobile : iOS Safari zoome automatiquement sur tout champ dont la taille
  // de police calculée est sous 16px — donc jamais en dessous, peu importe le design voulu.
  const inputStyle = {width:'100%',padding:'10px 12px',borderRadius:8,border:`1px solid ${C.border}`,background:'rgba(255,255,255,0.04)',color:C.text,fontSize:16,fontFamily:'inherit',resize:'vertical',outline:'none'};

  const closeBtn = (
    <button onClick={onClose} style={{width:30,height:30,borderRadius:8,border:'none',background:'rgba(255,255,255,0.07)',color:C.sec,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
      <Icon name="x" size={14}/>
    </button>
  );

  return createPortal(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',zIndex:700,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>

      {step === 'teaser' ? (
        <div style={{width:'100%',maxWidth:420,borderRadius:16,overflow:'hidden',position:'relative',
          background:'linear-gradient(115deg, #0B1E3D, #1FB6FF, #0B1E3D, #123A6B)',backgroundSize:'300% 300%',
          animation:'adstackGradientMove 6s ease infinite',border:`1px solid ${C.borderM}`}}>
          <style>{`@keyframes adstackGradientMove {0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}`}</style>
          <div style={{position:'absolute',top:12,right:12,zIndex:2}}>{closeBtn}</div>
          <div style={{padding:'40px 28px',textAlign:'center',position:'relative',zIndex:1}}>
            {isPre ? (
              <>
                <p style={{fontSize:13,fontWeight:700,color:'rgba(255,255,255,0.85)',letterSpacing:'1px',textTransform:'uppercase',margin:'0 0 8px'}}>Offre exclusive</p>
                <p style={{fontSize:52,fontWeight:900,color:'#fff',margin:'0 0 8px',lineHeight:1}}>-10%</p>
                <p style={{fontSize:14,color:'rgba(255,255,255,0.9)',margin:'0 0 26px',lineHeight:1.5}}>sur ton premier abonnement, en répondant à un rapide formulaire qui nous aide à améliorer AdStack.</p>
                <button onClick={() => setStep('form')} style={{padding:'13px 28px',borderRadius:9,border:'none',background:'#fff',color:'#0B1E3D',fontWeight:800,fontSize:14,cursor:'pointer',fontFamily:'inherit'}}>
                  Obtenir mon code -10%
                </button>
              </>
            ) : (
              <>
                <p style={{fontSize:13,fontWeight:700,color:'rgba(255,255,255,0.85)',letterSpacing:'1px',textTransform:'uppercase',margin:'0 0 8px'}}>Aide-nous à mieux te servir</p>
                <p style={{fontSize:22,fontWeight:800,color:'#fff',margin:'0 0 10px',lineHeight:1.3}}>2 minutes pour améliorer tes prochains livrables</p>
                <p style={{fontSize:14,color:'rgba(255,255,255,0.9)',margin:'0 0 26px',lineHeight:1.5}}>Quelques questions rapides, entièrement facultatives.</p>
                <button onClick={() => setStep('form')} style={{padding:'13px 28px',borderRadius:9,border:'none',background:'#fff',color:'#0B1E3D',fontWeight:800,fontSize:14,cursor:'pointer',fontFamily:'inherit'}}>
                  Répondre au formulaire
                </button>
              </>
            )}
          </div>
        </div>
      ) : (

      <div style={{width:'100%',maxWidth:520,maxHeight:'88vh',overflow:'auto',borderRadius:16,background:C.card,border:`1px solid ${C.borderM}`,padding:'26px'}}>

        {promoCode ? (
          <div style={{textAlign:'center',padding:'10px 0'}}>
            <div style={{width:52,height:52,borderRadius:14,background:'rgba(34,197,94,0.14)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
              <Icon name="check" size={24} color="#22C55E"/>
            </div>
            <h2 style={{fontSize:17,fontWeight:700,color:C.text,margin:'0 0 8px'}}>Merci pour tes réponses !</h2>
            <p style={{fontSize:13,color:C.sec,marginBottom:20}}>Voici ton code pour -10% sur ton premier abonnement :</p>
            <div onClick={copyCode} style={{display:'inline-flex',alignItems:'center',gap:10,padding:'12px 20px',borderRadius:10,border:`1.5px dashed ${C.accent}`,background:C.accentS,cursor:'pointer'}}>
              <span style={{fontSize:18,fontWeight:800,letterSpacing:'1px',color:C.accent,fontFamily:"'DM Mono',monospace"}}>{promoCode}</span>
              <Icon name={copied ? 'check' : 'document'} size={15} color={C.accent}/>
            </div>
            <p style={{fontSize:11,color:C.muted,marginTop:10}}>{copied ? 'Copié !' : 'Clique pour copier'} — à saisir au moment du paiement.</p>
            <button onClick={onClose} style={{marginTop:20,padding:'10px 24px',borderRadius:8,border:'none',background:C.accent,color:'#fff',fontWeight:700,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>
              Continuer
            </button>
          </div>
        ) : (
          <>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
              <div>
                <h2 style={{fontSize:17,fontWeight:700,color:C.text,margin:0}}>
                  {isPre ? 'Réponds à 10 questions, obtiens -10%' : 'Aide-nous à mieux te servir'}
                </h2>
                <p style={{fontSize:12.5,color:C.sec,marginTop:6,lineHeight:1.5}}>
                  {isPre
                    ? "Termine de répondre à ces 10 questions pour obtenir ton code de réduction."
                    : "10 questions facultatives — réponds à celles que tu veux, ça nous aide à mieux te servir. Tu peux fermer à tout moment."}
                </p>
              </div>
              {closeBtn}
            </div>

            <div style={{display:'flex',flexDirection:'column',gap:14,marginTop:18}}>
              {questions.map((q, i) => (
                <div key={i}>
                  <label style={{fontSize:12.5,fontWeight:600,color:C.text,marginBottom:6,display:'block',lineHeight:1.4}}>
                    {i+1}. {q}{isPre && <span style={{color:'#E55050'}}> *</span>}
                  </label>
                  <textarea
                    value={answers[i]}
                    onChange={e => { const a=[...answers]; a[i]=e.target.value; setAnswers(a); }}
                    rows={2}
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>

            {error && <div style={{marginTop:14,padding:'10px 14px',borderRadius:8,background:'rgba(229,80,80,0.1)',border:'1px solid rgba(229,80,80,0.3)',color:'#E55050',fontSize:12}}>{error}</div>}

            <button onClick={submit} disabled={submitting} style={{width:'100%',marginTop:18,padding:'13px',borderRadius:9,border:'none',background:C.accent,color:'#fff',fontWeight:700,fontSize:13.5,cursor:submitting?'default':'pointer',fontFamily:'inherit',opacity:submitting?0.6:1}}>
              {submitting ? 'Envoi...' : isPre ? 'Valider et obtenir mon code' : 'Envoyer mes réponses'}
            </button>
            {!isPre && (
              <button onClick={onClose} style={{width:'100%',marginTop:8,padding:'10px',borderRadius:9,border:'none',background:'transparent',color:C.muted,fontWeight:600,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>
                Plus tard
              </button>
            )}
          </>
        )}
      </div>
      )}
    </div>,
    document.body
  );
};

const PaymentModal = ({ productId, userEmail, onClose }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!productId) return;
    // On recharge le script à chaque ouverture pour garantir qu'il détecte
    // bien le nouveau data-product-id (pas de doublon de script accumulé).
    document.querySelectorAll('script[src*="chariowcdn"]').forEach(s => s.remove());
    const script = document.createElement('script');
    script.src = 'https://js.chariowcdn.com/v1/widget.min.js';
    script.async = true;
    document.head.appendChild(script);

    if (!document.querySelector('link[href*="chariowcdn"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://js.chariowcdn.com/v1/widget.min.css';
      document.head.appendChild(link);
    }

    return () => { script.remove(); };
  }, [productId]);

  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',zIndex:600,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      {/* Anti-zoom iOS : un champ avec une police < 16px déclenche un zoom auto au focus sur Safari mobile */}
      <style>{`#chariow-widget input, #chariow-widget textarea, #chariow-widget select { font-size:16px !important; }`}</style>
      <div onClick={e=>e.stopPropagation()} style={{width:'100%',maxWidth:460,maxHeight:'90vh',overflow:'auto',borderRadius:16,background:'#fff',padding:'20px',position:'relative'}}>
        <button onClick={onClose} style={{position:'absolute',top:12,right:12,width:30,height:30,borderRadius:8,border:'none',background:'rgba(0,0,0,0.06)',color:'#333',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2}}>
          <Icon name="x" size={14} color="#333"/>
        </button>
        <div
          key={productId}
          ref={containerRef}
          id="chariow-widget"
          data-product-id={productId}
          data-store-domain="shop.adstackofficial.com"
          data-style="frame"
          data-border-style="rounded"
          data-cta-width="xs"
          data-cta-animation="none"
          data-locale="fr"
          data-background-color="#FFFFFF"
          data-email={userEmail || undefined}
        />
      </div>
    </div>
  );
};

// ── Modal demande de créatives ─────────────────────────────────────────────
const CreativesModal = ({product, credits, onConfirm, onClose, C}) => {
  const [qty, setQty] = useState(9);
  const max = credits.available;
  const canIncrease = qty + 9 <= max;
  const canDecrease = qty > 9;

  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.82)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{position:'relative',overflow:'hidden',background:'linear-gradient(160deg, #12151f 0%, #0d0f16 100%)',borderRadius:16,padding:'26px 24px',maxWidth:380,width:'100%',border:`1px solid ${C.borderM}`,boxShadow:'0 32px 80px rgba(0,0,0,0.7)'}}>
        <div style={{position:'absolute',top:-50,right:-30,width:170,height:170,borderRadius:'50%',background:'radial-gradient(circle, rgba(45,127,249,0.16), transparent 70%)',pointerEvents:'none'}}/>

        {/* Bouton fermer */}
        <button onClick={onClose} style={{position:'absolute',top:14,right:14,width:28,height:28,borderRadius:7,border:'none',background:'rgba(255,255,255,0.07)',color:C.sec,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><Icon name="x" size={14}/></button>

        {/* Header */}
        <div style={{position:'relative',marginBottom:22,paddingRight:32}}>
          <h3 style={{fontSize:16,fontWeight:800,color:C.text,margin:'0 0 3px'}}>Demander des visuels</h3>
          <p style={{fontSize:12,color:C.sec,margin:0}}>Pour <strong style={{color:C.text}}>{product.nom}</strong></p>
        </div>

        {/* Jauge semaine — hero, citation à bordure latérale au lieu d'un encart fermé */}
        <div style={{position:'relative',borderLeft:`2px solid ${C.accent}`,paddingLeft:14,marginBottom:26}}>
          <div style={{fontSize:9.5,color:C.muted,fontWeight:700,letterSpacing:'1.2px',textTransform:'uppercase',marginBottom:6}}>Disponibles cette semaine</div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:28,fontWeight:800,color:max>0?C.text:C.muted,lineHeight:1}}>{max}</div>
          <div style={{marginTop:10,height:3,borderRadius:2,background:'rgba(255,255,255,0.06)',overflow:'hidden',maxWidth:220}}>
            <div style={{height:'100%',borderRadius:2,transition:'width .3s',background:max>0?`linear-gradient(90deg,${C.accent},#5B8DEF)`:'rgba(255,255,255,0.1)',width:max===0?'100%':`${Math.min(100,(qty/max)*100)}%`}}/>
          </div>
          <div style={{fontSize:10,color:C.muted,marginTop:8}}>{qty} sélectionné{qty>1?'s':''} · {max-qty} restant{max-qty>1?'s':''} après</div>
        </div>

        {/* Compteur */}
        <div style={{position:'relative',marginBottom:26}}>
          <div style={{fontSize:9.5,color:C.muted,fontWeight:700,letterSpacing:'1.2px',textTransform:'uppercase',marginBottom:16,textAlign:'center'}}>Nombre de visuels à recevoir</div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:26}}>
            <button onClick={()=>canDecrease&&setQty(q=>q-9)} style={{width:42,height:42,borderRadius:'50%',border:`1px solid ${canDecrease?'rgba(255,255,255,0.14)':'rgba(255,255,255,0.05)'}`,background:canDecrease?'rgba(255,255,255,0.05)':'rgba(255,255,255,0.02)',color:canDecrease?C.text:C.muted,fontSize:20,cursor:canDecrease?'pointer':'not-allowed',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.15s'}}>−</button>
            <div style={{textAlign:'center',minWidth:76}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:42,fontWeight:800,lineHeight:1,
                background:'linear-gradient(90deg, #ffffff 0%, #9fbcff 100%)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>{qty}</div>
              <div style={{fontSize:11,color:C.sec,marginTop:5}}>visuels</div>
            </div>
            <button onClick={()=>canIncrease&&setQty(q=>q+9)} style={{width:42,height:42,borderRadius:'50%',border:'none',background:canIncrease?`linear-gradient(135deg, ${C.accent}, #2D6FE0)`:'rgba(255,255,255,0.02)',color:canIncrease?'#fff':C.muted,fontSize:20,cursor:canIncrease?'pointer':'not-allowed',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:canIncrease?'0 4px 14px rgba(45,127,249,0.3)':'none',transition:'all 0.15s'}}>+</button>
          </div>
        </div>

        {/* Boutons */}
        <div style={{position:'relative',display:'flex',gap:10}}>
          <button onClick={onClose} style={{flex:1,padding:'12px',borderRadius:9,border:`1px solid ${C.border}`,background:'transparent',color:C.sec,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Annuler</button>
          <button onClick={()=>max>0&&onConfirm(qty)} disabled={max===0} style={{flex:2,padding:'12px',borderRadius:9,border:'none',background:max===0?'rgba(255,255,255,0.05)':`linear-gradient(135deg, ${C.accent}, #2D6FE0)`,color:max===0?C.muted:'#fff',fontWeight:700,fontSize:13,cursor:max===0?'not-allowed':'pointer',fontFamily:'inherit',boxShadow:max===0?'none':'0 4px 16px rgba(45,127,249,0.3)'}}>
            {max===0 ? 'Aucun visuel disponible' : `Confirmer · ${qty} visuels`}
          </button>
        </div>
      </div>
    </div>
  );
};



// ── Supabase Notifications API ─────────────────────────────────────────────
const sbNotifications = {
  async load(session) {
    if (!session?.access_token) return [];
    const r = await fetch(`${SUPABASE_URL}/rest/v1/notifications?select=*&order=created_at.desc&limit=50`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${session.access_token}` }
    });
    return r.ok ? r.json() : [];
  },
  async create(session, message, type='info') {
    if (!session?.access_token) return;
    const user = sbAuth.getUser();
    if (!user?.id) return;
    await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, message, type })
    });
  },
  async markAllRead(session) {
    if (!session?.access_token) return;
    await fetch(`${SUPABASE_URL}/rest/v1/notifications?read=eq.false`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: true })
    });
  }
};

// ── Modal de connexion Google ──────────────────────────────────────────────
const LoginModal = ({onClose, C, autoPrompt=false}) => {
  const font = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.82)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:24,fontFamily:font}}>
      <style>{`
        @keyframes loginShine { 0%{ background-position:0% center; } 100%{ background-position:200% center; } }
        @keyframes loginFloat1 { 0%,100%{ transform:translate(0,0); } 50%{ transform:translate(14px,10px); } }
        @keyframes loginFloat2 { 0%,100%{ transform:translate(0,0); } 50%{ transform:translate(-12px,-8px); } }
      `}</style>
      <div onClick={e=>e.stopPropagation()} style={{position:'relative',overflow:'hidden',background:C.card,borderRadius:18,padding:'36px 30px 28px',maxWidth:380,width:'100%',textAlign:'center',border:`1px solid ${C.borderM}`,boxShadow:'0 32px 90px rgba(0,0,0,0.7)',fontFamily:font}}>
        <div style={{position:'absolute',top:-90,left:-60,width:220,height:220,borderRadius:'50%',pointerEvents:'none',filter:'blur(2px)',background:'radial-gradient(circle, rgba(91,141,239,0.30), transparent 70%)',animation:'loginFloat1 7s ease-in-out infinite'}}/>
        <div style={{position:'absolute',bottom:-80,right:-50,width:200,height:200,borderRadius:'50%',pointerEvents:'none',filter:'blur(2px)',background:'radial-gradient(circle, rgba(139,92,246,0.22), transparent 70%)',animation:'loginFloat2 8s ease-in-out infinite'}}/>

        <button onClick={onClose} style={{position:'absolute',top:14,right:14,width:28,height:28,borderRadius:8,border:'none',background:'rgba(255,255,255,0.07)',color:C.sec,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1}}><Icon name="x" size={14}/></button>

        <div style={{position:'relative'}}>
          <div style={{margin:'0 auto 20px',width:'fit-content'}}><Logo size={52}/></div>
          <h2 style={{fontSize:21,fontWeight:800,lineHeight:1.25,margin:'0 0 10px',letterSpacing:'-0.01em',fontFamily:font,
            background:'linear-gradient(90deg,#5B8DEF,#8B5CF6,#5B8DEF)',backgroundSize:'200% auto',
            WebkitBackgroundClip:'text',backgroundClip:'text',WebkitTextFillColor:'transparent',
            animation:'loginShine 4s linear infinite'}}>
            Premier Pas Vers La Performance Publicitaire
          </h2>
          <p style={{fontSize:13.5,color:C.sec,lineHeight:1.55,margin:'0 0 26px',maxWidth:300,marginLeft:'auto',marginRight:'auto',fontFamily:font}}>
            Demande et accède facilement à tout ce que notre équipe aura produit pour toi.
          </p>

          <button onClick={sbAuth.signInWithGoogle} style={{width:'100%',padding:'14px 16px',borderRadius:11,border:'1px solid rgba(255,255,255,0.14)',background:'#fff',color:'#1a1a1a',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:font,display:'flex',alignItems:'center',justifyContent:'center',gap:10,marginBottom:12,transition:'transform .15s ease, box-shadow .15s ease'}}
            onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 8px 24px rgba(255,255,255,0.15)';}}
            onMouseLeave={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='none';}}>
            <svg width="19" height="19" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Se Connecter Avec Google
          </button>
          <button onClick={onClose} style={{width:'100%',padding:10,borderRadius:10,border:'none',background:'transparent',color:C.muted,fontSize:12,cursor:'pointer',fontFamily:font}}>Pas maintenant</button>
        </div>
      </div>
    </div>
  );
};


// ── Toast notification ─────────────────────────────────────────────────────
const NOTIF_ICONS = { success:'check', error:'x', info:'bell', warning:'alerttriangle', payment:'creditcard', brief:'package', product:'camera' };

const Toast = ({toasts}) => (
  <div style={{position:'fixed',bottom:100,right:20,zIndex:8000,display:'flex',flexDirection:'column',gap:8,pointerEvents:'none'}}>
    {toasts.map(t => (
      <div key={t.id} style={{
        background:'rgba(15,17,28,0.97)',border:'1px solid rgba(255,255,255,0.12)',
        borderRadius:10,padding:'12px 16px',maxWidth:320,
        display:'flex',alignItems:'flex-start',gap:10,
        boxShadow:'0 8px 32px rgba(0,0,0,0.5)',
        animation:'toastIn .3s cubic-bezier(.34,1.56,.64,1)',
        fontFamily:"'Inter',sans-serif",
        borderLeft:`3px solid ${t.type==='success'?'#22C55E':t.type==='error'?'#E55050':t.type==='payment'?'#5B8DEF':'#F59E0B'}`,
      }}>
        <div style={{flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}><Icon name={NOTIF_ICONS[t.type]||'bell'} size={15} color={t.type==='success'?'#22C55E':t.type==='error'?'#E55050':t.type==='payment'?'#5B8DEF':'#F59E0B'}/></div>
        <span style={{fontSize:12,color:'#E8EAF0',lineHeight:1.4}}>{t.message}</span>
      </div>
    ))}
    <style>{`@keyframes toastIn{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:none}}`}</style>
  </div>
);

// ── Section Notifications ──────────────────────────────────────────────────
const Notifications = ({notifications, onMarkRead, onDeleteAll=()=>{}, onDeleteOne=()=>{}, onMarkOne=()=>{}, C, user, notify=()=>{}}) => {
  const isMobile = useIsMobile();
  useEffect(() => { onMarkRead(); }, []);
  const COLORS = { success:'#22C55E', error:'#E55050', info:'#5B8DEF', payment:'#5B8DEF', brief:'#F59E0B', product:'#8B5CF6', warning:'#F59E0B' };

  const [pushStatus, setPushStatus] = useState('checking'); // checking | unsupported | denied | default | enabled
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    getPushStatus().then(setPushStatus);
  }, []);

  const togglePush = async () => {
    if (pushLoading || pushStatus === 'denied' || pushStatus === 'unsupported') return;
    if (pushStatus === 'enabled') {
      // Désactivation : on désabonne côté navigateur (le serveur nettoiera automatiquement l'entrée invalide au prochain envoi)
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
      } catch(e) {}
      setPushStatus('default');
      return;
    }
    setPushLoading(true);
    const ok = await registerPushSubscription(user?.id);
    setPushStatus(await getPushStatus());
    setPushLoading(false);
    if (ok) notify('Notifications activées', 'success');
  };

  const sendTestPush = async () => {
    try {
      await fetch('https://adstack-server.onrender.com/push-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.id })
      });
      notify('Notification de test envoyée', 'info');
    } catch(e) {}
  };

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:10}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:40,height:40,borderRadius:10,background:C.accentS,border:`1px solid rgba(45,127,249,0.2)`,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <Icon name="bell" size={18} color={C.accent}/>
          </div>
          <div>
            <h1 style={{fontSize:20,fontWeight:700,color:C.text,margin:'0 0 2px'}}>Notifications</h1>
            <p style={{fontSize:12,color:C.sec,margin:0}}>{notifications.filter(n=>!n.read).length > 0 ? `${notifications.filter(n=>!n.read).length} non lue(s)` : 'Tout est lu'}</p>
          </div>
        </div>
        {notifications.length > 0 && (
          <div style={{display:'flex',gap:8}}>
            <button onClick={onMarkRead} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:7,border:`1px solid ${C.border}`,background:'transparent',color:C.sec,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>
              <Icon name="check" size={12} color={C.sec}/> Tout marquer lu
            </button>
            <button onClick={onDeleteAll} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:7,border:'1px solid rgba(229,80,80,0.3)',background:'transparent',color:'#E55050',fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>
              <Icon name="x" size={12} color="#E55050"/> Tout supprimer
            </button>
          </div>
        )}
      </div>

      {/* Toggle notifications push */}
      {pushStatus !== 'unsupported' && (
        <div style={{position:'relative',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,padding:'16px 18px',borderRadius:14,background:'linear-gradient(160deg, #12151f 0%, #0d0f16 100%)',border:`1px solid ${C.border}`,marginBottom:20,flexWrap:'wrap'}}>
          <div style={{position:'absolute',top:-40,right:-20,width:130,height:130,borderRadius:'50%',background:'radial-gradient(circle, rgba(45,127,249,0.12), transparent 70%)',pointerEvents:'none'}}/>
          <div style={{position:'relative',display:'flex',alignItems:'center',gap:12,minWidth:0}}>
            <div style={{width:34,height:34,borderRadius:10,background:pushStatus==='enabled'?C.accentS:'rgba(255,255,255,0.05)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <Icon name="bell" size={15} color={pushStatus==='enabled'?C.accent:C.sec}/>
            </div>
            <div>
              <div style={{fontSize:12.5,fontWeight:700,color:C.text}}>Notifications push</div>
              <div style={{fontSize:10.5,color:C.muted,marginTop:1}}>
                {pushStatus==='denied' ? 'Bloquées dans les réglages de ton navigateur' :
                 pushStatus==='enabled' ? 'Activées sur cet appareil' :
                 pushStatus==='checking' ? 'Vérification...' :
                 'Reçois un signal quand tes visuels sont prêts'}
              </div>
            </div>
          </div>
          <div style={{position:'relative',display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
            <button
              onClick={togglePush}
              disabled={pushLoading || pushStatus==='denied' || pushStatus==='checking'}
              style={{
                width:42,height:24,borderRadius:12,border:'none',position:'relative',
                background: pushStatus==='enabled' ? `linear-gradient(135deg, ${C.accent}, #2D6FE0)` : 'rgba(255,255,255,0.15)',
                cursor: (pushStatus==='denied'||pushStatus==='checking') ? 'not-allowed' : 'pointer',
                opacity: pushStatus==='denied' ? 0.5 : 1,
                transition:'background 0.2s', flexShrink:0,
              }}>
              <div style={{
                width:18,height:18,borderRadius:'50%',background:'#fff',position:'absolute',top:3,
                left: pushStatus==='enabled' ? 21 : 3, transition:'left 0.2s',
                boxShadow:'0 1px 3px rgba(0,0,0,0.3)',
              }}/>
            </button>
          </div>
        </div>
      )}

      {!notifications.length ? (
        <div style={{position:'relative',overflow:'hidden',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'60px 24px',gap:14,textAlign:'center',border:`1px solid ${C.border}`,borderRadius:16,background:'linear-gradient(160deg, #12151f 0%, #0d0f16 100%)'}}>
          <div style={{position:'absolute',top:-60,left:'50%',transform:'translateX(-50%)',width:200,height:200,borderRadius:'50%',background:'radial-gradient(circle, rgba(45,127,249,0.1), transparent 70%)',pointerEvents:'none'}}/>
          <div style={{position:'relative',width:44,height:44,borderRadius:12,background:C.accentS,border:`1px solid ${C.borderM}`,display:'flex',alignItems:'center',justifyContent:'center',color:C.accent}}>
            <Icon name="bell" size={20}/>
          </div>
          <div style={{position:'relative',fontSize:15,fontWeight:700,color:C.text}}>Aucune notification</div>
          <div style={{position:'relative',fontSize:12,color:C.sec}}>Vos notifications apparaîtront ici</div>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {notifications.map(n => (
            <div key={n.id} style={{position:'relative',display:'flex',alignItems:'flex-start',gap:12,padding:'14px 16px',borderRadius:12,background:n.read?'rgba(255,255,255,0.02)':'linear-gradient(160deg, #12151f 0%, #0d0f16 100%)',border:`1px solid ${n.read?C.border:'rgba(45,127,249,0.25)'}`,borderLeft:`2px solid ${n.read?C.border:(COLORS[n.type]||C.accent)}`,transition:'background .2s'}}>
              <div style={{flexShrink:0,marginTop:1,color:COLORS[n.type]||C.accent}}>
                <Icon name={NOTIF_ICONS[n.type]||'bell'} size={15}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,color:C.text,lineHeight:1.4,marginBottom:3}}>{n.message}</div>
                <div style={{fontSize:10,color:C.muted}}>{new Date(n.created_at).toLocaleString('fr-FR')}</div>
              </div>
              <button onClick={()=>onDeleteOne(n.id)} title="Supprimer" style={{width:22,height:22,borderRadius:6,border:'none',background:'transparent',color:C.muted,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon name="x" size={10}/></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Section Suivi Demande ──────────────────────────────────────────────────
const SuiviDemande = ({allBriefs, products, briefs, cancelCreatives, C, onRefresh}) => {
  const isMobile = useIsMobile();
  const [tick, setTick] = useState(0);
  const [cancelConfirm, setCancelConfirm] = useState(null); // {id, nom} du produit à annuler
  useEffect(() => {
    const t = setInterval(() => setTick(n => n+1), 1000);
    return () => clearInterval(t);
  }, []);

  // Cause profonde corrigée : les données (statuts, minuteurs) n'étaient rafraîchies qu'à la
  // connexion ou via le tire-pour-rafraîchir manuel — jamais automatiquement. Un minuteur pouvait
  // donc continuer de tourner à l'écran bien après que le statut réel soit passé à "livré" côté
  // serveur, tant que le client ne rechargeait pas la page lui-même. Rafraîchit maintenant en
  // arrière-plan toutes les 25s tant qu'il y a une demande active à surveiller.
  //
  // Cause profonde corrigée (le minuteur semblait ne jamais s'arrêter même une fois livré) :
  // onRefresh (une fonction recréée à CHAQUE rendu du composant parent, jamais mémoïsée) était
  // dans le tableau de dépendances de cet effet — n'importe quel rendu non lié (chat, notifs,
  // autre état ailleurs dans l'app) détruisait et recréait l'intervalle avant qu'il n'atteigne
  // jamais 25 secondes. Le cycle ne se terminait donc quasiment jamais en pratique. On utilise
  // maintenant des refs pour lire la valeur la plus récente sans jamais redéclencher l'effet.
  const onRefreshRef = useRef(onRefresh);
  const hasActiveRef = useRef(false);
  onRefreshRef.current = onRefresh;
  hasActiveRef.current = (allBriefs || []).some(b => b.status === 'pending' || b.status === 'in_production');
  useEffect(() => {
    const p = setInterval(() => {
      if (hasActiveRef.current && onRefreshRef.current) onRefreshRef.current();
    }, 25000);
    return () => clearInterval(p);
  }, []); // tableau vide intentionnel — l'intervalle est créé UNE FOIS, lit toujours l'état le plus récent via les refs

  const CANCEL_WIN = 12*60*60*1000;
  const DELIVERY_WIN = 48*60*60*1000;

  const formatCountdown = (ms) => {
    if (ms <= 0) return null;
    const h = Math.floor(ms/3600000);
    const m = Math.floor((ms%3600000)/60000);
    const s = Math.floor((ms%60000)/1000);
    return `${h}h ${m.toString().padStart(2,'0')}m ${s.toString().padStart(2,'0')}s`;
  };

  // Une seule couleur d'accent cohérente avec AdBoard pour le badge de statut — plus de
  // multicolore par statut (jaune/rouge/vert/gris), juste le texte qui change.
  const STATUS_LABELS = { pending:'En attente', in_production:'En production' };

  // Cause profonde corrigée : les demandes déjà terminées (livrées, annulées, problème) restaient
  // affichées indéfiniment dans cette liste, mélangées aux demandes actives. "Tout disparaît" une
  // fois la demande satisfaite — seules les demandes réellement en cours restent visibles ici.
  const sorted = [...allBriefs]
    .filter(b => b.status === 'pending' || b.status === 'in_production')
    .sort((a,b) => new Date(b.created_at)-new Date(a.created_at));

  if (!sorted.length) return (
    <div>
      <div style={{marginBottom:20}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
          <div style={{width:40,height:40,borderRadius:10,background:'rgba(45,127,249,0.08)',border:'1px solid rgba(45,127,249,0.2)',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <Icon name="clock" size={18} color={C.accent}/>
          </div>
          <div>
            <h1 style={{fontSize:20,fontWeight:700,color:C.text,margin:0}}>Suivi Demande</h1>
            <p style={{fontSize:12,color:C.sec,margin:0}}>Suivez vos demandes de production en temps réel</p>
          </div>
        </div>
      </div>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'60px 24px',gap:14,textAlign:'center',border:`1px dashed ${C.border}`,borderRadius:12}}>
        <div style={{width:56,height:56,borderRadius:14,background:C.accentS,border:`1px solid rgba(45,127,249,0.2)`,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <Icon name="clock" size={24} color={C.accent}/>
        </div>
        <div style={{fontSize:16,fontWeight:700,color:C.text}}>Aucune demande en cours</div>
        <div style={{fontSize:12,color:C.sec,maxWidth:300}}>Vos demandes de visuels apparaîtront ici avec leur statut et le temps restant avant livraison.</div>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20}}>
        <div style={{width:40,height:40,borderRadius:10,background:'rgba(45,127,249,0.08)',border:'1px solid rgba(45,127,249,0.2)',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <Icon name="clock" size={18} color={C.accent}/>
        </div>
        <div>
          <h1 style={{fontSize:20,fontWeight:700,color:C.text,margin:0}}>Suivi Demande</h1>
          <p style={{fontSize:12,color:C.sec,margin:0}}>{sorted.length} demande(s) active(s)</p>
        </div>
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        {sorted.map(b => {
          const prod = products.find(p=>p.id===b.product_id);
          const now = Date.now();
          const created = new Date(b.created_at).getTime();
          const sinceCreated = now - created;
          const cancelRemaining = CANCEL_WIN - sinceCreated;
          const canCancel = b.status==='pending' && cancelRemaining > 0;
          const deliveryStart = new Date(b.started_at || b.created_at).getTime();
          const deliveryRemaining = DELIVERY_WIN - (now - deliveryStart);
          const pctElapsed = Math.min(100, Math.max(0, ((now - deliveryStart) / DELIVERY_WIN) * 100));

          return (
            <div key={b.id} style={{
              position:'relative', overflow:'hidden',
              background:'linear-gradient(160deg, #12151f 0%, #0d0f16 100%)',
              border:`1px solid ${C.border}`, borderRadius:16, padding:'22px 22px 20px',
            }}>
              {/* Lueur d'ambiance — remplace le fond plat, une seule fois, jamais un encart */}
              <div style={{position:'absolute',top:-50,right:-40,width:180,height:180,borderRadius:'50%',background:'radial-gradient(circle, rgba(45,127,249,0.16), transparent 70%)',pointerEvents:'none'}}/>

              {/* En-tête — photo + nom intégrés, pas de boîte séparée */}
              <div style={{display:'flex',alignItems:'center',gap:11,marginBottom:22,position:'relative'}}>
                {prod?.photo && (
                  <div style={{width:38,height:38,borderRadius:10,overflow:'hidden',flexShrink:0,background:'rgba(255,255,255,0.06)'}}>
                    <img src={prod.photo} style={{width:'100%',height:'100%',objectFit:'contain'}} alt=""/>
                  </div>
                )}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14.5,fontWeight:800,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{prod?.nom||'Produit inconnu'}</div>
                  <div style={{fontSize:11,color:C.muted}}>
                    <span style={{color:C.accent,fontWeight:700}}>{b.quantity||9} visuels</span>
                    {' · '}{new Date(b.created_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
                  </div>
                </div>
                <span style={{padding:'3px 9px',borderRadius:20,fontSize:9.5,fontWeight:700,background:'rgba(255,255,255,0.06)',color:C.sec,flexShrink:0}}>
                  {STATUS_LABELS[b.status]}
                </span>
              </div>

              {/* Décompte — élément hero, aucune boîte autour, la typographie porte tout */}
              {(b.status==='pending' || b.status==='in_production') && deliveryRemaining > 0 && (
                <div style={{position:'relative'}}>
                  <div style={{fontSize:9.5,color:C.muted,fontWeight:700,letterSpacing:'1.6px',textTransform:'uppercase',marginBottom:8}}>Livraison estimée dans</div>
                  <div style={{
                    fontFamily:"'DM Mono',monospace",fontSize:36,fontWeight:800,letterSpacing:'-0.5px',lineHeight:1,
                    background:'linear-gradient(90deg, #ffffff 0%, #9fbcff 100%)',
                    WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',
                  }}>
                    {formatCountdown(deliveryRemaining)}
                  </div>

                  {/* Ligne de progression fine — remplace l'encart, jamais un rectangle */}
                  <div style={{marginTop:16,height:3,borderRadius:2,background:'rgba(255,255,255,0.06)',overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${100-pctElapsed}%`,borderRadius:2,background:'linear-gradient(90deg, #5B8DFF, #2D7FF9)',transition:'width 1s linear'}}/>
                  </div>
                </div>
              )}

              {/* Annulation — lien discret, plus un bloc rouge alarmant */}
              {canCancel && (
                <div style={{marginTop:18,display:'flex',justifyContent:'flex-end'}}>
                  <button onClick={() => { if (prod) setCancelConfirm(prod); }}
                    style={{background:'none',border:'none',color:'#E88',fontSize:11.5,fontWeight:600,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:5,padding:'6px 2px',opacity:0.85}}>
                    <Icon name="x" size={11} color="#E88"/> Annuler la commande
                  </button>
                </div>
              )}
              {b.status==='pending' && !canCancel && (
                <div style={{marginTop:18,fontSize:11,color:C.muted,textAlign:'right'}}>
                  Annulation non disponible — en cours de traitement
                </div>
              )}
            </div>
          );
        })}
      </div>
      {cancelConfirm && (
        <ConfirmModal
          title="Annuler cette commande ?"
          message={`Ta demande pour "${cancelConfirm.nom}" sera annulée. Cette action est définitive.`}
          confirmLabel="Annuler la commande" cancelLabel="Garder ma commande" danger={true}
          onCancel={()=>setCancelConfirm(null)}
          onConfirm={()=>{ cancelCreatives(cancelConfirm); setCancelConfirm(null); }}
        />
      )}
    </div>
  );
};

const BriefButton = ({p, briefs, subscription, allBriefs, user, onNeedLogin, onAskCreatives, cancelCreatives, C}) => {
  const brief = briefs[p.id];
  const hasActiveBrief = brief && brief.status !== 'cancelled' && brief.status !== 'done' && brief.status !== 'probleme_agence';
  const credits = computeCredits(subscription, allBriefs);
  const nextCreditDate = credits.nextCreditDate
    ? credits.nextCreditDate.toLocaleDateString('fr-FR', { day:'numeric', month:'long' })
    : null;
  if (subscription?.active && credits.available < 9) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:7,padding:"10px",borderRadius:7,border:`1px solid ${C.border}`,background:"rgba(255,255,255,0.04)",color:C.muted,fontSize:11,textAlign:"center"}}>
      <Icon name="clock" size={13} color={C.muted}/> {nextCreditDate ? `Prochain crédit le ${nextCreditDate}` : 'Crédits épuisés cette semaine'}
    </div>
  );
  return (
    <div style={{display:'flex',flexDirection:'column',gap:6}}>
      {hasActiveBrief && (
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,fontSize:10.5,color:C.sec}}>
          <Icon name="check" size={11} color="#22C55E"/> Demande déjà envoyée pour ce produit
        </div>
      )}
      <button onClick={() => onAskCreatives && onAskCreatives(p)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:7,padding:"11px",borderRadius:8,border:"none",background:`linear-gradient(135deg,${C.accent},#0B3D91)`,color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit",boxShadow:`0 4px 18px rgba(45,127,249,0.4)`,transition:"all 0.2s",letterSpacing:"0.3px"}}>
        <Icon name="sparkle" size={13} color="#fff"/> Demander mes images
      </button>
    </div>
  );
};

const ProductCard = ({p, briefs, subscription, allBriefs, user, onNeedLogin, onAskCreatives, cancelCreatives, notify, setProducts, openEdit, C}) => {
  const [hovered, setHovered] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const brief = briefs[p.id];
  const hasActiveBrief = brief && brief.status !== 'cancelled' && brief.status !== 'probleme_agence';

  const doDelete = async () => {
    const session = await sbAuth.refreshSession();
    if (session) await sbProducts.delete(session, p.id);
    setProducts(prev => prev.filter(x => x.id !== p.id));
    notify(`Produit "${p.nom}" supprimé`, 'info');
    notifyAction(sbAuth.getUser()?.id, 'product_deleted', p.nom);
    setConfirmDelete(false);
  };

  return (
    <>
    <div
      style={{position:'relative',overflow:'hidden',display:'flex',flexDirection:'column',borderRadius:14,border:`1px solid ${C.border}`,background:'linear-gradient(160deg, #12151f 0%, #0d0f16 100%)',transition:'border-color 0.2s, transform 0.2s, box-shadow 0.2s'}}
      onMouseEnter={e=>{setHovered(true); e.currentTarget.style.borderColor='rgba(45,127,249,0.35)'; e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow='0 12px 32px rgba(45,127,249,0.12)';}}
      onMouseLeave={e=>{setHovered(false); e.currentTarget.style.borderColor=C.border; e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none';}}
    >
      <div style={{aspectRatio:'4/5',position:'relative',background: p.photo ? `url(${p.photo}) center/cover no-repeat` : 'repeating-linear-gradient(135deg,#171B24,#171B24 10px,#14161D 10px,#14161D 20px)',display:'flex',alignItems:'center',justifyContent:'center'}}>
        {!p.photo && <Icon name="box" size={32} color={C.muted}/>}
        {/* Voile dégradé bas — meilleure lisibilité du badge de statut, plus tech qu'un fond plat */}
        <div style={{position:'absolute',bottom:0,left:0,right:0,height:'45%',background:'linear-gradient(transparent, rgba(0,0,0,0.55))',pointerEvents:'none'}}/>
        {p.logo && (
          <div style={{position:'absolute',bottom:8,left:8,width:32,height:32,borderRadius:8,background:'rgba(255,255,255,0.92)',border:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',padding:4}}>
            <img src={p.logo} alt="" style={{width:'100%',height:'100%',objectFit:'contain'}}/>
          </div>
        )}
        <div style={{position:'absolute',top:10,right:10,display:'flex',gap:6,opacity:hovered?1:0,transition:'opacity 0.15s'}}>
          <button onClick={() => openEdit(p)} style={{width:26,height:26,borderRadius:8,border:'none',background:'rgba(10,12,17,0.7)',backdropFilter:'blur(4px)',color:'#E4E7EC',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'background 0.15s'}}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(91,141,239,0.85)'}
            onMouseLeave={e=>e.currentTarget.style.background='rgba(10,12,17,0.7)'}
          >
            <Icon name="pencil" size={13} color="#E4E7EC"/>
          </button>
          <button onClick={() => setConfirmDelete(true)} style={{width:26,height:26,borderRadius:8,border:'none',background:'rgba(10,12,17,0.7)',backdropFilter:'blur(4px)',color:'#E4E7EC',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'background 0.15s'}}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(239,107,91,0.85)'}
            onMouseLeave={e=>e.currentTarget.style.background='rgba(10,12,17,0.7)'}
          >
            <Icon name="x" size={13} color="#E4E7EC"/>
          </button>
        </div>
        <div style={{position:'absolute',top:10,left:10,display:'flex',gap:6}}>
          {p.promo && <Tag ch={p.promo} color="red"/>}
        </div>
        <div style={{position:'absolute',bottom:10,left:10}}>
          <span style={{fontSize:10,fontWeight:700,letterSpacing:'0.02em',padding:'4px 9px',borderRadius:99,background: hasActiveBrief ? 'rgba(91,141,239,0.16)' : 'rgba(255,255,255,0.09)', color: hasActiveBrief ? C.accent : C.muted, border:`1px solid ${hasActiveBrief ? 'rgba(91,141,239,0.3)' : C.border}`}}>
            {hasActiveBrief ? 'En production' : 'Prêt à commander'}
          </span>
        </div>
      </div>
      <div style={{padding:'14px 16px',flex:1,display:'flex',flexDirection:'column',gap:6}}>
        <div style={{fontSize:14.5,fontWeight:700,letterSpacing:'-0.005em',color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.nom}</div>
        <div style={{fontSize:12,color:C.sec,fontFamily:"'DM Mono',monospace"}}>{p.pricing}</div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:2}}>
          {p.pays ? <span style={{fontSize:11,fontWeight:600,color:C.gray,background:'rgba(255,255,255,0.06)',border:`1px solid ${C.border}`,padding:'4px 9px',borderRadius:99}}>{p.pays}</span> : <span/>}
          <div style={{display:'flex',gap:5}}>
            {[p.couleur1,p.couleur2,p.couleur3].filter(Boolean).map((col,i)=>(
              <span key={i} style={{width:13,height:13,borderRadius:'50%',background:col,border:'1.5px solid rgba(255,255,255,0.18)'}}/>
            ))}
          </div>
        </div>
      </div>
      <div style={{padding:'0 16px 16px'}}>
        <BriefButton p={p} briefs={briefs} subscription={subscription} allBriefs={allBriefs} user={user} onNeedLogin={onNeedLogin} onAskCreatives={onAskCreatives} cancelCreatives={cancelCreatives} C={C}/>
      </div>
    </div>

    {confirmDelete && createPortal(
      <ConfirmModal
        title={`Supprimer "${p.nom}" ?`}
        message="Cette action est irréversible. La fiche produit sera définitivement supprimée. Les images, données marché et copies déjà générées pour ce produit resteront disponibles dans vos sections."
        confirmLabel="Supprimer" cancelLabel="Annuler" danger={true}
        onCancel={()=>setConfirmDelete(false)}
        onConfirm={doDelete}
      />,
      document.body
    )}
    </>
  );
};

const Produits = ({products, setProducts, user, onNeedLogin, briefs={}, setBriefs, allBriefs=[], setAllBriefs, subscription, credits:_credits={available:0,used:0,earned:0}, onAskCreatives, notify=()=>{}, cancelCreatives=()=>{}, setSection}) => {
  // Recalculer les crédits en temps réel depuis allBriefs
  const credits = computeCredits(subscription, allBriefs);
  const nextCreditDate = credits.nextCreditDate
    ? credits.nextCreditDate.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })
    : null;
  const isMobile = useIsMobile();
  const [showForm, setShowForm] = useState(false);
  const [requestModal, setRequestModal] = useState(null); // { product }
  const [requestQty, setRequestQty] = useState(9);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [errors, setErrors] = useState({});
  const [brief, setBrief] = useState(null);
  const [briefCopied, setBriefCopied] = useState(false);
  const photoRef = useRef(null);

  const openNew = () => { if (!user) { onNeedLogin(); return; } setForm(EMPTY_PRODUCT); setEditingId(null); setErrors({}); setShowForm(true); };
  const openEdit = (p) => { setForm(p); setEditingId(p.id); setErrors({}); setShowForm(true); };

  const handleFile = (e, fieldKey) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 800;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      const compressed = canvas.toDataURL('image/jpeg', 0.82);
      setForm(f => ({...f, [fieldKey]: compressed}));
      URL.revokeObjectURL(objUrl);
    };
    img.src = objUrl;
  };

  const validate = () => {
    const req = ['nom','pricing','pays','photo'];
    const e = {};
    req.forEach(k => { if (!form[k]) e[k] = true; });
    const nbCouleurs = [form.couleur1, form.couleur2, form.couleur3].filter(Boolean).length;
    if (nbCouleurs === 1) e.couleurs = true;
    return e;
  };

  const submit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    const session = await sbAuth.refreshSession();
    if (editingId) {
      setProducts(prev => prev.map(p => p.id===editingId ? {...form, id:editingId} : p));
      if (session) sbProducts.update(session, editingId, form);
      notify(`"${form.nom}" mis à jour`, 'product');
    } else {
      if (session) {
        const saved = await sbProducts.save(session, form);
        if (saved) {
          setProducts(prev => [...prev, saved]);
          notify(`Produit "${saved.nom}" créé avec succès`, 'product');
          notifyAction(sbAuth.getUser()?.id, 'product_created', saved.nom);
        } else {
          setProducts(prev => [...prev, {...form, id: Date.now()}]);
          notify(`Produit "${form.nom}" ajouté`, 'product');
        }
      } else {
        setProducts(prev => [...prev, {...form, id: Date.now()}]);
        notify(`Produit "${form.nom}" ajouté`, 'product');
      }
    }
    setShowForm(false);
    if (document.activeElement) document.activeElement.blur();
  };

  const requestCreatives = (p) => {
    if (!user) { onNeedLogin(); return; }
    if (!subscription?.active) return; // pas d'abonnement
    const credits = computeCredits(subscription, allBriefs);
    if (credits.available < 9) return; // pas assez
    setRequestQty(9);
    setRequestModal({ product: p });
  };

  const confirmRequest = async () => {
    const p = requestModal?.product;
    if (!p) return;
    const session = sbAuth.getSession();
    const brief = await sbBriefs.create(session, p.id, requestQty);
    if (brief) {
      brief.credits_used = requestQty;
      setBriefs(prev => ({...prev, [p.id]: brief}));
      setAllBriefs(prev => [...prev, brief]);
    }
    setRequestModal(null);
    // Afficher le brief local aussi (ancien comportement)
    const qty = requestQty;
    setBrief({
      client: "",
      plan: "",
      quantite_demandee: qty,
      date_demande: new Date().toISOString().slice(0,10),
      produit: {
        nom: p.nom,
        pricing: p.pricing,
        offre_promo: p.promo || null,
        lien_page_produit: p.lien || null,
        utilite_principale: p.utilite,
        cible_principale: p.cible,
        pays_de_vente: p.pays,
        couleurs_principales: [p.couleur1, p.couleur2, p.couleur3].filter(Boolean),
        photo: p.photo ? '[fichier image joint]' : null,
        logo: p.logo ? '[fichier logo joint]' : null,
        contexte_additionnel: p.notes || null,
      },
    });
    setBriefCopied(false);
  };


  // cancelCreatives vient de Platform via prop

  const copyBrief = () => {
    navigator.clipboard?.writeText(JSON.stringify(brief, null, 2)).then(() => {
      setBriefCopied(true);
      setTimeout(() => setBriefCopied(false), 2200);
    });
  };

  // Field est défini au niveau module (au-dessus de Produits)

  return (
    <div>
      {/* ── Jauge images publicitaires ── */}
      {subscription?.active ? (
        <div style={{position:'relative',overflow:'hidden',marginBottom:18,background:'linear-gradient(160deg, #12151f 0%, #0d0f16 100%)',border:`1px solid ${C.border}`,borderRadius:16,padding:'22px 24px'}}>
          <div style={{position:'absolute',top:-50,right:-30,width:170,height:170,borderRadius:'50%',background:'radial-gradient(circle, rgba(45,127,249,0.16), transparent 70%)',pointerEvents:'none'}}/>
          <div style={{position:'relative',display:'flex',alignItems:'flex-end',justifyContent:'space-between',gap:16,flexWrap:'wrap'}}>
            <div style={{flex:1,minWidth:180}}>
              <div style={{fontSize:9.5,color:C.muted,fontWeight:700,letterSpacing:'1.5px',textTransform:'uppercase',marginBottom:8}}>Images publicitaires disponibles</div>
              <div style={{display:'flex',alignItems:'baseline',gap:8}}>
                <span style={{
                  fontFamily:"'DM Mono',monospace",fontSize:38,fontWeight:800,letterSpacing:'-0.5px',lineHeight:1,
                  background: credits.available>0 ? 'linear-gradient(90deg, #ffffff 0%, #9fbcff 100%)' : 'none',
                  WebkitBackgroundClip: credits.available>0 ? 'text' : undefined,
                  WebkitTextFillColor: credits.available>0 ? 'transparent' : undefined,
                  backgroundClip: credits.available>0 ? 'text' : undefined,
                  color: credits.available>0 ? undefined : C.muted,
                }}>{credits.available}</span>
                <span style={{fontSize:12,color:C.muted}}>/ {credits.total} accumulées</span>
              </div>
              <div style={{marginTop:14,height:3,borderRadius:2,background:'rgba(255,255,255,0.06)',overflow:'hidden',maxWidth:280}}>
                <div style={{height:'100%',borderRadius:2,background:credits.available>0?`linear-gradient(90deg,${C.accent},#5B8DEF)`:'rgba(255,255,255,0.12)',width:!credits.total?'0%':`${Math.min(100,(credits.available/credits.total)*100)}%`,transition:'width .4s ease'}}/>
              </div>
              <div style={{fontSize:10.5,color:C.muted,marginTop:8}}>{credits.used} déjà utilisées</div>
            </div>
            {credits.available === 0 && (
              <div style={{fontSize:11,color:C.sec,padding:'8px 14px',borderRadius:8,background:'rgba(255,255,255,0.05)',border:`1px solid ${C.border}`,whiteSpace:'nowrap'}}>
                {nextCreditDate ? `Prochaines images le ${nextCreditDate}` : 'Prochaines images la semaine prochaine'}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{position:'relative',overflow:'hidden',marginBottom:18,background:'linear-gradient(160deg, #141b2e 0%, #0d0f16 100%)',border:'1px solid rgba(91,141,239,0.3)',borderRadius:16,padding:'20px 24px',display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
          <div style={{position:'absolute',top:-50,right:-30,width:170,height:170,borderRadius:'50%',background:'radial-gradient(circle, rgba(45,127,249,0.22), transparent 70%)',pointerEvents:'none'}}/>
          <div style={{position:'relative',flex:1,minWidth:180,display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:36,height:36,borderRadius:10,background:'rgba(91,141,239,0.18)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <Icon name="bolt" size={16} color={C.accent}/>
            </div>
            <div>
              <div style={{fontSize:14,fontWeight:800,color:C.text}}>Images publicitaires</div>
              <div style={{fontSize:11.5,color:C.sec,marginTop:2}}>Abonne-toi pour recevoir tes visuels chaque semaine</div>
            </div>
          </div>
          <button onClick={()=>setSection && setSection('tarifs')} style={{position:'relative',padding:'10px 20px',borderRadius:9,border:'none',background:`linear-gradient(135deg, ${C.accent}, #2D6FE0)`,color:'#fff',fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap',boxShadow:'0 4px 16px rgba(45,127,249,0.35)'}}>
            Voir les offres
          </button>
        </div>
      )}

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:18,flexWrap:'wrap',gap:10}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:700,color:C.text,margin:0}}>Mes Produits</h1>
          <p style={{fontSize:13,color:C.sec,marginTop:3,marginBottom:0}}>{products.length} produit{products.length>1?'s':''} dans votre catalogue</p>
          <p style={{fontSize:11.5,color:C.muted,marginTop:6,marginBottom:0}}>Créez votre produit, puis demandez vos visuels — livrés en 48h.</p>
        </div>
        <button onClick={openNew} style={{display:'flex',alignItems:'center',gap:7,padding:'10px 18px',borderRadius:9,border:'none',background:`linear-gradient(135deg, ${C.accent}, #2D6FE0)`,color:'#fff',fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'inherit',boxShadow:'0 4px 14px rgba(45,127,249,0.3)'}}>
          <Icon name="plus" size={14} color="#fff"/> Ajouter un produit
        </button>
      </div>

      {products.length === 0 && (
        <div style={{position:'relative',overflow:'hidden',borderRadius:16,border:`1px solid ${C.border}`,background:'linear-gradient(160deg, #12151f 0%, #0d0f16 100%)',padding:'60px 24px',display:'flex',flexDirection:'column',alignItems:'center',gap:12,textAlign:'center',marginBottom:14}}>
          <div style={{position:'absolute',top:-60,left:'50%',transform:'translateX(-50%)',width:220,height:220,borderRadius:'50%',background:'radial-gradient(circle, rgba(45,127,249,0.12), transparent 70%)',pointerEvents:'none'}}/>
          <div style={{position:'relative',width:44,height:44,borderRadius:12,background:C.accentS,border:`1px solid ${C.borderM}`,display:'flex',alignItems:'center',justifyContent:'center',color:C.accent}}>
            <Icon name="box" size={20}/>
          </div>
          <div style={{position:'relative',fontSize:17,fontWeight:700,color:C.text}}>Aucun produit pour l'instant</div>
          <div style={{position:'relative',fontSize:13.5,color:C.sec,maxWidth:340,lineHeight:1.6}}>Ajoutez votre premier produit — nom, prix, pays et une photo suffisent pour démarrer. Vous pourrez ensuite demander vos visuels publicitaires, livrés sous 48h.</div>
          <button onClick={openNew} style={{position:'relative',marginTop:6,padding:'10px 20px',borderRadius:9,border:'none',background:`linear-gradient(135deg, ${C.accent}, #2D6FE0)`,color:'#fff',fontWeight:700,fontSize:12.5,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:7,boxShadow:'0 4px 14px rgba(45,127,249,0.3)'}}>
            <Icon name="plus" size={14} color="#fff"/> Ajouter mon premier produit
          </button>
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:14}}>
        {products.map(p => (
          <ProductCard key={p.id} p={p} briefs={briefs} subscription={subscription} allBriefs={allBriefs} user={user} onNeedLogin={onNeedLogin} onAskCreatives={onAskCreatives} cancelCreatives={cancelCreatives} notify={notify} setProducts={setProducts} openEdit={openEdit} C={C}/>
        ))}

        <button onClick={openNew} style={{aspectRatio:'4/5',minHeight:240,borderRadius:14,border:`1.5px dashed ${C.border}`,background:'transparent',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:10,cursor:'pointer',color:C.muted,fontFamily:'inherit',transition:'border-color 0.15s, color 0.15s, background 0.15s'}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent; e.currentTarget.style.color=C.accent; e.currentTarget.style.background='rgba(91,141,239,0.05)';}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border; e.currentTarget.style.color=C.muted; e.currentTarget.style.background='transparent';}}
        >
          <div style={{width:38,height:38,borderRadius:'50%',border:'1.5px solid currentColor',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <Icon name="plus" size={16}/>
          </div>
          <span style={{fontSize:13.5,fontWeight:600}}>Ajouter un produit</span>
        </button>
      </div>

      {showForm && (
        <div onClick={() => setShowForm(false)} style={{position:'fixed',top:0,bottom:0,left:isMobile?52:0,right:0,background:'rgba(0,0,0,0.75)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:'16px'}}>
          <style>{`
            @keyframes revealOptional { from{ opacity:0; max-height:0; } to{ opacity:1; max-height:900px; } }
          `}</style>
          <div onClick={e=>e.stopPropagation()} style={{position:'relative',overflow:'hidden',width:'100%',maxWidth:460,maxHeight:'82vh',borderRadius:16,background:'linear-gradient(160deg, #12151f 0%, #0d0f16 100%)',border:`1px solid ${C.borderM}`,boxShadow:'0 24px 64px rgba(0,0,0,0.6)',display:'flex',flexDirection:'column'}}>
            <div style={{position:'absolute',top:-60,right:-40,width:200,height:200,borderRadius:'50%',background:'radial-gradient(circle, rgba(45,127,249,0.12), transparent 70%)',pointerEvents:'none'}}/>

            {/* En-tête — fixe, hors zone de scroll */}
            <div style={{position:'relative',flexShrink:0}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'22px 20px 14px'}}>
                <h2 style={{fontSize:16,fontWeight:800,color:C.text,margin:0}}>{editingId ? 'Modifier le produit' : 'Ajouter un produit'}</h2>
                <button onClick={() => setShowForm(false)} style={{width:30,height:30,borderRadius:8,border:'none',background:'rgba(255,255,255,0.10)',color:C.sec,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <Icon name="x" size={14}/>
                </button>
              </div>
              {/* Jauge — se remplit avec chaque champ complété, sans jamais dire explicitement
                  "plus vous remplissez, mieux c'est" (implicite via le copywriting + la jauge). */}
              {(() => {
                const champs = [form.photo, form.nom, form.pricing, form.pays, form.lien, form.promo, form.cible, form.utilite];
                const remplis = champs.filter(Boolean).length;
                const pct = Math.round((remplis / champs.length) * 100);
                return (
                  <div style={{padding:'0 20px 16px'}}>
                    <div style={{height:5,borderRadius:3,background:'rgba(255,255,255,0.08)',overflow:'hidden'}}>
                      <div style={{height:'100%',width:pct+'%',borderRadius:3,background:`linear-gradient(90deg, ${C.accent}, #8B5CF6)`,transition:'width 0.4s cubic-bezier(.4,0,.2,1)'}}/>
                    </div>
                    <div style={{fontSize:10,color:C.muted,marginTop:6}}>
                      {pct < 100 ? `Fiche ${pct}% complète — chaque détail affine vos futures créatives` : 'Fiche complète — parfait pour un travail sur-mesure'}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Zone scrollable — photo + champs uniquement, jamais le bouton */}
            <div style={{position:'relative',overflow:'hidden auto',padding:'0 20px',flex:1}}>
            <div style={{marginBottom:20,display:'flex',alignItems:'center',gap:14}}>
              <input ref={photoRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>handleFile(e,'photo')}/>
              <div onClick={()=>photoRef.current?.click()}
                style={{width:80,height:80,flexShrink:0,borderRadius:14,border:`1.5px dashed ${errors.photo?C.accent:'rgba(255,255,255,0.16)'}`,background:form.photo?`url(${form.photo}) center/cover no-repeat`:'rgba(255,255,255,0.04)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',transition:'border-color 0.2s'}}
                onMouseEnter={e=>e.currentTarget.style.borderColor='rgba(45,127,249,0.5)'}
                onMouseLeave={e=>e.currentTarget.style.borderColor=errors.photo?C.accent:'rgba(255,255,255,0.16)'}
              >
                {!form.photo && <Icon name="upload" size={20} color={C.sec}/>}
              </div>
              <div>
                <div style={{fontSize:12.5,fontWeight:700,color:C.text,marginBottom:3}}>Photo du produit<span style={{color:C.accent}}> *</span></div>
                <div style={{fontSize:11,color:C.muted}}>Cliquez pour uploader</div>
              </div>
            </div>

            {(() => {
              const requisRemplis = !!(form.photo && form.nom && form.pricing && form.pays);
              return (
            <div style={{display:'flex',flexDirection:'column',gap:18}}>

              <div>
                <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:10}}>
                  <div style={{width:5,height:5,borderRadius:'50%',background:C.accent}}/>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:'0.08em',color:C.muted,textTransform:'uppercase'}}>Les 3 essentiels</div>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  <Field label="Nom du produit" k="nom" required placeholder="Ex : Sérum Éclat Intense" form={form} setForm={setForm} errors={errors} C={C}/>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                    <Field label="Prix actuel" k="pricing" required placeholder="Ex : 12 900" form={form} setForm={setForm} errors={errors} C={C}/>
                    <Field label="Pays de vente" k="pays" required placeholder="Ex : Sénégal" form={form} setForm={setForm} errors={errors} C={C}/>
                  </div>
                </div>
              </div>

              {!requisRemplis && (
                <div style={{fontSize:11,color:C.muted,display:'flex',alignItems:'center',gap:6,padding:'2px 2px 0'}}>
                  <Icon name="sparkle" size={12} color={C.muted}/> Photo + ces 3 infos, et votre produit est créé
                </div>
              )}

              <div style={{overflow:'hidden',...(requisRemplis ? {animation:'revealOptional 0.5s ease forwards'} : {maxHeight:0,opacity:0,margin:0})}}>
              <div style={{display:'flex',flexDirection:'column',gap:16}}>

              {/* Lien de la page produit — mis en avant, distinct des autres champs optionnels.
                  Pas obligatoire, mais très utile en production : source d'informations riches
                  et personnalisées sur le produit réel. */}
              <div style={{padding:'12px 14px',borderRadius:11,background:'rgba(45,127,249,0.07)',border:`1px solid rgba(45,127,249,0.25)`}}>
                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}>
                  <Icon name="sparkle" size={13} color={C.accent}/>
                  <div style={{fontSize:11.5,fontWeight:700,color:C.text}}>Lien de la page produit</div>
                  <span style={{fontSize:9,color:C.muted,fontWeight:400}}>(optionnel, mais précieux)</span>
                </div>
                <input value={form.lien||''} onChange={e=>setForm(f=>({...f,lien:e.target.value}))} placeholder="https://..."
                  style={{width:'100%',boxSizing:'border-box',padding:'9px 12px',background:'rgba(255,255,255,0.05)',border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:12.5,fontFamily:'inherit',outline:'none'}}/>
                <div style={{fontSize:10,color:C.muted,marginTop:6}}>Notre équipe y puise des détails que vous n'auriez pas pensé à mentionner.</div>
              </div>

              <div>
                <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:10}}>
                  <div style={{width:5,height:5,borderRadius:'50%',background:C.muted}}/>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:'0.08em',color:C.muted,textTransform:'uppercase'}}>Pour aller plus loin</div>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  <Field label="Offre promo en cours" k="promo" placeholder="Ex : -20% jusqu'au 30 juin" form={form} setForm={setForm} errors={errors} C={C}/>
                  <Field label="Qui achète ce produit ?" k="cible" textarea placeholder="Ex : Femme, 25-40 ans, Dakar" form={form} setForm={setForm} errors={errors} C={C}/>
                  <Field label="À quoi il sert" k="utilite" textarea placeholder="Le problème qu'il résout, en une phrase" form={form} setForm={setForm} errors={errors} C={C}/>
                  <div>
                    <label style={{fontSize:11,color:C.sec,fontWeight:600,marginBottom:4,display:'block'}}>Couleurs de la marque</label>
                    <div style={{fontSize:10,color:C.muted,marginBottom:8}}>2 ou 3 couleurs, utilisées dans vos visuels</div>
                    <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                      {[1,2,3].map(n => {
                        const key = `couleur${n}`;
                        return form[key]
                          ? <div key={n} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 8px 4px 4px',borderRadius:8,border:`1px solid ${C.border}`,background:'rgba(255,255,255,0.06)'}}>
                              <input type="color" value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} style={{width:28,height:28,borderRadius:5,border:'none',cursor:'pointer',padding:0,background:'none'}}/>
                              <span style={{fontSize:10,color:C.sec,fontFamily:'monospace'}}>{form[key].toUpperCase()}</span>
                              <button type="button" onClick={()=>setForm(f=>({...f,[key]:''}))} style={{width:14,height:14,borderRadius:'50%',border:'none',background:'rgba(255,255,255,0.15)',color:C.sec,fontSize:9,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon name="x" size={8} color={C.sec}/></button>
                            </div>
                          : <button key={n} type="button" onClick={()=>setForm(f=>({...f,[key]:'#1E3A8A'}))} style={{display:'flex',alignItems:'center',gap:5,padding:'5px 10px',borderRadius:7,border:`1px dashed ${C.border}`,background:'transparent',cursor:'pointer',color:C.sec,fontSize:11,fontFamily:'inherit'}}>
                              <Icon name="plus" size={11} color={C.sec}/> Ajouter
                            </button>;
                      })}
                    </div>
                    {errors.couleurs && <div style={{fontSize:10.5,color:'#E55050',marginTop:6}}>Ajoutez au moins 2 couleurs, ou aucune.</div>}
                  </div>
                </div>
              </div>

              </div>
              </div>

            </div>
              );
            })()}

            {Object.keys(errors).length>0 && (
              <div style={{marginTop:16,padding:'10px 14px',borderRadius:8,background:C.accentS,border:'1px solid rgba(45,127,249,0.2)',fontSize:11,color:C.accent}}>
                Merci de renseigner les champs marqués d'un astérisque.
              </div>
            )}
            <div style={{height:16}}/>
            </div>

            {/* Bouton — hors zone de scroll, toujours visible */}
            <div style={{position:'relative',padding:'14px 20px 20px',flexShrink:0,borderTop:`1px solid ${C.border}`}}>
              <button onClick={submit} style={{width:'100%',padding:'13px',borderRadius:9,border:'none',background:`linear-gradient(135deg, ${C.accent}, #2D6FE0)`,color:'#fff',fontWeight:700,fontSize:13,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:7,boxShadow:'0 4px 16px rgba(45,127,249,0.3)'}}>
                <Icon name="check" size={14} color="#fff"/> {editingId ? 'Enregistrer les modifications' : 'Créer le produit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {brief && (
        <div onClick={() => setBrief(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{width:'100%',maxWidth:480,maxHeight:'85vh',overflow:'auto',borderRadius:14,background:C.card,border:`1px solid ${C.borderM}`,padding:'22px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:38,height:38,borderRadius:10,background:C.accentS,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <Icon name="check" size={17} color={C.accent}/>
                </div>
                <div>
                  <h2 style={{fontSize:15,fontWeight:700,color:C.text,margin:0}}>Demande envoyée</h2>
                  <p style={{fontSize:11,color:C.sec,marginTop:2}}>Livraison sous 48h</p>
                </div>
              </div>
              <button onClick={() => setBrief(null)} style={{width:30,height:30,borderRadius:8,border:'none',background:'rgba(255,255,255,0.10)',color:C.sec,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <Icon name="x" size={14}/>
              </button>
            </div>

            <div style={{display:'flex',flexDirection:'column',gap:0,borderRadius:10,border:`1px solid ${C.border}`,overflow:'hidden'}}>
              {[
                ['Produit', brief.produit?.nom],
                ['Quantité', `${brief.quantite_demandee} visuels`],
                ['Pays de vente', brief.produit?.pays_de_vente || '—'],
                ['Date de la demande', brief.date_demande],
              ].map(([label, value], i) => (
                <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'11px 14px',borderTop:i>0?`1px solid ${C.border}`:'none',fontSize:12.5}}>
                  <span style={{color:C.sec}}>{label}</span>
                  <span style={{color:C.text,fontWeight:600}}>{value}</span>
                </div>
              ))}
            </div>

            <details style={{marginTop:14}}>
              <summary style={{fontSize:11.5,color:C.sec,cursor:'pointer',fontWeight:600,userSelect:'none'}}>Voir les détails techniques</summary>
              <pre style={{marginTop:8,fontSize:10.5,color:C.sec,background:'rgba(255,255,255,0.055)',border:`1px solid ${C.border}`,borderRadius:8,padding:'12px',overflow:'auto',lineHeight:1.6,whiteSpace:'pre-wrap',fontFamily:"'DM Mono',monospace"}}>
                {JSON.stringify(brief, null, 2)}
              </pre>
            </details>

            <button onClick={copyBrief} style={{width:'100%',marginTop:14,padding:'10px',borderRadius:8,border:`1px solid ${briefCopied?'rgba(91,141,239,0.3)':C.borderM}`,background:briefCopied?C.accentS:'rgba(255,255,255,0.05)',color:briefCopied?C.accent:C.text,fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:7,transition:'all 0.2s'}}>
              {briefCopied ? (<><Icon name="check" size={13}/> Brief copié</>) : 'Copier le brief'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

// Téléchargement direct — contourne la limitation navigateur qui ignore l'attribut "download"
// sur un lien cross-origin (Supabase Storage ≠ domaine AdBoard). Récupère l'image en mémoire
// (blob), puis déclenche le téléchargement depuis cette copie locale (même origine, donc jamais
// bloqué).
async function downloadImageDirect(url, filename) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename || 'creative.jpg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
  } catch(e) {
    window.open(url, '_blank');
  }
}

// Mobile : ouvre le menu de partage natif (inclut "Enregistrer dans Photos" sur iOS/Android)
// quand le navigateur le supporte. Sinon, retombe sur le téléchargement direct classique.
async function shareOrDownloadImage(url, filename, isMobile) {
  if (isMobile && navigator.share && navigator.canShare) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const file = new File([blob], filename || 'creative.jpg', { type: blob.type || 'image/jpeg' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
    } catch(e) { /* utilisateur a annulé le partage, ou navigateur incompatible — on retombe ci-dessous */ }
  }
  await downloadImageDirect(url, filename);
}

// Version groupée — sur mobile, tente UN SEUL partage natif avec toutes les images sélectionnées
// (le menu natif "Enregistrer dans Photos" les prend alors toutes en une fois), au lieu de
// forcer des téléchargements de fichiers isolés dans le navigateur.
async function shareOrDownloadMultiple(items, isMobile) {
  if (isMobile && navigator.share && navigator.canShare) {
    try {
      const files = await Promise.all(items.map(async (item) => {
        const response = await fetch(item.imageUrl);
        const blob = await response.blob();
        return new File([blob], `${item.angle}-${item.week}.jpg`.replace(/[^\w.-]+/g,'_'), { type: blob.type || 'image/jpeg' });
      }));
      if (navigator.canShare({ files })) {
        await navigator.share({ files });
        return;
      }
    } catch(e) { /* utilisateur a annulé, ou partage multi-fichiers non supporté — on retombe ci-dessous */ }
  }
  // Retombe sur un partage/téléchargement image par image (natif si possible sur mobile,
  // téléchargement direct sur desktop)
  for (const item of items) {
    await shareOrDownloadImage(item.imageUrl, `${item.angle}-${item.week}.jpg`.replace(/[^\w.-]+/g,'_'), isMobile);
    await new Promise(r => setTimeout(r, 350));
  }
}

const Galerie = ({products, setProducts, isDemo, setSection, isMobile}) => {
  const [query, setQuery] = useState('');
  const [filterMode, setFilterMode] = useState('tous');
  const [activeChip, setActiveChip] = useState(null);
  const [selected, setSelected] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const weeks = ['S1','S2','S3','S4','S5'];
  // Cause profonde corrigée : CREA était une constante vide codée en dur (jamais remplie) —
  // la galerie affichait des rectangles de dégradé factices, jamais les vraies créatives déjà
  // livrées par Factory. Dérivé maintenant depuis products (real Supabase products.creatives).
  const realCreatives = products.flatMap(p => p.creatives || []);
  const angleSet = [...new Set(realCreatives.map(c => c.angle))];

  const filtered = realCreatives.filter(c => {
    if (selectedProduct && c.productId !== selectedProduct) return false;
    const q = query.trim().toLowerCase();
    if (q && !c.angle.toLowerCase().includes(q) && !c.week.toLowerCase().includes(q)) return false;
    if (filterMode==='angle' && activeChip && c.angle!==activeChip) return false;
    if (filterMode==='date' && activeChip && c.week!==activeChip) return false;
    return true;
  });

  const chips = filterMode==='angle' ? angleSet : filterMode==='date' ? weeks : [];

  const confirmDeleteSelected = async () => {
    setDeleting(true);
    try {
      // Grouper par produit — chaque appel serveur ne touche qu'un seul produit à la fois
      const byProduct = {};
      filtered.filter(c => selectedIds.includes(c.id)).forEach(c => {
        (byProduct[c.productId] = byProduct[c.productId] || []).push(c.id);
      });
      for (const [productId, ids] of Object.entries(byProduct)) {
        await fetch(`https://adstack-server.onrender.com/products/${productId}/delete-creatives`, {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ creativeIds: ids })
        });
      }
      // Mise à jour locale immédiate — pas besoin d'attendre un refetch complet
      setProducts(prev => prev.map(p => ({
        ...p,
        creatives: (p.creatives||[]).filter(c => !selectedIds.includes(c.id))
      })));
      setSelectedIds([]);
      setSelectMode(false);
    } catch(e) {
      console.error('Suppression créatives échouée :', e.message);
    } finally {
      setDeleting(false);
      setDeleteConfirm(false);
    }
  };

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:18}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:700,color:C.text,margin:0}}>Galerie Créatives</h1>
          <p style={{fontSize:13,color:C.sec,marginTop:3,marginBottom:0}}>Vos visuels produits</p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <Tag ch={`${filtered.length} créatives`} color="gray"/>
          {realCreatives.length > 0 && (
            <button onClick={() => { setSelectMode(m => !m); setSelectedIds([]); }}
              style={{padding:'6px 12px',borderRadius:7,border:`1px solid ${selectMode?C.accent:C.border}`,background:selectMode?'rgba(196,30,58,0.08)':'rgba(255,255,255,0.05)',color:selectMode?C.text:C.sec,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
              {selectMode ? 'Annuler' : 'Sélectionner'}
            </button>
          )}
        </div>
      </div>

      {selectMode && (
        <div style={{display:'flex',flexDirection:isMobile?'column':'row',alignItems:isMobile?'stretch':'center',justifyContent:'space-between',gap:10,marginBottom:14,padding:'12px 14px',borderRadius:9,background:'rgba(255,255,255,0.04)',border:`1px solid ${C.border}`}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <button onClick={() => setSelectedIds(selectedIds.length === filtered.length ? [] : filtered.map(c=>c.id))}
              style={{fontSize:11.5,fontWeight:600,color:C.accent,background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',padding:0}}>
              {selectedIds.length === filtered.length ? 'Tout désélectionner' : 'Tout sélectionner'}
            </button>
            {isMobile && <span style={{fontSize:11.5,color:C.sec}}>{selectedIds.length} sélectionnée{selectedIds.length>1?'s':''}</span>}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            {!isMobile && <span style={{fontSize:11.5,color:C.sec,flexShrink:0}}>{selectedIds.length} sélectionnée{selectedIds.length>1?'s':''}</span>}
            <button disabled={!selectedIds.length || bulkDownloading}
              onClick={async () => {
                setBulkDownloading(true);
                const items = filtered.filter(c => selectedIds.includes(c.id));
                await shareOrDownloadMultiple(items, isMobile);
                setBulkDownloading(false);
              }}
              style={{flex:isMobile?1:'none',display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'8px 14px',borderRadius:7,border:'none',background:selectedIds.length?C.accent:'rgba(255,255,255,0.08)',color:selectedIds.length?'#fff':C.muted,fontSize:11.5,fontWeight:700,cursor:selectedIds.length?'pointer':'default',fontFamily:'inherit',whiteSpace:'nowrap'}}>
              <Icon name="download" size={13} color={selectedIds.length?'#fff':C.muted}/> {bulkDownloading ? '…' : `Télécharger (${selectedIds.length})`}
            </button>
            <button disabled={!selectedIds.length || deleting}
              onClick={() => setDeleteConfirm(true)}
              style={{flex:isMobile?1:'none',display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'8px 14px',borderRadius:7,border:`1px solid ${selectedIds.length?'rgba(229,80,80,0.3)':C.border}`,background:selectedIds.length?'rgba(229,80,80,0.08)':'rgba(255,255,255,0.04)',color:selectedIds.length?'#E55050':C.muted,fontSize:11.5,fontWeight:700,cursor:selectedIds.length?'pointer':'default',fontFamily:'inherit',whiteSpace:'nowrap'}}>
              <Icon name="x" size={13} color={selectedIds.length?'#E55050':C.muted}/> Supprimer
            </button>
          </div>
        </div>
      )}

      {/* Product filter strip */}
      {products.length > 0 && (
        <div style={{display:'flex',gap:8,marginBottom:16,overflowX:'auto',paddingBottom:2}}>
          <button
            onClick={() => setSelectedProduct(null)}
            style={{display:'flex',alignItems:'center',gap:6,padding:'6px 14px',borderRadius:20,border:`1px solid ${!selectedProduct ? C.accent : C.border}`,background:!selectedProduct ? 'rgba(196,30,58,0.08)' : 'rgba(255,255,255,0.07)',color:!selectedProduct ? C.text : C.sec,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit',flexShrink:0,transition:'all 0.15s'}}
          >Tous</button>
          {products.map(p => (
            <button key={p.id}
              onClick={() => setSelectedProduct(selectedProduct === p.id ? null : p.id)}
              style={{display:'flex',alignItems:'center',gap:7,padding:'5px 12px 5px 7px',borderRadius:20,border:`1px solid ${selectedProduct===p.id ? C.accent : C.border}`,background:selectedProduct===p.id ? 'rgba(196,30,58,0.08)' : 'rgba(255,255,255,0.07)',color:selectedProduct===p.id ? C.text : C.sec,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit',flexShrink:0,transition:'all 0.15s'}}
            >
              <div style={{width:20,height:20,borderRadius:4,flexShrink:0,background:p.photo?`url(${p.photo}) center/cover no-repeat`:'rgba(255,255,255,0.08)',border:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
                {!p.photo && <Icon name="box" size={10} color={C.sec}/>}
              </div>
              <span style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:130}}>{p.nom}</span>
            </button>
          ))}
        </div>
      )}

      <div style={{position:'relative',marginBottom:14}}>
        <div style={{position:'absolute',left:13,top:0,bottom:0,display:'flex',alignItems:'center',color:C.sec,pointerEvents:'none'}}>
          <Icon name="search" size={15}/>
        </div>
        <input
          value={query} onChange={e=>setQuery(e.target.value)}
          placeholder="Rechercher par angle, semaine..."
          style={{width:'100%',padding:'11px 14px 11px 38px',borderRadius:9,background:C.card,border:`1px solid ${C.border}`,color:C.text,fontSize:12,fontFamily:'inherit',outline:'none',transition:'border-color 0.15s'}}
          onFocus={e=>e.target.style.borderColor=C.borderM}
          onBlur={e=>e.target.style.borderColor=C.border}
        />
      </div>

      <div style={{display:'flex',gap:6,marginBottom:filterMode!=='tous'?10:18}}>
        {[['tous','Tous','grid'],['date','Date','calendar'],['angle','Angle','tag']].map(([id,label,icon]) => (
          <button key={id} onClick={() => {setFilterMode(id); setActiveChip(null);}}
            style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:7,border:'none',cursor:'pointer',background:filterMode===id?C.accent:'rgba(255,255,255,0.05)',color:filterMode===id?'#fff':C.sec,fontSize:12,fontWeight:600,fontFamily:'inherit',transition:'all 0.15s'}}>
            <Icon name={icon} size={13}/> {label}
          </button>
        ))}
      </div>

      {filterMode!=='tous' && (
        <div style={{display:'flex',gap:6,marginBottom:18,flexWrap:'wrap'}}>
          {chips.map(ch => (
            <button key={ch} onClick={() => setActiveChip(activeChip===ch?null:ch)}
              style={{padding:'5px 14px',borderRadius:20,border:`1px solid ${activeChip===ch?C.borderM:C.border}`,cursor:'pointer',background:activeChip===ch?'rgba(255,255,255,0.09)':'transparent',color:activeChip===ch?C.text:C.sec,fontSize:11,fontWeight:600,fontFamily:'inherit',transition:'all 0.15s'}}>
              {filterMode==='date' ? `Semaine ${ch.replace('S','')}` : ch}
            </button>
          ))}
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(110px,1fr))',gap:4}}>
        {filtered.map(c => (
          <div key={c.id} className="gallery-item"
            onClick={() => selectMode
              ? setSelectedIds(ids => ids.includes(c.id) ? ids.filter(i=>i!==c.id) : [...ids, c.id])
              : setSelected(c)}
            style={{aspectRatio:'4/5',borderRadius:6,overflow:'hidden',cursor:'pointer',position:'relative',background:c.imageUrl?`url(${c.imageUrl}) center/cover no-repeat`:`linear-gradient(160deg,${c.g1||'#333'},${c.g2||'#111'})`}}
          >
            {selectMode && (
              <div style={{position:'absolute',top:6,right:6,width:20,height:20,borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',background:selectedIds.includes(c.id)?C.accent:'rgba(0,0,0,0.45)',border:`1.5px solid ${selectedIds.includes(c.id)?C.accent:'rgba(255,255,255,0.6)'}`,backdropFilter:'blur(2px)'}}>
                {selectedIds.includes(c.id) && <Icon name="check" size={12} color="#fff"/>}
              </div>
            )}
            <div className="gallery-overlay" style={{position:'absolute',bottom:0,left:0,right:0,padding:'18px 8px 6px',background:'linear-gradient(transparent,rgba(0,0,0,0.7))'}}>
              <div style={{fontSize:9,color:'#fff',fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{c.angle}</div>
              <div style={{fontSize:8,color:'rgba(255,255,255,0.6)'}}>Semaine {c.week.replace('S','')}</div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length===0 && query && (
        <div style={{textAlign:'center',padding:'60px 0',color:C.sec,fontSize:12}}>Aucune créative trouvée pour cette recherche</div>
      )}

      {realCreatives.length===0 && !query && (
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'60px 24px',textAlign:'center',gap:14,minHeight:300,border:`1px dashed ${C.border}`,borderRadius:12,background:'rgba(255,255,255,0.015)'}}>
          <div style={{width:56,height:56,borderRadius:14,background:'rgba(45,127,249,0.10)',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <Icon name="grid" size={26} color={C.accent}/>
          </div>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:6}}>Vos créatives apparaîtront ici</div>
            <div style={{fontSize:12,color:C.sec,lineHeight:1.5,maxWidth:420}}>
              Dès que votre agence aura produit vos visuels Meta Ads, vous les retrouverez ici — triés par angle, par semaine, prêts à télécharger et à publier.
            </div>
          </div>
          <button onClick={() => setSection && setSection('tarifs')} style={{marginTop:6,padding:'9px 18px',borderRadius:7,border:'none',background:C.accent,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:7}}>
            Découvrir nos offres <Icon name="arrow" size={12} color="#fff"/>
          </button>
        </div>
      )}



      {selected && (
        <div onClick={() => setSelected(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:600,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div onClick={e => e.stopPropagation()} style={{width:'100%',maxWidth:320,borderRadius:14,overflow:'hidden',background:C.card,border:`1px solid ${C.borderM}`}}>
            <div style={{aspectRatio:'4/5',background:selected.imageUrl?`url(${selected.imageUrl}) center/cover no-repeat`:`linear-gradient(160deg,${selected.g1||'#333'},${selected.g2||'#111'})`}}/>
            <div style={{padding:'14px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:C.text}}>{selected.angle}</div>
                <div style={{fontSize:11,color:C.sec}}>Semaine {selected.week.replace('S','')}</div>
              </div>
              <button onClick={() => shareOrDownloadImage(selected.imageUrl, `${selected.angle}-${selected.week}.jpg`.replace(/[^\w.-]+/g,'_'), isMobile)}
                style={{width:34,height:34,borderRadius:8,border:`1px solid ${C.border}`,background:'rgba(255,255,255,0.07)',color:C.text,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <Icon name="download" size={15}/>
              </button>
            </div>
          </div>
          <button onClick={() => setSelected(null)} style={{position:'absolute',top:24,right:24,width:38,height:38,borderRadius:'50%',border:'none',background:'rgba(255,255,255,0.1)',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <Icon name="x" size={16} color="#fff"/>
          </button>
        </div>
      )}
      {deleteConfirm && (
        <ConfirmModal
          title="Supprimer ces créatives ?"
          message={`${selectedIds.length} créative${selectedIds.length>1?'s':''} ${selectedIds.length>1?'seront supprimées':'sera supprimée'} définitivement de ta galerie. Cette action est irréversible.`}
          confirmLabel={deleting ? 'Suppression…' : 'Supprimer'} cancelLabel="Annuler" danger={true}
          onCancel={()=>!deleting && setDeleteConfirm(false)}
          onConfirm={confirmDeleteSelected}
        />
      )}
    </div>
  );
};

const Copies = ({products, setSection}) => {
  const isMobile = useIsMobile();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [copied, setCopied] = useState(null);
  const angleRefs = useRef({});

  const copy = (text, id) => {
    navigator.clipboard?.writeText(text).then(() => { setCopied(id); setTimeout(() => setCopied(null), 2200); });
  };

  const allAngles = selected
    ? (selected.deliveries || []).flatMap(d => d.angles.map(a => ({...a, semaine:d.semaine, date:d.date})))
    : [];

  const filtered = products.filter(p => p.nom.toLowerCase().includes(query.toLowerCase()));

  const pick = (p) => { setSelected(p); setQuery(''); };

  const scrollTo = (num) => { angleRefs.current[num]?.scrollIntoView({behavior:'smooth', block:'start'}); };

  return (
    <div>
      <div style={{marginBottom:18}}>
        <h1 style={{fontSize:20,fontWeight:700,color:C.text,margin:0}}>Ad Copies</h1>
        <p style={{fontSize:13,color:C.sec,marginTop:3,marginBottom:0}}>Hooks et textes classés par angle · Copiez directement dans Meta Ads Manager</p>
      </div>

      {!selected ? (
        <>
          {/* Search */}
          <div style={{position:'relative',maxWidth:480,marginBottom:20}}>
            <div style={{position:'absolute',left:13,top:0,bottom:0,display:'flex',alignItems:'center',pointerEvents:'none'}}>
              <Icon name="search" size={15} color={C.sec}/>
            </div>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher un produit..."
              style={{width:'100%',padding:'12px 14px 12px 38px',borderRadius:9,background:C.card,border:`1px solid ${C.border}`,color:C.text,fontSize:13,fontFamily:'inherit',outline:'none',transition:'border-color 0.15s'}}
            />
          </div>

          {/* Product card grid */}
          {products.length === 0
            ? <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'60px 24px',textAlign:'center',gap:14,minHeight:300,border:`1px dashed ${C.border}`,borderRadius:12,background:'rgba(255,255,255,0.015)'}}>
                <div style={{width:56,height:56,borderRadius:14,background:'rgba(45,127,249,0.10)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <Icon name="document" size={26} color={C.accent}/>
                </div>
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:6}}>Vos ad copies apparaîtront ici</div>
                  <div style={{fontSize:12,color:C.sec,lineHeight:1.5,maxWidth:420}}>
                    Hooks accrocheurs et descriptions optimisées Meta Ads, classés par angle. Copiez-collez directement dans votre Ads Manager pour gagner du temps.
                  </div>
                </div>
                <button onClick={() => setSection && setSection('produits')} style={{marginTop:6,padding:'9px 18px',borderRadius:7,border:'none',background:C.accent,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:7}}>
                  Ajouter un produit <Icon name="arrow" size={12} color="#fff"/>
                </button>
              </div>
            : filtered.length === 0 && query
            ? <div style={{textAlign:'center',padding:'32px 0'}}>
                <Icon name="search" size={26} color={C.muted}/>
                <div style={{fontSize:12,color:C.sec,marginTop:10}}>Aucun résultat pour "{query}"</div>
              </div>
            : <div style={{display:'grid',gridTemplateColumns:isMobile?'minmax(0,1fr)':'repeat(2,minmax(0,1fr))',gap:10}}>
                {filtered.map(p => {
                  const total = (p.deliveries||[]).reduce((n,d)=>n+d.angles.length,0);
                  return (
                    <button key={p.id} onClick={()=>pick(p)}
                      style={{position:'relative',overflow:'hidden',display:'flex',alignItems:'center',gap:14,padding:'14px 16px',borderRadius:12,border:`1px solid ${C.border}`,background:'linear-gradient(160deg, #12151f 0%, #0d0f16 100%)',cursor:'pointer',textAlign:'left',fontFamily:'inherit',transition:'all 0.2s',width:'100%'}}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(45,127,249,0.35)';e.currentTarget.style.boxShadow='0 8px 24px rgba(45,127,249,0.1)';}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.boxShadow='none';}}
                    >
                      <div style={{width:48,height:48,borderRadius:10,flexShrink:0,background:p.photo?`url(${p.photo}) center/cover no-repeat`:'rgba(255,255,255,0.06)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
                        {!p.photo && <Icon name="box" size={20} color={C.sec}/>}
                      </div>
                      <div style={{flex:1,overflow:'hidden'}}>
                        <div style={{fontSize:13,fontWeight:700,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.nom}</div>
                        <div style={{display:'flex',alignItems:'center',gap:6,marginTop:4}}>
                          <span style={{width:5,height:5,borderRadius:'50%',background:total>0?'#22C55E':C.muted,flexShrink:0}}/>
                          <span style={{fontSize:11,color:C.sec}}>{p.pays||'—'} · {total>0 ? `${total} angle${total!==1?'s':''} livré${total!==1?'s':''}` : 'En attente'}</span>
                        </div>
                      </div>
                      {total>0 && (
                        <div style={{textAlign:'center',flexShrink:0}}>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:17,fontWeight:800,color:C.accent,lineHeight:1}}>{total}</div>
                          <div style={{fontSize:8.5,color:C.muted,textTransform:'uppercase',letterSpacing:'0.4px',marginTop:2}}>angles</div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
          }
        </>
      ) : (
        <div>
          {/* Product banner */}
          <div style={{display:'flex',alignItems:'center',gap:14,padding:'14px 16px',borderRadius:10,background:'rgba(45,127,249,0.10)',border:'1px solid rgba(45,127,249,0.28)',marginBottom:20}}>
            <div style={{width:48,height:48,borderRadius:8,flexShrink:0,background:selected.photo?`url(${selected.photo}) center/cover`:'rgba(255,255,255,0.06)',border:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
              {!selected.photo && <Icon name="box" size={20} color={C.sec}/>}
            </div>
            <div style={{flex:1,overflow:'hidden'}}>
              <div style={{fontSize:14,fontWeight:700,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{selected.nom}</div>
              <div style={{fontSize:11,color:C.sec,marginTop:2,display:'flex',gap:8,flexWrap:'wrap'}}>
                <span>{selected.pricing}</span><span>·</span>
                <span>{selected.pays||'—'}</span><span>·</span>
                <span>{allAngles.length} angle{allAngles.length!==1?'s':''} livré{allAngles.length!==1?'s':''}</span>
              </div>
            </div>
            <button onClick={()=>setSelected(null)}
              style={{width:30,height:30,borderRadius:7,border:'none',background:'rgba(255,255,255,0.10)',color:C.sec,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'background 0.15s'}}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.1)'}
              onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.05)'}
            ><Icon name="x" size={13}/></button>
          </div>

          {allAngles.length === 0 ? (
            <div style={{textAlign:'center',padding:'40px',color:C.sec}}>
              <Icon name="clock" size={28} color={C.muted}/>
              <div style={{fontSize:13,fontWeight:600,color:C.text,marginTop:12}}>Aucun Ad Copy livré pour le moment</div>
              <div style={{fontSize:11,marginTop:6}}>Dès que votre agence aura livré vos copies, elles apparaîtront ici</div>
            </div>
          ) : (
            <>
              {/* Jump to angle chips */}
              <div style={{marginBottom:22}}>
                <div style={{fontSize:10,color:C.sec,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:8}}>Aller à l'angle</div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {allAngles.map(a => (
                    <button key={a.numero} onClick={()=>scrollTo(a.numero)} title={`Angle ${a.numero} · ${a.nom}`}
                      style={{padding:'5px 12px',borderRadius:20,border:`1px solid ${C.border}`,background:'rgba(255,255,255,0.07)',color:C.sec,fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit',transition:'all 0.15s'}}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.background=C.accentS;e.currentTarget.style.color=C.accent;}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background='rgba(255,255,255,0.07)';e.currentTarget.style.color=C.sec;}}
                    >A{a.numero}</button>
                  ))}
                </div>
              </div>

              {/* Deliveries + Angles */}
              {(selected.deliveries||[]).map(delivery => (
                <div key={delivery.semaine} style={{marginBottom:28}}>
                  <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
                    <div style={{height:1,flex:1,background:C.border}}/>
                    <div style={{display:'flex',alignItems:'center',gap:7,padding:'4px 12px',borderRadius:20,background:'rgba(255,255,255,0.07)',border:`1px solid ${C.border}`,flexShrink:0}}>
                      <Icon name="clock" size={11} color={C.sec}/>
                      <span style={{fontSize:11,color:C.sec,fontWeight:600,whiteSpace:'nowrap'}}>Semaine {delivery.semaine} · {delivery.date}</span>
                    </div>
                    <div style={{height:1,flex:1,background:C.border}}/>
                  </div>

                  <div style={{display:'flex',flexDirection:'column',gap:16}}>
                    {delivery.angles.map(angle => (
                      <div key={angle.numero} ref={el=>{angleRefs.current[angle.numero]=el;}} style={{
                        position:'relative', overflow:'hidden', scrollMarginTop:16,
                        background:'linear-gradient(160deg, #12151f 0%, #0d0f16 100%)',
                        border:`1px solid ${C.border}`, borderRadius:16, padding:'24px 24px 22px',
                      }}>
                        {/* Numéro d'angle géant en filigrane — remplace le badge carré */}
                        <div style={{position:'absolute',top:-18,right:10,fontSize:96,fontWeight:900,color:'rgba(255,255,255,0.025)',lineHeight:1,fontFamily:"'DM Mono',monospace",pointerEvents:'none'}}>
                          {String(angle.numero).padStart(2,'0')}
                        </div>

                        <div style={{position:'relative'}}>
                          <div style={{fontSize:9.5,color:C.accent,fontWeight:700,letterSpacing:'1.5px',textTransform:'uppercase',marginBottom:6}}>Angle {angle.numero}</div>
                          <div style={{fontSize:16.5,fontWeight:800,color:C.text,marginBottom:22}}>{angle.nom}</div>

                          {/* Hooks — liste divisée par de fines lignes, plus une boîte par hook */}
                          <div style={{marginBottom:24}}>
                            <div style={{fontSize:9.5,color:C.muted,fontWeight:700,letterSpacing:'1.2px',textTransform:'uppercase',marginBottom:4}}>5 Hooks</div>
                            {angle.hooks.map((hook,i) => (
                              <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'11px 0',borderBottom:i<angle.hooks.length-1?'1px solid rgba(255,255,255,0.05)':'none'}}>
                                <span style={{fontSize:10,color:C.muted,fontFamily:"'DM Mono',monospace",flexShrink:0,width:14}}>{i+1}</span>
                                <span style={{flex:1,fontSize:12.5,color:C.text,lineHeight:1.5}}>{hook}</span>
                                <button onClick={()=>copy(hook,`h-${angle.numero}-${i}`)} title="Copier"
                                  style={{flexShrink:0,width:26,height:26,borderRadius:6,border:'none',background:copied===`h-${angle.numero}-${i}`?C.accentS:'transparent',color:copied===`h-${angle.numero}-${i}`?C.accent:C.muted,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.15s'}}>
                                  <Icon name={copied===`h-${angle.numero}-${i}`?'check':'document'} size={12}/>
                                </button>
                              </div>
                            ))}
                          </div>

                          {/* Texte — citation à bordure latérale, plus un encart fermé */}
                          <div>
                            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                              <div style={{fontSize:9.5,color:C.muted,fontWeight:700,letterSpacing:'1.2px',textTransform:'uppercase'}}>Texte</div>
                              <button onClick={()=>copy(angle.description,`body-${angle.numero}`)}
                                style={{padding:'4px 11px',borderRadius:6,display:'flex',alignItems:'center',gap:5,background:copied===`body-${angle.numero}`?C.accentS:'rgba(255,255,255,0.05)',border:`1px solid ${copied===`body-${angle.numero}`?'rgba(45,127,249,0.3)':C.border}`,color:copied===`body-${angle.numero}`?C.accent:C.sec,fontSize:10,fontWeight:600,cursor:'pointer',fontFamily:'inherit',transition:'all 0.2s'}}>
                                {copied===`body-${angle.numero}` ? <><Icon name="check" size={11}/> Copié</> : 'Copier tout'}
                              </button>
                            </div>
                            <div style={{borderLeft:`2px solid ${C.accent}`,paddingLeft:14}}>
                              <pre style={{fontSize:12.5,color:C.sec,lineHeight:1.7,whiteSpace:'pre-wrap',fontFamily:'inherit',margin:0}}>{angle.description}</pre>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};


const Marche = ({products, isDemo, setSection}) => {
  const isMobile = useIsMobile();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);

  const filtered = products.filter(p => p.nom.toLowerCase().includes(query.toLowerCase()));
  const pick = (p) => { setSelected(p); setQuery(''); };
  const m = selected?.marche;

  return (
  <div>
    <div style={{marginBottom:18}}>
      <h1 style={{fontSize:20,fontWeight:700,color:C.text,margin:0}}>Données Marché</h1>
      <p style={{fontSize:13,color:C.sec,marginTop:3,marginBottom:0}}>Data collectée et applicable à vos campagnes</p>
    </div>

    {!selected ? (
      <>
        {/* Search */}
        <div style={{position:'relative',maxWidth:480,marginBottom:20}}>
          <div style={{position:'absolute',left:13,top:0,bottom:0,display:'flex',alignItems:'center',pointerEvents:'none'}}>
            <Icon name="search" size={15} color={C.sec}/>
          </div>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher un produit..."
            style={{width:'100%',padding:'12px 14px 12px 38px',borderRadius:9,background:C.card,border:`1px solid ${C.border}`,color:C.text,fontSize:13,fontFamily:'inherit',outline:'none',transition:'border-color 0.15s'}}
          />
        </div>

        {/* Product card grid */}
        {products.length === 0
          ? <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'60px 24px',textAlign:'center',gap:14,minHeight:300,border:`1px dashed ${C.border}`,borderRadius:12,background:'rgba(255,255,255,0.015)'}}>
              <div style={{width:56,height:56,borderRadius:14,background:'rgba(45,127,249,0.10)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <Icon name="chart" size={26} color={C.accent}/>
              </div>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:6}}>Vos données marché apparaîtront ici</div>
                <div style={{fontSize:12,color:C.sec,lineHeight:1.5,maxWidth:420}}>
                  Analyse de la concurrence, tendances actuelles, persona cible et ciblage Meta Ads optimisé pour chacun de vos produits — mis à jour chaque semaine.
                </div>
              </div>
              <button onClick={() => setSection && setSection('produits')} style={{marginTop:6,padding:'9px 18px',borderRadius:7,border:'none',background:C.accent,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:7}}>
                Ajouter un produit <Icon name="arrow" size={12} color="#fff"/>
              </button>
            </div>
          : filtered.length === 0 && query
          ? <div style={{textAlign:'center',padding:'32px 0'}}>
              <Icon name="search" size={26} color={C.muted}/>
              <div style={{fontSize:12,color:C.sec,marginTop:10}}>Aucun résultat pour "{query}"</div>
            </div>
          : <div style={{display:'grid',gridTemplateColumns:isMobile?'minmax(0,1fr)':'repeat(2,minmax(0,1fr))',gap:10}}>
              {filtered.map(p => (
                <button key={p.id} onClick={() => pick(p)}
                  style={{position:'relative',overflow:'hidden',display:'flex',alignItems:'center',gap:14,padding:'14px 16px',borderRadius:12,border:`1px solid ${C.border}`,background:'linear-gradient(160deg, #12151f 0%, #0d0f16 100%)',cursor:'pointer',textAlign:'left',fontFamily:'inherit',transition:'all 0.2s',width:'100%'}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(45,127,249,0.35)';e.currentTarget.style.boxShadow='0 8px 24px rgba(45,127,249,0.1)';}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.boxShadow='none';}}
                >
                  <div style={{width:48,height:48,borderRadius:10,flexShrink:0,background:p.photo?`url(${p.photo}) center/cover no-repeat`:'rgba(255,255,255,0.06)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
                    {!p.photo && <Icon name="box" size={20} color={C.sec}/>}
                  </div>
                  <div style={{flex:1,overflow:'hidden'}}>
                    <div style={{fontSize:13,fontWeight:700,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.nom}</div>
                    <div style={{display:'flex',alignItems:'center',gap:6,marginTop:4}}>
                      <span style={{width:5,height:5,borderRadius:'50%',background:p.marche?'#22C55E':C.muted,flexShrink:0}}/>
                      <span style={{fontSize:11,color:C.sec}}>{p.pays||'—'} · {p.marche ? 'Données disponibles' : 'En attente'}</span>
                    </div>
                  </div>
                  {p.marche && (
                    <div style={{flexShrink:0,color:'#22C55E'}}><Icon name="check" size={16}/></div>
                  )}
                </button>
              ))}
            </div>
        }
      </>
    ) : (
      <div>
        {/* Product banner — same pattern as Ad Copies */}
        <div style={{display:'flex',alignItems:'center',gap:14,padding:'14px 16px',borderRadius:10,background:'rgba(45,127,249,0.10)',border:'1px solid rgba(45,127,249,0.28)',marginBottom:20}}>
          <div style={{width:48,height:48,borderRadius:8,flexShrink:0,background:selected.photo?`url(${selected.photo}) center/cover`:'rgba(255,255,255,0.06)',border:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
            {!selected.photo && <Icon name="box" size={20} color={C.sec}/>}
          </div>
          <div style={{flex:1,overflow:'hidden'}}>
            <div style={{fontSize:14,fontWeight:700,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{selected.nom}</div>
            <div style={{fontSize:11,color:C.sec,marginTop:2,display:'flex',gap:8,flexWrap:'wrap'}}>
              <span>{selected.pricing}</span><span>·</span>
              <span>{selected.pays||'—'}</span><span>·</span>
              <span>{m ? 'Données marché disponibles' : "En attente d'analyse"}</span>
            </div>
          </div>
          <button onClick={() => setSelected(null)}
            style={{width:30,height:30,borderRadius:7,border:'none',background:'rgba(255,255,255,0.10)',color:C.sec,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'background 0.15s'}}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.1)'}
            onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.05)'}
          ><Icon name="x" size={13}/></button>
        </div>

        {!m ? (
          <div style={{textAlign:'center',padding:'40px',color:C.sec}}>
            <Icon name="clock" size={28} color={C.muted}/>
            <div style={{fontSize:13,fontWeight:600,color:C.text,marginTop:12}}>Aucune donnée marché disponible pour le moment</div>
            <div style={{fontSize:11,marginTop:6}}>Dès que votre agence aura produit votre analyse, elle apparaîtra ici</div>
          </div>
        ) : (
          <>
            <MarcheDossier m={m} selected={selected} isMobile={isMobile} isDemo={isDemo}/>
          </>
        )}
      </div>
    )}
  </div>
  );
};

// Extrait un nombre depuis une chaîne de prix ("8 900 FCFA" → 8900) — retourne null si rien d'exploitable.
function parsePrixNombre(str) {
  if (typeof str === 'number') return str;
  if (!str) return null;
  const digits = String(str).replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : null;
}

// Composant "dossier" — structure narrative continue (rail de chiffres + colonne de récit),
// remplace l'ancien empilement de cartes séparées. Voir maquette validée.
const MarcheDossier = ({m, selected, isMobile, isDemo}) => {
  const p = m.positionnement || {};
  const persona = m.persona || {};
  const angles = m.angles || [];
  const insights = m.insights || [];
  const deliveries = selected.deliveries || [];

  // Historique des angles groupé par cible — construit depuis deliveries (source cumulative),
  // jamais depuis m.angles seul (qui ne reflète que le dernier lot en mode remplacement).
  const groupes = [];
  deliveries.slice().reverse().forEach(d => {
    const cibleNom = d.cible || 'Cible non identifiée';
    const dernierGroupe = groupes[groupes.length - 1];
    const groupe = (dernierGroupe && dernierGroupe.cible === cibleNom) ? dernierGroupe : (() => {
      const g = { cible: cibleNom, items: [] };
      groupes.push(g);
      return g;
    })();
    (d.angles||[]).slice().reverse().forEach(a => groupe.items.push({ nom: a.nom, semaine: d.semaine, date: d.date }));
  });
  const cibleActuelleNom = groupes[0]?.cible;
  const nbAnglesCibleActuelle = groupes[0]?.items?.length || 0;

  // Échelle de prix — seulement si au moins un concurrent a un prix numérique connu
  const prixVous = parsePrixNombre(selected.pricing);
  const concurrentsAvecPrix = (p.concurrents_directs||[]).filter(c => c && (c.prix_fcfa != null));
  const pointsLadder = prixVous != null
    ? [{ nom:'Votre produit', prix:prixVous, you:true }, ...concurrentsAvecPrix.map(c=>({nom:c.nom, prix:c.prix_fcfa}))]
    : [];
  const minPrix = pointsLadder.length ? Math.min(...pointsLadder.map(x=>x.prix)) : 0;
  const maxPrix = pointsLadder.length ? Math.max(...pointsLadder.map(x=>x.prix)) : 1;
  const rangePrix = Math.max(1, maxPrix - minPrix);
  const posPct = (prix) => 10 + ((prix - minPrix) / rangePrix) * 80; // marge 10-90% pour éviter les labels coupés au bord

  const railItems = [
    p.taille_marche_personnes && { n: p.taille_marche_personnes, l: 'taille de marché estimée', hero:true },
    p.taux_croissance && { n: p.taux_croissance, l: 'tendance du marché', color:'#22C55E' },
    concurrentsAvecPrix.length > 0 && { n: `${concurrentsAvecPrix.filter(c=>c.prix_fcfa < prixVous).length}/${concurrentsAvecPrix.length}`, l: 'concurrents moins chers' },
    nbAnglesCibleActuelle > 0 && { n: `${nbAnglesCibleActuelle}/18`, l: 'angles exploités sur la cible actuelle' },
  ].filter(Boolean);

  return (
    <div style={{position:'relative', overflowX:'hidden'}}>
      <div style={{display: isMobile ? 'flex' : 'grid', gridTemplateColumns: isMobile ? undefined : '150px minmax(0,1fr)', minWidth:0, gap: isMobile ? 20 : 40, flexDirection: isMobile ? 'row' : undefined, overflowX: isMobile ? 'auto' : undefined, paddingBottom: isMobile ? 16 : 0, marginBottom: isMobile ? 20 : 0, borderBottom: isMobile ? `1px solid ${C.border}` : 'none', alignItems:'flex-start'}}>

        {/* Rail de chiffres — bande horizontale scrollable sur mobile, colonne sticky sur desktop */}
        <div style={{display:'flex', flexDirection: isMobile ? 'row' : 'column', gap: isMobile ? 26 : 24, position: isMobile ? 'static' : 'sticky', top: isMobile ? 0 : 20}}>
          {railItems.map((it,i) => (
            <div key={i} style={{flexShrink:0, minWidth: isMobile ? 118 : undefined}}>
              <div style={{width:16, height:1, background:C.border, marginBottom:7}}/>
              <div style={{fontFamily:"'DM Mono',monospace", fontSize:19, fontWeight:500, lineHeight:1,
                color: it.color || undefined,
                background: it.hero && !it.color ? 'linear-gradient(135deg,#fff,#9fbcff)' : undefined,
                WebkitBackgroundClip: it.hero && !it.color ? 'text' : undefined,
                WebkitTextFillColor: it.hero && !it.color ? 'transparent' : undefined,
              }}>{it.n}</div>
              <div style={{fontSize:10, color:C.muted, marginTop:5, lineHeight:1.4, maxWidth:120}}>{it.l}</div>
            </div>
          ))}
        </div>

        {/* Colonne narrative */}
        <div style={{minWidth:0}}>

          {/* 01 — Positionnement */}
          {p.taille_marche_personnes && (
            <div style={{padding: isMobile? '0 0 32px' : '0 0 36px', borderBottom:`1px solid ${C.border}`}}>
              <div style={{fontFamily:"'DM Mono',monospace", fontSize:10.5, color:C.muted, marginBottom:9}}>01 — Positionnement</div>
              <div style={{fontSize:12.5, color:C.sec, lineHeight:1.75, maxWidth:520}}>
                Le marché pèse environ <b style={{color:C.text}}>{p.taille_marche_revenus}</b>{p.taux_croissance ? <> et progresse de <b style={{color:C.text}}>{p.taux_croissance}</b></> : ''}.
                {p.concurrence && <> La concurrence y est <b style={{color: p.concurrence==='Élevée'?'#E55050':p.concurrence==='Moyenne'?'#FFB547':'#22C55E'}}>{p.concurrence.toLowerCase()}</b>{p.concurrence_explication ? ` — ${p.concurrence_explication}` : ''}</>}
              </div>
              {p.argument_principal && (
                <div style={{marginTop:14, borderLeft:`2px solid ${C.accent}`, paddingLeft:13, fontSize:12, color:C.sec, lineHeight:1.6}}>{p.argument_principal}</div>
              )}
            </div>
          )}

          {/* 02 — Prix */}
          {(pointsLadder.length > 1 || p.positionnement_prix) && (
            <div style={{padding:'28px 0', borderBottom:`1px solid ${C.border}`}}>
              <div style={{fontFamily:"'DM Mono',monospace", fontSize:10.5, color:C.muted, marginBottom:9}}>02 — Prix</div>
              {p.positionnement_prix && <div style={{fontSize:12.5, color:C.sec, lineHeight:1.75, maxWidth:520, marginBottom: pointsLadder.length>1?24:0}}>{p.positionnement_prix}</div>}

              {pointsLadder.length > 1 && (
                isMobile ? (
                  <div>
                    {pointsLadder.sort((a,b)=>a.prix-b.prix).map((pt,i) => (
                      <div key={i} style={{display:'flex', alignItems:'baseline', gap:10, marginBottom:12}}>
                        <span style={{fontFamily:"'DM Mono',monospace", fontSize:13, color: pt.you?C.accent:C.text, fontWeight: pt.you?700:400}}>{pt.prix.toLocaleString('fr-FR')} F</span>
                        <span style={{fontSize:11.5, color: pt.you?C.accent:C.sec, fontWeight: pt.you?700:400}}>{pt.you ? '— Votre produit' : `— ${pt.nom}`}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{position:'relative', height:2, background:C.border, margin:'50px 0 34px', overflow:'visible'}}>
                    {pointsLadder.map((pt,i) => {
                      const pct = posPct(pt.prix);
                      // Près des bords, le texte centré déborderait — on ancre à gauche/droite selon la position
                      const align = pct < 22 ? 'left' : pct > 78 ? 'right' : 'center';
                      const infoStyle = align === 'left'
                        ? { left:0, textAlign:'left' }
                        : align === 'right'
                        ? { right:0, textAlign:'right' }
                        : { left:'50%', transform:'translateX(-50%)', textAlign:'center' };
                      return (
                        <div key={i} style={{position:'absolute', left:`${pct}%`, top:'50%', transform:'translate(-50%,-50%)', display:'flex', flexDirection:'column', alignItems:'center'}}>
                          <div style={{position:'absolute', bottom: pt.you?undefined:20, top: pt.you?20:undefined, whiteSpace:'nowrap', ...infoStyle}}>
                            <div style={{fontFamily:"'DM Mono',monospace", fontSize:12.5, color:C.text, fontWeight:500}}>{pt.prix.toLocaleString('fr-FR')} F</div>
                            <div style={{fontSize:10, color: pt.you?C.accent:C.sec, fontWeight: pt.you?700:400, marginTop:2}}>{pt.you?'Votre produit':pt.nom}</div>
                          </div>
                          <div style={{width:11, height:11, borderRadius:'50%', border:`2px solid ${C.bg}`, background: pt.you?C.accent:'rgba(255,255,255,0.25)', boxShadow: pt.you?'0 0 0 4px rgba(91,141,239,0.18)':'none'}}/>
                        </div>
                      );
                    })}
                  </div>
                )
              )}
              {p.concurrents_indirects?.length > 0 && (
                <div style={{marginTop:14, fontSize:11, color:C.muted}}><b style={{color:C.sec}}>Indirects : </b>{p.concurrents_indirects.join(', ')}</div>
              )}
            </div>
          )}

          {/* 03 — Cible actuelle */}
          {persona.nom && (
            <div style={{padding:'28px 0', borderBottom:`1px solid ${C.border}`}}>
              <div style={{fontFamily:"'DM Mono',monospace", fontSize:10.5, color:C.muted, marginBottom:16}}>03 — Cible actuelle</div>
              <div style={{display:'flex', alignItems:'baseline', gap:9, flexWrap:'wrap', marginBottom:14}}>
                <span style={{fontSize:14.5, fontWeight:800, color:C.text}}>{persona.nom}</span>
                <span style={{fontSize:11.5, color:C.muted}}>{persona.age && `${persona.age} ans · `}{persona.role}{persona.ville ? ` · ${persona.ville}` : ''}</span>
              </div>
              {persona.quote && (
                <div style={{fontSize:16, fontWeight:600, lineHeight:1.5, color:C.text, borderLeft:`2px solid ${C.accent}`, paddingLeft:16, margin:'16px 0', maxWidth:480}}>"{persona.quote}"</div>
              )}
              <div style={{display:'flex', gap:isMobile?24:32, flexWrap:'wrap', marginTop:18}}>
                {persona.desirs?.length > 0 && (
                  <div>
                    <div style={{fontSize:9.5, color:C.muted, textTransform:'uppercase', letterSpacing:'0.5px', fontWeight:700, marginBottom:8}}>Ce qu'elle veut</div>
                    {persona.desirs.map((d,i)=>(<div key={i} style={{fontSize:12, color:C.text, marginBottom:5}}>→ {d}</div>))}
                  </div>
                )}
                {persona.craintes?.length > 0 && (
                  <div>
                    <div style={{fontSize:9.5, color:C.muted, textTransform:'uppercase', letterSpacing:'0.5px', fontWeight:700, marginBottom:8}}>Ce qui la freine</div>
                    {persona.craintes.map((cr,i)=>(<div key={i} style={{fontSize:12, color:C.text, marginBottom:5}}>→ {cr}</div>))}
                  </div>
                )}
              </div>
              {nbAnglesCibleActuelle > 0 && (
                <div style={{display:'flex', alignItems:'center', gap:12, marginTop:24, fontSize:11.5, color:C.muted, flexWrap:'wrap'}}>
                  <b style={{color:C.text, fontFamily:"'DM Mono',monospace", fontWeight:500}}>{nbAnglesCibleActuelle}/18</b> angles exploités sur cette cible
                  <div style={{flex: isMobile?'1 0 100%':1, maxWidth: isMobile?'none':220, height:2, background:C.border, position:'relative'}}>
                    <div style={{position:'absolute', left:0, top:0, height:'100%', width:`${Math.min(100,(nbAnglesCibleActuelle/18)*100)}%`, background:C.accent}}/>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 04 — Historique des angles, groupé par cible, scrollable */}
          {groupes.length > 0 && (
            <div style={{padding:'28px 0', borderBottom:`1px solid ${C.border}`}}>
              <div style={{fontFamily:"'DM Mono',monospace", fontSize:10.5, color:C.muted, marginBottom:9}}>04 — Historique des angles</div>
              <div style={{fontSize:12.5, color:C.sec, lineHeight:1.75, marginBottom:18, maxWidth:520}}>Chaque angle appartient à une cible précise — jamais réutilisé tel quel pour une autre cible.</div>
              <div style={{maxHeight:320, overflowY:'auto', paddingRight:6}}>
                {groupes.map((g, gi) => (
                  <div key={gi}>
                    <div style={{position:'sticky', top:0, background:C.bg, padding:'7px 0', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', color: gi===0?C.accent:C.muted, display:'flex', alignItems:'center', gap:8}}>
                      {gi===0 ? 'Cible actuelle' : 'Cible précédente'} — {g.cible} ({g.items.length})
                      <div style={{flex:1, height:1, background:C.border}}/>
                    </div>
                    {g.items.map((a,ai) => (
                      <div key={ai} style={{display:'grid', gridTemplateColumns:'22px 1fr', gap:10, padding:'10px 0', borderBottom:`1px solid ${C.border}`}}>
                        <div style={{fontFamily:"'DM Mono',monospace", fontSize:10, color:C.muted, paddingTop:2}}>{g.items.length-ai}</div>
                        <div>
                          <div style={{fontSize:12.5, fontWeight:700, color:C.text}}>{a.nom}</div>
                          <div style={{fontFamily:"'DM Mono',monospace", fontSize:9.5, color:C.muted, marginTop:3}}>{a.semaine} · {a.date}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 05 — Recommandations */}
          {insights.length > 0 && (
            <div style={{position:'relative', padding:'28px 0'}}>
              <div style={{fontFamily:"'DM Mono',monospace", fontSize:10.5, color:C.muted, marginBottom:16}}>05 — Recommandations</div>
              <div>
                {insights.map((ins,i) => (
                  <div key={i} style={{display: isMobile?'block':'grid', gridTemplateColumns: isMobile?undefined:'90px 1fr', gap: isMobile?6:20, padding:'18px 0', borderTop: i>0?`1px solid ${C.border}`:'none'}}>
                    <div style={{flexShrink:0, color:C.accent}}><Icon name={ins.icon} size={15}/></div>
                    <div style={{fontSize:12, color:C.sec, lineHeight:1.65, marginTop: isMobile?6:0}}>{ins.t}</div>
                  </div>
                ))}
              </div>
              {isDemo && <LockOverlay/>}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};


const Chatbot = ({user, subscription, products=[], credits={}, allBriefs=[], briefs={}, section='', setSection, openProductForm, priceCtx={currency:'XOF',rate:1}, onOpenPayment}) => {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [showNudge, setShowNudge] = useState(true); // petit badge rouge incitatif, tant que le chat n'a jamais été ouvert
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => {
    let id = localStorage.getItem('amina_session');
    if (!id) { id = 'sess_' + Math.random().toString(36).slice(2); localStorage.setItem('amina_session', id); }
    return id;
  });
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const language = (() => {
    const lang = navigator.language || 'fr';
    return lang.startsWith('fr') ? 'fr' : 'en';
  })();

  // Bienvenue frais à chaque ouverture (pas d'historique affiché)
  useEffect(() => {
    if (!open) return;
    setMessages([]);
    const name = user?.user_metadata?.full_name?.split(' ')[0] || '';
    const hour = new Date().getHours();
    const greeting = language === 'fr'
      ? (hour < 12 ? 'Bonne matinée' : hour < 18 ? 'Bonne après-midi' : 'Bonsoir')
      : (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');
    const welcome = language === 'fr'
      ? `${greeting}${name ? ' ' + name : ''} ! Je suis **Ava**. Dis-moi — qu'est-ce qui t'amène aujourd'hui ?`
      : `${greeting}${name ? ' ' + name : ''} ! I'm **Ava**. What brings you here today?`;
    setTimeout(() => setMessages([{ role: 'model', content: welcome }]), 120);
  }, [open]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const newHistory = [...messages, { role: 'user', content: text }];
    setMessages(newHistory);
    setLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      const r = await fetch('https://adstack-server.onrender.com/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message: text,
          history: messages.slice(-8),
          session_id: user?.id || sessionId,
          context: {
            user: user ? { email: user.email, name: user.user_metadata?.full_name } : null,
            subscription, products: products.slice(0,5),
            credits: computeCredits(subscription, allBriefs),
            section, language,
            currency: priceCtx?.currency || 'XOF',
            currencyRate: priceCtx?.rate || 1,
          }
        })
      });
      clearTimeout(timeoutId);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      setMessages(prev => [...prev, { role: 'model', content: data.reply }]);
    } catch(e) {
      setMessages(prev => [...prev, { role: 'model', content: language==='fr' ? "Désolée, je suis temporairement indisponible. Réessaie dans un instant." : "Sorry, I'm temporarily unavailable. Please try again." }]);
    }
    setLoading(false);
  };

  // Parse message for action buttons
  const parseMessage = (content) => {
    const btnRegex = /\[BTN:([^\]]+)\]/g;
    const buttons = [];
    let match;
    while ((match = btnRegex.exec(content)) !== null) buttons.push(match[1]);
    const text = content.replace(/\[BTN:[^\]]+\]/g, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').trim();
    return { text, buttons };
  };

  const handleAction = (action) => {
    const parts = action.split(':');
    const type = parts[0];
    if (type === 'navigate' && parts[1]) { setSection(parts[1]); setOpen(false); }
    if (type === 'openProductForm') { setSection('produits'); setOpen(false); setTimeout(() => openProductForm?.(), 200); }
    if (type === 'login') { sbAuth.signInWithGoogle(); }
    if (type === 'checkout' || type === 'checkout-annual') {
      const cycle = type === 'checkout-annual' ? 'annual' : 'monthly';
      const productId = PLAN_CHECKOUT_IDS[`${parts[1]}-${cycle}`];
      if (productId && onOpenPayment) { setOpen(false); startCheckout(productId, onOpenPayment); }
    }
  };

  const BTN_LABELS = {
    'navigate:tarifs': '→ Voir les offres',
    'navigate:produits': '→ Mes produits',
    'navigate:suivi': '→ Suivi de demandes',
    'navigate:notifications': '→ Mes notifications',
    'navigate:galerie': '→ Galerie créatives',
    'openProductForm': '+ Créer mon produit maintenant',
    'login': '→ Connecter mon compte Google',
    'checkout:starter': 'Commencer avec Starter →',
    'checkout:pro': 'Passer en Pro →',
    'checkout:scale': 'Passer en Scale →',
    'checkout-annual:starter': 'Starter annuel (-25%) →',
    'checkout-annual:pro': 'Pro annuel (-25%) →',
    'checkout-annual:scale': 'Scale annuel (-25%) →',
  };

  return (
    <>
      {/* Inject chat CSS */}
      <style>{`
        @keyframes aminaIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
        @keyframes aminaPulse{0%,100%{box-shadow:0 4px 20px rgba(45,127,249,0.5)}50%{box-shadow:0 4px 28px rgba(45,127,249,0.8)}}
        .amina-msg strong{font-weight:700;color:#fff}
        .amina-bubble::-webkit-scrollbar{width:4px}
        .amina-bubble::-webkit-scrollbar-track{background:transparent}
        .amina-bubble::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:2px}
        .amina-input:focus{outline:none;border-color:rgba(45,127,249,0.5)!important;box-shadow:0 0 0 3px rgba(45,127,249,0.12)}
      `}</style>

      {/* Panel chat */}
      {open && (
        <div style={{
          position:'fixed', bottom: isMobile?16:90, right: isMobile?8:20,
          width: isMobile?'calc(100vw - 16px)':380, height: isMobile?'72vh':540,
          background:'#0C0D14', border:'1px solid rgba(255,255,255,0.08)',
          borderRadius:16, zIndex:9998,
          display:'flex', flexDirection:'column', overflow:'hidden',
          boxShadow:'0 24px 64px rgba(0,0,0,0.7)',
          animation:'aminaIn .25s cubic-bezier(.34,1.56,.64,1)'
        }}>
          {/* Header */}
          <div style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',borderBottom:'1px solid rgba(255,255,255,0.07)',flexShrink:0}}>
            <div style={{width:36,height:36,borderRadius:'50%',background:'linear-gradient(145deg,#141C33,#0B0F1A)',border:'1px solid rgba(255,255,255,0.12)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <AvaMark size={20}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:800,color:'#fff',fontFamily:"'Inter',sans-serif"}}>Ava</div>
              <div style={{fontSize:10,color:'#22C55E',fontWeight:600}}>● En ligne</div>
            </div>
            <button onClick={()=>setOpen(false)} style={{width:28,height:28,borderRadius:7,border:'none',background:'rgba(255,255,255,0.06)',color:'rgba(255,255,255,0.4)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><Icon name="x" size={13} color="rgba(255,255,255,0.4)"/></button>
          </div>

          {/* Messages */}
          <div className="amina-bubble" style={{flex:1,overflowY:'auto',padding:'16px 14px',display:'flex',flexDirection:'column',gap:12}}>
            {messages.map((m, i) => {
              const isUser = m.role === 'user';
              const { text, buttons } = parseMessage(m.content);
              return (
                <div key={i} style={{display:'flex',flexDirection:'column',alignItems:isUser?'flex-end':'flex-start',gap:6,animation:'aminaIn .2s ease'}}>
                  <div className="amina-msg" style={{
                    maxWidth:'82%', padding:'9px 12px', borderRadius: isUser?'14px 14px 4px 14px':'14px 14px 14px 4px',
                    background: isUser ? 'linear-gradient(135deg,#5B8DEF,#0B3D91)' : 'rgba(255,255,255,0.07)',
                    color: isUser?'#fff':'rgba(255,255,255,0.88)', fontSize:12.5, lineHeight:1.55,
                    fontFamily:"'Inter',sans-serif",
                  }} dangerouslySetInnerHTML={{__html: text}}/>
                  {buttons.length > 0 && (
                    <div style={{display:'flex',flexWrap:'wrap',gap:6,maxWidth:'82%'}}>
                      {buttons.map((b, j) => (
                        <button key={j} onClick={()=>handleAction(b)}
                          style={{padding:'6px 12px',borderRadius:20,border:'1px solid rgba(45,127,249,0.4)',background:'rgba(45,127,249,0.1)',color:'#5B8DEF',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:"'Inter',sans-serif",transition:'all 0.15s'}}
                          onMouseEnter={e=>{e.currentTarget.style.background='rgba(45,127,249,0.2)';e.currentTarget.style.borderColor='rgba(45,127,249,0.7)';}}
                          onMouseLeave={e=>{e.currentTarget.style.background='rgba(45,127,249,0.1)';e.currentTarget.style.borderColor='rgba(45,127,249,0.4)';}}>
                          {BTN_LABELS[b] || b.split(':').pop()}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {loading && (
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <div style={{padding:'9px 14px',borderRadius:'14px 14px 14px 4px',background:'rgba(255,255,255,0.07)'}}>
                  <div style={{display:'flex',gap:4,alignItems:'center'}}>
                    {[0,1,2].map(i=><div key={i} style={{width:5,height:5,borderRadius:'50%',background:'rgba(255,255,255,0.4)',animation:`aminaPulse 1.2s ${i*0.2}s infinite`}}/>)}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef}/>
          </div>

          {/* Input */}
          <div style={{padding:'12px 14px',borderTop:'1px solid rgba(255,255,255,0.07)',display:'flex',gap:8,flexShrink:0}}>
            <input ref={inputRef} className="amina-input" value={input}
              onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();} }}
              placeholder={language==='fr'?"Pose-moi une question...":"Ask me anything..."}
              style={{flex:1,padding:'9px 12px',borderRadius:10,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.10)',color:'#fff',fontSize:12,fontFamily:"'Inter',sans-serif",outline:'none',transition:'border-color .2s, box-shadow .2s'}}
            />
            <button onClick={send} disabled={!input.trim()||loading}
              style={{width:36,height:36,borderRadius:10,border:'none',background:input.trim()&&!loading?'linear-gradient(135deg,#1FB6FF,#5B8DEF)':'rgba(255,255,255,0.12)',color:'#fff',cursor:input.trim()&&!loading?'pointer':'default',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all .2s'}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button onClick={()=>{setOpen(o=>!o); setShowNudge(false);}} style={{
        position:'fixed', bottom:isMobile?16:20, right:isMobile?16:20,
        width:56, height:56, borderRadius:'50%', border:'2px solid rgba(255,255,255,0.12)',
        background:'linear-gradient(145deg,#141C33,#0B0F1A)',
        color:'#fff', cursor:'pointer', zIndex:9999,
        display:open?'none':'flex', alignItems:'center', justifyContent:'center',
        boxShadow:'0 8px 28px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
        transition:'transform .2s',
      }}
      onMouseEnter={e=>e.currentTarget.style.transform='scale(1.08)'}
      onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
        <AvaMark size={30}/>
        {showNudge && (
          <span style={{position:'absolute',top:-2,right:-2,width:20,height:20,borderRadius:'50%',background:'#E55050',color:'#fff',fontSize:11,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',border:'2px solid #0A0C11',boxShadow:'0 0 8px rgba(229,80,80,0.6)'}}>
            1
          </span>
        )}
      </button>
    </>
  );
};

const PLANS = [
  {
    id:'starter', name:'Conversion Starter', color:C.gray, best:false,
    tagline:'Pour tester vos produits sereinement et obtenir vos premières ventes rentables, sans brûler votre budget.',
    ctaText:'Vendez Maintenant',
    imagesPerWeek: 9, produitsPerWeek: '1',
    monthly: { price:39900, priceBarre:60000, prixImg:1108, delivery:'48h', checkout:'https://shop.adstackofficial.com/prd_ljowq8/checkout' },
    annual:  { price:29900, priceBarre:39900, prixImg:830,  delivery:'24h', checkout:'https://shop.adstackofficial.com/prd_wdya3v9h/checkout' },
  },
  {
    id:'pro', name:'Conversion Pro', color:C.accent, best:true,
    tagline:'Pour dominer votre marché, écraser vos coûts d\'acquisition et positionner votre marque en leader.',
    ctaText:'Dominez Votre Marché',
    imagesPerWeek: 18, produitsPerWeek: '1 à 2',
    monthly: { price:69900, priceBarre:120000, prixImg:970, delivery:'48h', checkout:'https://shop.adstackofficial.com/prd_34w031/checkout' },
    annual:  { price:54900, priceBarre:69900,  prixImg:762, delivery:'24h', checkout:'https://shop.adstackofficial.com/prd_lnp4ax0b/checkout' },
  },
  {
    id:'scale', name:'Conversion Scale', color:C.white, best:false,
    tagline:'L\'arsenal complet pour inonder de multiples marchés en simultané et faire exploser votre ROAS.',
    ctaText:'Explosez Votre Croissance',
    imagesPerWeek: 36, produitsPerWeek: '1 à 4',
    monthly: { price:109900, priceBarre:240000, prixImg:763, delivery:'48h', checkout:'https://shop.adstackofficial.com/prd_9fi79y/checkout' },
    annual:  { price:79900,  priceBarre:109900, prixImg:554, delivery:'24h', checkout:'https://shop.adstackofficial.com/prd_dn4fb72l/checkout' },
  },
];

const PLAN_CHECKOUT_IDS = {
  'starter-monthly': 'prd_ljowq8',   'starter-annual': 'prd_wdya3v9h',
  'pro-monthly':     'prd_34w031',   'pro-annual':     'prd_lnp4ax0b',
  'scale-monthly':   'prd_9fi79y',   'scale-annual':   'prd_dn4fb72l',
};

// Point d'entrée UNIQUE pour "payer" — utilisé par Nos Tarifs, le bloc upsell sidebar, et le chatbot.
// Vérifie la connexion Google, mémorise l'intention si pas connecté, reprend automatiquement après connexion.
const startCheckout = (productId, setPaymentProductId) => {
  const user = sbAuth.getUser();
  if (!user) {
    localStorage.setItem('adstack_pending_checkout', productId);
    sbAuth.signInWithGoogle();
    return;
  }
  setPaymentProductId(productId);
};

const triggerChariowCheckout = async (plan, cycle, user, popup) => {
  const cycleData = plan[cycle];
  const checkoutUrl = cycleData.checkout;
  try {
    const r = await fetch('https://adstack-server.onrender.com/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: PLAN_CHECKOUT_IDS[`${plan.id}-${cycle}`],
        email: user.email,
        user_id: user.id,
        plan: plan.id,
        cycle,
      })
    });
    const data = await r.json();
    const url = data.checkout_url || checkoutUrl;
    if (popup === window) { window.location.href = url; }
    else { popup.location.href = url; }
  } catch(e) {
    if (popup === window) { window.location.href = checkoutUrl; }
    else { popup.location.href = checkoutUrl; }
  }
};

const FAQ_ITEMS = [
  {
    q: "Qu'est-ce qu'AdBoard exactement ?",
    a: "AdBoard est la plateforme d'AdStack : vous ajoutez vos produits, et notre équipe produit chaque semaine vos visuels publicitaires (images Meta Ads), une analyse de votre marché cible, et des textes publicitaires prêts à l'emploi — livrés directement sur votre tableau de bord."
  },
  {
    q: "Quelle est la différence entre les 3 formules ?",
    a: "Conversion Starter (9 images/semaine, 1 produit), Conversion Pro (18 images/semaine, 2 produits), et Conversion Scale (36 images/semaine, 4 produits). Plus la formule est élevée, plus vous recevez de visuels par semaine et plus vous pouvez gérer de produits en simultané."
  },
  {
    q: "En combien de temps mes visuels sont-ils livrés ?",
    a: "Comptez généralement jusqu'à 48h après votre demande. Vous êtes notifié dès que vos visuels sont prêts, directement dans l'onglet Notifications."
  },
  {
    q: "Comment fonctionne l'analyse de marché ?",
    a: "Pour chaque produit, notre équipe analyse votre marché cible (pays, concurrence, persona) et vous fournit une synthèse claire pour orienter vos campagnes — visible dans l'onglet Données Marché."
  },
  {
    q: "Puis-je changer de formule à tout moment ?",
    a: "Oui. Vous pouvez upgrader depuis l'onglet Nos Tarifs à tout moment ; le changement prend effet immédiatement."
  },
  {
    q: "Comment se passe le paiement ?",
    a: "Le paiement est traité de façon sécurisée par notre partenaire Chariow. Nous ne stockons jamais vos informations bancaires directement."
  },
  {
    q: "Que faire si un visuel ne me convient pas ?",
    a: "Contactez-nous directement — nous ajustons en fonction de vos retours pour que vos prochains lots correspondent mieux à vos attentes."
  },
  {
    q: "Mes données sont-elles en sécurité ?",
    a: "Oui. Vos informations sont hébergées de façon sécurisée et ne sont jamais revendues à des tiers à des fins publicitaires. Le détail complet est disponible dans notre Politique de confidentialité ci-dessous."
  },
];

const Faq = () => {
  const isMobile = useIsMobile();
  const [openIdx, setOpenIdx] = useState(0);
  return (
    <div style={{maxWidth:720, margin:'0 auto', padding: isMobile ? '20px 16px 60px' : '32px 24px 80px'}}>
      <h1 style={{fontSize:isMobile?20:24, fontWeight:800, color:C.text, margin:'0 0 6px'}}>FAQ & Aide</h1>
      <p style={{fontSize:13, color:C.sec, margin:'0 0 24px', lineHeight:1.6}}>Les réponses aux questions les plus fréquentes sur AdBoard.</p>

      {FAQ_ITEMS.map((item, i) => (
        <div key={i} style={cs({marginBottom:10, overflow:'hidden'})}>
          <button onClick={() => setOpenIdx(openIdx === i ? null : i)} style={{
            width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12,
            padding:'14px 16px', background:'transparent', border:'none', cursor:'pointer',
            fontFamily:'inherit', textAlign:'left',
          }}>
            <span style={{fontSize:13.5, fontWeight:700, color:C.text}}>{item.q}</span>
            <Icon name={openIdx === i ? 'x' : 'plus'} size={14} color={C.sec}/>
          </button>
          {openIdx === i && (
            <div style={{padding:'0 16px 16px', fontSize:13, color:C.sec, lineHeight:1.6}}>
              {item.a}
            </div>
          )}
        </div>
      ))}

      <div style={{marginTop:28, padding:'16px', borderTop:`1px solid ${C.border}`, fontSize:12, color:C.sec, lineHeight:1.8}}>
        <div>Une autre question ? Écrivez-nous à <a href="mailto:thefirstquality01@gmail.com" style={{color:'#5B8DEF'}}>thefirstquality01@gmail.com</a></div>
        <div>Pour savoir comment vos données sont traitées, consultez notre <a href="/privacy.html" target="_blank" rel="noopener noreferrer" style={{color:'#5B8DEF'}}>Politique de confidentialité</a>.</div>
      </div>
    </div>
  );
};

const Tarifs = ({convertPrice=(f=>f.toLocaleString('fr-FR')+' FCFA'), subscription=null, onOpenPayment=null}) => {
  const isMobile = useIsMobile();
  const [annual, setAnnual] = useState(true); // activé par défaut sur annuel
  const onCta = async (plan) => {
    const cycle = annual ? 'annual' : 'monthly';
    const cycleData = plan[cycle];
    try { window.fbq && window.fbq('track', 'InitiateCheckout', { content_name: plan.name, value: cycleData.price, currency: 'XOF' }); } catch(e) {}
    const productId = PLAN_CHECKOUT_IDS[`${plan.id}-${cycle}`];
    if (onOpenPayment && productId) { startCheckout(productId, onOpenPayment); return; }
    // Filet de sécurité si jamais le produit n'est pas reconnu : ouvrir le checkout classique
    const user = sbAuth.getUser();
    if (!user) { localStorage.setItem('adstack_pending_plan', JSON.stringify({ ...plan, cycle })); sbAuth.signInWithGoogle(); return; }
    const popup = window.open('', '_blank') || window;
    triggerChariowCheckout(plan, cycle, user, popup);
  };
  const userPlan = subscription?.plan;

  // Inject gradient animation CSS
  useEffect(() => {
    if (document.getElementById('tarifs-gradient-css')) return;
    const s = document.createElement('style');
    s.id = 'tarifs-gradient-css';
    s.textContent = `
      @keyframes gradientFlow {
        0%   { background-position: 0% 50%; }
        50%  { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      .headline-gradient {
        background: linear-gradient(90deg, #1FB6FF, #5B8DEF, #8AB4F8, #1FB6FF);
        background-size: 250% auto;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        animation: gradientFlow 4s ease infinite;
        display: inline;
      }
      .cta-btn-active:hover {
        opacity: 0.88;
        transform: translateY(-1px);
        box-shadow: 0 8px 24px rgba(45,127,249,0.45) !important;
      }
    `;
    document.head.appendChild(s);
    return () => { const el = document.getElementById('tarifs-gradient-css'); if(el) el.remove(); };
  }, []);

  return (
    <div>
      {/* ── Header ── */}
      <div style={{marginBottom:28}}>
        <div style={{fontSize:11,color:C.sec,fontWeight:700,letterSpacing:'2px',textTransform:'uppercase',marginBottom:10}}>
          Nos Tarifs
        </div>
        <h1 style={{fontSize:isMobile?28:34,fontWeight:900,margin:'0 0 12px',lineHeight:1.15,letterSpacing:'-0.5px'}}>
          <span className="headline-gradient">Des Images Qui Vendent.</span> Chaque Semaine, Sans Effort.
        </h1>
        <p style={{fontSize:14,color:C.sec,margin:0,lineHeight:1.5,maxWidth:480}}>
          Arrêtez de chercher quoi publier. Recevez chaque semaine toute une stratégie de contenu publicitaire performant : <strong style={{color:C.text}}>visuels, copywriting et données marché.</strong>
        </p>
      </div>

      {/* ── Toggle Mensuel / Annuel ── */}
      <div style={{display:'flex',flexDirection:'column',alignItems:isMobile?'center':'flex-start',marginBottom:24}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontSize:13,fontWeight:600,color:!annual?C.text:C.sec}}>Mensuel</span>
          <button
            onClick={() => setAnnual(a => !a)}
            style={{width:44,height:24,borderRadius:99,border:'none',cursor:'pointer',position:'relative',background:annual?C.accent:'rgba(255,255,255,0.15)',transition:'background 0.2s',flexShrink:0}}
          >
            <div style={{position:'absolute',top:2,left:annual?22:2,width:20,height:20,borderRadius:'50%',background:'#fff',transition:'left 0.2s'}}/>
          </button>
          <span style={{fontSize:13,fontWeight:600,color:annual?C.text:C.sec,display:'flex',alignItems:'center',gap:7}}>
            Annuel
            <span style={{fontSize:10,fontWeight:800,padding:'2px 8px',borderRadius:99,background:C.accentS,color:C.accent}}>-25%</span>
          </span>
        </div>
        <p style={{fontSize:11.5,color:C.muted,marginTop:8,textAlign:isMobile?'center':'left'}}>
          Facturation au choix — paie mensuellement ou une fois par an. <strong style={{color:C.accent}}>L'annuel te fait économiser jusqu'à 25%.</strong>
        </p>
      </div>

      {/* ── Garantie — visible sur PC ; sur mobile, trop encombrante ici, déplacée sous chaque CTA ── */}
      {!isMobile && (
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 16px',borderRadius:11,background:'rgba(45,127,249,0.07)',border:`1px solid rgba(45,127,249,0.22)`,marginBottom:20,flexWrap:'wrap'}}>
          <span style={{width:30,height:30,borderRadius:9,background:'rgba(45,127,249,0.15)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon name="lock" size={15} color={C.accent}/></span>
          <div style={{fontSize:12.5,color:C.text,lineHeight:1.4}}>
            <strong style={{color:C.accent}}>Satisfait ou 100% remboursé.</strong> <span style={{color:C.sec}}>Paiement sécurisé, sans engagement caché.</span>
          </div>
        </div>
      )}

      {/* ── Plan cards ── */}
      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr 1fr',gap:14,marginBottom:20}}>
        {PLANS.map(p => {
          const selectedCycle = annual ? 'annual' : 'monthly';
          const sameTier = userPlan === p.id;
          // Abonnements créés avant l'ajout du cycle annuel → toujours mensuel historiquement
          const currentCycle = subscription?.cycle || 'monthly';
          const isCurrent = sameTier && currentCycle === selectedCycle;
          const isCycleUpsell = sameTier && currentCycle !== selectedCycle && selectedCycle === 'annual';   // même palier, passer à l'annuel
          const isCycleDowngradeCycle = sameTier && currentCycle !== selectedCycle && selectedCycle === 'monthly'; // même palier, repasser au mensuel
          const PLAN_ORDER = { starter:1, pro:2, scale:3 };
          const isDowngrade = userPlan && !sameTier && PLAN_ORDER[p.id] < PLAN_ORDER[userPlan];
          const isUpgrade = userPlan && !sameTier && PLAN_ORDER[p.id] > PLAN_ORDER[userPlan];
          const cycleData = annual ? p.annual : p.monthly;
          const visuelsLabel = p.id === 'starter' ? `${p.imagesPerWeek} Visuels`
                              : p.id === 'pro' ? `${p.imagesPerWeek} Visuels Haute Performance`
                              : `${p.imagesPerWeek} Visuels Multi-Angles`;
          const features = [
            { icon:'image',   bold:visuelsLabel,             rest: p.id==='starter' ? 'livrés / semaine (angles et concepts variés)' : 'livrés / semaine' },
            { icon:'box',     bold:`${p.produitsPerWeek} Produit${p.produitsPerWeek!=='1'?'s':''}`, rest: p.id==='starter' ? '/ semaine' : (p.id==='pro' ? '/ semaine, couverts simultanément' : '/ semaine, couverture massive') },
            { icon:'grid',    bold:'Galerie Créative',        rest:'— tous vos visuels centralisés' },
            { icon:'chart',   bold:'Marché analysé',          rest:'chaque semaine : cibles, concurrents & tendances' },
            { icon:'document',bold:'Textes publicitaires',    rest:'prêts à copier-coller (Ad Copies)' },
            { icon:'sparkle', bold:'Assistant IA',            rest:'stratégique, disponible 7j/7' },
            { icon:'upload',  bold:'Import produits',         rest:'simple et rapide' },
            { icon:'clock',   bold:'Suivi de production',     rest:'en temps réel' },
            { icon:'bolt',    bold:`Prêtes en ${cycleData.delivery}`, rest:'chaque semaine' },
          ];
          return (
            <div key={p.id}
              style={{
                background: p.best
                  ? 'linear-gradient(180deg,rgba(45,127,249,0.10),rgba(45,127,249,0.03))'
                  : C.card,
                border:`1px solid ${isCurrent?'rgba(255,255,255,0.28)':p.best?'rgba(45,127,249,0.38)':C.border}`,
                borderRadius:14, padding:'22px', display:'flex', flexDirection:'column',
                position:'relative', transition:'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-3px)';e.currentTarget.style.boxShadow='0 14px 32px rgba(0,0,0,0.35)';}}
              onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none';}}
            >
              {/* Badge */}
              {isCurrent && (
                <div style={{position:'absolute',top:-1,left:'50%',transform:'translateX(-50%)',background:'rgba(255,255,255,0.9)',color:'#0A0A0E',fontSize:9,fontWeight:900,padding:'3px 14px',borderRadius:'0 0 7px 7px',letterSpacing:'0.5px',textTransform:'uppercase',whiteSpace:'nowrap'}}>
                  VOTRE PLAN ACTUEL
                </div>
              )}
              {p.best && !isCurrent && (
                <div style={{position:'absolute',top:-1,left:'50%',transform:'translateX(-50%)',background:`linear-gradient(90deg,${C.accent},#0B3D91)`,color:'#fff',fontSize:9,fontWeight:900,padding:'3px 14px',borderRadius:'0 0 7px 7px',letterSpacing:'0.5px',textTransform:'uppercase',whiteSpace:'nowrap'}}>
                  RECOMMANDÉ
                </div>
              )}

              <div style={{fontSize:12,fontWeight:700,color:p.color,marginTop:isCurrent||p.best?8:0,marginBottom:4,letterSpacing:'0.3px'}}>{p.name}</div>
              <div style={{fontSize:11,color:C.text,lineHeight:1.4,marginBottom:10,minHeight:28}}>{p.tagline}</div>

              <div style={{fontSize:11,color:C.muted,textDecoration:'line-through',fontFamily:"'DM Mono',monospace",marginBottom:2}}>
                {convertPrice(cycleData.priceBarre)}
              </div>

              <div style={{display:'flex',alignItems:'baseline',gap:4,marginBottom:6}}>
                <span style={{fontSize:28,fontWeight:800,fontFamily:"'DM Mono',monospace",color:C.text,lineHeight:1}}>{convertPrice(cycleData.price)}</span>
                <span style={{fontSize:11,color:C.sec}}>/ mois</span>
              </div>

              <div style={{display:'inline-flex',alignItems:'center',gap:5,padding:'3px 10px',borderRadius:20,marginBottom:18,width:'fit-content',background:`${p.color}18`,border:`1px solid ${p.color}38`}}>
                <span style={{fontSize:11,fontWeight:800,fontFamily:"'DM Mono',monospace",color:p.color}}>{convertPrice(cycleData.prixImg)}</span>
                <span style={{fontSize:10,color:C.sec}}>/ image</span>
              </div>

              <div style={{height:1,background:C.border,marginBottom:16}}/>

              <div style={{flex:1,marginBottom:20,display:'flex',flexDirection:'column',gap:13}}>
                {features.map((f,j) => (
                  <div key={j} style={{display:'flex',alignItems:'flex-start',gap:10}}>
                    <span style={{flexShrink:0,marginTop:1,width:22,height:22,borderRadius:7,background:`${p.color}18`,display:'flex',alignItems:'center',justifyContent:'center'}}><Icon name={f.icon} size={12} color={p.color}/></span>
                    <div style={{fontSize:12,color:C.sec,lineHeight:1.45}}><strong style={{color:C.text,fontWeight:700}}>{f.bold}</strong> {f.rest}</div>
                  </div>
                ))}
              </div>

              {/* CTA Button */}
              <button
                onClick={() => onCta(p)}
                className={(isDowngrade || isCycleDowngradeCycle) ? '' : 'cta-btn-active'}
                style={{
                  width:'100%', padding:'12px', borderRadius:9, fontFamily:'inherit',
                  border: (isDowngrade || isCycleDowngradeCycle) ? `1px solid ${C.borderM}` : 'none', cursor: 'pointer',
                  fontWeight:700, fontSize:13, transition:'all 0.2s',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                  background: (isDowngrade || isCycleDowngradeCycle)
                    ? 'transparent'
                    : 'linear-gradient(135deg,#5B8DEF,#0B3D91)',
                  color: (isDowngrade || isCycleDowngradeCycle) ? C.sec : '#fff',
                  boxShadow: (isDowngrade || isCycleDowngradeCycle) ? 'none' : '0 4px 16px rgba(45,127,249,0.35)',
                }}
              >
                {isCurrent
                  ? (<>Renouveler le forfait <Icon name="arrow" size={13} color="#fff"/></>)
                  : isCycleUpsell
                    ? (<>Passer à l'annuel <Icon name="arrow" size={13} color="#fff"/></>)
                    : isCycleDowngradeCycle
                      ? (<>Repasser au mensuel</>)
                      : isDowngrade
                        ? (<>Downgrade <Icon name="arrow" size={13} color="#fff"/></>)
                        : isUpgrade
                          ? (<>Upgrade <Icon name="arrow" size={13} color="#fff"/></>)
                          : (<>{p.ctaText} <Icon name="arrow" size={13} color="#fff"/></>)
                }
              </button>

              {/* Reassurance */}
              {!isCurrent && (
                <div style={{marginTop:10,textAlign:'center',fontSize:10,color:C.muted}}>
                  <span style={{display:'inline-flex',alignItems:'center',gap:4}}><Icon name="lock" size={10} color={C.muted}/> Paiement sécurisé</span>
                  {isMobile && <><br/><span style={{color:C.accent,fontWeight:700}}>Satisfait ou 100% remboursé</span></>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Vue Démo : charge la mindmap dans un iframe ──────────────────────────────
const DemoPreview = ({slug}) => {
  if (!slug) return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:16,padding:40,textAlign:'center'}}>
      <Icon name="eye" size={48} color={C.muted}/>
      <div style={{fontSize:18,fontWeight:700,color:C.text}}>Aucune démo à afficher</div>
      <div style={{fontSize:13,color:C.sec,maxWidth:400}}>
        Dès que votre agence aura généré votre démonstration, elle apparaîtra ici avec l'analyse de marché, le persona cible et vos créatives Meta Ads.
      </div>
    </div>
  );
  return (
    <div style={{position:'relative',width:'100%',height:'100%'}}>
      <iframe
        src={`/demo/${slug}.html`}
        style={{width:'100%',height:'100%',border:'none',display:'block'}}
        title="Démo AdStack"
        allow="fullscreen"
      />
    </div>
  );
};

export default function Platform() {
  const SECTION_PATHS = { tarifs:'offers', produits:'products', galerie:'gallery', copies:'copies', marche:'market', suivi:'tracking', notifications:'notifications', demo:'demo', faq:'faq', commentaires:'feedback' };
  const PATH_TO_SECTION = Object.fromEntries(Object.entries(SECTION_PATHS).map(([k,v])=>[v,k]));

  const [section, _setSection] = useState(() => {
    try {
      // Priorité 1 : lien direct type /adboard/offers
      const path = window.location.pathname.replace(/^\/adboard\/?/, '').replace(/\/$/, '');
      if (path && PATH_TO_SECTION[path]) return PATH_TO_SECTION[path];
      return sessionStorage.getItem('adstack_section')
        || localStorage.getItem('adstack_section')
        || 'produits';
    } catch(e) { return 'produits'; }
  });
  const setSection = (s) => {
    _setSection(s);
    try {
      sessionStorage.setItem('adstack_section', s);
      localStorage.setItem('adstack_section', s);
      const path = SECTION_PATHS[s];
      if (path) window.history.replaceState({}, '', `/adboard/${path}`);
      // Marquer la section comme vue (fait disparaître son badge de nouveau contenu)
      if (['galerie','copies','marche'].includes(s)) {
        const counts = { galerie: totalCreatives, copies: totalAngles, marche: totalMarche, ...seenCounts };
        counts[s] = s === 'galerie' ? totalCreatives : s === 'copies' ? totalAngles : totalMarche;
        localStorage.setItem('adstack_seen_counts', JSON.stringify(counts));
      }
    } catch(e) { console.warn('[refreshUserData] Échec du rafraîchissement :', e.message); }
  };
  const [isDemo, setIsDemo] = useState(false);
  const pendingPurchaseRef = useRef(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  const mainRef = useRef(null);

  // Rafraîchit toutes les données utilisateur (abonnement, produits, briefs) — utilisé par le pull-to-refresh
  const refreshUserData = async () => {
    if (!user) return;
    setIsRefreshing(true);
    try {
      const session = await sbAuth.refreshSession();
      if (!session) { setIsRefreshing(false); return; }
      const [prods, sub] = await Promise.all([sbProducts.load(session), sbSubs.load(session)]);
      if (prods) setProducts(prods);
      setSubscription(sub);
      if (prods?.length > 0) {
        const bs = await sbBriefs.loadForProducts(session, prods.map(p=>p.id));
        setAllBriefs(bs);
        const map = {};
        bs.forEach(b => { if (!map[b.product_id]) map[b.product_id] = b; });
        setBriefs(map);
      }
      const notifs = await sbNotifications.load(session);
      if (notifs) {
        setNotifications(notifs);
        setUnreadCount(notifs.filter(n => !n.read).length);
      }
    } catch(e) {}
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Pull-to-refresh tactile — actif uniquement si le contenu est tout en haut.
  // Tolérance de quelques pixels plutôt qu'une égalité stricte à 0 : sur iOS, le scroll
  // élastique/momentum ne se stabilise pas toujours pile à 0px (0.4px, 1px...), ce qui
  // bloquait silencieusement le geste environ une fois sur deux avec une égalité stricte.
  const enHaut = () => (mainRef.current?.scrollTop || 0) <= 3;
  const handleTouchStart = (e) => {
    // Ne jamais initier le tirer-pour-rafraîchir depuis un champ de saisie — un simple tap
    // avec un micro-mouvement du doigt peut sinon déclencher un léger pullDistance, qui
    // applique une transformation sur le conteneur juste au moment où le clavier devrait
    // s'ouvrir, et casse les deux (clavier qui ne vient pas + zone du spinner qui s'affiche).
    const cible = e.target;
    if (cible && (cible.tagName === 'TEXTAREA' || cible.tagName === 'INPUT' || cible.isContentEditable)) {
      touchStartY.current = 0;
      return;
    }
    touchStartY.current = enHaut() ? e.touches[0].clientY : 0;
  };
  const handleTouchMove = (e) => {
    if (!touchStartY.current || isRefreshing) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0 && enHaut()) {
      setPullDistance(Math.min(delta, 100));
    }
  };
  const handleTouchEnd = () => {
    if (pullDistance > 65 && !isRefreshing) refreshUserData();
    setPullDistance(0);
    touchStartY.current = 0;
  };

  const [collapsed, setCollapsed] = useState(false);

  // Événement AddToCart — dès que la section Tarifs devient active
  useEffect(() => {
    if (section === 'tarifs') {
      try { window.fbq && window.fbq('track', 'AddToCart', { content_name: 'Voir les offres' }); } catch(e) {}
      // Tracking léger pour le nudge push "vu Tarifs sans payer"
      if (user?.id) {
        fetch('https://adstack-server.onrender.com/track-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id, event_key: 'viewed_pricing' })
        }).catch(()=>{});
      }
    }
  }, [section]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [products, setProducts] = useState(INITIAL_PRODUCTS);

  // Précharge chaque image de créative en arrière-plan dès qu'elle apparaît dans products —
  // le navigateur la met en cache HTTP standard (aucune compression, qualité intacte). Résultat
  // recherché : au moment où le client ouvre réellement la Galerie, l'image est déjà en cache,
  // donc affichage instantané au lieu d'un chargement visible à chaque visite.
  useEffect(() => {
    const urls = products.flatMap(p => (p.creatives || []).map(c => c.imageUrl)).filter(Boolean);
    urls.forEach(url => { const img = new Image(); img.src = url; });
  }, [products]);

  // ── Badges "nouveau contenu" (Galerie/Ad Copies/Données Marché) — même principe que
  // Notifications : compare le total actuel au dernier total vu (localStorage), affiche
  // la différence, se remet à zéro dès que le client ouvre la section concernée. ──
  const totalCreatives = products.reduce((s,p) => s + (p.creatives||[]).length, 0);
  const totalAngles = products.reduce((s,p) => s + (p.deliveries||[]).reduce((s2,d) => s2 + (d.angles?.length||0), 0), 0);
  const totalMarche = products.filter(p => p.marche).length;
  const seenCounts = (() => {
    try { return JSON.parse(localStorage.getItem('adstack_seen_counts') || '{}'); } catch(e) { return {}; }
  })();
  const sectionBadges = {
    galerie: Math.max(0, totalCreatives - (seenCounts.galerie||0)),
    copies: Math.max(0, totalAngles - (seenCounts.copies||0)),
    marche: Math.max(0, totalMarche - (seenCounts.marche||0)),
  };
  const [demoSlug, setDemoSlug] = useState(null);
  const isMobile = useIsMobile();

  // ── Auth state ──
  const [user, setUser] = useState(() => sbAuth.getUser());
  const [showLogin, setShowLogin] = useState(false);
  const [loginAutoPrompt, setLoginAutoPrompt] = useState(false);

  // ── Incitation "Ajouter à l'écran d'accueil" — universelle. Sur Android/Chromium, un vrai
  // bouton d'installation en un clic (API beforeinstallprompt, la seule plateforme qui le
  // permet réellement). Sur iOS, Apple n'expose AUCUNE API pour déclencher ça par code —
  // c'est une vraie limite plateforme, pas un manque d'effort : on ne peut qu'afficher des
  // instructions manuelles aussi claires que possible. ──
  // ── CTA global "Découvrir Nos Offres" — se déclenche après 15s passées sur la page démo,
  // mais reste affiché PARTOUT ensuite (toutes sections), tant que le prospect ne le ferme
  // pas explicitement (croix). Fermeture persistée — ne réapparaît jamais après ça. ──
  const [showOffersCta, setShowOffersCta] = useState(false);
  useEffect(() => {
    if (section !== 'demo' || showOffersCta) return;
    try { if (localStorage.getItem('adstack_offers_cta_dismissed')) return; } catch(e) {}
    const t = setTimeout(() => setShowOffersCta(true), 15000);
    return () => clearTimeout(t);
  }, [section, showOffersCta]);

  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const deferredInstallPrompt = useRef(null);
  const [canAutoInstall, setCanAutoInstall] = useState(false);
  useEffect(() => {
    const onBeforeInstall = (e) => {
      e.preventDefault();
      deferredInstallPrompt.current = e;
      setCanAutoInstall(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) return;
    try {
      if (localStorage.getItem('adstack_install_prompted')) return;
    } catch(e) {}
    const t = setTimeout(() => {
      // Sur Android sans event beforeinstallprompt capté (déjà installé, ou navigateur non
      // compatible) et pas iOS non plus → rien de pertinent à montrer, on n'insiste pas.
      if (!isIOS && !deferredInstallPrompt.current) return;
      setShowInstallPrompt(true);
      try { localStorage.setItem('adstack_install_prompted', '1'); } catch(e) {}
    }, 45000);
    return () => clearTimeout(t);
  }, []);
  const lancerInstallation = async () => {
    if (!deferredInstallPrompt.current) return;
    deferredInstallPrompt.current.prompt();
    await deferredInstallPrompt.current.userChoice;
    deferredInstallPrompt.current = null;
    setShowInstallPrompt(false);
  };

  // ── Auto-prompt connexion Google après 60s (nouveau visiteur non connecté) ──
  useEffect(() => {
    if (user) return;
    try {
      if (localStorage.getItem('adstack_login_prompted')) return;
    } catch(e) {}
    const t = setTimeout(() => {
      if (!sbAuth.getUser()) {
        setShowInstallPrompt(false); // jamais deux bandeaux/popups en même temps à l'écran
        setLoginAutoPrompt(true);
        setShowLogin(true);
        try { localStorage.setItem('adstack_login_prompted', '1'); } catch(e) {}
      }
    }, 60000);
    return () => clearTimeout(t);
  }, [user]);

  // ── Auto-prompt notifications push après 70s — passe D'ABORD par un écran maison expliquant
  // la valeur, et ne déclenche la VRAIE popup native du navigateur qu'après un clic volontaire.
  // Demander la permission brute sans contexte est un anti-pattern connu qui fait chuter le
  // taux d'acceptation — le navigateur affiche sa popup générique sans aucune explication. ──
  const [showPushPriming, setShowPushPriming] = useState(false);
  useEffect(() => {
    try {
      if (sessionStorage.getItem('adstack_push_prompted')) return;
    } catch(e) {}
    const t = setTimeout(async () => {
      try { sessionStorage.setItem('adstack_push_prompted', '1'); } catch(e) {}
      const status = await getPushStatus();
      if (status === 'default') {
        setShowInstallPrompt(false); // jamais deux bandeaux en bas de l'écran en même temps
        setShowPushPriming(true);
      }
    }, 90000);
    return () => clearTimeout(t);
  }, [user]);
  const activerNotifications = async () => {
    setShowPushPriming(false);
    await registerPushSubscription(user?.id);
  };

  // ── Notifications ──
  const [toasts, setToasts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const notify = (message, type='info') => {
    const id = Date.now();
    setToasts(prev => [...prev, {id, message, type}]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
    // Sauvegarder en Supabase si connecté
    sbAuth.refreshSession().then(session => {
      if (session) {
        sbNotifications.create(session, message, type).then(() => {
          setNotifications(prev => [{id, user_id:'', message, type, read:false, created_at:new Date().toISOString()}, ...prev]);
          setUnreadCount(n => n + 1);
        });
      }
    });
  };

  const cancelCreatives = async (p) => {
    const session = await sbAuth.refreshSession();
    const brief = briefs[p.id];
    if (!brief) return;
    const ok = await sbBriefs.cancel(session, brief.id);
    if (ok) {
      setAllBriefs(prev => prev.map(b => b.id===brief.id ? {...b,status:'cancelled'} : b));
      setBriefs(prev => { const n={...prev}; delete n[p.id]; return n; });
      notify(`Commande annulée pour "${p.nom}"`, 'warning');
      notifyAction(sbAuth.getUser()?.id, 'request_cancelled', p.nom);
      for (let i=0; i<3; i++) {
        try {
          const r = await fetch('https://adstack-server.onrender.com/commandes/'+brief.id+'/delete', {
            method:'POST', headers:{'Content-Type':'application/json'}, signal:AbortSignal.timeout(12000),
            body: JSON.stringify({ source: 'client_cancel' })
          });
          if (r.ok) break;
        } catch(e) { await new Promise(res=>setTimeout(res,2000)); }
      }
    }
  };

  const [briefs, setBriefs] = useState({});
  const [allBriefs, setAllBriefs] = useState([]); // tous les briefs pour calcul crédits
  const [subscription, setSubscription] = useState(null);
  const [creativesTarget, setCreativesTarget] = useState(null);
  const [reAskConfirm, setReAskConfirm] = useState(null); // {product, canCancel} — confirmation stylée "déjà une demande en cours"
  const [paymentProductId, setPaymentProductId] = useState(null); // id produit Chariow pour la modale de paiement intégrée
  const [showPrepurchaseForm, setShowPrepurchaseForm] = useState(false);
  const [showPostpurchaseForm, setShowPostpurchaseForm] = useState(false);

  // ── Formulaire pré-achat : à chaque session, après 2 min, tant qu'il n'a jamais été
  // VALIDÉ (soumis) ET qu'il n'a JAMAIS pris d'offre (active ou expirée) — vérifié à neuf
  // au moment du déclenchement, pas au chargement de la page, pour éviter de le montrer à
  // quelqu'un qui vient tout juste de passer client entre-temps. ──
  useEffect(() => {
    try {
      if (localStorage.getItem('adstack_prepurchase_form_done')) return;
      // Cause profonde corrigée (réapparaît dans la même visite après un simple abandon) :
      // rien ne mémorisait qu'il avait déjà été montré durant cette session précise — seule
      // la VALIDATION posait un flag permanent. sessionStorage comble cet intermédiaire :
      // remis à zéro à chaque nouvelle session (comportement voulu), mais empêche toute
      // réapparition tant qu'on reste dans la même.
      if (sessionStorage.getItem('adstack_prepurchase_shown_session')) return;
    } catch(e) {}
    const t = setTimeout(async () => {
      try {
        const session = await sbAuth.refreshSession();
        if (session) {
          const freshSub = await sbSubs.load(session);
          // Cause profonde corrigée (popup montré à un abonnement expiré) : sbSubs.load()
          // renvoie un objet non-null même pour un abonnement expiré (juste active:false) —
          // seul un utilisateur n'ayant JAMAIS souscrit reçoit null. Vérifier .active
          // seul laissait passer quiconque avait déjà été client mais dont l'offre a expiré.
          if (freshSub) return; // déjà pris une offre un jour (active ou non) — jamais ce popup
        }
      } catch(e) {}
      try { sessionStorage.setItem('adstack_prepurchase_shown_session', '1'); } catch(e) {}
      setShowPrepurchaseForm(true);
    }, 2 * 60 * 1000);
    return () => clearTimeout(t);
  }, []);

  // Vérifie si un achat vient de se conclure (appelé après fermeture de la modale de paiement)
  const checkRecentPurchase = async () => {
    try {
      if (localStorage.getItem('adstack_postpurchase_form_done')) return;
    } catch(e) {}
    for (const delay of [3000, 8000, 15000]) {
      await new Promise(res => setTimeout(res, delay));
      try {
        const session = await sbAuth.refreshSession();
        if (!session) continue;
        const freshSub = await sbSubs.load(session);
        if (freshSub?.active && freshSub.started_at) {
          const startedRecently = (Date.now() - new Date(freshSub.started_at).getTime()) < 10 * 60 * 1000;
          if (startedRecently) { setShowPostpurchaseForm(true); return; }
        }
      } catch(e) {}
    }
  };

  useEffect(() => {
    if (window.location.hash.includes('access_token')) {
      sbAuth.handleCallback();
      return;
    }
    const u = sbAuth.getUser();
    setUser(u);
    if (u) {
      // Attribution CRM — mêmes règles que dans handleCallback, mais pour un utilisateur déjà
      // connecté qui clique un NOUVEAU lien traqué (pas une nouvelle connexion). On veut le
      // dernier message cliqué avant l'achat, donc on met à jour à chaque nouvelle capture.
      try {
        const attribution = JSON.parse(localStorage.getItem('crm_attribution') || 'null');
        if (attribution?.prospect_id && u.user_metadata?.crm_last_campaign !== attribution.campagne) {
          sbAuth.updateUserMetadata({
            crm_prospect_id: attribution.prospect_id,
            crm_last_campaign: attribution.campagne,
          });
        }
      } catch(e) {}
      // Reprise automatique du checkout si l'utilisateur vient de se connecter pour payer
      try {
        const pendingProductId = localStorage.getItem('adstack_pending_checkout');
        if (pendingProductId) {
          localStorage.removeItem('adstack_pending_checkout');
          setSection('tarifs');
          setTimeout(() => setPaymentProductId(pendingProductId), 400);
        } else {
          // Ancienne clé (avant unification du flux de paiement) — compatibilité pendant la transition
          const pendingRaw = localStorage.getItem('adstack_pending_plan');
          if (pendingRaw) {
            localStorage.removeItem('adstack_pending_plan');
            const pendingPlan = JSON.parse(pendingRaw);
            const pendingCycle = pendingPlan.cycle || 'annual';
            setSection('tarifs');
            const productId = PLAN_CHECKOUT_IDS[`${pendingPlan.id}-${pendingCycle}`];
            setTimeout(() => {
              if (productId) setPaymentProductId(productId);
              else triggerChariowCheckout(pendingPlan, pendingCycle, u, window);
            }, 400);
          }
        }
      } catch(e) {}
      // Rafraîchir le token avant de charger les données
      sbAuth.refreshSession().then(session => {
        if (!session) { setUser(null); return; }
        Promise.all([
          sbProducts.load(session),
          sbSubs.load(session),
        ]).then(([prods, sub]) => {
          if (prods.length > 0) {
            setProducts(prods);
            sbBriefs.loadForProducts(session, prods.map(p=>p.id)).then(bs => {
              setAllBriefs(bs);
              const map = {};
              bs.forEach(b => { if (!map[b.product_id]) map[b.product_id] = b; });
              setBriefs(map);
            });
          }
          setSubscription(sub);
          if (sub?.expired) {
            notify(`Votre abonnement ${sub.plan?.charAt(0).toUpperCase()+sub.plan?.slice(1)} a expiré. Renouvelez pour continuer à recevoir vos visuels chaque semaine.`, 'warning');
          }
          // Événement Purchase — déclenché ici pour avoir le vrai montant du plan
          if (pendingPurchaseRef.current && sub?.plan) {
            pendingPurchaseRef.current = false;
            const boughtPlan = PLANS.find(pl => pl.id === sub.plan);
            try {
              window.fbq && window.fbq('track', 'Purchase', {
                currency: 'XOF',
                value: boughtPlan?.price || 0,
                content_name: boughtPlan?.name || sub.plan,
              });
            } catch(e) {}
          }
      // Charger notifications si pas encore chargées
      if (notifications.length === 0) {
        sbNotifications.load(session).then(notifs => {
          if (notifs?.length) {
            setNotifications(notifs);
            setUnreadCount(notifs.filter(n => !n.read).length);
          }
        });
      }
        });
      });
    }
  }, []);
  const [priceCtx, setPriceCtx] = useState({ currency: 'XOF', rate: 1, ready: false });

  useEffect(() => {
    (async () => {
      try {
        const geo = await fetch('https://ipapi.co/json/').then(r => r.json());
        const currency = (geo.currency || 'XOF').toUpperCase();
        const persistIfNeeded = (curr) => {
          const u = sbAuth.getUser();
          if (u && u.user_metadata?.currency !== curr) sbAuth.updateUserMetadata({ currency: curr });
        };
        if (currency === 'XOF') { setPriceCtx({ currency: 'XOF', rate: 1, ready: true }); persistIfNeeded('XOF'); return; }
        const rates = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/xof.json').then(r => r.json());
        const rate = rates.xof?.[currency.toLowerCase()];
        if (!rate) { setPriceCtx({ currency: 'XOF', rate: 1, ready: true }); persistIfNeeded('XOF'); return; }
        setPriceCtx({ currency, rate, ready: true });
        persistIfNeeded(currency);
      } catch(e) { setPriceCtx({ currency: 'XOF', rate: 1, ready: true }); }
    })();
  }, [user]);

  const convertPrice = (fcfa) => {
    const { currency, rate, ready } = priceCtx;
    if (!ready || currency === 'XOF') return fcfa.toLocaleString('fr-FR') + ' FCFA';
    const CHARIOW_COEFF = 1.035; // +3.5% pour rester légèrement au-dessus de Chariow
    const NO_DECIMALS = ['XOF','XAF','GNF','KMF','DJF','RWF','BIF','UGX','TZS','MGA','JPY','KRW','VND','CLP','PYG','IDR','MMK'];
    const hasDecimals = !NO_DECIMALS.includes(currency);
    const decimals = hasDecimals ? 2 : 0;
    const raw = fcfa * rate * CHARIOW_COEFF;
    return new Intl.NumberFormat(undefined, { style:'currency', currency, minimumFractionDigits:decimals, maximumFractionDigits:decimals }).format(raw);
  };
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'ios-zoom-fix';
    style.textContent = `
      html,body,#root{margin:0;padding:0;width:100%;height:100%;overflow:hidden;overscroll-behavior:none;}
      html,body{font-family:'Inter',sans-serif;}
      input,textarea,select{touch-action:manipulation;font-size:16px !important;font-family:'Inter',sans-serif;}
    `; // iOS zoom fix: Safari zoome si font-size<16px + fix rebond blanc PWA standalone
       // + police Inter posée sur html/body : les popups en createPortal (document.body) sortent
       // Cause profonde corrigée (bug de scroll bloqué au survol des cartes) : la règle
       // "*{overscroll-behavior-y:contain;}" s'appliquait à CHAQUE élément de la page, y compris
       // les cartes avec overflow:hidden (ProductCard, cartes d'angle...) qui n'ont pourtant
       // aucun contenu scrollable — piégeant le scroll dessus au lieu de le laisser remonter à la
       // page. Le conteneur principal a déjà sa propre règle ciblée (overscrollBehaviorY inline
       // plus bas) ; cette règle globale était redondante et strictement nuisible ailleurs.
       // de l'arbre React et n'héritaient donc pas de la police du conteneur principal.
    if (!document.getElementById('ios-zoom-fix')) document.head.appendChild(style);
    return () => { const s = document.getElementById('ios-zoom-fix'); if(s) s.remove(); };
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('demo');
    if (slug) {
      setDemoSlug(slug);
      setSection('demo');
      setIsDemo(true);
      // Stocker dans localStorage pour que le prospect retrouve sa démo
      localStorage.setItem('adstack_demo_slug', slug);
    } else {
      // Vérifier si un slug est stocké
      const saved = localStorage.getItem('adstack_demo_slug');
      if (saved) setDemoSlug(saved);
    }
    // Détection retour paiement réussi (redirect Chariow) → on force un re-check répété (le webhook peut arriver avec quelques secondes de délai)
    if (params.get('payment') === 'success') {
      pendingPurchaseRef.current = true;
      window.history.replaceState({}, '', window.location.pathname);
      let attempts = 0;
      const maxAttempts = 10; // 10 x 3s = 30s de fenêtre
      const poll = setInterval(async () => {
        attempts++;
        const session = await sbAuth.refreshSession();
        if (session) {
          const sub = await sbSubs.load(session);
          if (sub?.active) {
            setSubscription(sub);
            notify(`Abonnement ${sub.plan?.charAt(0).toUpperCase()+sub.plan?.slice(1)} activé !`, 'payment');
            clearInterval(poll);
          }
        }
        if (attempts >= maxAttempts) clearInterval(poll);
      }, 3000);
    }
  }, []);

  useEffect(() => {
    const s = document.createElement('style');
    s.textContent = `
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      ::-webkit-scrollbar { width: 3px; height: 3px; }
      ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.16); border-radius: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      @keyframes blink { 0%,60%,100%{ opacity:.3; transform:scale(1); } 30%{ opacity:1; transform:scale(1.25); } }
      .gallery-item { position: relative; transition: outline-color 0.15s; outline: 1px solid transparent; outline-offset: 0; }
      .gallery-overlay { opacity: 0; transition: opacity 0.15s; }
      .gallery-item:hover .gallery-overlay { opacity: 1; }
      .gallery-item:hover { outline-color: rgba(255,255,255,0.32); }
    `;
    document.head.appendChild(s);
  }, []);

  const Commentaires = ({ user }) => {
  const [texte, setTexte] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [envoye, setEnvoye] = useState(false);

  const envoyer = async () => {
    if (!texte.trim()) { setError('Écris quelque chose avant d\'envoyer.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const r = await fetch('https://adstack-server.onrender.com/save-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.id || null, email: user?.email || null, texte }),
      });
      const data = await r.json();
      if (!r.ok) {
        if (data.error === 'contenu_inapproprie') { setError("Merci de reformuler ton message de façon constructive."); setSubmitting(false); return; }
        throw new Error(data.error || 'unknown');
      }
      setEnvoye(true);
      setTexte('');
    } catch(e) {
      setError("Un souci technique est survenu — réessaie dans un instant.");
    }
    setSubmitting(false);
  };

  return (
    <div style={{maxWidth:640}}>
      <h1 style={{fontSize:20,fontWeight:800,color:C.text,margin:'0 0 6px'}}>Commentaires</h1>
      <p style={{fontSize:13.5,color:C.sec,lineHeight:1.6,marginBottom:24}}>
        Une remarque sur nos tarifs, une idée d'amélioration, un résultat que tu aimerais avoir ?
        Dis-nous tout ici — on lit chaque message pour améliorer AdStack.
      </p>

      {envoye ? (
        <div style={{position:'relative',overflow:'hidden',textAlign:'center',padding:'40px 20px',borderRadius:16,background:'linear-gradient(160deg, #12151f 0%, #0d0f16 100%)',border:`1px solid ${C.borderM}`}}>
          <div style={{position:'absolute',top:-50,left:'50%',transform:'translateX(-50%)',width:200,height:200,borderRadius:'50%',background:'radial-gradient(circle, rgba(34,197,94,0.12), transparent 70%)',pointerEvents:'none'}}/>
          <div style={{position:'relative',width:48,height:48,borderRadius:12,background:'rgba(34,197,94,0.14)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px'}}>
            <Icon name="check" size={22} color="#22C55E"/>
          </div>
          <p style={{position:'relative',fontSize:14,fontWeight:700,color:C.text,marginBottom:6}}>Merci pour ton message !</p>
          <p style={{position:'relative',fontSize:12.5,color:C.sec,marginBottom:18}}>C'est bien pris en compte.</p>
          <button onClick={()=>setEnvoye(false)} style={{position:'relative',padding:'9px 20px',borderRadius:8,border:`1px solid ${C.border}`,background:'transparent',color:C.text,fontWeight:600,fontSize:12.5,cursor:'pointer',fontFamily:'inherit'}}>
            Envoyer un autre commentaire
          </button>
        </div>
      ) : (
        <div style={{position:'relative',overflow:'hidden',borderRadius:16,background:'linear-gradient(160deg, #12151f 0%, #0d0f16 100%)',border:`1px solid ${C.borderM}`,padding:22}}>
          <div style={{position:'absolute',top:-50,right:-30,width:170,height:170,borderRadius:'50%',background:'radial-gradient(circle, rgba(45,127,249,0.12), transparent 70%)',pointerEvents:'none'}}/>
          <textarea
            value={texte}
            onChange={e => setTexte(e.target.value)}
            placeholder="Écris ton commentaire ici..."
            rows={6}
            maxLength={2000}
            style={{position:'relative',width:'100%',padding:'12px 14px',borderRadius:9,border:`1px solid ${C.border}`,background:'rgba(255,255,255,0.03)',color:C.text,fontSize:16,fontFamily:'inherit',resize:'vertical',outline:'none',boxSizing:'border-box'}}
          />
          <div style={{position:'relative',display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:6}}>
            <span style={{fontSize:11,color:C.muted}}>{texte.length}/2000</span>
          </div>
          {error && <div style={{position:'relative',marginTop:10,padding:'10px 14px',borderRadius:8,background:'rgba(229,80,80,0.1)',border:'1px solid rgba(229,80,80,0.3)',color:'#E55050',fontSize:12}}>{error}</div>}
          <button onClick={envoyer} disabled={submitting} style={{position:'relative',marginTop:14,padding:'12px 26px',borderRadius:9,border:'none',background:`linear-gradient(135deg, ${C.accent}, #2D6FE0)`,color:'#fff',fontWeight:700,fontSize:13.5,cursor:submitting?'default':'pointer',fontFamily:'inherit',opacity:submitting?0.6:1,boxShadow:'0 4px 16px rgba(45,127,249,0.3)'}}>
            {submitting ? 'Envoi...' : 'Envoyer'}
          </button>
        </div>
      )}
    </div>
  );
};

const views = {
    demo: <DemoPreview slug={demoSlug}/>,
    produits: <Produits products={products} setProducts={setProducts} user={user} onNeedLogin={()=>setShowLogin(true)} briefs={briefs} setBriefs={setBriefs} allBriefs={allBriefs} setAllBriefs={setAllBriefs} subscription={subscription} credits={computeCredits(subscription,allBriefs)} notify={notify} cancelCreatives={cancelCreatives} setSection={setSection} onAskCreatives={(p)=>{ 
            if(!user){setShowLogin(true);return;} 
            if(!subscription?.active){setSection('tarifs');return;}
            // Limite anti-abus : max 36 images / 4 demandes par fenêtre glissante de 24h (tous produits confondus)
            const now = Date.now();
            const WIN_24H = 24*60*60*1000;
            const recentBriefs = allBriefs.filter(b => b.status !== 'cancelled' && (now - new Date(b.created_at).getTime()) < WIN_24H);
            const recentImages = recentBriefs.reduce((sum,b) => sum + (b.quantity || b.credits_used || 9), 0);
            if (recentBriefs.length >= 4 || recentImages >= 36) {
              const oldest = recentBriefs.reduce((o,b) => !o || new Date(b.created_at) < new Date(o.created_at) ? b : o, null);
              const freeAt = oldest ? new Date(new Date(oldest.created_at).getTime() + WIN_24H) : null;
              const freeAtStr = freeAt ? freeAt.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }) + ' le ' + freeAt.toLocaleDateString('fr-FR', { day:'numeric', month:'long' }) : 'plus tard';
              notify(`Limite atteinte : maximum 36 images (4 demandes) par 24h. Réessayez après ${freeAtStr}.`, 'info');
              return;
            }
            // Anti-doublon : brief actif existant ?
            const existing = briefs[p.id];
            const CANCEL_WIN = 12*60*60*1000;
            const isActive = existing && existing.status !== 'cancelled' && existing.status !== 'done';
            if(isActive){
              const canCancel = existing.status==='pending' && (Date.now()-new Date(existing.created_at).getTime()) < CANCEL_WIN;
              setReAskConfirm({ product: p, canCancel });
              return;
            }
            setCreativesTarget(p); }}/>,
    galerie: <Galerie products={products} setProducts={setProducts} isDemo={isDemo} setSection={setSection} isMobile={isMobile}/>,
    copies: <Copies products={products} setSection={setSection}/>,
    marche: <Marche products={products} isDemo={isDemo} setSection={setSection}/>,
    tarifs: <Tarifs convertPrice={convertPrice} subscription={subscription} onOpenPayment={(productId)=>setPaymentProductId(productId)}/>,
    faq: <Faq/>,
    commentaires: <Commentaires user={user}/>,
    suivi: <SuiviDemande allBriefs={allBriefs} products={products} briefs={briefs} cancelCreatives={cancelCreatives} C={C} onRefresh={refreshUserData}/>,
    notifications: <Notifications
        notifications={notifications}
        C={C}
        user={user}
        notify={notify}
        onMarkRead={async()=>{const s=await sbAuth.refreshSession();if(!s)return;const fresh=await sbNotifications.load(s);if(fresh?.length){setNotifications(fresh);}await sbNotifications.markAllRead(s);setUnreadCount(0);setNotifications(p=>p.map(n=>({...n,read:true})));}}
        onDeleteAll={async()=>{const s=await sbAuth.refreshSession();if(s){await fetch(`${SUPABASE_URL}/rest/v1/notifications?user_id=eq.${user?.id}`,{method:'DELETE',headers:{apikey:SUPABASE_ANON,Authorization:`Bearer ${s.access_token}`}});}setNotifications([]);setUnreadCount(0);}}
        onDeleteOne={async(id)=>{const s=await sbAuth.refreshSession();if(s){await fetch(`${SUPABASE_URL}/rest/v1/notifications?id=eq.${id}`,{method:'DELETE',headers:{apikey:SUPABASE_ANON,Authorization:`Bearer ${s.access_token}`}});}setNotifications(p=>p.filter(n=>n.id!==id));setUnreadCount(p=>Math.max(0,p-1));}}
        onMarkOne={async(id)=>{const s=await sbAuth.refreshSession();if(s){await fetch(`${SUPABASE_URL}/rest/v1/notifications?id=eq.${id}`,{method:'PATCH',headers:{apikey:SUPABASE_ANON,Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({read:true})});}setNotifications(p=>p.map(n=>n.id===id?{...n,read:true}:n));setUnreadCount(p=>Math.max(0,p-1));}}
      />,
  };

  return (
    <>
    <div style={{display:'flex',flexDirection:'column',height:'100dvh',overflow:'hidden',background:C.bg,fontFamily:"'Inter',sans-serif",color:C.text,WebkitFontSmoothing:'antialiased',MozOsxFontSmoothing:'grayscale'}}>


      <div style={{display:'flex',flex:1,overflow:'hidden',position:'relative'}}>
        <Sidebar active={section} set={setSection} isDemo={isDemo} setDemo={setIsDemo} collapsed={collapsed} setCollapsed={setCollapsed} isMobile={isMobile} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} convertPrice={convertPrice} user={user} setUser={setUser} unreadCount={unreadCount} subscription={subscription} activeBriefsCount={allBriefs.filter(b=>b.status==='pending'||b.status==='in_production').length} onOpenPayment={(productId)=>setPaymentProductId(productId)} onOpenLogin={()=>setShowLogin(true)} sectionBadges={sectionBadges}/>

        {isMobile && mobileOpen && (
          <div onClick={() => setMobileOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:400}}/>
        )}

        <main
          ref={mainRef}
          onTouchStart={isMobile ? handleTouchStart : undefined}
          onTouchMove={isMobile ? handleTouchMove : undefined}
          onTouchEnd={isMobile ? handleTouchEnd : undefined}
          style={{
          flex:1,overflow:section==='demo'?'hidden':'auto',
          padding: section==='demo' ? 0 : isMobile
            ? 'calc(16px + env(safe-area-inset-top, 0px)) 16px calc(16px + env(safe-area-inset-bottom, 0px))'
            : '28px 30px',
          marginLeft:isMobile?52:0,
          overscrollBehaviorY:'contain',
          // Pas de transition PENDANT le glissement du doigt (suivi direct, 1:1) — mais une
          // vraie transition douce dès qu'on relâche, que ce soit pour se caler sur la position
          // de rafraîchissement ou pour revenir à zéro une fois terminé. Avant, le retour à zéro
          // était instantané dès le relâchement, faisant "disparaître" le cercle de chargement
          // avant même que le rafraîchissement soit fini — donnant une impression de blocage.
          transition: (pullDistance>0 && !isRefreshing) ? 'none' : 'transform 0.25s cubic-bezier(.34,1.56,.64,1), margin-left 0.22s cubic-bezier(.4,0,.2,1)',
          transform: (isRefreshing ? 56 : pullDistance) > 0 ? `translateY(${isRefreshing ? 56 : pullDistance}px)` : undefined,
          position:'relative',
        }}>
          {isMobile && (pullDistance > 0 || isRefreshing) && (
            <div style={{position:'absolute',top:'calc(-40px + env(safe-area-inset-top, 0px))',left:0,right:0,display:'flex',justifyContent:'center',alignItems:'center',height:40,color:C.accent}}>
              <div style={{
                width:18,height:18,borderRadius:'50%',border:`2px solid ${C.border}`,borderTopColor:C.accent,
                animation: isRefreshing ? 'spin 0.7s linear infinite' : 'none',
                transform: !isRefreshing ? `rotate(${Math.min(pullDistance*3.6,360)}deg)` : undefined,
                opacity: isRefreshing ? 1 : Math.min(pullDistance/65, 1),
                transition: 'opacity 0.15s ease',
              }}/>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}
          {views[section]}
        </main>
      </div>
    </div>
    <Chatbot user={user} subscription={subscription} products={products} credits={computeCredits(subscription,allBriefs)} allBriefs={allBriefs} briefs={briefs} section={section} setSection={setSection} priceCtx={priceCtx} openProductForm={()=>{setSection('produits'); setTimeout(()=>window.dispatchEvent(new Event('openProductForm')),100);}} onOpenPayment={(productId)=>setPaymentProductId(productId)} />
    {showLogin && <LoginModal onClose={()=>setShowLogin(false)} C={C} autoPrompt={loginAutoPrompt}/>}
    {showOffersCta && (
      <div style={{position:'fixed', bottom:88, left:'50%', transform:'translateX(-50%)', zIndex:8000, animation:'ctaFloat 0.6s cubic-bezier(.34,1.56,.64,1) forwards'}}>
        <style>{`
          @keyframes ctaFloat { from{ opacity:0; transform:translateX(-50%) translateY(20px); } to{ opacity:1; transform:translateX(-50%) translateY(0); } }
          @keyframes ctaPulse { 0%,100%{ box-shadow:0 6px 28px rgba(45,127,239,0.55); } 50%{ box-shadow:0 6px 36px rgba(45,127,249,0.80); } }
        `}</style>
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 20px',borderRadius:50,background:'linear-gradient(135deg,#5B8DEF,#0B3D91)',color:'#fff',fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:13,animation:'ctaPulse 2.5s ease infinite',cursor:'pointer',whiteSpace:'nowrap',userSelect:'none'}}
          onClick={() => setSection('tarifs')}>
          <Icon name="sparkle" size={13} color="#fff"/> Découvrir Nos Offres
          <button onClick={e=>{e.stopPropagation(); setShowOffersCta(false); try{localStorage.setItem('adstack_offers_cta_dismissed','1');}catch(e){}}} style={{marginLeft:4,width:18,height:18,borderRadius:'50%',border:'none',background:'rgba(255,255,255,0.2)',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon name="x" size={9} color="#fff"/></button>
        </div>
      </div>
    )}
    {showInstallPrompt && (
      <div style={{position:'fixed',left:12,right:12,bottom: isMobile ? 88 : 96,zIndex:550,maxWidth:420,margin:'0 auto',borderRadius:14,background:'#12151C',border:'1px solid rgba(255,255,255,0.14)',padding:'14px 16px',boxShadow:'0 12px 40px rgba(0,0,0,0.5)',display:'flex',alignItems:'center',gap:12,animation:'toastIn .3s cubic-bezier(.34,1.56,.64,1)'}}>
        <div style={{width:36,height:36,borderRadius:10,background:'rgba(91,141,239,0.14)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <Icon name="bell" size={17} color="#5B8DEF"/>
        </div>
        <div style={{flex:1,fontSize:12,color:'#E8EAF0',lineHeight:1.5}}>
          Ajoute AdBoard à ton écran d'accueil pour recevoir tes notifications (visuels prêts, suivi de commande...).
          {!canAutoInstall && (
            <div style={{marginTop:4,color:'#8891A0',fontSize:11}}>
              Appuie sur <strong>Partager</strong> <span style={{fontSize:13}}>⎋</span> puis <strong>"Sur l'écran d'accueil"</strong>.
            </div>
          )}
        </div>
        {canAutoInstall && (
          <button onClick={lancerInstallation} style={{padding:'8px 14px',borderRadius:8,border:'none',background:'#5B8DEF',color:'#fff',fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'inherit',flexShrink:0,whiteSpace:'nowrap'}}>
            Installer
          </button>
        )}
        <button onClick={()=>setShowInstallPrompt(false)} style={{width:26,height:26,borderRadius:8,border:'none',background:'rgba(255,255,255,0.08)',color:'#8891A0',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <Icon name="x" size={12} color="#8891A0"/>
        </button>
      </div>
    )}

    {showPushPriming && (
      <div style={{position:'fixed',left:12,right:12,bottom: isMobile ? 88 : 96,zIndex:550,maxWidth:420,margin:'0 auto',borderRadius:14,background:'#12151C',border:'1px solid rgba(255,255,255,0.14)',padding:'14px 16px',boxShadow:'0 12px 40px rgba(0,0,0,0.5)',display:'flex',alignItems:'center',gap:12,animation:'toastIn .3s cubic-bezier(.34,1.56,.64,1)'}}>
        <div style={{width:36,height:36,borderRadius:10,background:'rgba(91,141,239,0.14)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <Icon name="bell" size={17} color="#5B8DEF"/>
        </div>
        <div style={{flex:1,fontSize:12,color:'#E8EAF0',lineHeight:1.5}}>
          Sois prévenu dès que tes visuels sont prêts, sans avoir à revenir vérifier.
        </div>
        <button onClick={activerNotifications} style={{padding:'8px 14px',borderRadius:8,border:'none',background:'#5B8DEF',color:'#fff',fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'inherit',flexShrink:0,whiteSpace:'nowrap'}}>
          Activer
        </button>
        <button onClick={()=>setShowPushPriming(false)} style={{width:26,height:26,borderRadius:8,border:'none',background:'rgba(255,255,255,0.08)',color:'#8891A0',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <Icon name="x" size={12} color="#8891A0"/>
        </button>
      </div>
    )}

    {paymentProductId && (
      <PaymentModal productId={paymentProductId} userEmail={user?.email} onClose={()=>{ setPaymentProductId(null); checkRecentPurchase(); }}/>
    )}

    {showPrepurchaseForm && (
      <InsightForm mode="prepurchase" user={user} C={C} onClose={()=>setShowPrepurchaseForm(false)}/>
    )}

    {showPostpurchaseForm && (
      <InsightForm mode="postpurchase" user={user} C={C} onClose={()=>setShowPostpurchaseForm(false)}/>
    )}

    {reAskConfirm && (
      <div onClick={()=>setReAskConfirm(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',zIndex:600,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
        <div onClick={e=>e.stopPropagation()} style={{width:'100%',maxWidth:380,borderRadius:14,background:C.card,border:`1px solid ${C.borderM}`,padding:'22px'}}>
          <div style={{width:40,height:40,borderRadius:11,background:C.accentS,border:`1px solid ${C.borderM}`,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:14,color:C.accent}}>
            <Icon name="sparkle" size={18} color={C.accent}/>
          </div>
          <h2 style={{fontSize:15,fontWeight:700,color:C.text,margin:'0 0 8px'}}>Nouvelle demande pour "{reAskConfirm.product.nom}" ?</h2>
          <p style={{fontSize:12.5,color:C.sec,lineHeight:1.6,margin:0}}>
            {reAskConfirm.canCancel
              ? 'Vous avez déjà une commande en cours pour ce produit. Voulez-vous en ajouter une supplémentaire ?'
              : 'Vos visuels pour ce produit sont déjà en production. Voulez-vous commander un batch supplémentaire ?'}
          </p>
          <div style={{display:'flex',gap:8,marginTop:18}}>
            <button onClick={()=>setReAskConfirm(null)} style={{flex:1,padding:'10px',borderRadius:8,border:`1px solid ${C.border}`,background:'transparent',color:C.text,fontWeight:600,fontSize:12.5,cursor:'pointer',fontFamily:'inherit'}}>Annuler</button>
            <button onClick={()=>{ setCreativesTarget(reAskConfirm.product); setReAskConfirm(null); }} style={{flex:1,padding:'10px',borderRadius:8,border:'none',background:C.accent,color:'#fff',fontWeight:700,fontSize:12.5,cursor:'pointer',fontFamily:'inherit'}}>Confirmer</button>
          </div>
        </div>
      </div>
    )}

    {creativesTarget && (
      <CreativesModal
        product={creativesTarget}
        credits={computeCredits(subscription, allBriefs)}
        C={C}
        onClose={()=>setCreativesTarget(null)}
        onConfirm={async (qty) => {
          const session = await sbAuth.refreshSession();
          const brief = await sbBriefs.create(session, creativesTarget.id, qty);
          if (brief) {
            setAllBriefs(prev => [...prev, brief]);
            setBriefs(prev => ({...prev, [creativesTarget.id]: brief}));
            notify(`Demande de ${qty} visuels envoyée — livraison sous 48h`, 'brief');

            // ── Envoyer le ticket vers Factory (avec wake-up Render) ──
            const p = creativesTarget;
            const pastBriefs = allBriefs.filter(b => b.product_id === p.id && b.status !== 'cancelled');
            const sendWebhook = async (payload, retries=3) => {
              for (let i=0; i<retries; i++) {
                try {
                  const r = await fetch('https://adstack-server.onrender.com/webhook/brief', {
                    method:'POST', headers:{'Content-Type':'application/json'},
                    body: JSON.stringify(payload),
                    signal: AbortSignal.timeout(15000)
                  });
                  if (r.ok) return;
                } catch(e) {
                  if (i < retries-1) await new Promise(res => setTimeout(res, 3000));
                }
              }
            };
            try {
              fetch('https://adstack-server.onrender.com/webhook/brief', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
                body: JSON.stringify({
                  brief_id: brief.id,
                  user_id: user?.id,
                  user_email: user?.email,
                  plan: subscription?.plan || 'starter',
                  quantity: qty,
                  product: {
                    id: p.id,
                    nom: p.nom,
                    pricing: p.pricing,
                    pays: p.pays,
                    cible: p.cible || '',
                    utilite: p.utilite || '',
                    couleur1: p.couleur1 || '',
                    couleur2: p.couleur2 || '',
                    couleur3: p.couleur3 || '',
                    photo_url: p.photo_url || null,
                    photo_base64: p.photo?.startsWith('data:') ? p.photo : null,
                    lien_page_produit: p.lien || null,
                    marque: p.marque || null,
                  },
                  history: {
                    batches_count: pastBriefs.length,
                    total_creatives_done: pastBriefs.reduce((s,b) => s+(b.credits_used||9), 0),
                  }
                })
              }).catch(e => console.warn('[Webhook] Factory non joignable:', e.message));
            } catch(e) { console.warn('[Webhook]', e); }
          }
          setCreativesTarget(null);
        }}
      />
    )}
    <Toast toasts={toasts}/>
    </>
  );
}
