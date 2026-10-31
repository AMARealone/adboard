import React from 'react'
import { Link } from 'react-router-dom'
export default function Legacy({ titre }) {
  return <div className="cx-empty"><b>{titre}</b><div>Cette section n'est pas encore migrée dans la nouvelle version (phases suivantes).</div><a className="cx-btn primary" href="/adstats" target="_blank" rel="noreferrer">Ouvrir dans l'ancien CRM</a></div>
}
