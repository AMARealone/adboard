// Boîtes de dialogue et messages (remplace les alert/confirm du navigateur).
import React, { useEffect, useState } from 'react'
let subs = new Set(), queue = [], toasts = []
const push = () => subs.forEach((f) => f())
export function confirmDlg(message, o = {}) { return new Promise((res) => { queue.push({ kind: 'confirm', message, ok: o.ok || 'Continuer', danger: o.danger, res }); push() }) }
export function alertDlg(message, o = {}) { return new Promise((res) => { queue.push({ kind: 'alert', message, title: o.title, res }); push() }) }
export function toast(text, ms = 4200) { const t = { id: Math.random(), text }; toasts.push(t); push(); setTimeout(() => { toasts = toasts.filter((x) => x !== t); push() }, ms) }

export function DialogHost() {
  const [, set] = useState(0)
  useEffect(() => { const f = () => set((n) => n + 1); subs.add(f); return () => subs.delete(f) }, [])
  const d = queue[0]
  const close = (v) => { queue.shift(); d.res(v); push() }
  return (
    <>
      {d && (
        <div className="fx-modal-back" onClick={() => close(d.kind === 'alert' ? true : false)}>
          <div className="fx-modal sm" onClick={(e) => e.stopPropagation()} role="dialog">
            {d.title && <h3>{d.title}</h3>}
            <p className="fx-pre">{d.message}</p>
            <div className="fx-modal-act">
              {d.kind === 'confirm' && <button className="fx-btn" onClick={() => close(false)}>Annuler</button>}
              <button className={'fx-btn ' + (d.danger ? 'danger' : 'primary')} autoFocus onClick={() => close(true)}>{d.kind === 'confirm' ? d.ok : 'OK'}</button>
            </div>
          </div>
        </div>
      )}
      <div className="fx-toasts">{toasts.map((t) => <div key={t.id} className="fx-toast">{t.text}</div>)}</div>
    </>
  )
}
