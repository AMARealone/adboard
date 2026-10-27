import { useEffect, useState, useCallback } from 'react';
import { teamFetch, PRESETS, PERM_KEYS, PERM_LABELS, PLAN_LABEL, SEATS } from './team.js';

// Page « Équipe » (propriétaire uniquement). Autonome : reçoit la palette C et une fonction
// qui renvoie une session fraîche. Fonctionne en une colonne sur mobile.

const ERR = {
  email_invalide: "Cette adresse email n'est pas valide.",
  places_epuisees: "Toutes les places de votre offre sont utilisées.",
  deja_invite: "Cette personne fait déjà partie de votre équipe (ou a déjà été invitée).",
  abonnement_requis: "Les comptes d'équipe demandent un abonnement actif PERF+, GROWTH ou SCALE.",
  reseau: "Le serveur ne répond pas. Réessayez dans quelques secondes.",
  connexion_requise: "Votre session a expiré. Reconnectez-vous.",
  introuvable: "Ce membre n'existe plus.",
  creation_impossible: "L'invitation n'a pas pu être créée. Réessayez.",
};
const STATUS = {
  active: { t: 'Actif', c: '#22C55E' },
  invited: { t: 'Invitation envoyée', c: '#F59E0B' },
  suspended: { t: 'Suspendu (plus de place)', c: '#E55050' },
};

