import React from 'react'
// Petits graphiques SVG / CSS sans dépendance. Couleurs = variables du CRM.
export const COUL = ['var(--ac)', '#2EF2E8', '#9B7BFF', 'var(--wa)', 'var(--ok)', '#FF6FB5']
const fmt = (n) => (n >= 1000 ? (Math.round(n / 100) / 10).toString().replace('.', ',') + 'k' : String(Math.round(n * 10) / 10).replace('.', ','))
let uid = 0

export function Area({ data, color = 'var(--ac)', h = 120, unite = '' }) {
  const id = React.useMemo(() => 'g' + ++uid, [])
  const n = data.length, W = 600, H = h, pad = 8, max = Math.max(1, ...data.map((d) => d.v))
  if (n < 2) return null
  const x = (i) => (i / (n - 1)) * W, y = (v) => H - pad - (v / max) * (H - pad * 2 - 8)
  const pts = data.map((d, i) => [x(i), y(d.v)])
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')
  const tot = data.reduce((s, d) => s + d.v, 0)
  return (
    <div className="cx-ch">
      <svg viewBox={'0 0 ' + W + ' ' + H} preserveAspectRatio="none" role="img" aria-label={'Courbe, total ' + tot} style={{ height: h }}>
        <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".38" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={W} y1={H - pad - f * (H - pad * 2 - 8)} y2={H - pad - f * (H - pad * 2 - 8)} stroke="rgba(255,255,255,.06)" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />)}
        <path d={line + ' L' + W + ' ' + H + ' L0 ' + H + ' Z'} fill={'url(#' + id + ')'} />
        <path d={line} fill="none" stroke={color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {data.map((d, i) => <rect key={i} x={x(i) - W / n / 2} y="0" width={W / n} height={H} fill="transparent"><title>{d.l + ' : ' + d.v + unite}</title></rect>)}
      </svg>
      <div className="cx-ax"><span>{data[0].l}</span><b>{max > 1 ? 'max ' + fmt(max) + unite : ''}</b><span>{data[n - 1].l}</span></div>
    </div>
  )
}

export function Bars({ data, color = 'var(--ac)', h = 120, unite = '' }) {
  const n = data.length, max = Math.max(1, ...data.map((d) => d.v))
  if (!n) return null
  return (
    <div className="cx-ch">
      <div className="cx-bars" style={{ height: h }}>
        {data.map((d, i) => <div key={i} className="cx-barcol" title={d.l + ' : ' + d.v + unite}><i style={{ height: Math.max(d.v ? 4 : 1, (d.v / max) * 100) + '%', background: d.v ? (d.hl ? 'var(--ok)' : color) : 'rgba(255,255,255,.1)' }} /></div>)}
      </div>
      <div className="cx-ax"><span>{data[0].l}</span><b>{max > 1 ? 'max ' + fmt(max) + unite : ''}</b><span>{data[n - 1].l}</span></div>
    </div>
  )
}

// Entonnoir : chaque étape = une barre proportionnelle, avec le % par rapport à l'étape précédente.
export function Funnel({ steps }) {
  const max = Math.max(1, ...steps.map((s) => s.v))
  return (
    <div className="cx-fun">
      {steps.map((s, i) => {
        const prev = i ? steps[i - 1].v : null, conv = prev && s.v <= prev ? Math.round((s.v / prev) * 100) : null
        return (
          <div key={s.l} className={'cx-fstep' + (s.accent ? ' acc' : '')}>
            <span className="cx-fl">{s.l}</span>
            <div className="cx-ft"><i style={{ width: Math.max(s.v ? 3 : 0, (s.v / max) * 100) + '%', background: s.accent ? 'linear-gradient(90deg,var(--ok),#2EF2E8)' : 'linear-gradient(90deg,var(--ac),#0B5CFF)', opacity: 1 - i * 0.06 }} /></div>
            <b className="cx-fv">{s.v}</b>
            <em className="cx-fc">{conv === null ? '' : conv + ' %'}</em>
          </div>
        )
      })}
    </div>
  )
}

export function Donut({ parts, size = 120, centre, sous }) {
  const tot = parts.reduce((s, p) => s + p.v, 0), r = 42, C = 2 * Math.PI * r
  let off = 0
  return (
    <div className="cx-donut">
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={'Répartition, total ' + tot}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="12" />
        {tot > 0 && parts.map((p, i) => { const l = (p.v / tot) * C, el = <circle key={p.l} cx="50" cy="50" r={r} fill="none" stroke={p.c || COUL[i % COUL.length]} strokeWidth="12" strokeDasharray={Math.max(0, l - 1.5) + ' ' + C} strokeDashoffset={-off} transform="rotate(-90 50 50)"><title>{p.l + ' : ' + p.v}</title></circle>; off += l; return el })}
        <text x="50" y={sous ? 49 : 55} textAnchor="middle" fontSize="20" fontWeight="800" fill="var(--tx)">{centre != null ? centre : tot}</text>
        {sous && <text x="50" y="63" textAnchor="middle" fontSize="8" fill="var(--sec)">{sous}</text>}
      </svg>
      <ul>{parts.map((p, i) => <li key={p.l}><i style={{ background: p.c || COUL[i % COUL.length] }} />{p.l}<b>{p.t != null ? p.t : p.v}</b></li>)}</ul>
    </div>
  )
}

export function Ring({ v, max, size = 84, label, color = 'var(--ac)' }) {
  const r = 40, C = 2 * Math.PI * r, f = max > 0 ? Math.min(1, v / max) : 0
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={label}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="9" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={f >= 1 ? 'var(--ok)' : color} strokeWidth="9" strokeLinecap="round" strokeDasharray={f * C + ' ' + C} transform="rotate(-90 50 50)" />
      <text x="50" y="57" textAnchor="middle" fontSize="26" fontWeight="800" fill="var(--tx)">{v}</text>
    </svg>
  )
}

export function Spark({ values, color = 'var(--ac)', w = 90, h = 28 }) {
  const n = values.length, max = Math.max(1, ...values)
  if (n < 2) return null
  const p = values.map((v, i) => (i / (n - 1)) * w + ',' + (h - 3 - (v / max) * (h - 6))).join(' ')
  return <svg viewBox={'0 0 ' + w + ' ' + h} width={w} height={h} aria-hidden="true"><polyline points={p} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /></svg>
}

export function HBars({ rows, color = 'var(--ac)', fmtV = (v) => v }) {
  const max = Math.max(1, ...rows.map((r) => r.v))
  return <div className="cx-hb">{rows.map((r, i) => <div key={r.l} className="cx-hbr"><span title={r.l}>{r.l}</span><div><i style={{ width: Math.max(r.v ? 2 : 0, (r.v / max) * 100) + '%', background: r.c || (i === 0 ? color : 'color-mix(in srgb,' + color + ' 55%,transparent)') }} /></div><b>{fmtV(r.v)}{r.sub && <small>{r.sub}</small>}</b></div>)}</div>
}
