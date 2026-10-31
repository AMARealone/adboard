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
