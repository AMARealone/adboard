// rectifications-v1 (24 nov. 2026) — décision du fondateur : sur chaque VIDÉO livrée, le client peut demander UNE rectification,
// décrite en détail. Elle arrive dans Factory ; la vidéo corrigée remplace l'ancienne dans sa galerie en 24 h au plus.
import React, { useEffect, useState } from 'react'

const SERVER = 'https://adstack-server.onrender.com'
const quand = (ms) => { try { return new Date(ms).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) } catch (_) { return '' } }

export function BoutonRectif({ creative, getToken, tuile, notify }) {
  const [rev, setRev] = useState(undefined)   // undefined = pas encore lu, null = aucune
  const [ouvert, setOuvert] = useState(false)
  const [texte, setTexte] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [err, setErr] = useState('')
  const id = creative && creative.id
  useEffect(() => {
    let vivant = true
    setRev(undefined); setTexte(''); setErr('')
    if (!id || !/_g\d+_\d+$/.test(id)) { setRev(null); return }
    ;(async () => {
      try {
        const t = await getToken(); if (!t) { if (vivant) setRev(null); return }
        const r = await fetch(SERVER + '/revisions/etat?creative_id=' + encodeURIComponent(id), { headers: { Authorization: 'Bearer ' + t } })
        const j = await r.json().catch(() => ({}))
        if (vivant) setRev(j.revision || null)
      } catch (_) { if (vivant) setRev(null) }
    })()
    return () => { vivant = false }
  }, [id])
  if (!id || !/_g\d+_\d+$/.test(id)) return null
  const envoyer = async () => {
    setErr('')
    if (texte.trim().length < 15) { setErr('Décrivez précisément ce qu\'il faut changer.'); return }
    setEnvoi(true)
    try {
      const t = await getToken()
      const r = await fetch(SERVER + '/revisions/demander', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ creative_id: id, texte: texte.trim() }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j.error || 'Envoi impossible, réessayez.'); if (j.revision) setRev(j.revision); return }
      setRev(j.revision); setOuvert(false)
      if (notify) notify('Demande envoyée : votre vidéo rectifiée arrive avant le ' + quand(j.revision.echeance) + '.')
    } catch (_) { setErr('Connexion impossible, réessayez.') } finally { setEnvoi(false) }
  }
  const etat = rev ? (rev.etat === 'livree' ? 'Rectifiée' : rev.etat === 'refusee' ? 'Rectifier' : 'En rectification') : 'Rectifier'
  const actif = !!rev && rev.etat !== 'refusee'
  return (
    <>
      <button onClick={() => setOuvert(true)} data-testid="btn-rectifier" aria-label="Demander une rectification" style={{ ...tuile(actif, 'rgba(245,158,11,0.6)'), color: actif ? '#FBBF24' : '#fff' }}>
        <span style={{ fontSize: 17, lineHeight: 1 }}>✎</span>{etat}
      </button>
      {ouvert && (
        <div onClick={(e) => { e.stopPropagation(); setOuvert(false) }} style={{ position: 'fixed', inset: 0, zIndex: 100001, background: 'rgba(4,5,8,0.72)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Rectification de la vidéo" style={{ width: '100%', maxWidth: 460, background: '#12151C', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 18, padding: 20, color: '#fff', fontFamily: 'inherit', boxShadow: '0 30px 90px rgba(0,0,0,0.6)' }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>Rectifier cette vidéo</div>
            {rev && rev.etat !== 'refusee' ? (
              <>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.55 }}>
                  {rev.etat === 'livree'
                    ? <>La rectification de cette vidéo a été livrée le {quand(rev.livree_t)}. Chaque vidéo comprend une rectification.</>
                    : <>Votre demande est entre les mains de l'équipe. La vidéo rectifiée remplacera celle-ci dans votre galerie avant le <b style={{ color: '#fff' }}>{quand(rev.echeance)}</b>.</>}
                </div>
                <div style={{ marginTop: 12, fontSize: 12.5, color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '10px 12px', whiteSpace: 'pre-wrap' }}>« {rev.texte} »</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.55 }}>Chaque vidéo comprend <b style={{ color: '#fff' }}>une rectification</b>, livrée en 24 h. Dites précisément à quel moment de la vidéo et ce qui doit changer à l'image (geste, produit, décor, expression…).</div>
                <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={5} maxLength={2000} autoFocus placeholder="Ex. : vers 0:08, quand elle montre le produit, on doit voir la boîte de face avec le logo."
                  style={{ width: '100%', boxSizing: 'border-box', marginTop: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 12, color: '#fff', padding: 12, fontSize: 13.5, fontFamily: 'inherit', lineHeight: 1.5, resize: 'vertical' }} />
                {err && <div style={{ marginTop: 8, fontSize: 12.5, color: '#F87171' }}>{err}</div>}
              </>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setOuvert(false)} style={{ height: 42, padding: '0 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.16)', background: 'transparent', color: '#fff', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>Fermer</button>
              {!(rev && rev.etat !== 'refusee') && <button onClick={envoyer} disabled={envoi} style={{ height: 42, padding: '0 18px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#5B8DEF,#1FB6FF)', color: '#fff', fontWeight: 800, fontFamily: 'inherit', cursor: envoi ? 'default' : 'pointer', opacity: envoi ? 0.7 : 1 }}>{envoi ? 'Envoi…' : 'Envoyer la demande'}</button>}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
