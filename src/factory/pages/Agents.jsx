import React from 'react'
import { useNavigate } from 'react-router-dom'
export const AGENTS = [
  { slug: 'analyst', n: 1, name: 'Analyste de Marché', sub: 'Brief client (JSON) → Hypothèse S0→S11, cible + 2 facettes + stock de 10 angles', model: 'gemini-3.1-pro', file: 'COMPETENCE_ANALYSTE.md', color: '#5C7A99', kind: 'analyst', maxTokens: 64000,
    prompt: 'DONNÉES BRUTES :\n[Sources externes (Gemini/Trends/YouTube/Jumia/CSE) non connectées pour ce test — applique RÈGLE #1/#2/#3 de ta compétence : marque chaque point qui en dépendrait par [NON TROUVÉ DANS DONNÉES BRUTES].]\n\nProduis la Synthèse complète S0→S7 selon ta compétence.' },
  { slug: 'creative-prod', n: 2, name: 'Creative Image', sub: 'CT + brief.json + Synthèse → Static ad Meta Ads 4:5', model: 'gemini-2.5-pro + gemini-3-pro-image', file: 'COMPETENCE_CREATIVE_PROD.md', color: '#5AB4FF', kind: 'image', maxTokens: 8000 },
  { slug: 'copywriter', n: 3, name: 'Copywriter', sub: 'Synthèse → chaque angle × (5 hooks + 1 description AIDA)', model: 'gemini-2.5-pro', file: 'COMPETENCE_COPYWRITER_PROD.md', color: '#7FA8D9', kind: 'copy', maxTokens: 8000,
    prompt: 'Produis les Ad Copy complets pour TOUS les angles présents dans la synthèse selon ta compétence — 5 hooks variés + 1 description AIDA paragraphée par angle, registre Most Aware.' },
  { slug: 'creative-video', n: 4, name: 'Créative Vidéo', sub: 'Synthèse + CT vidéo + photos → vidéo montée (service vidéo)', model: 'gemini-3.1-pro + veo-3.1', file: 'COMPETENCE_CREATIVE_VIDEO.md', color: '#E0A458', kind: 'video' },
]
export default function Agents() {
  const nav = useNavigate()
  return (
    <div className="fx-wrap">
      <div className="fx-h"><div><h1>Agents</h1><p>Interfaces de test, une par agent.</p></div></div>
      <div className="fx-ag">{AGENTS.map((a) => (
        <div key={a.slug} className="fx-agc" onClick={() => nav('/agents/' + a.slug)}>
          <div className="fx-agc-h"><span className="fx-badge-n" style={{ background: a.color + '28', color: a.color }}>{a.n}</span><div className="fx-t" style={{ fontSize: 15 }}>{a.name}</div></div>
          <div className="fx-s wrap">{a.sub}</div><div className="fx-s mono">{a.model}</div>
        </div>))}</div>
    </div>
  )
}
