import React from 'react'
// khalil-crm-v1 — Portrait de Khalil (Sales) : buste au trait, casque-micro d'appel, ondes de voix. Aucun fichier externe.
export function KhalilPortrait({ parle = false }) {
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true" className={'kh-portrait' + (parle ? ' parle' : '')}>
      <defs>
        <radialGradient id="khFond" cx="50%" cy="38%" r="70%"><stop offset="0" stopColor="#1FB6FF" stopOpacity=".32" /><stop offset=".55" stopColor="#7C5CFF" stopOpacity=".14" /><stop offset="1" stopColor="#0A0C11" stopOpacity="0" /></radialGradient>
        <linearGradient id="khPeau" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8A5A3C" /><stop offset="1" stopColor="#6B4329" /></linearGradient>
        <linearGradient id="khVeste" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1B2433" /><stop offset="1" stopColor="#111722" /></linearGradient>
        <clipPath id="khRond"><circle cx="100" cy="100" r="96" /></clipPath>
      </defs>
      <g clipPath="url(#khRond)">
        <rect width="200" height="200" fill="#0D1119" />
        <circle cx="100" cy="92" r="110" fill="url(#khFond)" />
        {[0, 1, 2].map((i) => <circle key={i} className="kh-onde" cx="100" cy="86" r={58 + i * 16} fill="none" stroke="#1FB6FF" strokeOpacity={0.22 - i * 0.06} strokeWidth="1.4" style={{ animationDelay: i * 0.25 + 's' }} />)}
        {/* buste */}
        <path d="M28 200c4-38 30-58 72-58s68 20 72 58z" fill="url(#khVeste)" stroke="#2A3548" strokeWidth="1.5" />
        <path d="M84 144l16 22 16-22" fill="#F2F4F8" opacity=".92" />
        <path d="M100 166l-5 34h10z" fill="#1FB6FF" opacity=".85" />
        <path d="M86 128h28v20c-4 6-24 6-28 0z" fill="url(#khPeau)" />
        {/* tête */}
        <ellipse cx="100" cy="92" rx="33" ry="39" fill="url(#khPeau)" />
        <path d="M67 84c0-26 15-38 33-38s33 12 33 38c-4-9-10-15-18-17-7 4-22 5-30 1-9 3-15 9-18 16z" fill="#14100E" />
        <path d="M76 106c4 15 13 24 24 24s20-9 24-24c-3 8-10 11-24 11s-21-3-24-11z" fill="#1A1412" opacity=".9" />
        <path d="M89 112c3 3 7 4 11 4s8-1 11-4" fill="none" stroke="#3A2418" strokeWidth="2.4" strokeLinecap="round" />
        <ellipse cx="87" cy="90" rx="3.4" ry="3.8" fill="#14100E" /><ellipse cx="113" cy="90" rx="3.4" ry="3.8" fill="#14100E" />
        <path d="M80 81c4-3 9-3 13 0M107 81c4-3 9-3 13 0" stroke="#14100E" strokeWidth="2.6" strokeLinecap="round" fill="none" />
        <ellipse cx="66" cy="94" rx="5" ry="8" fill="#6B4329" /><ellipse cx="134" cy="94" rx="5" ry="8" fill="#6B4329" />
        {/* casque-micro */}
        <path d="M63 92c0-30 16-46 37-46s37 16 37 46" fill="none" stroke="#E8ECF3" strokeWidth="4.5" strokeLinecap="round" />
        <rect x="56" y="84" width="12" height="20" rx="5" fill="#1FB6FF" />
        <rect x="132" y="84" width="12" height="20" rx="5" fill="#1FB6FF" />
        <path d="M62 103c2 14 12 21 24 21" fill="none" stroke="#E8ECF3" strokeWidth="3" strokeLinecap="round" />
        <circle cx="88" cy="124" r="4.5" fill="#E8ECF3" />
      </g>
      <circle cx="100" cy="100" r="96" fill="none" stroke="#1FB6FF" strokeOpacity=".35" strokeWidth="2" />
    </svg>
  )
}
// Silhouette d'un agent qui n'est pas encore arrivé
export function AgentAVenir() {
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true" className="kh-portrait">
      <circle cx="100" cy="100" r="96" fill="#0D1119" stroke="rgba(255,255,255,.1)" strokeWidth="2" strokeDasharray="6 6" />
      <circle cx="100" cy="86" r="30" fill="rgba(255,255,255,.06)" />
      <path d="M44 172c6-28 28-42 56-42s50 14 56 42" fill="rgba(255,255,255,.06)" />
      <text x="100" y="96" textAnchor="middle" fontSize="30" fill="rgba(255,255,255,.28)" fontWeight="700">?</text>
    </svg>
  )
}
