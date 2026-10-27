import React from 'react'
import { useNavigate } from 'react-router-dom'
const AG = [
  { slug: 'analyst', name: 'Analyste de Marché', sub: 'Brief client → hypothèses, cible et stock d’angles', c: '#5C7A99' },
  { slug: 'creative-prod', name: 'Creative Image', sub: 'CT + brief + synthèse → créative statique 4:5', c: '#5AB4FF' },
  { slug: 'copywriter', name: 'Copywriter', sub: 'Angles → textes publicitaires', c: '#E0A458' },
  { slug: 'creative-video', name: 'Créative Vidéo', sub: 'Entrées → vidéo finale (labo vidéo)', c: '#A66BFF' },
]
export default function Agents() {
  const nav = useNavigate()
  return (
    <div className="fx-wrap">
      <div className="fx-h"><div><h1>Agents</h1><p>Interfaces de test, une par agent.</p></div></div>
      <div className="fx-ag">{AG.map((a) => (
        <div key={a.slug} className="fx-agc" onClick={() => nav('/agents/' + a.slug)}>
          <i style={{ background: a.c }} /><div className="fx-t" style={{ fontSize: 15 }}>{a.name}</div><div className="fx-s" style={{ whiteSpace: 'normal' }}>{a.sub}</div>
        </div>))}</div>
    </div>
  )
}
