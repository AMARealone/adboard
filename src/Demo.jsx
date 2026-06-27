import { useEffect } from 'react'
import { useParams } from 'react-router-dom'

const C = {
  bg: '#07080C', card: '#0F1219',
  border: 'rgba(255,255,255,0.065)',
  red: '#2D7FF9', redS: 'rgba(45,127,249,0.09)',
  text: '#EEEEF5', sec: '#71709A',
}

export default function Demo() {
  const { slug } = useParams()

  // Redirect vers AdBoard avec la démo chargée dans la vue intégrée
  useEffect(() => {
    if (slug) {
      window.location.replace(`/adboard?demo=${slug}`)
    }
  }, [slug])

  // Fallback pendant le redirect (affiché < 1 seconde)
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh', background: C.bg, gap: 16,
      fontFamily: "'Outfit', sans-serif", color: C.text,
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap');`}</style>
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: `linear-gradient(135deg, ${C.red}, #0B3D91)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, fontWeight: 800, color: '#fff',
      }}>A</div>
      <div style={{ fontSize: 14, color: C.sec }}>Chargement de votre démo...</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: '50%', background: C.red,
            animation: `pulse 1.3s ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
      <style>{`@keyframes pulse { 0%,60%,100%{ opacity:.3; transform:scale(1); } 30%{ opacity:1; transform:scale(1.3); } }`}</style>
    </div>
  )
}
