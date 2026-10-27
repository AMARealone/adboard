import React, { useEffect, useState } from 'react'
import { SB, SB_KEY, ADMIN_EMAIL } from './api'

const KS = 'factory_admin_sb_session', KU = 'factory_admin_sb_user'
const rd = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null') } catch (_) { return null } }
function save(d) {
  try {
    localStorage.setItem(KS, JSON.stringify({ access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Date.now() + (d.expires_in || 3600) * 1000 }))
    if (d.user) localStorage.setItem(KU, JSON.stringify(d.user))
  } catch (_) {}
}
export function signOut() { try { localStorage.removeItem(KS); localStorage.removeItem(KU) } catch (_) {} }

async function refresh() {
  const s = rd(KS)
  if (!s) return null
  if (s.expires_at && Date.now() < s.expires_at - 60000) return s
  try {
    const r = await fetch(`${SB}/auth/v1/token?grant_type=refresh_token`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_KEY }, body: JSON.stringify({ refresh_token: s.refresh_token }) })
    const d = await r.json()
    if (!r.ok) return null
    save(d); return rd(KS)
  } catch (_) { return null }
}

async function oauthCallback() {
  if (!location.hash.includes('access_token')) return
  const p = new URLSearchParams(location.hash.replace('#', ''))
  const d = { access_token: p.get('access_token'), refresh_token: p.get('refresh_token'), expires_in: parseInt(p.get('expires_in') || '3600') }
  history.replaceState(null, '', location.pathname)
  const r = await fetch(`${SB}/auth/v1/user`, { headers: { Authorization: 'Bearer ' + d.access_token, apikey: SB_KEY } })
  d.user = await r.json(); save(d)
}

export function useAdmin() {
  const [state, setState] = useState({ loading: true, user: null })
  const check = async () => {
    await oauthCallback().catch(() => {})
    const s = await refresh()
    const u = rd(KU)
    setState({ loading: false, user: s && u && (u.email || '').toLowerCase() === ADMIN_EMAIL ? u : null })
  }
  useEffect(() => { check() }, [])
  return { ...state, recheck: check }
}

export function Login({ onDone }) {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const go = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      const r = await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_KEY }, body: JSON.stringify({ email, password: pw }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error_description || d.msg || 'Identifiants incorrects')
      if ((d.user?.email || '').toLowerCase() !== ADMIN_EMAIL) throw new Error('Accès réservé à l’administrateur')
      save(d); onDone()
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  const google = () => { location.href = `${SB}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(location.origin + '/factory-next')}&prompt=select_account` }
  return (
    <div className="fx-login">
      <form className="fx-login-card" onSubmit={go}>
        <div className="fx-logo big">F</div>
        <h1>Factory</h1>
        <p>Espace administrateur AdStack</p>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        <input type="password" placeholder="Mot de passe" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />
        {err && <div className="fx-err">{err}</div>}
        <button className="fx-btn primary" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button>
        <button type="button" className="fx-btn" onClick={google}>Continuer avec Google</button>
      </form>
    </div>
  )
}
