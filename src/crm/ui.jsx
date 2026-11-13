import React, { useEffect, useState } from 'react'
let subs = new Set(), toasts = [], dlg = null
const push = () => subs.forEach((f) => f())
export function toast(text, ms = 4200) { const t = { id: Math.random(), text }; toasts = [...toasts, t]; push(); setTimeout(() => { toasts = toasts.filter((x) => x !== t); push() }, ms) }
export function confirmDlg(message, ok = 'Confirmer') { return new Promise((res) => { dlg = { message, ok, res }; push() }) }
export function Host() {
  const [, set] = useState(0)
  useEffect(() => { const f = () => set((n) => n + 1); subs.add(f); return () => subs.delete(f) }, [])
  const close = (v) => { const d = dlg; dlg = null; push(); d.res(v) }
  return (<>
    {dlg && <div className="cx-back" onClick={() => close(false)}><div className="cx-modal sm" onClick={(e) => e.stopPropagation()}><p style={{ whiteSpace: 'pre-line' }}>{dlg.message}</p><div className="cx-act"><button className="cx-btn" onClick={() => close(false)}>Annuler</button><button className="cx-btn primary" autoFocus onClick={() => close(true)}>{dlg.ok}</button></div></div></div>}
    <div className="cx-toasts">{toasts.map((t) => <div key={t.id} className="cx-toast">{t.text}</div>)}</div>
  </>)
}
export function Modal({ title, onClose, children, wide }) {
  return <div className="cx-back" onClick={onClose}><div className={'cx-modal' + (wide ? ' wide' : '')} onClick={(e) => e.stopPropagation()}><div className="cx-mh"><b>{title}</b><button className="cx-x" onClick={onClose}>✕</button></div>{children}</div></div>
}
export const Chip = ({ c = 'mu', children, title }) => <span className={'cx-chip ' + c} title={title}>{children}</span>
export const Empty = ({ t, s }) => <div className="cx-empty"><b>{t}</b>{s && <div>{s}</div>}</div>

const IC = {
  today: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>',
  eye: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
  flame: '<path d="M12 2c1 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-9z"/>',
  phone: '<path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L8 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.6 2.8.7a2 2 0 011.7 2z"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/>',
  star: '<polygon points="12 2 15.1 8.6 22 9.3 17 14.1 18.2 21 12 17.7 5.8 21 7 14.1 2 9.3 8.9 8.6 12 2"/>',
  wallet: '<rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20M16 15h2"/>',
  receipt: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 6l10 7 10-7"/>',
  doc: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
  pulse: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6"/><path d="M17 4.5a3.5 3.5 0 010 7M22 21c0-3-1.5-5-4-5.8"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  book: '<path d="M4 4h12a4 4 0 014 4v12H8a4 4 0 01-4-4z"/><path d="M4 16a4 4 0 014-4h12"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  refresh: '<path d="M21 12a9 9 0 11-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  down: '<path d="M12 3v12M7 11l5 5 5-5M4 21h16"/>',
  chev: '<path d="M6 9l6 6 6-6"/>',
  expand: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
}
export const Icon = ({ n, s = 18 }) => <svg className="cx-ic" width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: IC[n] || '' }} />

// Sélecteur à segments (période, vue…) : une seule valeur active, mémorisée par l'appelant.
export const Seg = ({ value, onChange, options }) => <div className="cx-seg" role="tablist">{options.map(([v, l, c]) => <button key={String(v)} role="tab" aria-selected={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{l}{c != null && <i>{c}</i>}</button>)}</div>
// Pastilles de filtre avec compteur.
export const Pills = ({ value, onChange, options }) => <div className="cx-pills">{options.map(([v, l, c, t]) => <button key={String(v)} className={'cx-pill' + (value === v ? ' on' : '') + (t ? ' ' + t : '')} onClick={() => onChange(v)}>{l}{c != null && <i>{c}</i>}</button>)}</div>
// Carte chiffre : valeur, libellé, variation, mini-courbe.
export const Stat = ({ v, l, d, children, t, onClick }) => <div className={'cx-stat' + (t ? ' ' + t : '') + (onClick ? ' click' : '')} onClick={onClick}><span>{l}</span><b>{v}</b>{d != null && <em className={d > 0 ? 'up' : d < 0 ? 'dn' : ''}>{d > 0 ? '▲ ' : d < 0 ? '▼ ' : ''}{Math.abs(d)} %</em>}{children}</div>
export const Card = ({ t, note, children, className = '', pad = true }) => <section className={'cx-bloc ' + className}>{(t || note) && <header>{t && <b>{t}</b>}{note && <span className="cx-note">{note}</span>}</header>}{pad ? <div className="cx-pad">{children}</div> : children}</section>
