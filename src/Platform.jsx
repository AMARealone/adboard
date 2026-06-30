import { useState, useEffect, useRef } from "react";

// ── Supabase Auth ──────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://mifljhsusidgzelnswma.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZmxqaHN1c2lkZ3plbG5zd21hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MjI2MzQsImV4cCI6MjA5MzQ5ODYzNH0.AX4Xu0sP2tgjLhZSbCKhtw4Q3sd7GRMJ2aMKK3GfzUc';

// Supabase Auth helpers (sans SDK — fetch natif)
const sbAuth = {
  signInWithGoogle: () => {
    const redirectTo = encodeURIComponent(window.location.origin + '/adboard');
    window.location.href = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${redirectTo}`;
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
      window.location.replace('/adboard');
    }).catch(()=>{ window.location.replace('/adboard'); });
    return true;
  }
};

const C = {
  bg:'#0B0F1A',    sidebar:'#070A12',    card:'#141D30',
  border:'rgba(255,255,255,0.11)',        borderM:'rgba(255,255,255,0.22)',
  red:'#2D7FF9',   redS:'rgba(45,127,249,0.11)', redM:'rgba(45,127,249,0.22)',
  white:'#FFFFFF', whiteS:'rgba(255,255,255,0.09)',
  gray:'#9CA0B5',  grayS:'rgba(255,255,255,0.07)',
  text:'#E8EDF8',  sec:'#8A90B2',        muted:'#50587A',
};

const CLIENT = { name:'', brand:'', plan:'', avatar:'', total:0 };

const PLAN_QUANTITY = { 'Conversion Starter':9, 'Conversion Pro':18, 'Conversion Scale':36 };

const ANGLES = [];

const CREA = [];

const INITIAL_PRODUCTS = [];


const NAV = [
  {id:'produits',icon:'box',label:'Mes Produits'},
  {id:'galerie',icon:'grid',label:'Galerie Créatives'},
  {id:'copies',icon:'document',label:'Ad Copies'},
  {id:'marche',icon:'chart',label:'Données Marché'},
  {id:'suivi',icon:'clock',label:'Suivi Demande'},
  {id:'notifications',icon:'bell',label:'Notifications'},
  {id:'tarifs',icon:'tag',label:'Nos Tarifs'},
];

const cs = (extra={}) => ({background:C.card, border:`1px solid ${C.border}`, borderRadius:10, boxShadow:'0 2px 14px rgba(0,0,0,0.45)', ...extra});

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
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled?color:'none'} stroke={filled?'none':color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
};

const Tag = ({ch, color='red'}) => {
  const m = {
    red:{bg:C.redS,c:C.red,b:'rgba(45,127,249,0.2)'},
    gray:{bg:'rgba(255,255,255,0.05)',c:C.sec,b:C.border},
    white:{bg:'rgba(255,255,255,0.08)',c:C.text,b:'rgba(255,255,255,0.16)'},
  };
  const t = m[color]||m.red;
  return <span style={{padding:'2px 8px',borderRadius:4,fontSize:10,fontWeight:700,letterSpacing:'0.4px',background:t.bg,color:t.c,border:`1px solid ${t.b}`}}>{ch}</span>;
};

const LockOverlay = () => (
  <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,backdropFilter:'blur(6px)',background:'rgba(11,15,26,0.90)',borderRadius:10,zIndex:10,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:10}}>
    <Icon name="lock" size={26} color={C.sec}/>
    <div style={{fontSize:13,fontWeight:700,color:C.text}}>Réservé aux abonnés</div>
    <div style={{fontSize:11,color:C.sec,textAlign:'center',maxWidth:200,lineHeight:1.5}}>Abonnez-vous pour accéder à toutes vos données</div>
    <button style={{marginTop:6,padding:'9px 22px',borderRadius:7,border:'none',background:C.red,color:'#fff',fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:6}}>
      Voir les offres <Icon name="arrow" size={13} color="#fff"/>
    </button>
  </div>
);

const Sidebar = ({active, set, isDemo, setDemo, collapsed, setCollapsed, isMobile, mobileOpen, setMobileOpen, user, setUser, convertPrice=((f)=>f.toLocaleString('fr-FR')+' FCFA'), unreadCount=0}) => {
  const showCollapsed = collapsed && !isMobile;

  const navClick = (id) => {
    set(id);
    if (isMobile) setMobileOpen(false);
  };

  const asideStyle = isMobile
    ? {
        position:'fixed',top:0,left:0,height:'100%',zIndex:500,
        width: mobileOpen ? 'min(80vw,272px)' : 52,
        background:C.sidebar,
        borderRight:`1px solid ${C.border}`,
        display:'flex',flexDirection:'column',overflow:'hidden',
        transition:'width 0.22s cubic-bezier(.4,0,.2,1)',
        boxShadow: mobileOpen ? '8px 0 30px rgba(0,0,0,0.5)' : '2px 0 12px rgba(0,0,0,0.3)'
      }
    : {width:showCollapsed?64:222,flexShrink:0,background:C.sidebar,borderRight:`1px solid ${C.border}`,display:'flex',flexDirection:'column',overflow:'hidden',transition:'width 0.2s ease',boxShadow:'4px 0 28px rgba(0,0,0,0.5)'};

  return (
  <aside style={asideStyle}>
    <div style={{padding:'12px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',gap:9,minHeight:52}}>
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
          <div style={{width:28,height:28,borderRadius:7,background:`linear-gradient(135deg,${C.red},#0B3D91)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:800,color:'#fff',flexShrink:0}}>A</div>
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
          <div style={{fontSize:10,color:C.red}}>Connecté</div>
        </div>
      )}
      {!showCollapsed && !(isMobile && !mobileOpen) && !user && (
        <button onClick={sbAuth.signInWithGoogle} style={{flex:1,display:'flex',alignItems:'center',gap:7,padding:'6px 8px',borderRadius:8,border:`1px solid ${C.border}`,background:'rgba(255,255,255,0.09)',cursor:'pointer',fontFamily:'inherit',textAlign:'left',transition:'background 0.15s'}}
          onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.08)'}
          onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.04)'}>
          <svg width="13" height="13" viewBox="0 0 24 24" style={{flexShrink:0}}><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:C.text,lineHeight:1.2}}>Se connecter</div>
            <div style={{fontSize:9,color:C.sec}}>avec Google</div>
          </div>
        </button>
      )}
      {!showCollapsed && !(isMobile && !mobileOpen) && user && (
        <button onClick={()=>{ sbAuth.signOut(); setUser(null); }} title="Se déconnecter"
          style={{width:24,height:24,borderRadius:6,border:'none',background:'rgba(255,255,255,0.07)',color:C.sec,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <Icon name="x" size={11} color={C.sec}/>
        </button>
      )}
    </div>

    <nav style={{flex:1,padding:'10px',overflow:'auto'}}>
      {NAV.map(n => (
        <button key={n.id} onClick={() => navClick(n.id)} title={(showCollapsed || (isMobile && !mobileOpen)) ? n.label : undefined} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:(showCollapsed || (isMobile && !mobileOpen))?'center':'flex-start',gap:(showCollapsed || (isMobile && !mobileOpen))?0:10,padding:(showCollapsed || (isMobile && !mobileOpen))?'10px 0':'9px 10px',borderRadius:7,border:'none',cursor:'pointer',background:active===n.id?C.redS:'transparent',color:active===n.id?C.red:C.sec,fontSize:12,fontWeight:600,fontFamily:'inherit',borderLeft:active===n.id?`2px solid ${C.red}`:'2px solid transparent',transition:'all 0.15s',textAlign:'left',marginBottom:1,whiteSpace:'nowrap'}}>
          <div style={{position:'relative',display:'inline-flex',alignItems:'center',justifyContent:'center'}}>
            <Icon name={n.icon} size={14} color={active===n.id?C.red:C.sec}/>
            {n.id==='notifications' && unreadCount>0 && (showCollapsed || (isMobile && !mobileOpen)) && (
              <span style={{position:'absolute',top:-5,right:-5,background:'#E55050',color:'#fff',borderRadius:'50%',minWidth:14,height:14,fontSize:8,fontWeight:900,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 2px',lineHeight:1}}>
                {unreadCount>9?'9+':unreadCount}
              </span>
            )}
          </div>
          {!(showCollapsed || (isMobile && !mobileOpen)) && <span style={{flex:1}}>{n.label}</span>}
          {!(showCollapsed || (isMobile && !mobileOpen)) && n.id==='notifications' && unreadCount>0 && (
            <span style={{background:'#E55050',color:'#fff',borderRadius:10,padding:'1px 6px',fontSize:9,fontWeight:900,minWidth:16,textAlign:'center',marginLeft:'auto'}}>
              {unreadCount>9?'9+':unreadCount}
            </span>
          )}
        </button>
      ))}
    </nav>

    <div style={{padding:showCollapsed?'12px 0':'12px 14px',borderTop:`1px solid ${C.border}`}}>
      <button onClick={() => { if(!isDemo) set('demo'); setDemo(!isDemo); }} title={showCollapsed||(isMobile&&!mobileOpen)?(isDemo?'Mode Démo actif':'VOIR DEMO'):undefined} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:(showCollapsed||(isMobile&&!mobileOpen))?0:7,padding:'8px',borderRadius:7,background:isDemo?C.redS:'rgba(255,255,255,0.07)',border:`1px solid ${isDemo?'rgba(45,127,249,0.28)':C.border}`,color:isDemo?C.red:C.sec,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit',marginBottom:(showCollapsed||(isMobile&&!mobileOpen))?0:10,whiteSpace:'nowrap'}}>
        {isDemo
          ? (<><Icon name="bolt" size={12} color={C.red}/> {!(showCollapsed||(isMobile&&!mobileOpen)) && 'Mode Démo actif'}</>)
          : (<><Icon name="image" size={12} color={C.sec}/> {!(showCollapsed||(isMobile&&!mobileOpen)) && 'VOIR DEMO'}</>)}
      </button>
      {!showCollapsed && !(isMobile && !mobileOpen) && (
        <div style={{padding:'13px',borderRadius:8,background:'rgba(45,127,249,0.08)',border:'1px solid rgba(45,127,249,0.18)',marginTop:10}}>
          <div style={{fontSize:11,color:C.red,fontWeight:700,marginBottom:2}}>Conversion Starter</div>
          <div style={{fontSize:10,color:C.sec,lineHeight:1.4,marginBottom:7}}>9 images / semaine · Données marché</div>
          <div style={{fontSize:15,color:C.text,fontWeight:700,marginBottom:8}}>{convertPrice(39900)}<span style={{fontSize:10,color:C.sec,fontWeight:400}}>/mois</span></div>
          <button onClick={() => set('tarifs')}
            style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,width:'100%',padding:'8px',borderRadius:6,border:'none',background:C.red,color:'#fff',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
            Commencer <Icon name="arrow" size={11} color="#fff"/>
          </button>
        </div>
      )}
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
  const common = {
    value: form[k] || '',
    onChange: e => setForm(f=>({...f,[k]:e.target.value})),
    placeholder: placeholder || '',
    style:{
      width:'100%', padding:'8px 10px', borderRadius:7,
      background:'rgba(255,255,255,0.07)',
      border:`1px solid ${err?C.red:C.border}`,
      color:C.text,
      fontSize:13,
      fontFamily:'inherit', outline:'none', resize:'vertical',
      WebkitAppearance:'none', WebkitTextSizeAdjust:'100%',
    },
  };
  return (
    <div>
      <label style={{fontSize:11,color:C.sec,fontWeight:600,marginBottom:6,display:'block'}}>
        {label}{required && <span style={{color:C.red}}> *</span>}
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
  if (!sub || !sub.active) return { total: 0, used: 0, available: 0 };
  const started = new Date(sub.started_at);
  const now = new Date();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksActive = Math.floor((now - started) / msPerWeek) + 1;
  const total = weeksActive * sub.credits_per_week;
  const used = allBriefs
    .filter(b => b.status !== 'cancelled')
    .reduce((sum, b) => sum + (b.credits_used || 9), 0);
  return { total, used, available: Math.max(0, total - used) };
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
    return rows[0] || null;
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
const PLAN_COLORS = { starter: '#8A90B2', pro: '#2D7FF9', scale: '#22C55E' };

// ── Modal demande de créatives ─────────────────────────────────────────────
const CreativesModal = ({product, credits, onConfirm, onClose, C}) => {
  const [qty, setQty] = useState(9);
  const max = credits.available;
  const canIncrease = qty + 9 <= max;
  const canDecrease = qty > 9;

  const font = "'Outfit', -apple-system, BlinkMacSystemFont, sans-serif";

  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.82)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:20,fontFamily:font}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,borderRadius:16,padding:'26px 24px',maxWidth:380,width:'100%',border:`1px solid ${C.borderM}`,boxShadow:'0 32px 80px rgba(0,0,0,0.7)',position:'relative',fontFamily:font}}>

        {/* Bouton fermer */}
        <button onClick={onClose} style={{position:'absolute',top:14,right:14,width:28,height:28,borderRadius:7,border:'none',background:'rgba(255,255,255,0.07)',color:C.sec,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:font}}>✕</button>

        {/* Header */}
        <div style={{marginBottom:20,paddingRight:32}}>
          <h3 style={{fontSize:16,fontWeight:700,color:C.text,margin:'0 0 3px',fontFamily:font}}>Demander des visuels</h3>
          <p style={{fontSize:12,color:C.sec,margin:0,fontFamily:font}}>Pour <strong style={{color:C.text}}>{product.nom}</strong></p>
        </div>

        {/* Jauge semaine */}
        <div style={{background:'rgba(255,255,255,0.09)',border:`1px solid ${C.border}`,borderRadius:10,padding:'12px 14px',marginBottom:24}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:7}}>
            <span style={{fontSize:11,color:C.sec,fontWeight:600,fontFamily:font}}>Disponibles cette semaine</span>
            <span style={{fontSize:20,fontWeight:800,color:max>0?C.red:C.muted,fontFamily:font}}>{max}</span>
          </div>
          <div style={{height:5,borderRadius:3,background:'rgba(255,255,255,0.08)'}}>
            <div style={{height:'100%',borderRadius:3,transition:'width .3s',background:max>0?`linear-gradient(90deg,${C.red},#5B8FFF)`:'rgba(255,255,255,0.1)',width:max===0?'100%':`${Math.min(100,(qty/max)*100)}%`}}/>
          </div>
          <div style={{fontSize:10,color:C.muted,marginTop:4,fontFamily:font}}>{qty} sélectionné{qty>1?'s':''} · {max-qty} restant{max-qty>1?'s':''} après</div>
        </div>

        {/* Compteur */}
        <div style={{marginBottom:24}}>
          <div style={{fontSize:11,color:C.sec,fontWeight:600,marginBottom:14,fontFamily:font}}>Nombre de visuels à recevoir</div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:24}}>
            <button onClick={()=>canDecrease&&setQty(q=>q-9)} style={{width:44,height:44,borderRadius:10,border:`1px solid ${canDecrease?C.border:'rgba(255,255,255,0.05)'}`,background:canDecrease?'rgba(255,255,255,0.07)':'rgba(255,255,255,0.02)',color:canDecrease?C.text:C.muted,fontSize:24,cursor:canDecrease?'pointer':'not-allowed',fontFamily:font,display:'flex',alignItems:'center',justifyContent:'center'}}>−</button>
            <div style={{textAlign:'center',minWidth:70}}>
              <div style={{fontSize:40,fontWeight:800,color:C.text,lineHeight:1,fontFamily:font}}>{qty}</div>
              <div style={{fontSize:11,color:C.sec,marginTop:4,fontFamily:font}}>visuels</div>
            </div>
            <button onClick={()=>canIncrease&&setQty(q=>q+9)} style={{width:44,height:44,borderRadius:10,border:`1px solid ${canIncrease?C.red:'rgba(255,255,255,0.05)'}`,background:canIncrease?C.redS:'rgba(255,255,255,0.02)',color:canIncrease?C.red:C.muted,fontSize:24,cursor:canIncrease?'pointer':'not-allowed',fontFamily:font,display:'flex',alignItems:'center',justifyContent:'center'}}>+</button>
          </div>
        </div>

        {/* Boutons */}
        <div style={{display:'flex',gap:10}}>
          <button onClick={onClose} style={{flex:1,padding:'12px',borderRadius:9,border:`1px solid ${C.border}`,background:'transparent',color:C.sec,fontSize:13,cursor:'pointer',fontFamily:font}}>Annuler</button>
          <button onClick={()=>max>0&&onConfirm(qty)} disabled={max===0} style={{flex:2,padding:'12px',borderRadius:9,border:'none',background:max===0?'rgba(255,255,255,0.05)':C.red,color:max===0?C.muted:'#fff',fontWeight:700,fontSize:13,cursor:max===0?'not-allowed':'pointer',fontFamily:font}}>
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
const LoginModal = ({onClose, C}) => {
  const font = "'Outfit', -apple-system, BlinkMacSystemFont, sans-serif";
  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.82)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:24,fontFamily:font}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,borderRadius:16,padding:'32px 28px',maxWidth:380,width:'100%',textAlign:'center',border:`1px solid ${C.borderM}`,boxShadow:'0 32px 80px rgba(0,0,0,0.7)',position:'relative',fontFamily:font}}>
        <button onClick={onClose} style={{position:'absolute',top:14,right:14,width:28,height:28,borderRadius:7,border:'none',background:'rgba(255,255,255,0.07)',color:C.sec,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
        <div style={{width:52,height:52,borderRadius:14,background:`linear-gradient(135deg,${C.red},#0B3D91)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,fontWeight:800,color:'#fff',margin:'0 auto 16px'}}>A</div>
        <h2 style={{fontSize:18,fontWeight:700,color:C.text,margin:'0 0 8px',fontFamily:font}}>Connectez-vous pour continuer</h2>
        <p style={{fontSize:13,color:C.sec,lineHeight:1.5,margin:'0 0 24px',fontFamily:font}}>Votre catalogue produits sera sauvegardé et accessible depuis n'importe quel appareil.</p>
        <button onClick={sbAuth.signInWithGoogle} style={{width:'100%',padding:'12px 16px',borderRadius:10,border:`1px solid rgba(255,255,255,0.15)`,background:'rgba(255,255,255,0.06)',color:C.text,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:font,display:'flex',alignItems:'center',justifyContent:'center',gap:10,marginBottom:10}}>
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continuer avec Google
        </button>
        <button onClick={onClose} style={{width:'100%',padding:'10px',borderRadius:10,border:'none',background:'transparent',color:C.sec,fontSize:12,cursor:'pointer',fontFamily:font}}>Pas maintenant</button>
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
        fontFamily:"'Outfit',sans-serif",
        borderLeft:`3px solid ${t.type==='success'?'#22C55E':t.type==='error'?'#E55050':t.type==='payment'?'#2D7FF9':'#F59E0B'}`,
      }}>
        <div style={{flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}><Icon name={NOTIF_ICONS[t.type]||'bell'} size={15} color={t.type==='success'?'#22C55E':t.type==='error'?'#E55050':t.type==='payment'?'#2D7FF9':'#F59E0B'}/></div>
        <span style={{fontSize:12,color:'#E8EAF0',lineHeight:1.4}}>{t.message}</span>
      </div>
    ))}
    <style>{`@keyframes toastIn{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:none}}`}</style>
  </div>
);

// ── Section Notifications ──────────────────────────────────────────────────
const Notifications = ({notifications, onMarkRead, onDeleteAll=()=>{}, onDeleteOne=()=>{}, onMarkOne=()=>{}, C}) => {
  const isMobile = useIsMobile();
  useEffect(() => { onMarkRead(); }, []);
  const COLORS = { success:'#22C55E', error:'#E55050', info:'#2D7FF9', payment:'#2D7FF9', brief:'#F59E0B', product:'#8B5CF6', warning:'#F59E0B' };

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:10}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:40,height:40,borderRadius:10,background:C.redS,border:`1px solid rgba(45,127,249,0.2)`,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <Icon name="bell" size={18} color={C.red}/>
          </div>
          <div>
            <h1 style={{fontSize:20,fontWeight:700,color:C.text,margin:'0 0 2px'}}>Notifications</h1>
            <p style={{fontSize:12,color:C.sec,margin:0}}>{notifications.filter(n=>!n.read).length > 0 ? `${notifications.filter(n=>!n.read).length} non lue(s)` : 'Tout est lu'}</p>
          </div>
        </div>
        {notifications.length > 0 && (
          <div style={{display:'flex',gap:8}}>
            <button onClick={onMarkRead} style={{padding:'6px 12px',borderRadius:7,border:`1px solid ${C.border}`,background:'transparent',color:C.sec,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>
              ✓ Tout marquer lu
            </button>
            <button onClick={onDeleteAll} style={{padding:'6px 12px',borderRadius:7,border:'1px solid rgba(229,80,80,0.3)',background:'transparent',color:'#E55050',fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>
              🗑 Tout supprimer
            </button>
          </div>
        )}
      </div>
      {!notifications.length ? (
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'60px 24px',gap:14,textAlign:'center',border:`1px dashed ${C.border}`,borderRadius:12}}>
          <div style={{fontSize:32}}>🔔</div>
          <div style={{fontSize:15,fontWeight:700,color:C.text}}>Aucune notification</div>
          <div style={{fontSize:12,color:C.sec}}>Vos notifications apparaîtront ici</div>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {notifications.map(n => (
            <div key={n.id} style={{display:'flex',alignItems:'flex-start',gap:12,padding:'14px 16px',borderRadius:10,background:n.read?'transparent':C.redS,border:`1px solid ${n.read?C.border:'rgba(45,127,249,0.2)'}`,transition:'background .2s'}}>
              <div style={{width:36,height:36,borderRadius:9,background:`${COLORS[n.type]||C.red}18`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>
                <Icon name={NOTIF_ICONS[n.type]||'bell'} size={16} color={COLORS[n.type]||C.red}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,color:C.text,lineHeight:1.4,marginBottom:3}}>{n.message}</div>
                <div style={{fontSize:10,color:C.muted}}>{new Date(n.created_at).toLocaleString('fr-FR')}</div>
              </div>
              <button onClick={()=>onDeleteOne(n.id)} title="Supprimer" style={{width:22,height:22,borderRadius:5,border:`1px solid ${C.border}`,background:'transparent',color:C.muted,cursor:'pointer',fontSize:10,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Section Suivi Demande ──────────────────────────────────────────────────
const SuiviDemande = ({allBriefs, products, briefs, cancelCreatives, C}) => {
  const isMobile = useIsMobile();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n+1), 1000);
    return () => clearInterval(t);
  }, []);

  const CANCEL_WIN = 12*60*60*1000;
  const DELIVERY_WIN = 48*60*60*1000;

  const formatCountdown = (ms) => {
    if (ms <= 0) return null;
    const h = Math.floor(ms/3600000);
    const m = Math.floor((ms%3600000)/60000);
    const s = Math.floor((ms%60000)/1000);
    return `${h}h ${m.toString().padStart(2,'0')}m ${s.toString().padStart(2,'0')}s`;
  };

  const STATUS_COLORS = { pending:'#F59E0B', in_production:'#2D7FF9', done:'#22C55E', cancelled:'#6B7280' };
  const STATUS_LABELS = { pending:'⏳ En attente', in_production:'🔵 En production', done:'✅ Livré', cancelled:'✗ Annulé' };

  const sorted = [...allBriefs].sort((a,b) => new Date(b.created_at)-new Date(a.created_at));

  if (!sorted.length) return (
    <div>
      <div style={{marginBottom:20}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
          <div style={{width:40,height:40,borderRadius:10,background:'rgba(45,127,249,0.08)',border:'1px solid rgba(45,127,249,0.2)',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <Icon name="clock" size={18} color={C.red}/>
          </div>
          <div>
            <h1 style={{fontSize:20,fontWeight:700,color:C.text,margin:0}}>Suivi Demande</h1>
            <p style={{fontSize:12,color:C.sec,margin:0}}>Suivez vos demandes de production en temps réel</p>
          </div>
        </div>
      </div>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'60px 24px',gap:14,textAlign:'center',border:`1px dashed ${C.border}`,borderRadius:12}}>
        <div style={{width:56,height:56,borderRadius:14,background:C.redS,border:`1px solid rgba(45,127,249,0.2)`,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <Icon name="clock" size={24} color={C.red}/>
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
          <Icon name="clock" size={18} color={C.red}/>
        </div>
        <div>
          <h1 style={{fontSize:20,fontWeight:700,color:C.text,margin:0}}>Suivi Demande</h1>
          <p style={{fontSize:12,color:C.sec,margin:0}}>{sorted.filter(b=>b.status==='pending'||b.status==='in_production').length} demande(s) active(s)</p>
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

          return (
            <div key={b.id} style={{
              background:C.card, border:`1px solid ${b.status==='pending'?'rgba(245,158,11,0.2)':b.status==='in_production'?'rgba(45,127,249,0.2)':b.status==='done'?'rgba(34,197,94,0.15)':C.border}`,
              borderRadius:12, padding:18, display:'flex', flexDirection:'column', gap:12
            }}>
              {/* Header */}
              <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
                {prod?.photo && (
                  <div style={{width:52,height:52,borderRadius:8,overflow:'hidden',flexShrink:0,background:'rgba(255,255,255,0.09)',border:`1px solid ${C.border}`}}>
                    <img src={prod.photo} style={{width:'100%',height:'100%',objectFit:'contain'}} alt=""/>
                  </div>
                )}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
                    <span style={{fontSize:14,fontWeight:700,color:C.text}}>{prod?.nom||'Produit inconnu'}</span>
                    <span style={{padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:700,background:`${STATUS_COLORS[b.status]}18`,color:STATUS_COLORS[b.status]}}>
                      {STATUS_LABELS[b.status]}
                    </span>
                  </div>
                  <div style={{fontSize:11,color:C.sec}}>
                    <span style={{color:C.red,fontWeight:700}}>{b.quantity||9} visuels</span>
                    {' · '}{new Date(b.created_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
                  </div>
                </div>
              </div>

              {/* Timer livraison 48h — visible dès la commande */}
              {(b.status==='pending' || b.status==='in_production') && deliveryRemaining > 0 && (
                <div style={{background:'linear-gradient(135deg,rgba(45,127,249,0.07),rgba(91,143,255,0.04))',border:'1px solid rgba(45,127,249,0.2)',borderRadius:10,padding:'12px 16px'}}>
                  <div style={{fontSize:10,color:C.sec,fontWeight:700,letterSpacing:'0.8px',textTransform:'uppercase',marginBottom:6}}>Livraison estimée dans</div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:22,fontWeight:900,color:C.red,letterSpacing:2,lineHeight:1}}>
                    {formatCountdown(deliveryRemaining)}
                  </div>
                  <div style={{fontSize:10,color:C.muted,marginTop:4}}>à partir de votre commande du {new Date(b.created_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
                </div>
              )}

              {/* Bouton annuler — visible 12h sans countdown */}
              {canCancel && (
                <button onClick={() => {
                  if (prod && window.confirm(`Annuler la demande pour "${prod.nom}" ?`)) cancelCreatives(prod);
                }} style={{width:'100%',padding:'9px',borderRadius:8,border:'1px solid rgba(229,80,80,0.3)',background:'rgba(229,80,80,0.06)',color:'#E55050',fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'inherit',transition:'all 0.2s'}}>
                  ✕ Annuler la commande
                </button>
              )}
              {b.status==='pending' && !canCancel && (
                <div style={{padding:'9px',borderRadius:8,border:`1px solid ${C.border}`,background:'rgba(255,255,255,0.07)',fontSize:11,color:C.muted,textAlign:'center'}}>
                  En cours de traitement · Annulation non disponible
                </div>
              )}

              {b.status==='done' && (
                <div style={{background:'rgba(34,197,94,0.06)',border:'1px solid rgba(34,197,94,0.2)',borderRadius:8,padding:'10px 14px',display:'flex',alignItems:'center',gap:10}}>
                  <Icon name="check" size={16} color="#22C55E"/>
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:'#22C55E'}}>Visuels livrés ✓</div>
                    {b.done_at && <div style={{fontSize:10,color:C.sec}}>{new Date(b.done_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</div>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const BriefButton = ({p, briefs, subscription, allBriefs, user, onNeedLogin, onAskCreatives, cancelCreatives, C}) => {
  const brief = briefs[p.id];
  const CANCEL_WINDOW = 12 * 60 * 60 * 1000;
  const canCancel = brief && brief.status==="pending" && (Date.now() - new Date(brief.created_at).getTime()) < CANCEL_WINDOW;
  const inProd = brief && (brief.status==="in_production" || (brief.status==="pending" && !canCancel));
  const credits = computeCredits(subscription, allBriefs);
  if (canCancel) return (
    <button onClick={() => cancelCreatives(p)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:7,padding:"10px",borderRadius:7,border:"1px solid rgba(229,80,80,0.5)",background:"linear-gradient(135deg,rgba(229,80,80,0.15),rgba(229,80,80,0.05))",color:"#E55050",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 0 12px rgba(229,80,80,0.2)",transition:"all 0.2s"}}>
      ✕ Annuler la demande
    </button>
  );
  if (inProd) return (
    <div style={{padding:"10px",borderRadius:7,border:`1px solid ${C.border}`,background:"rgba(255,255,255,0.04)",color:C.sec,fontWeight:600,fontSize:11,textAlign:"center"}}>
      ⏳ En production · livraison sous 36h
    </div>
  );
  if (subscription?.active && credits.available < 9) return (
    <div style={{padding:"10px",borderRadius:7,border:`1px solid ${C.border}`,background:"rgba(255,255,255,0.04)",color:C.muted,fontSize:11,textAlign:"center"}}>
      ✓ Disponible semaine prochaine
    </div>
  );
  return (
    <button onClick={() => onAskCreatives && onAskCreatives(p)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:7,padding:"11px",borderRadius:8,border:"none",background:`linear-gradient(135deg,${C.red},#0B3D91)`,color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit",boxShadow:`0 4px 18px rgba(45,127,249,0.4)`,transition:"all 0.2s",letterSpacing:"0.3px"}}>
      <Icon name="sparkle" size={13} color={C.red}/> Demander mes images
    </button>
  );
};

const Produits = ({products, setProducts, user, onNeedLogin, briefs={}, setBriefs, allBriefs=[], setAllBriefs, subscription, credits:_credits={available:0,used:0,earned:0}, onAskCreatives, notify=()=>{}, cancelCreatives=()=>{}}) => {
  // Recalculer les crédits en temps réel depuis allBriefs
  const credits = computeCredits(subscription, allBriefs);
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
    const req = ['nom','pricing','pays'];
    const e = {};
    req.forEach(k => { if (!form[k]) e[k] = true; });
    return e;
  };

  const submit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    const session = await sbAuth.refreshSession();
    if (editingId) {
      setProducts(prev => prev.map(p => p.id===editingId ? {...form, id:editingId} : p));
      if (session) sbProducts.update(session, editingId, form);
      notify(`✏️ "${form.nom}" mis à jour`, 'product');
    } else {
      if (session) {
        const saved = await sbProducts.save(session, form);
        if (saved) {
          setProducts(prev => [...prev, saved]);
          notify(`✅ Produit "${saved.nom}" créé avec succès`, 'product');
        } else {
          setProducts(prev => [...prev, {...form, id: Date.now()}]);
          notify(`✅ Produit "${form.nom}" ajouté`, 'product');
        }
      } else {
        setProducts(prev => [...prev, {...form, id: Date.now()}]);
        notify(`✅ Produit "${form.nom}" ajouté`, 'product');
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
      {subscription?.active && (
        <div style={{marginBottom:18,padding:'14px 16px',borderRadius:10,background:'rgba(255,255,255,0.07)',border:`1px solid ${C.border}`,display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
          <div style={{flex:1,minWidth:160}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:6}}>
              <span style={{fontSize:11,color:C.sec,fontWeight:600}}>Images publicitaires disponibles</span>
              <span style={{fontSize:16,fontWeight:800,color:credits.available>0?C.red:C.muted}}>{credits.available}</span>
            </div>
            <div style={{height:5,borderRadius:3,background:'rgba(255,255,255,0.08)'}}>
              <div style={{height:'100%',borderRadius:3,background:credits.available>0?`linear-gradient(90deg,${C.red},#5B8FFF)`:'rgba(255,255,255,0.1)',width:!credits.total?'0%':`${Math.min(100,(credits.available/credits.total)*100)}%`,transition:'width .4s ease'}}/>
            </div>
            <div style={{fontSize:10,color:C.muted,marginTop:4}}>{credits.used} utilisées · {credits.total} accumulées au total</div>
          </div>
          {credits.available === 0 && (
            <div style={{fontSize:11,color:C.muted,padding:'6px 12px',borderRadius:7,background:'rgba(255,255,255,0.09)',border:`1px solid ${C.border}`}}>
              Nouvelles images disponibles semaine prochaine
            </div>
          )}
        </div>
      )}

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:18,flexWrap:'wrap',gap:10}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:700,color:C.text,margin:0}}>Mes Produits</h1>
          <p style={{fontSize:13,color:C.sec,marginTop:3,marginBottom:0}}>{products.length} produit{products.length>1?'s':''} dans votre catalogue</p>
        </div>
        <button onClick={openNew} style={{display:'flex',alignItems:'center',gap:7,padding:'10px 18px',borderRadius:8,border:'none',background:C.red,color:'#fff',fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>
          <Icon name="plus" size={14} color="#fff"/> Ajouter un produit
        </button>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:14}}>
        {products.map(p => (
          <div key={p.id} style={cs({overflow:'hidden',display:'flex',flexDirection:'column'})}>
            <div style={{aspectRatio:'4/5',position:'relative',background: p.photo ? `url(${p.photo}) center/cover no-repeat` : 'rgba(255,255,255,0.055)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              {!p.photo && <Icon name="box" size={32} color={C.muted}/>}
              {p.logo && (
                <div style={{position:'absolute',bottom:8,left:8,width:32,height:32,borderRadius:6,background:'rgba(255,255,255,0.92)',border:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',padding:4}}>
                  <img src={p.logo} alt="" style={{width:'100%',height:'100%',objectFit:'contain'}}/>
                </div>
              )}
              <div style={{position:'absolute',top:8,right:8,display:'flex',gap:4}}>
                <button onClick={() => openEdit(p)} style={{width:28,height:28,borderRadius:7,border:'none',background:'rgba(7,8,12,0.7)',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <Icon name="pencil" size={13} color="#fff"/>
                </button>
                <button onClick={async () => {
                  if (!confirm('Supprimer ce produit ?')) return;
                  const session = await sbAuth.refreshSession();
                  if (session) await sbProducts.delete(session, p.id);
                  setProducts(prev => prev.filter(x => x.id !== p.id));
                  notify(`🗑 Produit "${p.nom}" supprimé`, 'info');
                }} style={{width:28,height:28,borderRadius:7,border:'none',background:'rgba(229,48,48,0.8)',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <Icon name="x" size={13} color="#fff"/>
                </button>
              </div>
              {p.promo && (
                <div style={{position:'absolute',top:8,left:8}}>
                  <Tag ch={p.promo} color="red"/>
                </div>
              )}
            </div>
            <div style={{padding:'12px 14px',flex:1,display:'flex',flexDirection:'column',gap:6}}>
              <div style={{fontSize:13,fontWeight:700,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.nom}</div>
              <div style={{fontSize:12,color:C.sec,fontFamily:"'DM Mono',monospace"}}>{p.pricing}</div>
              <div style={{fontSize:10,color:C.sec,lineHeight:1.5,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{p.utilite}</div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:2}}>
                {p.pays ? <Tag ch={p.pays} color="gray"/> : <span/>}
                <div style={{display:'flex',gap:4}}>
                  {[p.couleur1,p.couleur2,p.couleur3].filter(Boolean).map((col,i)=>(
                    <span key={i} style={{width:12,height:12,borderRadius:'50%',background:col,border:`1px solid ${C.border}`}}/>
                  ))}
                </div>
              </div>
            </div>
            <div style={{padding:'0 14px 14px'}}>
              <BriefButton p={p} briefs={briefs} subscription={subscription} allBriefs={allBriefs} user={user} onNeedLogin={onNeedLogin} onAskCreatives={onAskCreatives} cancelCreatives={cancelCreatives} C={C}/>
            </div>
          </div>
        ))}

        <button onClick={openNew} style={{aspectRatio:'4/5',minHeight:240,borderRadius:10,border:`1.5px dashed ${C.border}`,background:'transparent',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:10,cursor:'pointer',color:C.sec,fontFamily:'inherit',transition:'border-color 0.15s'}}
          onMouseEnter={e=>e.currentTarget.style.borderColor=C.borderM}
          onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}
        >
          <Icon name="plus" size={22}/>
          <span style={{fontSize:12,fontWeight:600}}>Ajouter un produit</span>
        </button>
      </div>

      {showForm && (
        <div onClick={() => setShowForm(false)} style={{position:'fixed',top:0,bottom:0,left:isMobile?52:0,right:0,background:'rgba(0,0,0,0.75)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:'16px'}}>
          <div onClick={e=>e.stopPropagation()} style={{width:'100%',maxWidth:460,maxHeight:'82vh',overflow:'auto',borderRadius:12,background:C.card,border:`1px solid ${C.borderM}`,padding:'16px 16px 20px',boxShadow:'0 24px 64px rgba(0,0,0,0.6)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <h2 style={{fontSize:16,fontWeight:700,color:C.text,margin:0}}>{editingId ? 'Modifier le produit' : 'Ajouter un produit'}</h2>
              <button onClick={() => setShowForm(false)} style={{width:30,height:30,borderRadius:8,border:'none',background:'rgba(255,255,255,0.10)',color:C.sec,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <Icon name="x" size={14}/>
              </button>
            </div>

            <div style={{marginBottom:12,display:'flex',alignItems:'center',gap:12}}>
              <input ref={photoRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>handleFile(e,'photo')}/>
              <div onClick={()=>photoRef.current?.click()} style={{width:72,height:72,flexShrink:0,borderRadius:10,border:`2px dashed ${errors.photo?C.red:C.border}`,background:form.photo?`url(${form.photo}) center/cover no-repeat`:'rgba(255,255,255,0.055)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
                {!form.photo && <Icon name="upload" size={18} color={C.sec}/>}
              </div>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:C.text,marginBottom:3}}>Photo du produit<span style={{color:C.red}}> *</span></div>
                <div style={{fontSize:11,color:C.sec}}>Cliquez pour uploader</div>
              </div>
            </div>

            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <Field label="Nom du produit" k="nom" required placeholder="Ex : Sérum Éclat Intense" form={form} setForm={setForm} errors={errors} C={C}/>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <Field label="Prix actuel" k="pricing" required placeholder="Ex : 12 900" form={form} setForm={setForm} errors={errors} C={C}/>
                <Field label="Pays de vente" k="pays" required placeholder="Ex : Sénégal" form={form} setForm={setForm} errors={errors} C={C}/>
              </div>
              <Field label="Lien de la page produit" k="lien" placeholder="https://..." form={form} setForm={setForm} errors={errors} C={C}/>
              <Field label="Offre promo en cours" k="promo" placeholder="Ex : -20% jusqu'au 30 juin" form={form} setForm={setForm} errors={errors} C={C}/>
              <Field label="Cible principale" k="cible" textarea placeholder="Femme +25ans Dakar, Teint métisse..." form={form} setForm={setForm} errors={errors} C={C}/>
              <Field label="Utilité principale" k="utilite" textarea placeholder="À quoi sert ce produit, quel problème il résout..." form={form} setForm={setForm} errors={errors} C={C}/>
              <div>
                  <label style={{fontSize:11,color:C.sec,fontWeight:600,marginBottom:4,display:'block'}}>Couleurs de la marque <span style={{fontWeight:400,opacity:.6}}>(pour vos visuels Meta Ads · optionnel)</span></label>
                  <div style={{fontSize:10,color:C.muted,marginBottom:8}}>Ces couleurs seront utilisées dans vos créatives publicitaires</div>
                  <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                    {[1,2,3].map(n => {
                      const key = `couleur${n}`;
                      return form[key]
                        ? <div key={n} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 8px 4px 4px',borderRadius:8,border:`1px solid ${C.border}`,background:'rgba(255,255,255,0.09)'}}>
                            <input type="color" value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} style={{width:28,height:28,borderRadius:5,border:'none',cursor:'pointer',padding:0,background:'none'}}/>
                            <span style={{fontSize:10,color:C.sec,fontFamily:'monospace'}}>{form[key].toUpperCase()}</span>
                            <button onClick={()=>setForm(f=>({...f,[key]:''}))} style={{width:14,height:14,borderRadius:'50%',border:'none',background:'rgba(255,255,255,0.15)',color:C.sec,fontSize:9,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>✕</button>
                          </div>
                        : <button key={n} onClick={()=>setForm(f=>({...f,[key]:'#1E3A8A'}))} style={{display:'flex',alignItems:'center',gap:5,padding:'5px 10px',borderRadius:7,border:`1px dashed ${C.border}`,background:'transparent',cursor:'pointer',color:C.sec,fontSize:11,fontFamily:'inherit'}}>
                            <span style={{fontSize:14,lineHeight:1}}>+</span> Ajouter
                          </button>;
                    })}
                  </div>
                </div>
            </div>

            {Object.keys(errors).length>0 && (
              <div style={{marginTop:14,padding:'10px 14px',borderRadius:8,background:C.redS,border:'1px solid rgba(45,127,249,0.2)',fontSize:11,color:C.red}}>
                Merci de renseigner les champs marqués d'un astérisque.
              </div>
            )}

            <button onClick={submit} style={{width:'100%',marginTop:18,padding:'12px',borderRadius:8,border:'none',background:C.red,color:'#fff',fontWeight:700,fontSize:13,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:7}}>
              <Icon name="check" size={14} color="#fff"/> {editingId ? 'Enregistrer les modifications' : 'Créer le produit'}
            </button>
          </div>
        </div>
      )}

      {brief && (
        <div onClick={() => setBrief(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{width:'100%',maxWidth:480,maxHeight:'85vh',overflow:'auto',borderRadius:14,background:C.card,border:`1px solid ${C.borderM}`,padding:'22px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
              <div>
                <h2 style={{fontSize:15,fontWeight:700,color:C.text,margin:0}}>Brief créatives envoyé</h2>
                <p style={{fontSize:11,color:C.sec,marginTop:3}}>{brief.quantite_demandee} créatives seront générées pour ce produit</p>
              </div>
              <button onClick={() => setBrief(null)} style={{width:30,height:30,borderRadius:8,border:'none',background:'rgba(255,255,255,0.10)',color:C.sec,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <Icon name="x" size={14}/>
              </button>
            </div>
            <pre style={{fontSize:10.5,color:C.sec,background:'rgba(255,255,255,0.055)',border:`1px solid ${C.border}`,borderRadius:8,padding:'12px',overflow:'auto',lineHeight:1.6,whiteSpace:'pre-wrap',fontFamily:"'DM Mono',monospace"}}>
              {JSON.stringify(brief, null, 2)}
            </pre>
            <button onClick={copyBrief} style={{width:'100%',marginTop:12,padding:'10px',borderRadius:8,border:`1px solid ${briefCopied?'rgba(45,127,249,0.3)':C.borderM}`,background:briefCopied?C.redS:'rgba(255,255,255,0.05)',color:briefCopied?C.red:C.text,fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:7,transition:'all 0.2s'}}>
              {briefCopied ? (<><Icon name="check" size={13}/> Brief copié</>) : 'Copier le brief'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

const Galerie = ({products, isDemo, setSection}) => {
  const [query, setQuery] = useState('');
  const [filterMode, setFilterMode] = useState('tous');
  const [activeChip, setActiveChip] = useState(null);
  const [selected, setSelected] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const weeks = ['S1','S2','S3','S4','S5'];

  const filtered = CREA.filter(c => {
    if (selectedProduct && c.productId !== selectedProduct) return false;
    const q = query.trim().toLowerCase();
    if (q && !c.angle.toLowerCase().includes(q) && !c.week.toLowerCase().includes(q)) return false;
    if (filterMode==='angle' && activeChip && c.angle!==activeChip) return false;
    if (filterMode==='date' && activeChip && c.week!==activeChip) return false;
    return true;
  });

  const chips = filterMode==='angle' ? ANGLES : filterMode==='date' ? weeks : [];

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:18}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:700,color:C.text,margin:0}}>Galerie Créatives</h1>
          <p style={{fontSize:13,color:C.sec,marginTop:3,marginBottom:0}}>Vos visuels produits</p>
        </div>
        <Tag ch={`${filtered.length} créatives`} color="gray"/>
      </div>

      {/* Product filter strip */}
      {products.length > 0 && (
        <div style={{display:'flex',gap:8,marginBottom:16,overflowX:'auto',paddingBottom:2}}>
          <button
            onClick={() => setSelectedProduct(null)}
            style={{display:'flex',alignItems:'center',gap:6,padding:'6px 14px',borderRadius:20,border:`1px solid ${!selectedProduct ? C.red : C.border}`,background:!selectedProduct ? 'rgba(196,30,58,0.08)' : 'rgba(255,255,255,0.07)',color:!selectedProduct ? C.text : C.sec,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit',flexShrink:0,transition:'all 0.15s'}}
          >Tous</button>
          {products.map(p => (
            <button key={p.id}
              onClick={() => setSelectedProduct(selectedProduct === p.id ? null : p.id)}
              style={{display:'flex',alignItems:'center',gap:7,padding:'5px 12px 5px 7px',borderRadius:20,border:`1px solid ${selectedProduct===p.id ? C.red : C.border}`,background:selectedProduct===p.id ? 'rgba(196,30,58,0.08)' : 'rgba(255,255,255,0.07)',color:selectedProduct===p.id ? C.text : C.sec,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit',flexShrink:0,transition:'all 0.15s'}}
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
            style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:7,border:'none',cursor:'pointer',background:filterMode===id?C.red:'rgba(255,255,255,0.05)',color:filterMode===id?'#fff':C.sec,fontSize:12,fontWeight:600,fontFamily:'inherit',transition:'all 0.15s'}}>
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
          <div key={c.id} className="gallery-item" onClick={() => setSelected(c)}
            style={{aspectRatio:'4/5',borderRadius:6,overflow:'hidden',cursor:'pointer',position:'relative',background:`linear-gradient(160deg,${c.g1},${c.g2})`}}
          >
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

      {CREA.length===0 && !query && (
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'60px 24px',textAlign:'center',gap:14,minHeight:300,border:`1px dashed ${C.border}`,borderRadius:12,background:'rgba(255,255,255,0.015)'}}>
          <div style={{width:56,height:56,borderRadius:14,background:'rgba(45,127,249,0.10)',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <Icon name="grid" size={26} color={C.red}/>
          </div>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:6}}>Vos créatives apparaîtront ici</div>
            <div style={{fontSize:12,color:C.sec,lineHeight:1.5,maxWidth:420}}>
              Dès que votre agence aura produit vos visuels Meta Ads, vous les retrouverez ici — triés par angle, par semaine, prêts à télécharger et à publier.
            </div>
          </div>
          <button onClick={() => setSection && setSection('tarifs')} style={{marginTop:6,padding:'9px 18px',borderRadius:7,border:'none',background:C.red,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:7}}>
            Découvrir nos offres <Icon name="arrow" size={12} color="#fff"/>
          </button>
        </div>
      )}



      {selected && (
        <div onClick={() => setSelected(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div onClick={e => e.stopPropagation()} style={{width:'100%',maxWidth:320,borderRadius:14,overflow:'hidden',background:C.card,border:`1px solid ${C.borderM}`}}>
            <div style={{aspectRatio:'4/5',background:`linear-gradient(160deg,${selected.g1},${selected.g2})`}}/>
            <div style={{padding:'14px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:C.text}}>{selected.angle}</div>
                <div style={{fontSize:11,color:C.sec}}>Semaine {selected.week.replace('S','')}</div>
              </div>
              <button style={{width:34,height:34,borderRadius:8,border:`1px solid ${C.border}`,background:'rgba(255,255,255,0.07)',color:C.text,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <Icon name="download" size={15}/>
              </button>
            </div>
          </div>
          <button onClick={() => setSelected(null)} style={{position:'absolute',top:24,right:24,width:38,height:38,borderRadius:'50%',border:'none',background:'rgba(255,255,255,0.1)',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <Icon name="x" size={16} color="#fff"/>
          </button>
        </div>
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
                  <Icon name="document" size={26} color={C.red}/>
                </div>
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:6}}>Vos ad copies apparaîtront ici</div>
                  <div style={{fontSize:12,color:C.sec,lineHeight:1.5,maxWidth:420}}>
                    Hooks accrocheurs et descriptions optimisées Meta Ads, classés par angle. Copiez-collez directement dans votre Ads Manager pour gagner du temps.
                  </div>
                </div>
                <button onClick={() => setSection && setSection('produits')} style={{marginTop:6,padding:'9px 18px',borderRadius:7,border:'none',background:C.red,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:7}}>
                  Ajouter un produit <Icon name="arrow" size={12} color="#fff"/>
                </button>
              </div>
            : filtered.length === 0 && query
            ? <div style={{textAlign:'center',padding:'32px 0'}}>
                <Icon name="search" size={26} color={C.muted}/>
                <div style={{fontSize:12,color:C.sec,marginTop:10}}>Aucun résultat pour "{query}"</div>
              </div>
            : <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(2,1fr)',gap:10}}>
                {filtered.map(p => {
                  const total = (p.deliveries||[]).reduce((n,d)=>n+d.angles.length,0);
                  return (
                    <button key={p.id} onClick={()=>pick(p)}
                      style={{display:'flex',alignItems:'center',gap:14,padding:'14px 16px',borderRadius:10,border:`1px solid ${C.border}`,background:C.card,cursor:'pointer',textAlign:'left',fontFamily:'inherit',transition:'all 0.15s',width:'100%'}}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor=C.borderM;e.currentTarget.style.background='rgba(255,255,255,0.05)';}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background=C.card;}}
                    >
                      <div style={{width:48,height:48,borderRadius:8,flexShrink:0,background:p.photo?`url(${p.photo}) center/cover no-repeat`:'rgba(255,255,255,0.06)',border:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
                        {!p.photo && <Icon name="box" size={20} color={C.sec}/>}
                      </div>
                      <div style={{flex:1,overflow:'hidden'}}>
                        <div style={{fontSize:13,fontWeight:700,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.nom}</div>
                        <div style={{fontSize:11,color:C.sec,marginTop:3}}>{p.pays||'—'} · {total} angle{total!==1?'s':''} livré{total!==1?'s':''}</div>
                      </div>
                      {total>0 ? <Tag ch={`${total} A`} color="white"/> : <Tag ch="En attente" color="gray"/>}
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
                      onMouseEnter={e=>{e.currentTarget.style.borderColor=C.red;e.currentTarget.style.background=C.redS;e.currentTarget.style.color=C.red;}}
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

                  <div style={{display:'flex',flexDirection:'column',gap:12}}>
                    {delivery.angles.map(angle => (
                      <div key={angle.numero} ref={el=>{angleRefs.current[angle.numero]=el;}} style={cs({padding:'20px',scrollMarginTop:16})}>
                        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:18}}>
                          <div style={{width:30,height:30,borderRadius:8,background:C.redS,border:'1px solid rgba(45,127,249,0.2)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                            <span style={{fontSize:11,fontWeight:800,color:C.red}}>A{angle.numero}</span>
                          </div>
                          <div style={{fontSize:14,fontWeight:700,color:C.text}}>{angle.nom}</div>
                        </div>

                        <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:12}}>
                          <div>
                            <div style={{fontSize:10,color:C.sec,fontWeight:700,letterSpacing:'0.8px',textTransform:'uppercase',marginBottom:10}}>5 Hooks</div>
                            {angle.hooks.map((hook,i) => (
                              <div key={i} style={cs({padding:'10px 12px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,marginBottom:7})}>
                                <div style={{fontSize:12,color:C.text,lineHeight:1.45,flex:1}}>{hook}</div>
                                <button onClick={()=>copy(hook,`h-${angle.numero}-${i}`)}
                                  style={{flexShrink:0,padding:'3px 10px',borderRadius:5,display:'flex',alignItems:'center',gap:5,background:copied===`h-${angle.numero}-${i}`?C.redS:'rgba(255,255,255,0.05)',border:`1px solid ${copied===`h-${angle.numero}-${i}`?'rgba(45,127,249,0.3)':C.border}`,color:copied===`h-${angle.numero}-${i}`?C.red:C.sec,fontSize:10,fontWeight:600,cursor:'pointer',fontFamily:'inherit',transition:'all 0.2s'}}>
                                  {copied===`h-${angle.numero}-${i}` ? <><Icon name="check" size={11}/> Copié</> : 'Copier'}
                                </button>
                              </div>
                            ))}
                          </div>
                          <div>
                            <div style={{fontSize:10,color:C.sec,fontWeight:700,letterSpacing:'0.8px',textTransform:'uppercase',marginBottom:10}}>Corps AIDA</div>
                            <div style={cs({padding:'14px',position:'relative'})}>
                              <pre style={{fontSize:12,color:C.text,lineHeight:1.7,whiteSpace:'pre-wrap',fontFamily:'inherit',margin:0}}>{angle.body}</pre>
                              <button onClick={()=>copy(angle.body,`body-${angle.numero}`)}
                                style={{position:'absolute',top:10,right:10,padding:'3px 10px',borderRadius:5,display:'flex',alignItems:'center',gap:5,background:copied===`body-${angle.numero}`?C.redS:'rgba(255,255,255,0.05)',border:`1px solid ${copied===`body-${angle.numero}`?'rgba(45,127,249,0.3)':C.border}`,color:copied===`body-${angle.numero}`?C.red:C.sec,fontSize:10,fontWeight:600,cursor:'pointer',fontFamily:'inherit',transition:'all 0.2s'}}>
                                {copied===`body-${angle.numero}` ? <><Icon name="check" size={11}/> Copié</> : 'Copier tout'}
                              </button>
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
                <Icon name="chart" size={26} color={C.red}/>
              </div>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:6}}>Vos données marché apparaîtront ici</div>
                <div style={{fontSize:12,color:C.sec,lineHeight:1.5,maxWidth:420}}>
                  Analyse de la concurrence, tendances actuelles, persona cible et ciblage Meta Ads optimisé pour chacun de vos produits — mis à jour chaque semaine.
                </div>
              </div>
              <button onClick={() => setSection && setSection('produits')} style={{marginTop:6,padding:'9px 18px',borderRadius:7,border:'none',background:C.red,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:7}}>
                Ajouter un produit <Icon name="arrow" size={12} color="#fff"/>
              </button>
            </div>
          : filtered.length === 0 && query
          ? <div style={{textAlign:'center',padding:'32px 0'}}>
              <Icon name="search" size={26} color={C.muted}/>
              <div style={{fontSize:12,color:C.sec,marginTop:10}}>Aucun résultat pour "{query}"</div>
            </div>
          : <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(2,1fr)',gap:10}}>
              {filtered.map(p => (
                <button key={p.id} onClick={() => pick(p)}
                  style={{display:'flex',alignItems:'center',gap:14,padding:'14px 16px',borderRadius:10,border:`1px solid ${C.border}`,background:C.card,cursor:'pointer',textAlign:'left',fontFamily:'inherit',transition:'all 0.15s',width:'100%'}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=C.borderM;e.currentTarget.style.background='rgba(255,255,255,0.05)';}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background=C.card;}}
                >
                  <div style={{width:48,height:48,borderRadius:8,flexShrink:0,background:p.photo?`url(${p.photo}) center/cover no-repeat`:'rgba(255,255,255,0.06)',border:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
                    {!p.photo && <Icon name="box" size={20} color={C.sec}/>}
                  </div>
                  <div style={{flex:1,overflow:'hidden'}}>
                    <div style={{fontSize:13,fontWeight:700,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.nom}</div>
                    <div style={{fontSize:11,color:C.sec,marginTop:3}}>{p.pays||'—'} · {p.marche ? 'Données disponibles' : 'En attente'}</div>
                  </div>
                  {p.marche ? <Tag ch="Data" color="white"/> : <Tag ch="En attente" color="gray"/>}
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
            <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:12,marginBottom:12}}>
              <div style={cs({padding:'18px'})}>
                <div style={{fontSize:10,color:C.sec,fontWeight:700,letterSpacing:'0.8px',textTransform:'uppercase',marginBottom:12}}>Persona Principal</div>
                <div style={{display:'flex',gap:12,marginBottom:14}}>
                  <div style={{width:44,height:44,borderRadius:10,flexShrink:0,background:'rgba(255,255,255,0.06)',border:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <Icon name="person" size={20} color={C.text}/>
                  </div>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:C.text}}>{m.persona.nom}</div>
                    <div style={{fontSize:11,color:C.sec}}>{m.persona.role}</div>
                    <div style={{fontSize:10,color:C.sec,marginTop:1}}>{m.persona.revenu}</div>
                  </div>
                </div>
                <div style={{fontSize:12,color:C.sec,lineHeight:1.6,padding:'10px 12px',background:'rgba(255,255,255,0.055)',borderRadius:8,border:`1px solid ${C.border}`,marginBottom:12,fontStyle:'italic'}}>
                  {m.persona.quote}
                </div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {m.persona.platforms.map(pl => <Tag key={pl} ch={pl} color="gray"/>)}
                </div>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {m.stats.map(stat => (
                  <div key={stat.l} style={cs({padding:'13px 16px'})}>
                    <div style={{fontSize:9,color:C.sec,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.5px'}}>{stat.l}</div>
                    <div style={{fontSize:14,fontWeight:700,color:stat.c==='red'?C.red:C.text,marginTop:4}}>{stat.v}</div>
                    <div style={{fontSize:10,color:C.sec}}>{stat.s}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={cs({padding:'18px',position:'relative'})}>
              <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:14}}>Insights applicables</div>
              <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:10}}>
                {m.insights.map((ins,idx) => (
                  <div key={idx} style={{padding:'12px 14px',borderRadius:8,background:'rgba(255,255,255,0.055)',border:`1px solid ${C.border}`,display:'flex',gap:11,alignItems:'flex-start'}}>
                    <div style={{flexShrink:0,marginTop:1,color:C.sec}}><Icon name={ins.icon} size={16}/></div>
                    <span style={{fontSize:11,color:C.sec,lineHeight:1.55}}>{ins.t}</span>
                  </div>
                ))}
              </div>
              {isDemo && <LockOverlay/>}
            </div>
          </>
        )}
      </div>
    )}
  </div>
  );
};


const Chatbot = ({user, subscription, products=[], credits={}, allBriefs=[], briefs={}, section='', setSection, openProductForm}) => {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
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
      ? `${greeting}${name ? ' ' + name : ''} ! 👋 Je suis **Amina**. Dis-moi — qu'est-ce qui t'amène aujourd'hui ?`
      : `${greeting}${name ? ' ' + name : ''} ! 👋 I'm **Amina**. What brings you here today?`;
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
      const r = await fetch('https://adstack-server.onrender.com/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    if (type === 'checkout') {
      const urls = {
        starter: 'https://ecomaster.mychariow.shop/prd_ljowq8/checkout',
        pro: 'https://ecomaster.mychariow.shop/prd_34w031/checkout',
        scale: 'https://ecomaster.mychariow.shop/prd_9fi79y/checkout',
      };
      const url = urls[parts[1]];
      if (url) window.open(url, '_blank');
    }
  };

  const BTN_LABELS = {
    'navigate:tarifs': '→ Voir les offres',
    'navigate:produits': '→ Mes produits',
    'navigate:suivi': '→ Suivi de demandes',
    'navigate:notifications': '→ Mes notifications',
    'navigate:galerie': '→ Galerie créatives',
    'openProductForm': '+ Créer mon produit maintenant',
    'login': '🔑 Connecter mon compte Google',
    'checkout:starter': '🚀 Commencer avec Starter →',
    'checkout:pro': '⚡ Passer en Pro →',
    'checkout:scale': '🔥 Passer en Scale →',
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
            <div style={{width:36,height:36,borderRadius:'50%',background:'linear-gradient(135deg,#1FB6FF,#2D7FF9)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>👩🏽‍💼</div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:800,color:'#fff',fontFamily:"'Outfit',sans-serif"}}>Amina</div>
              <div style={{fontSize:10,color:'#22C55E',fontWeight:600}}>● En ligne</div>
            </div>
            <button onClick={()=>setOpen(false)} style={{width:28,height:28,borderRadius:7,border:'none',background:'rgba(255,255,255,0.06)',color:'rgba(255,255,255,0.4)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>✕</button>
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
                    background: isUser ? 'linear-gradient(135deg,#2D7FF9,#0B3D91)' : 'rgba(255,255,255,0.07)',
                    color: isUser?'#fff':'rgba(255,255,255,0.88)', fontSize:12.5, lineHeight:1.55,
                    fontFamily:"'Outfit',sans-serif",
                  }} dangerouslySetInnerHTML={{__html: text}}/>
                  {buttons.length > 0 && (
                    <div style={{display:'flex',flexWrap:'wrap',gap:6,maxWidth:'82%'}}>
                      {buttons.map((b, j) => (
                        <button key={j} onClick={()=>handleAction(b)}
                          style={{padding:'6px 12px',borderRadius:20,border:'1px solid rgba(45,127,249,0.4)',background:'rgba(45,127,249,0.1)',color:'#5B8FFF',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:"'Outfit',sans-serif",transition:'all 0.15s'}}
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
              style={{flex:1,padding:'9px 12px',borderRadius:10,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.10)',color:'#fff',fontSize:12,fontFamily:"'Outfit',sans-serif",outline:'none',transition:'border-color .2s, box-shadow .2s'}}
            />
            <button onClick={send} disabled={!input.trim()||loading}
              style={{width:36,height:36,borderRadius:10,border:'none',background:input.trim()&&!loading?'linear-gradient(135deg,#1FB6FF,#2D7FF9)':'rgba(255,255,255,0.12)',color:'#fff',cursor:input.trim()&&!loading?'pointer':'default',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all .2s'}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button onClick={()=>setOpen(o=>!o)} style={{
        position:'fixed', bottom:isMobile?16:20, right:isMobile?16:20,
        width:52, height:52, borderRadius:'50%', border:'none',
        background:'linear-gradient(135deg,#1FB6FF,#2D7FF9)',
        color:'#fff', cursor:'pointer', zIndex:9999,
        display:open?'none':'flex', alignItems:'center', justifyContent:'center',
        fontSize:22, boxShadow:'0 4px 20px rgba(45,127,249,0.55)',
        animation:'aminaPulse 3s ease infinite', transition:'transform .2s',
      }}
      onMouseEnter={e=>e.currentTarget.style.transform='scale(1.08)'}
      onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
        👩🏽‍💼
      </button>
    </>
  );
};

const PLANS = [
  {
    id:'starter', name:'Conversion Starter',
    price:39900, priceBarre:60000, prixImg:1108, discount:33,
    color:C.gray, best:false, current:false,
    checkout:'https://ecomaster.mychariow.shop/prd_ljowq8/checkout',
    features:[
      '9 Images Publicitaires Livrées / Semaine',
      '1 Produit / Semaine',
      'Données Marchés Hebdomadaire : Cibles, Concurrents, Tendances',
      'Titres et Descriptions à mettre dans la Campagne',
      'Assistant IA dispo 7j/7',
      'Livraison en 48h chaque semaine',
    ],
  },
  {
    id:'pro', name:'Conversion Pro',
    price:79900, priceBarre:120000, prixImg:1108, discount:33,
    color:C.red, best:true, current:false,
    checkout:'https://ecomaster.mychariow.shop/prd_34w031/checkout',
    features:[
      '18 Images Publicitaires Livrées / Semaine',
      '1 à 2 Produits / Semaine',
      'Données Marchés Hebdomadaire : Cibles, Concurrents, Tendances',
      'Titres et Descriptions à mettre dans la Campagne',
      'Assistant IA dispo 7j/7',
      'Livraison en 48h chaque semaine',
    ],
  },
  {
    id:'scale', name:'Conversion Scale',
    price:99900, priceBarre:240000, prixImg:694, discount:58,
    color:C.white, best:false, current:false,
    checkout:'https://ecomaster.mychariow.shop/prd_9fi79y/checkout',
    features:[
      '36 Images Publicitaires Livrées / Semaine',
      '1 à 4 Produits / Semaine',
      'Données Marchés Hebdomadaire : Cibles, Concurrents, Tendances',
      'Titres et Descriptions à mettre dans la Campagne',
      'Assistant IA dispo 7j/7',
      'Livraison en 48h chaque semaine',
    ],
  },
];

const Tarifs = ({convertPrice=(f=>f.toLocaleString('fr-FR')+' FCFA'), subscription=null}) => {
  const isMobile = useIsMobile();
  const onCta = async (plan) => {
    const user = sbAuth.getUser();
    if (!user) {
      localStorage.setItem('adstack_pending_plan', JSON.stringify(plan));
      sbAuth.signInWithGoogle();
      return;
    }
    // Ouvrir une fenêtre AVANT l'appel async (sinon bloqué sur mobile)
    const popup = window.open('', '_blank') || window;
    try {
      const r = await fetch('https://adstack-server.onrender.com/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: plan.id === 'starter' ? 'prd_ljowq8' : plan.id === 'pro' ? 'prd_34w031' : 'prd_9fi79y',
          email: user.email,
          user_id: user.id,
          plan: plan.id
        })
      });
      const data = await r.json();
      const url = data.checkout_url || plan.checkout;
      if (popup === window) { window.location.href = url; }
      else { popup.location.href = url; }
    } catch(e) {
      if (popup === window) { window.location.href = plan.checkout; }
      else { popup.location.href = plan.checkout; }
    }
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
        background: linear-gradient(90deg, #1FB6FF, #2D7FF9, #5B8FFF, #1FB6FF);
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
        <h1 style={{fontSize:isMobile?28:34,fontWeight:900,margin:'0 0 12px',lineHeight:1.1,letterSpacing:'-0.5px'}}>
          <span className="headline-gradient">Télécharge. Publie. Vends.</span>
        </h1>
        <p style={{fontSize:14,color:C.sec,margin:0,lineHeight:1.5,maxWidth:480}}>
          Moins de temps sur Canva et ChatGPT — plus de temps à scaler ton business.
        </p>
      </div>

      {/* ── Plan cards ── */}
      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr 1fr',gap:14,marginBottom:20}}>
        {PLANS.map(p => {
          const isCurrent = userPlan === p.id;
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
                <div style={{position:'absolute',top:-1,left:'50%',transform:'translateX(-50%)',background:`linear-gradient(90deg,${C.red},#0B3D91)`,color:'#fff',fontSize:9,fontWeight:900,padding:'3px 14px',borderRadius:'0 0 7px 7px',letterSpacing:'0.5px',textTransform:'uppercase',whiteSpace:'nowrap'}}>
                  ✦ RECOMMANDÉ
                </div>
              )}

              <div style={{fontSize:12,fontWeight:700,color:p.color,marginTop:isCurrent||p.best?8:0,marginBottom:10,letterSpacing:'0.3px'}}>{p.name}</div>

              <div style={{fontSize:11,color:C.muted,textDecoration:'line-through',fontFamily:"'DM Mono',monospace",marginBottom:2}}>
                {convertPrice(p.priceBarre)}
              </div>

              <div style={{display:'flex',alignItems:'baseline',gap:4,marginBottom:6}}>
                <span style={{fontSize:28,fontWeight:800,fontFamily:"'DM Mono',monospace",color:C.text,lineHeight:1}}>{convertPrice(p.price)}</span>
                <span style={{fontSize:11,color:C.sec}}>/ mois</span>
              </div>

              <div style={{display:'inline-flex',alignItems:'center',gap:5,padding:'3px 10px',borderRadius:20,marginBottom:18,width:'fit-content',background:`${p.color}18`,border:`1px solid ${p.color}38`}}>
                <span style={{fontSize:11,fontWeight:800,fontFamily:"'DM Mono',monospace",color:p.color}}>{convertPrice(p.prixImg)}</span>
                <span style={{fontSize:10,color:C.sec}}>/ image</span>
              </div>

              <div style={{height:1,background:C.border,marginBottom:16}}/>

              <div style={{flex:1,marginBottom:20,display:'flex',flexDirection:'column',gap:10}}>
                {p.features.map((f,j) => (
                  <div key={j} style={{display:'flex',alignItems:'flex-start',gap:9}}>
                    <span style={{flexShrink:0,marginTop:1,color:p.color}}><Icon name="check" size={13}/></span>
                    <div style={{fontSize:12,color:C.sec,lineHeight:1.4}}>{f}</div>
                  </div>
                ))}
              </div>

              {/* CTA Button */}
              <button
                onClick={() => !isCurrent && onCta(p)}
                className={isCurrent ? '' : 'cta-btn-active'}
                style={{
                  width:'100%', padding:'12px', borderRadius:9, fontFamily:'inherit',
                  border:'none', cursor: isCurrent ? 'default' : 'pointer',
                  fontWeight:700, fontSize:13, transition:'all 0.2s',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                  background: isCurrent
                    ? 'rgba(255,255,255,0.07)'
                    : 'linear-gradient(135deg,#2D7FF9,#0B3D91)',
                  color: isCurrent ? C.sec : '#fff',
                  boxShadow: isCurrent ? 'none' : '0 4px 16px rgba(45,127,249,0.35)',
                }}
              >
                {isCurrent
                  ? (<><Icon name="check" size={13} color={C.sec}/> Abonnement actuel</>)
                  : (<>Commencer maintenant <Icon name="arrow" size={13} color="#fff"/></>)
                }
              </button>

              {/* Reassurance */}
              {!isCurrent && (
                <div style={{marginTop:10,textAlign:'center',fontSize:10,color:C.muted,lineHeight:1.5}}>
                  🔒 Paiement sécurisé<br/>
                  <span style={{color:C.sec}}>Satisfait ou 100% remboursé</span>
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
const DemoPreview = ({slug, setSection}) => {
  const [showCta, setShowCta] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!slug) return;
    const t = setTimeout(() => setShowCta(true), 30000);
    return () => clearTimeout(t);
  }, [slug]);

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
      {/* Bouton flottant — apparaît après 30s */}
      {showCta && !dismissed && (
        <div style={{
          position:'fixed', bottom:88, left:'50%', transform:'translateX(-50%)',
          zIndex:8000, animation:'ctaFloat 0.6s cubic-bezier(.34,1.56,.64,1) forwards',
        }}>
          <style>{`
            @keyframes ctaFloat {
              from { opacity:0; transform:translateX(-50%) translateY(20px); }
              to   { opacity:1; transform:translateX(-50%) translateY(0); }
            }
            @keyframes ctaPulse {
              0%,100% { box-shadow:0 6px 28px rgba(45,127,249,0.55); }
              50%      { box-shadow:0 6px 36px rgba(45,127,249,0.80); }
            }
          `}</style>
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 20px',borderRadius:50,background:'linear-gradient(135deg,#2D7FF9,#0B3D91)',color:'#fff',fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:13,animation:'ctaPulse 2.5s ease infinite',cursor:'pointer',whiteSpace:'nowrap',userSelect:'none'}}
            onClick={() => setSection && setSection('tarifs')}>
            ✦ Découvrir nos offres
            <button onClick={e=>{e.stopPropagation();setDismissed(true);}} style={{marginLeft:4,width:18,height:18,borderRadius:'50%',border:'none',background:'rgba(255,255,255,0.2)',color:'#fff',cursor:'pointer',fontSize:10,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default function Platform() {
  const [section, _setSection] = useState(() => {
    try {
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
    } catch(e) {}
  };
  const [isDemo, setIsDemo] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [demoSlug, setDemoSlug] = useState(null);
  const isMobile = useIsMobile();

  // ── Auth state ──
  const [user, setUser] = useState(() => sbAuth.getUser());
  const [showLogin, setShowLogin] = useState(false);

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
      notify(`✕ Commande annulée pour "${p.nom}"`, 'warning');
      for (let i=0; i<3; i++) {
        try {
          const r = await fetch('https://adstack-server.onrender.com/commandes/'+brief.id+'/delete', {
            method:'POST', headers:{'Content-Type':'application/json'}, signal:AbortSignal.timeout(12000)
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

  useEffect(() => {
    if (window.location.hash.includes('access_token')) {
      sbAuth.handleCallback();
      return;
    }
    const u = sbAuth.getUser();
    setUser(u);
    if (u) {
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
      // Charger notifications si pas encore chargées
      if (notifications.length === 0) {
        sbNotifications.load(sess).then(notifs => {
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
        if (currency === 'XOF') { setPriceCtx({ currency: 'XOF', rate: 1, ready: true }); return; }
        const rates = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/xof.json').then(r => r.json());
        const rate = rates.xof?.[currency.toLowerCase()];
        if (!rate) { setPriceCtx({ currency: 'XOF', rate: 1, ready: true }); return; }
        setPriceCtx({ currency, rate, ready: true });
      } catch(e) { setPriceCtx({ currency: 'XOF', rate: 1, ready: true }); }
    })();
  }, []);

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
      html,body,#root{margin:0;padding:0;width:100%;height:100%;overflow:hidden;}
      input,textarea,select{touch-action:manipulation;font-size:16px !important;}
    `; // iOS zoom fix: Safari zoome si font-size<16px
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

  const views = {
    demo: <DemoPreview slug={demoSlug} setSection={setSection}/>,
    produits: <Produits products={products} setProducts={setProducts} user={user} onNeedLogin={()=>setShowLogin(true)} briefs={briefs} setBriefs={setBriefs} allBriefs={allBriefs} setAllBriefs={setAllBriefs} subscription={subscription} credits={computeCredits(subscription,allBriefs)} notify={notify} cancelCreatives={cancelCreatives} onAskCreatives={(p)=>{ 
            if(!user){setShowLogin(true);return;} 
            if(!subscription?.active){setSection('tarifs');return;}
            // Anti-doublon : brief actif existant ?
            const existing = briefs[p.id];
            const CANCEL_WIN = 12*60*60*1000;
            const isActive = existing && existing.status !== 'cancelled' && existing.status !== 'done';
            if(isActive){
              const canCancel = existing.status==='pending' && (Date.now()-new Date(existing.created_at).getTime()) < CANCEL_WIN;
              const msg = canCancel
                ? `Vous avez déjà une commande en cours pour "${p.nom}" (annulable). Souhaitez-vous ajouter une commande supplémentaire ?`
                : `Vos visuels pour "${p.nom}" sont en production. Souhaitez-vous commander un batch supplémentaire ?`;
              if(!window.confirm(msg)) return;
            }
            setCreativesTarget(p); }}/>,
    galerie: <Galerie products={products} isDemo={isDemo} setSection={setSection}/>,
    copies: <Copies products={products} setSection={setSection}/>,
    marche: <Marche products={products} isDemo={isDemo} setSection={setSection}/>,
    tarifs: <Tarifs convertPrice={convertPrice} subscription={subscription}/>,
    suivi: <SuiviDemande allBriefs={allBriefs} products={products} briefs={briefs} cancelCreatives={cancelCreatives} C={C}/>,
    notifications: <Notifications
        notifications={notifications}
        C={C}
        onMarkRead={async()=>{const s=await sbAuth.refreshSession();if(!s)return;const fresh=await sbNotifications.load(s);if(fresh?.length){setNotifications(fresh);}await sbNotifications.markAllRead(s);setUnreadCount(0);setNotifications(p=>p.map(n=>({...n,read:true})));}}
        onDeleteAll={async()=>{const s=await sbAuth.refreshSession();if(s){await fetch(`${SUPABASE_URL}/rest/v1/notifications?user_id=eq.${user?.id}`,{method:'DELETE',headers:{apikey:SUPABASE_ANON,Authorization:`Bearer ${s.access_token}`}});}setNotifications([]);setUnreadCount(0);}}
        onDeleteOne={async(id)=>{const s=await sbAuth.refreshSession();if(s){await fetch(`${SUPABASE_URL}/rest/v1/notifications?id=eq.${id}`,{method:'DELETE',headers:{apikey:SUPABASE_ANON,Authorization:`Bearer ${s.access_token}`}});}setNotifications(p=>p.filter(n=>n.id!==id));setUnreadCount(p=>Math.max(0,p-1));}}
        onMarkOne={async(id)=>{const s=await sbAuth.refreshSession();if(s){await fetch(`${SUPABASE_URL}/rest/v1/notifications?id=eq.${id}`,{method:'PATCH',headers:{apikey:SUPABASE_ANON,Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({read:true})});}setNotifications(p=>p.map(n=>n.id===id?{...n,read:true}:n));setUnreadCount(p=>Math.max(0,p-1));}}
      />,
  };

  return (
    <>
    <div style={{display:'flex',flexDirection:'column',height:'100vh',overflow:'hidden',background:C.bg,fontFamily:"'Outfit',sans-serif",color:C.text,WebkitFontSmoothing:'antialiased',MozOsxFontSmoothing:'grayscale'}}>


      <div style={{display:'flex',flex:1,overflow:'hidden',position:'relative'}}>
        <Sidebar active={section} set={setSection} isDemo={isDemo} setDemo={setIsDemo} collapsed={collapsed} setCollapsed={setCollapsed} isMobile={isMobile} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} convertPrice={convertPrice} user={user} setUser={setUser} unreadCount={unreadCount}/>

        {isMobile && mobileOpen && (
          <div onClick={() => setMobileOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:400}}/>
        )}

        <main style={{flex:1,overflow:section==='demo'?'hidden':'auto',padding:section==='demo'?0:isMobile?'16px':'28px 30px',marginLeft:isMobile?52:0,transition:'margin-left 0.22s cubic-bezier(.4,0,.2,1)'}}>
          {views[section]}
        </main>
      </div>
    </div>
    <Chatbot user={user} subscription={subscription} products={products} credits={computeCredits(subscription,allBriefs)} allBriefs={allBriefs} briefs={briefs} section={section} setSection={setSection} openProductForm={()=>{setSection('produits'); setTimeout(()=>window.dispatchEvent(new Event('openProductForm')),100);}} />
    {showLogin && <LoginModal onClose={()=>setShowLogin(false)} C={C}/>}
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
            notify(`📦 Demande de ${qty} visuels envoyée — livraison sous 48h`, 'brief');

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
