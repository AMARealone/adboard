// syntheses-coffre-v1 (21 nov. 2026) — Les synthèses du test Analyste rangées sur le serveur, à reprendre sans relancer (ni repayer) l'Analyste.
import React, { useEffect, useState } from 'react'
import { synthesesServeur, syntheseServeur, heureCourte } from '../agentStore'
import { alertDlg } from '../ui'

export default function SynthesesEnregistrees({ cles, onPick, titre }) {
  const [ouvert, setOuvert] = useState(false), [l, setL] = useState(null), [tout, setTout] = useState(false), [busy, setBusy] = useState('')
  const cl = (cles || []).filter(Boolean)
  const charger = async (t) => { setL(null); try { setL(await synthesesServeur(t || !cl.length ? [] : cl)) } catch (e) { setL({ error: e.message }) } }
  useEffect(() => { if (ouvert) charger(tout) }, [ouvert, tout, cl.join(',')])
  const prendre = async (x) => { setBusy(x.id); try { onPick(await syntheseServeur(x.id)); setOuvert(false) } catch (e) { alertDlg('Synthèse illisible : ' + e.message) } finally { setBusy('') } }
  return (
    <div className="fx-fld">
      <button className="fx-btn sm" onClick={() => setOuvert(!ouvert)}>{ouvert ? 'Fermer' : (titre || 'Reprendre une synthèse enregistrée')}</button>
      {ouvert && <div className="fx-hist" style={{ marginTop: 8 }}>
        {cl.length > 0 && <label className="fx-s" style={{ display: 'block', marginBottom: 6 }}><input type="checkbox" checked={tout} onChange={(e) => setTout(e.target.checked)} /> Voir aussi celles des autres commandes</label>}
        {l === null ? <div className="fx-s">Chargement…</div> : !Array.isArray(l) ? <div className="fx-err">Liste illisible : {l.error}</div> : !l.length ? <div className="fx-s">Aucune synthèse enregistrée{cl.length && !tout ? ' pour cette commande' : ''}.</div> :
          l.map((x) => (
            <div key={x.id} className="fx-s wrap" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '6px 0', borderTop: '1px solid var(--bd, #2a2a2a)' }}>
              <span style={{ flex: '1 1 240px', minWidth: 0 }}><b>{heureCourte(x.t)}</b> · {x.titre || 'Test Analyste'} · {Math.round((x.taille || 0) / 1000)} k car.</span>
              <button className="fx-btn sm" disabled={!!busy} onClick={() => prendre(x)}>{busy === x.id ? '…' : 'Reprendre'}</button>
            </div>))}
      </div>}
    </div>
  )
}