export default function TeamPage({ C, getToken, notify, onUpgrade, isMobile }) {
  const [data, setData] = useState(null);       // { seats, plan, members } | { error }
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);     // null | {mode:'invite'} | {mode:'edit', m}
  const [confirmRm, setConfirmRm] = useState(null);
  const [lien, setLien] = useState(null);       // lien d'invitation si l'email n'a pas pu partir

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) { setData({ error: 'connexion_requise' }); setLoading(false); return; }
    const d = await teamFetch('/team/members', { token });
    setData(d); setLoading(false);
  }, [getToken]);
  useEffect(() => { load(); }, [load]);

  const call = async (path, body, okMsg) => {
    const token = await getToken();
    const r = await teamFetch(path, { method: 'POST', body, token });
    if (r.error) { notify && notify(ERR[r.error] || 'Une erreur est survenue.', 'warning'); return r; }
    if (okMsg) notify && notify(okMsg, 'success');
    await load();
    return r;
  };

  const card = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14 };
  const btn = (primary) => ({ padding: '9px 14px', borderRadius: 8, border: primary ? 'none' : `1px solid ${C.border}`, background: primary ? C.accent : 'rgba(255,255,255,0.04)', color: primary ? '#fff' : C.text, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' });

  if (loading) return <div style={{ color: C.sec, fontSize: 13, padding: 20 }}>Chargement de votre équipe…</div>;

  if (data?.error === 'abonnement_requis') {
    return (
      <div style={{ maxWidth: 640 }}>
        <h2 style={{ fontSize: 20, margin: '0 0 6px', color: C.text }}>Équipe</h2>
        <div style={{ ...card, padding: 20, marginTop: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 6 }}>Travaillez à plusieurs sur le même espace</div>
          <div style={{ fontSize: 12.5, color: C.sec, lineHeight: 1.6, marginBottom: 14 }}>
            Invitez votre media buyer ou votre assistant, avec les droits que vous choisissez. PERF+ : {SEATS.starter} membres · GROWTH : {SEATS.pro} · SCALE : {SEATS.scale}.
          </div>
          <button style={btn(true)} onClick={onUpgrade}>Voir les offres</button>
        </div>
      </div>
    );
  }
  if (data?.error) {
    return (
      <div style={{ maxWidth: 640 }}>
        <h2 style={{ fontSize: 20, margin: '0 0 6px', color: C.text }}>Équipe</h2>
        <div style={{ ...card, padding: 20, marginTop: 14, color: C.sec, fontSize: 13 }}>
          {ERR[data.error] || 'Impossible de charger votre équipe.'}
          <div style={{ marginTop: 12 }}><button style={btn(false)} onClick={() => { setLoading(true); load(); }}>Réessayer</button></div>
        </div>
      </div>
    );
  }

  const { seats, plan, members } = data;
  const visibles = members.filter((m) => m.status !== 'removed');
  const pct = Math.min(100, Math.round((seats.used / Math.max(1, seats.max)) * 100));
  const full = seats.used >= seats.max;
  const nextPlan = plan === 'starter' ? 'GROWTH' : plan === 'pro' ? 'SCALE' : null;

  return (
    <div style={{ maxWidth: 760, paddingBottom: 90 }} data-testid="team-page">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 20, margin: '0 0 4px', color: C.text }}>Équipe</h2>
          <div style={{ fontSize: 12.5, color: C.sec }}>Vous êtes le propriétaire. Vos membres travaillent dans votre espace, avec les droits que vous leur donnez.</div>
        </div>
        <button style={{ ...btn(true), opacity: full ? 0.5 : 1, width: isMobile ? '100%' : undefined }} disabled={full}
          onClick={() => { setLien(null); setModal({ mode: 'invite' }); }}>+ Inviter un membre</button>
      </div>

      <div style={{ ...card, padding: 16, marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: C.text, fontWeight: 700, marginBottom: 8 }}>
          <span>Places d'équipe · offre {PLAN_LABEL[plan] || plan}</span><span>{seats.used} / {seats.max}</span>
        </div>
        <div style={{ height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <div style={{ width: pct + '%', height: '100%', background: full ? '#F59E0B' : C.accent, transition: 'width .3s' }} />
        </div>
        {full && (
          <div style={{ fontSize: 12, color: C.sec, marginTop: 10, lineHeight: 1.5 }}>
            Toutes vos places sont utilisées.{nextPlan ? <> Passez à <b style={{ color: C.text }}>{nextPlan}</b> pour {nextPlan === 'GROWTH' ? SEATS.pro : SEATS.scale} places. <button onClick={onUpgrade} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit', padding: 0 }}>Voir les offres</button></> : ''}
          </div>
        )}
      </div>

      {lien && (
        <div style={{ ...card, padding: 14, marginTop: 12, borderColor: '#F59E0B' }}>
          <div style={{ fontSize: 12.5, color: C.text, marginBottom: 6, fontWeight: 700 }}>L'email n'a pas pu partir. Envoyez ce lien vous-même :</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input readOnly value={lien} onFocus={(e) => e.target.select()} style={{ flex: 1, minWidth: 180, padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 12 }} />
            <button style={btn(false)} onClick={() => { try { navigator.clipboard.writeText(lien); notify && notify('Lien copié', 'success'); } catch (e) {} }}>Copier</button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visibles.length === 0 && (
          <div style={{ ...card, padding: 22, textAlign: 'center', color: C.sec, fontSize: 13 }}>
            Personne n'a encore été invité. Cliquez sur « Inviter un membre » pour ajouter votre media buyer ou votre assistant.
          </div>
        )}
        {visibles.map((m) => {
          const st = STATUS[m.status] || { t: m.status, c: C.sec };
          return (
            <div key={m.id} style={{ ...card, padding: 14, display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 10, alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text, overflowWrap: 'anywhere' }}>{m.email}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 5, fontSize: 10.5, fontWeight: 700, background: C.accentS, color: C.accent }}>{PRESETS[m.role_preset]?.label || 'Membre'}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: st.c }}>● {st.t}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button style={btn(false)} onClick={() => setModal({ mode: 'edit', m })}>Droits</button>
                {m.status === 'invited' && (
                  <button style={btn(false)} onClick={async () => {
                    const r = await call('/team/resend', { id: m.id }, null);
                    if (r && r.ok) { if (r.emailEnvoye) notify && notify('Invitation renvoyée', 'success'); else setLien(r.lien); }
                  }}>Renvoyer</button>
                )}
                <button style={{ ...btn(false), color: '#E55050' }} onClick={() => setConfirmRm(m)}>Retirer</button>
              </div>
            </div>
          );
        })}
      </div>

      {modal && (
        <MemberModal C={C} btn={btn} card={card} isMobile={isMobile} mode={modal.mode} member={modal.m}
          onClose={() => setModal(null)}
          onSubmit={async ({ email, preset, permissions }) => {
            if (modal.mode === 'invite') {
              const r = await call('/team/invite', { email, preset, permissions });
              if (r && r.ok) { setModal(null); if (r.emailEnvoye) notify && notify('Invitation envoyée à ' + email, 'success'); else setLien(r.lien); }
            } else {
              const r = await call('/team/update', { id: modal.m.id, preset, permissions }, 'Droits mis à jour');
              if (r && r.ok) setModal(null);
            }
          }} />
      )}

      {confirmRm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setConfirmRm(null)}>
          <div style={{ ...card, padding: 20, maxWidth: 380, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 8 }}>Retirer ce membre ?</div>
            <div style={{ fontSize: 12.5, color: C.sec, lineHeight: 1.5, marginBottom: 16 }}>{confirmRm.email} n'aura plus accès à votre espace. Ses demandes déjà envoyées restent dans votre suivi.</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={btn(false)} onClick={() => setConfirmRm(null)}>Annuler</button>
              <button style={{ ...btn(true), background: '#E55050' }} onClick={async () => { const m = confirmRm; setConfirmRm(null); await call('/team/remove', { id: m.id }, 'Membre retiré'); }}>Retirer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MemberModal({ C, btn, card, isMobile, mode, member, onClose, onSubmit }) {
  const [email, setEmail] = useState(member?.email || '');
  const [preset, setPreset] = useState(member?.role_preset || 'media_buyer');
  const [perms, setPerms] = useState(() => ({ ...(PRESETS[member?.role_preset || 'media_buyer'].perms), ...(member?.permissions || {}) }));
  const [busy, setBusy] = useState(false);

  const pick = (k) => { setPreset(k); if (k !== 'personnalise') setPerms({ ...PRESETS[k].perms }); };
  const toggle = (k) => { if (k === 'view') return; setPerms((p) => ({ ...p, [k]: !p[k] })); setPreset('personnalise'); };
  const okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100000, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 16 }} onClick={onClose}>
      <div style={{ ...card, padding: 20, width: '100%', maxWidth: 480, maxHeight: '92dvh', overflowY: 'auto', borderRadius: isMobile ? '16px 16px 0 0' : 14 }} onClick={(e) => e.stopPropagation()} data-testid="member-modal">
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 14 }}>{mode === 'invite' ? 'Inviter un membre' : 'Droits de ' + member.email}</div>

        {mode === 'invite' && (
          <>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: C.sec }}>Adresse Google de la personne</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom@gmail.com" autoFocus
              style={{ width: '100%', boxSizing: 'border-box', marginTop: 6, marginBottom: 4, padding: '11px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 16 }} />
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>Elle devra se connecter avec cette adresse pour accepter l'invitation.</div>
          </>
        )}

        <div style={{ fontSize: 11.5, fontWeight: 700, color: C.sec, marginBottom: 6 }}>Rôle</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {Object.entries(PRESETS).filter(([k]) => k !== 'personnalise').map(([k, p]) => (
            <button key={k} onClick={() => pick(k)} style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', border: `1.5px solid ${preset === k ? C.accent : C.border}`, background: preset === k ? C.accentS : 'transparent' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{p.label}</div>
              <div style={{ fontSize: 11.5, color: C.sec, marginTop: 2 }}>{p.desc}</div>
            </button>
          ))}
        </div>

        <div style={{ fontSize: 11.5, fontWeight: 700, color: C.sec, marginBottom: 6 }}>Droits {preset === 'personnalise' && <span style={{ color: C.accent }}>· personnalisés</span>}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 14 }}>
          {PERM_KEYS.map((k) => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 4px', fontSize: 12.5, color: C.text, cursor: k === 'view' ? 'default' : 'pointer', opacity: k === 'view' ? 0.6 : 1 }}>
              <input type="checkbox" checked={!!perms[k]} disabled={k === 'view'} onChange={() => toggle(k)} style={{ width: 18, height: 18, accentColor: C.accent }} />
              {PERM_LABELS[k]}
            </label>
          ))}
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 14, lineHeight: 1.5 }}>Un membre ne peut jamais rien supprimer ni annuler, ne voit ni la facturation ni les prix, et ne peut pas inviter d'autres personnes.</div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button style={btn(false)} onClick={onClose}>Annuler</button>
          <button style={{ ...btn(true), opacity: (mode === 'invite' && !okEmail) || busy ? 0.5 : 1 }} disabled={(mode === 'invite' && !okEmail) || busy}
            onClick={async () => { setBusy(true); await onSubmit({ email: email.trim().toLowerCase(), preset, permissions: perms }); setBusy(false); }}>
            {busy ? '…' : mode === 'invite' ? 'Envoyer l\'invitation' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
