import React, { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'

// Affiche une partie de l'ancien Factory (mode intégré, sans son menu) tant qu'elle n'est pas reconstruite en React.
export function LegacyFrame({ path, cmd }) {
  const ref = useRef(null)
  const [ready, setReady] = useState(false)
  useEffect(() => { setReady(false) }, [path])
  const onLoad = () => {
    setReady(true)
    if (cmd) {
      let tries = 0
      const t = setInterval(() => {
        try { const w = ref.current.contentWindow; if (typeof w.lancerProduction === 'function') { clearInterval(t); w.lancerProduction(cmd) } } catch (_) {}
        if (++tries > 40) clearInterval(t)
      }, 400)
    }
  }
  return (
    <div className="fx-framewrap">
      {!ready && <div className="fx-loading">Chargement…</div>}
      <iframe ref={ref} key={path} className="fx-frame" title="Factory" src={`/factory/${path}?embed=1`} onLoad={onLoad} />
    </div>
  )
}
export const Production = () => { const [sp] = useSearchParams(); return <LegacyFrame path={sp.get('cmd') ? 'orders' : 'production'} cmd={sp.get('cmd')} /> }
export const Fichiers = () => <LegacyFrame path="files" />
export const AgentFrame = () => { const { slug } = useParams(); return <LegacyFrame path={'agent/' + slug} /> }
export const GestionImage = () => <LegacyFrame path="gallery" />
export const GestionVideo = () => <LegacyFrame path="video-gallery" />
