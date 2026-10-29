// ── Équipe AdBoard : contexte d'espace de travail + droits ─────────────────────
// Un client payant est PROPRIÉTAIRE de son espace. Il peut inviter des membres (media buyer,
// assistant…) avec des droits précis. Un membre travaille dans l'espace du propriétaire :
// tous les chargements filtrent sur l'identifiant du propriétaire (wsOwner), et les actions
// sont conditionnées par can(). La vraie sécurité est côté base (RLS + team_can) et serveur ;
// ce module ne fait que refléter les droits dans l'interface.

export const SERVER = 'https://adstack-server.onrender.com';
const LS_WS = 'adstack_ws';          // identifiant du propriétaire choisi ('own' = mon espace)
const LS_CACHE = 'adstack_ws_cache'; // dernier résultat connu de /team/workspaces
const LS_INVITE = 'adstack_invite';  // jeton d'invitation reçu par lien, à accepter après connexion

export const PERM_KEYS = ['view', 'download', 'edit_products', 'request_production'];
export const PERM_LABELS = {
  view: 'Voir produits, galerie et suivi',
  download: 'Télécharger les créatives',
  edit_products: 'Ajouter et modifier des produits',
  request_production: 'Demander une production',
};
export const PRESETS = {
  media_buyer:  { label: 'Media buyer', desc: 'Voit tout, télécharge, demande des productions. Ne supprime rien.', perms: { view: true, download: true, edit_products: false, request_production: true } },
  assistant:    { label: 'Assistant', desc: 'Comme le media buyer, et peut aussi ajouter et modifier des produits.', perms: { view: true, download: true, edit_products: true, request_production: true } },
  lecture:      { label: 'Lecture seule', desc: 'Consulte et télécharge. Ne demande et ne modifie rien.', perms: { view: true, download: true, edit_products: false, request_production: false } },
  personnalise: { label: 'Personnalisé', desc: 'Vous cochez exactement les droits.', perms: { view: true, download: true, edit_products: false, request_production: false } },
};
export const SEATS = { starter: 2, pro: 5, scale: 15 };
export const PLAN_LABEL = { test: 'TEST', starter: 'PERF+', pro: 'GROWTH', scale: 'SCALE' };

const ALL = { view: true, download: true, edit_products: true, request_production: true };

// État partagé (module) — lu par les fonctions sb* qui ne sont pas des composants React.
export const WS = { ownerId: null, isOwner: true, perms: ALL, ownerLabel: '', info: null };

export const wsOwner = (fallbackId) => WS.ownerId || fallbackId || null;
// Supprimer / annuler : réservé au propriétaire, jamais délégable.
export const can = (perm) => perm === 'delete' ? WS.isOwner : (WS.isOwner || !!WS.perms?.[perm]);
export const isMember = () => !WS.isOwner;

const safeGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const safeSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const safeDel = (k) => { try { localStorage.removeItem(k); } catch (e) {} };

export const resetWorkspace = (userId) => {
  WS.ownerId = userId || null; WS.isOwner = true; WS.perms = ALL; WS.ownerLabel = ''; WS.info = null;
};

export async function teamFetch(path, { method = 'GET', body, token, timeoutMs = 20000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(SERVER + path, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    let data = {};
    try { data = await r.json(); } catch (e) {}
    if (!r.ok && !data.error) data.error = r.status === 401 ? 'connexion_requise' : 'reseau';
    return data;
  } catch (e) {
    return { error: 'reseau' };
  } finally { clearTimeout(t); }
}

// Lien d'invitation : on garde le jeton le temps que la personne se connecte avec Google.
export function captureInviteFromUrl() {
  try {
    const p = new URLSearchParams(window.location.search);
    const tok = p.get('invite');
    if (tok) {
      safeSet(LS_INVITE, tok);
      p.delete('invite');
      const qs = p.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? '?' + qs : '') + window.location.hash);
    }
  } catch (e) {}
}
export const pendingInviteToken = () => safeGet(LS_INVITE);

function applyInfo(userId, info) {
  const chosen = safeGet(LS_WS);
  const ms = info?.memberships || [];
  let target = null;
  if (chosen && chosen !== 'own') target = ms.find((m) => m.ownerId === chosen) || null;
  // Un membre sans abonnement propre arrive directement dans l'espace qui l'a invité.
  if (!target && (!chosen) && !info?.own?.hasPlan && ms.length) target = ms[0];
  if (target) {
    WS.ownerId = target.ownerId; WS.isOwner = false;
    WS.perms = { view: false, download: false, edit_products: false, request_production: false, ...(target.permissions || {}), delete: false };
    WS.ownerLabel = target.ownerLabel || '';
  } else {
    WS.ownerId = userId; WS.isOwner = true; WS.perms = ALL; WS.ownerLabel = '';
  }
  WS.info = info || null;
}

// Appelée une fois à la connexion (et après acceptation d'une invitation / changement d'espace).
// Ne bloque jamais l'appli : au pire (serveur endormi, réseau), on reprend le dernier état connu.
export async function resolveWorkspace(session, userId, { refresh = false } = {}) {
  if (!refresh) resetWorkspace(userId);
  if (!session?.access_token) return WS;
  let info = null;
  // 1) accepter une invitation en attente (lien) avant de lister les espaces
  const tok = pendingInviteToken();
  let accepted = null;
  if (tok) {
    const a = await teamFetch('/team/accept', { method: 'POST', body: { token: tok }, token: session.access_token, timeoutMs: 15000 });
    if (a.ok) { safeDel(LS_INVITE); safeSet(LS_WS, a.ownerId); accepted = { ok: true, ownerId: a.ownerId }; }
    else if (a.error && a.error !== 'reseau') { safeDel(LS_INVITE); accepted = { error: a.error, attendu: a.attendu }; }
  }
  // 2) mes espaces
  let cached = null;
  try { const c = JSON.parse(safeGet(LS_CACHE) || 'null'); if (c && c.userId === userId) cached = c.info; } catch (e) {}
  // Sans mémoire locale, on attend plus longtemps (serveur Render qui se réveille) plutôt que d'afficher le mauvais espace.
  const d = await teamFetch('/team/workspaces', { token: session.access_token, timeoutMs: refresh ? 15000 : (cached ? 6000 : 25000) });
  if (!d.error) { info = d; safeSet(LS_CACHE, JSON.stringify({ userId, info })); }
  else if (refresh) { return WS; }
  else {
    try { const c = JSON.parse(safeGet(LS_CACHE) || 'null'); if (c && c.userId === userId) info = c.info; } catch (e) {}
  }
  applyInfo(userId, info);
  WS.accepted = accepted;
  return WS;
}

export function switchWorkspace(ownerIdOrOwn) {
  safeSet(LS_WS, ownerIdOrOwn || 'own');
  window.location.reload();
}
export const clearWorkspaceMemory = () => { safeDel(LS_WS); safeDel(LS_CACHE); safeDel(LS_INVITE); };
