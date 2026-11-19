import React from 'react'
// ux-factory-v2 — Illustrations des agents (une par rôle) et pictogrammes de pages.
// Dessin au trait, couleur de l'agent (currentColor) ; aucun fichier externe.

const Grille = ({ id }) => (
  <>
    <defs>
      <pattern id={id} width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1" fill="currentColor" opacity=".16" /></pattern>
      <radialGradient id={id + 'g'} cx="50%" cy="45%" r="60%"><stop offset="0" stopColor="currentColor" stopOpacity=".26" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></radialGradient>
    </defs>
    <rect width="160" height="110" fill={`url(#${id})`} />
    <ellipse cx="80" cy="55" rx="120" ry="82" fill={`url(#${id}g)`} />
  </>
)
const Etincelle = ({ x, y, s = 1, o = 1 }) => <path transform={`translate(${x} ${y}) scale(${s})`} d="M0-7C.8-2 2-.8 7 0 2 .8.8 2 0 7-.8 2-2 .8-7 0-2-.8-.8-2 0-7z" fill="currentColor" opacity={o} />

// 1 — Analyste de marché : graphique du marché passé à la loupe, une cible (persona) au centre de la loupe
function Analyste() {
  return (
    <svg viewBox="0 0 160 110" aria-hidden="true">
      <Grille id="ga" />
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 92h96" strokeWidth="2" opacity=".5" />
        {[[24, 70], [38, 58], [52, 64], [66, 46], [80, 36]].map(([x, y], i) => <rect key={i} x={x} y={y} width="9" height={92 - y} rx="2.5" fill="currentColor" fillOpacity={0.14 + i * 0.05} strokeWidth="1.6" />)}
        <path d="M28 64l14-12 14 6 14-18 14-10" fill="none" strokeWidth="2.4" />
        {[[28, 64], [42, 52], [56, 58], [70, 40], [84, 30]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.6" fill="#0B0E15" strokeWidth="2" />)}
        <circle cx="112" cy="44" r="23" fill="#0B0E15" fillOpacity=".72" strokeWidth="4" />
        <circle cx="112" cy="44" r="15" fill="none" strokeWidth="1.2" strokeDasharray="2 3.5" opacity=".7" />
        <path d="M129 61l15 15" strokeWidth="8" />
        <circle cx="112" cy="39" r="5" fill="currentColor" fillOpacity=".55" strokeWidth="1.6" />
        <path d="M102 54c1.5-6 5.5-8.5 10-8.5s8.5 2.5 10 8.5" fill="currentColor" fillOpacity=".3" strokeWidth="1.6" />
      </g>
      <Etincelle x={140} y={22} s={0.9} o={0.8} /><Etincelle x={20} y={26} s={0.55} o={0.5} />
    </svg>
  )
}

// 2 — Creative Image : une static ad 4:5 posée sur le CT modèle choisi dans la galerie
function CreativeImage() {
  return (
    <svg viewBox="0 0 160 110" aria-hidden="true">
      <Grille id="gi" />
      <g stroke="currentColor" strokeLinejoin="round" strokeLinecap="round">
        <rect x="34" y="22" width="50" height="62" rx="6" transform="rotate(-9 59 53)" fill="currentColor" fillOpacity=".1" strokeWidth="1.5" opacity=".6" strokeDasharray="4 3" />
        <rect x="64" y="14" width="58" height="73" rx="7" fill="#0B0E15" strokeWidth="2.2" />
        <rect x="70" y="20" width="46" height="40" rx="3.5" fill="currentColor" fillOpacity=".12" strokeWidth="1.2" />
        <circle cx="106" cy="30" r="5" fill="currentColor" fillOpacity=".7" strokeWidth="0" />
        <path d="M70 56l13-15 9 9 7-6 17 16" fill="currentColor" fillOpacity=".35" strokeWidth="1.6" />
        <path d="M71 67h30M71 73h20" strokeWidth="2.4" opacity=".85" />
        <rect x="96" y="76" width="20" height="7" rx="3.5" fill="currentColor" strokeWidth="0" />
        <path d="M30 88l9-9" strokeWidth="1.5" opacity=".5" />
      </g>
      <Etincelle x={132} y={20} s={1.1} /><Etincelle x={140} y={42} s={0.6} o={0.6} /><Etincelle x={30} y={20} s={0.7} o={0.55} />
    </svg>
  )
}

// 3 — Copywriter : la page d'ad copy (hook en gras, description), la plume qui écrit, les guillemets
function Copywriter() {
  return (
    <svg viewBox="0 0 160 110" aria-hidden="true">
      <Grille id="gc" />
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <rect x="34" y="12" width="68" height="86" rx="8" fill="#0B0E15" strokeWidth="2.2" />
        <path d="M44 28c0-4 2-6.5 6-7.5M53 28c0-4 2-6.5 6-7.5" fill="none" strokeWidth="3" />
        <path d="M44 38h46" strokeWidth="5" />
        <path d="M44 48h40" strokeWidth="5" opacity=".55" />
        <path d="M44 61h48M44 69h44M44 77h48M44 85h28" strokeWidth="2" opacity=".5" />
        <path d="M131 18l9 9-37 37-12 3 3-12z" fill="currentColor" fillOpacity=".22" strokeWidth="2.2" />
        <path d="M125 24l9 9" strokeWidth="2.2" />
        <path d="M94 67l-3 3" strokeWidth="2.6" />
        <path d="M88 86c8-2 12 3 20 0s10-4 16-1" fill="none" strokeWidth="1.8" opacity=".7" />
      </g>
      <Etincelle x={140} y={70} s={0.8} o={0.75} /><Etincelle x={22} y={86} s={0.55} o={0.5} />
    </svg>
  )
}

// 4 — Créative Vidéo : clap de tournage, lecture, piste son
function Video() {
  return (
    <svg viewBox="0 0 160 110" aria-hidden="true">
      <Grille id="gv" />
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M30 34l70-16 4 14-70 16z" fill="currentColor" fillOpacity=".22" strokeWidth="2" />
        <path d="M44 31l10 12M60 27l10 12M76 23l10 12M92 20l8 10" strokeWidth="2.4" opacity=".75" />
        <rect x="30" y="46" width="76" height="50" rx="6" fill="#0B0E15" strokeWidth="2.2" />
        <path d="M30 58h76" strokeWidth="1.4" opacity=".5" />
        <path d="M61 66v20l17-10z" fill="currentColor" strokeWidth="1.5" />
        {[[118, 12], [124, 26], [130, 18], [136, 34], [142, 22], [148, 10]].map(([x, h], i) => <path key={i} d={`M${x} ${71 - h / 2}v${h}`} strokeWidth="3.2" opacity={0.5 + (i % 3) * 0.2} />)}
        {[52, 62, 72, 82].map((y) => <rect key={y} x="18" y={y} width="5" height="5" rx="1.2" fill="currentColor" fillOpacity=".35" strokeWidth="0" />)}
      </g>
      <Etincelle x={134} y={98} s={0.7} o={0.6} /><Etincelle x={126} y={30} s={0.9} />
    </svg>
  )
}

const ART = { analyst: Analyste, 'creative-prod': CreativeImage, copywriter: Copywriter, 'creative-video': Video }
export function AgentArt({ slug, color }) {
  const C = ART[slug] || Analyste
  return <div className="fx-art" style={{ color }}><C /></div>
}
