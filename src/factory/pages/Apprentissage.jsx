// Page « Apprentissage » (administrateur) : le carnet de chaque client — ce qui gagne, ce qui perd, ce que la prochaine production va faire, et les retours qualité.
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { SERVER } from '../api'
import { toast } from '../ui'

const tok = () => { try { return (JSON.parse(localStorage.getItem('factory_admin_sb_session') || 'null') || {}).access_token || '' } catch (_) { return '' } }
const H = () => ({ 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1', Authorization: 'Bearer ' + tok() })
async function api(chemin, opt) { const r = await fetch(SERVER + chemin, { headers: H(), ...opt }); const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.error || 'HTTP ' + r.status); return j }
const STATUT = { gagnant: ['Gagnant', 'ok'], perdant: ['Perdant', 'er'], a_confirmer: ['À confirmer', 'wait'], gagnante: ['Gagnante', 'ok'], candidate: ['Candidate', 'prod'], moyenne: ['Moyenne', 'wait'], perdante: ['Perdante', 'er'], perdante_faible: ['Faible', 'wait'], trop_tot: ['Trop tôt', 'wait'] }
const Pastille = ({ s }) => { const [l, c] = STATUT[s] || [s, 'wait']; return <span className={'fx-tag ' + (c === 'ok' ? 'done' : c === 'er' ? '' : c)} style={c === 'er' ? { color: 'var(--er)', borderColor: 'rgba(229,80,80,.5)' } : undefined}>{l}</span> }
const pct = (x) => (x === null || x === undefined ? '—' : Math.round(x * 100) + ' %')
const taux = (b) => (b && b.n ? Math.round(100 * b.reussites / b.n) + ' % (' + b.reussites + '/' + b.n + ')' : '—')

function Barre({ r }) {
  const tot = Math.max(1, r.exploit + r.voisins + r.exploration)
  const seg = [['Reprise', r.exploit, 'var(--ok)'], ['Voisin', r.voisins, 'var(--ac)'], ['Exploration', r.exploration, 'var(--pu)']]
  return <div>
    <div className="fxap-bar">{seg.map(([l, n, c]) => n > 0 && <div key={l} style={{ flex: n / tot, background: c }} title={l + ' : ' + n}>{n}</div>)}</div>
    <div className="fxap-leg">{seg.map(([l, n, c]) => <span key={l}><i style={{ background: c }} />{l} {n}</span>)}</div>
  </div>
}

function Cible({ c, produit }) {
  const p = c.prochaine_production
  return <div className="fx-card" style={{ marginBottom: 14 }}>
    <h2>{produit} · {c.cible} <span className="fx-tag">{c.nb_chiffrees} chiffrée(s) sur {c.nb_livrees} livrée(s)</span></h2>
    <div className="fxap-grid">
      <div>
        <div className="fxap-t">Prochaine production ({p.nbAngles} angles)</div>
        <Barre r={p.ratio} />
        <div className="fxap-s">{p.ratio.raison}</div>
        {p.exploit.length > 0 && <div className="fxap-b"><b>À reprendre :</b> {p.exploit.map((a) => a.nom + (a.indice ? ' (indice ' + a.indice + ', ' + a.confiance + ')' : ' (' + a.confiance + ')')).join(' · ')}</div>}
        {p.epuises.length > 0 && <div className="fxap-b"><b>Au repos :</b> {p.epuises.map((a) => a.nom + ' (' + a.reprises + ' reprises)').join(' · ')}</div>}
        {p.perdants.length > 0 && <div className="fxap-b"><b>À ne pas reconduire :</b> {p.perdants.map((a) => a.nom + ' (' + a.indice + ')').join(' · ')}</div>}
        {p.ctGagnant && <div className="fxap-b"><b>CT gagnant à rejouer sur un nouvel angle :</b> {p.ctGagnant.ctId} (indice {p.ctGagnant.indice}, {p.ctGagnant.format})</div>}
        {p.ctSatures.length > 0 && <div className="fxap-b"><b>CT saturés :</b> {p.ctSatures.join(', ')}</div>}
        {p.qualite.consignes.length > 0 && <div className="fxap-b"><b>Consignes qualité appliquées :</b> {p.qualite.consignes.length}</div>}
      </div>
      <div>
        <div className="fxap-t">Réussite mesurée du ratio</div>
        <table className="fxap-tb"><tbody>
          <tr><td>Reprises de gagnants</td><td>{taux(c.bilan.exploit)}</td></tr>
          <tr><td>Tests (angles neufs)</td><td>{taux(c.bilan.test)}</td></tr>
          <tr><td>CT gagnant rejoué</td><td>{taux(c.bilan.ct_gagnant)}</td></tr>
        </tbody></table>
        <div className="fxap-s">Réussite = créative « gagnante » ou « candidate ». Il est normal que la plupart des tests échouent.</div>
      </div>
    </div>
    <details><summary>Angles ({c.angles.length}) et créatives chiffrées ({c.creatives.length})</summary>
      <table className="fxap-tb"><thead><tr><th>Angle</th><th>Statut</th><th>Indice</th><th>Créatives</th><th>Dans le haut</th><th>Ventes</th><th>Reprises</th></tr></thead><tbody>
        {c.angles.map((a) => <tr key={a.nom}><td>{a.nom}</td><td><Pastille s={a.statut} />{a.confiance ? ' ' + a.confiance : ''}</td><td>{a.indice}</td><td>{a.n}</td><td>{a.nTop}</td><td>{a.achats}</td><td>{a.reprises}</td></tr>)}
      </tbody></table>
      <table className="fxap-tb"><thead><tr><th>Rang</th><th>Créative</th><th>Angle</th><th>Format</th><th>CT</th><th>Concept</th><th>Indice</th><th>Fiabilité</th><th>Statut</th></tr></thead><tbody>
        {c.creatives.map((x) => <tr key={x.id}><td>{x.rang}/{x.sur}</td><td>{String(x.id).slice(-6)}</td><td>{x.angle}</td><td>{x.format}</td><td>{x.ct || '—'}</td><td>{(x.tags || []).join(', ')}</td><td>{x.indice}</td><td>{x.fiabilite}</td><td><Pastille s={x.statut} /></td></tr>)}
      </tbody></table>
    </details>
  </div>
}


function BoussoleClient({ b }) {
  const [prod, setProd] = useState('')
  useEffect(() => { if (!prod && b && b.agents[0]) setProd(b.agents[0].id) }, [b, prod])
  const ag = b.agents.find((a) => String(a.id) === String(prod)) || b.agents[0]
  return <div className="fx-card" style={{ marginBottom: 14 }}>
    <h2>Boussole du client — ses avis dans AdBoard <span className="fx-tag">{b.n} avis</span> <span className="fx-tag">{b.nb_creatives} sur des créatives</span></h2>
    {b.n === 0 ? <div className="fxap-s">Ce client n'a encore donné aucun avis (page « Votre regard » ou bouton « Donner mon avis » dans la galerie). Dès son premier avis, ses goûts sont envoyés aux agents.</div> : <>
      <div className="fxap-grid">
        <div>
          <div className="fxap-t">Sensibilité créative (curseurs 1 à 5)</div>
          {b.axes.map((a) => <div key={a.cle} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{a.lib} {a.n ? <span className="fx-tag">{String(a.moy).replace('.', ',')}/5 · {a.n} avis{a.n < 2 ? ' (hypothèse)' : ''}</span> : <span style={{ color: 'var(--sec)', fontWeight: 400 }}>— pas d'avis</span>}</div>
            <div className="fxap-ax">{a.n > 0 && <i style={{ left: ((a.moy - 1) / 4 * 100) + '%' }} />}</div>
            <div className="fxap-axl"><span>{a.bas}</span><span>{a.haut}</span></div>
          </div>)}
        </div>
        <div>
          {b.aime.length > 0 && <div className="fxap-b"><b>Ce qu'il adore :</b> {b.aime.map((x) => x.lib + (x.n > 1 ? ' ×' + x.n : '')).join(' · ')}</div>}
          {b.affiner.length > 0 && <div className="fxap-b"><b>Ce qu'il voudrait voir évoluer (goût) :</b> {b.affiner.map((x) => x.lib + (x.n > 1 ? ' ×' + x.n : '')).join(' · ')}</div>}
          {b.adorees.length > 0 && <div className="fxap-b"><b>Créatives adorées :</b> {b.adorees.map((x) => (x.angle || 'créative') + ' (' + (x.ct || 'CT ?') + ', ' + x.format + ')').join(' · ')}</div>}
          {b.mal_recues.length > 0 && <div className="fxap-b"><b>Créatives à retravailler :</b> {b.mal_recues.map((x) => (x.angle || 'créative') + ' (' + (x.ct || 'CT ?') + ', ' + x.format + ')').join(' · ')}</div>}
          <div className="fxap-t" style={{ marginTop: 14 }}>Dans ses mots</div>
          {b.verbatims.length ? b.verbatims.slice(0, 8).map((q, i) => <div key={i} className="fxap-q">{q.type === 'aime' ? '♥ ' : '✎ '}« {q.texte} »{q.angle && q.portee !== 'general' ? <span style={{ color: 'var(--sec)' }}> — {q.angle}</span> : null}{q.suspect ? <span className="fx-tag" style={{ marginLeft: 6, color: 'var(--er)' }}>jamais envoyé aux agents (ressemble à une consigne)</span> : null}</div>) : <div className="fxap-s">Aucun texte écrit.</div>}
        </div>
      </div>
      <details><summary>Ce que reçoit chaque agent de ce client</summary>
        <select className="fxap-in" style={{ width: 'auto' }} value={prod} onChange={(e) => setProd(e.target.value)}>{b.agents.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}</select>
        {ag && [['Agent copy', ag.copy], ['Agent image', ag.image], ['Agent vidéo', ag.video], ['Choix du CT', ag.ct_base], ['Analyste', ag.analyste]].map(([t, x]) => <div key={t}><div className="fxap-t" style={{ marginTop: 10 }}>{t}</div>{x ? <div className="fxap-pre">{x}</div> : <div className="fxap-s">Rien à envoyer pour l'instant.</div>}</div>)}
        {ag && ag.ct_mal_recus.length > 0 && <div className="fxap-b"><b>CT écartés des choix :</b> {ag.ct_mal_recus.join(', ')}</div>}
        {ag && ag.ct_adores.length > 0 && <div className="fxap-b"><b>CT adorés (points de départ de style) :</b> {ag.ct_adores.join(', ')}</div>}
      </details></>}
  </div>
}

function Retours({ v, recharger }) {
  const [prod, setProd] = useState(''), [codes, setCodes] = useState([]), [grav, setGrav] = useState(2), [com, setCom] = useState(''), [lot, setLot] = useState(''), [cmd, setCmd] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => { if (!prod && v.produits[0]) setProd(v.produits[0].id) }, [v, prod])
  const bascule = (c) => setCodes((l) => l.includes(c) ? l.filter((x) => x !== c) : [...l, c])
  const envoyer = async () => {
    setBusy(true)
    try { await api('/learning/retour', { method: 'POST', body: JSON.stringify({ product_id: prod, user_id: v.user_id, codes, gravite: grav, commentaire: com, lot, commande_id: cmd, source: 'admin' }) }); toast('Retour enregistré : il sera appliqué à la prochaine production de ce client.'); setCodes([]); setCom(''); recharger() }
    catch (e) { toast(e.message, 7000) } finally { setBusy(false) }
  }
  return <div className="fx-card" style={{ marginBottom: 14 }}>
    <h2>Retours qualité <span className="fx-tag">{v.qualite.total}</span></h2>
    <div className="fxap-grid">
      <div>
        <div className="fxap-t">Enregistrer un retour du client</div>
        <select className="fxap-in" value={prod} onChange={(e) => setProd(e.target.value)}>{v.produits.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}</select>
        <div className="fxap-chips">{v.defauts.map((d) => <button key={d.code} className={'fx-pill' + (codes.includes(d.code) ? ' on' : '')} onClick={() => bascule(d.code)}>{d.lib}</button>)}</div>
        <div className="fxap-row">Gravité : {[1, 2, 3].map((g) => <label key={g}><input type="radio" checked={grav === g} onChange={() => setGrav(g)} /> {['gênant', 'à refaire', 'inacceptable'][g - 1]}</label>)}</div>
        <input className="fxap-in" placeholder="Lot / semaine concernée (facultatif)" value={lot} onChange={(e) => setLot(e.target.value)} />
        <input className="fxap-in" placeholder="N° de commande concernée (facultatif, pour retrouver le dossier complet)" value={cmd} onChange={(e) => setCmd(e.target.value)} />
        <textarea className="fxap-in" rows={3} placeholder="Ce que le client a dit, avec ses mots (facultatif)" value={com} onChange={(e) => setCom(e.target.value)} />
        <button className="fx-btn primary" disabled={busy || (!codes.length && !com.trim())} onClick={envoyer}>{busy ? '…' : 'Enregistrer le retour'}</button>
      </div>
      <div>
        <div className="fxap-t">Défauts qui reviennent chez ce client</div>
        {v.qualite.par_code.length ? <table className="fxap-tb"><tbody>{v.qualite.par_code.map((d) => <tr key={d.code}><td>{d.lib}</td><td>{d.n} fois</td><td>{d.creatives} créative(s)</td></tr>)}</tbody></table> : <div className="fxap-s">Aucun retour enregistré.</div>}
        {v.qualite.consignes.length > 0 && <div className="fxap-s">Ces défauts sont déjà transformés en consignes pour les agents image et vidéo de ce client. Pour améliorer les agents pour TOUS les clients : télécharge le dossier complet de la commande concernée (bouton dans Production) et envoie-le à Claude.</div>}
        {v.retours.slice(0, 8).map((r) => <div key={r.id} className="fxap-ret">{(r.date || '').slice(0, 10)} · {(r.codes || []).join(', ')}{r.commentaire ? ' — « ' + r.commentaire + ' »' : ''}</div>)}
      </div>
    </div>
  </div>
}

export default function Apprentissage() {
  const [liste, setListe] = useState(null), [uid, setUid] = useState(''), [n, setN] = useState(4), [v, setV] = useState(null), [err, setErr] = useState(''), [chg, setChg] = useState(false)
  useEffect(() => { api('/learning/clients').then((l) => { setListe(l); if (l.clients[0]) setUid(l.clients[0].user_id) }).catch((e) => setErr(e.message)) }, [])
  const charger = useCallback(() => { if (!uid) return; setChg(true); setErr(''); api('/learning/client?user_id=' + encodeURIComponent(uid) + '&nb_angles=' + n).then(setV).catch((e) => setErr(e.message)).finally(() => setChg(false)) }, [uid, n])
  useEffect(() => { charger() }, [charger])
  const cl = useMemo(() => (liste ? liste.clients.find((c) => c.user_id === uid) : null), [liste, uid])
  const tauxTests = useMemo(() => { if (!v) return null; const b = { n: 0, r: 0 }; v.produits.forEach((p) => p.cibles.forEach((c) => { b.n += c.bilan.test.n; b.r += c.bilan.test.reussites })); return b }, [v])
  return <div className="fx-page">
    <style>{`.fxap-grid{display:grid;grid-template-columns:1.2fr 1fr;gap:22px}@media(max-width:900px){.fxap-grid{grid-template-columns:1fr}}.fxap-t{font-size:12px;font-weight:700;color:var(--sec);text-transform:uppercase;letter-spacing:.05em;margin:0 0 8px}.fxap-s{font-size:12px;color:var(--sec);margin-top:6px;line-height:1.45}.fxap-b{font-size:13px;margin-top:7px;line-height:1.45}.fxap-bar{display:flex;height:26px;border-radius:8px;overflow:hidden;gap:2px}.fxap-bar>div{display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700}.fxap-leg{display:flex;gap:14px;font-size:12px;color:var(--sec);margin-top:6px}.fxap-leg i{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:5px}.fxap-tb{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:8px}.fxap-tb th,.fxap-tb td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--bd)}.fxap-in{width:100%;box-sizing:border-box;background:var(--bg);border:1px solid var(--bd2);border-radius:8px;color:inherit;padding:8px 10px;margin:6px 0;font:inherit}.fxap-chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.fxap-chips .fx-pill.on{background:var(--ac);border-color:var(--ac);color:#fff}.fxap-row{display:flex;gap:14px;font-size:13px;margin:6px 0;flex-wrap:wrap}.fxap-ret{font-size:12px;color:var(--sec);margin-top:6px}.fxap-ax{position:relative;height:6px;border-radius:6px;background:var(--bd2);margin:8px 7px 4px}.fxap-ax i{position:absolute;top:-4px;width:14px;height:14px;border-radius:50%;background:var(--ac);transform:translateX(-50%);box-shadow:0 0 0 3px rgba(91,141,239,.25)}.fxap-axl{display:flex;justify-content:space-between;font-size:11px;color:var(--sec)}.fxap-pre{white-space:pre-wrap;font-size:12px;line-height:1.45;background:var(--bg);border:1px solid var(--bd);border-radius:8px;padding:10px;margin:6px 0;max-height:260px;overflow:auto}.fxap-q{font-size:13px;margin-top:7px;line-height:1.45;padding-left:10px;border-left:2px solid var(--bd2)}.fxap-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px}.fxap-kpi{background:var(--card);border:1px solid var(--bd);border-radius:12px;padding:12px 14px}.fxap-kpi b{display:block;font-size:20px}.fxap-kpi span{font-size:11.5px;color:var(--sec)}details summary{cursor:pointer;font-size:13px;font-weight:600;margin-top:12px}`}</style>
    <div className="fx-h"><div><h1>Apprentissage</h1></div>
      <div className="fx-btnrow">
        <select className="fxap-in" style={{ width: 'auto', margin: 0 }} value={uid} onChange={(e) => setUid(e.target.value)}>{(liste ? liste.clients : []).map((c) => <option key={c.user_id} value={c.user_id}>{(c.email || c.nom || c.user_id.slice(0, 8)) + ' — ' + c.produits.length + ' produit(s), ' + c.nb_chiffrees_total + ' chiffrée(s)'}</option>)}</select>
        <select className="fxap-in" style={{ width: 'auto', margin: 0 }} value={n} onChange={(e) => setN(parseInt(e.target.value, 10))}>{[2, 4, 6, 8].map((k) => <option key={k} value={k}>Plan pour {k} angles ({k * 3} créatives)</option>)}</select>
        <button className="fx-btn" onClick={charger}>↻ Actualiser</button>
      </div></div>
    {err && <div className="fx-banner err">{err}</div>}
    {liste && !liste.table_evenements && <div className="fx-banner warn">La table des retours qualité n'existe pas encore : exécute le fichier SQL learning_events.sql dans Supabase (SQL Editor). Le reste fonctionne sans.</div>}
    {chg && <div className="fx-banner info"><span className="fx-spin sm" /> Calcul du carnet…</div>}
    {v && cl && <>
      <div className="fxap-kpis">
        <div className="fxap-kpi"><b>{cl.produits.length}</b><span>produit(s)</span></div>
        <div className="fxap-kpi"><b>{cl.produits.reduce((s, p) => s + p.nb_lots, 0)}</b><span>lots livrés</span></div>
        <div className="fxap-kpi"><b>{pct(cl.produits.reduce((s, p) => s + p.nb_creatives, 0) ? cl.nb_chiffrees_total / cl.produits.reduce((s, p) => s + p.nb_creatives, 0) : null)}</b><span>créatives avec chiffres</span></div>
        <div className="fxap-kpi"><b>{tauxTests && tauxTests.n ? Math.round(100 * tauxTests.r / tauxTests.n) + ' %' : '—'}</b><span>tests qui ont réussi</span></div>
        <div className="fxap-kpi"><b>{v.usage_ct.length}</b><span>CT déjà utilisés (sur {v.galerie.balises} balisés)</span></div>
        <div className="fxap-kpi"><b>{v.qualite.total}</b><span>retours qualité</span></div>
        {v.boussole && <div className="fxap-kpi"><b>{v.boussole.n}</b><span>avis du client (boussole)</span></div>}
      </div>
      {v.produits.map((p) => p.cibles.length ? p.cibles.map((c, i) => <Cible key={p.id + i} c={c} produit={p.nom} />) : <div key={p.id} className="fx-card" style={{ marginBottom: 14 }}><h2>{p.nom}</h2><div className="fxap-s">Aucune créative avec des chiffres : tout sera testé à la prochaine production. Demande au client d'entrer ses chiffres dans Top Performer.</div></div>)}
      {v.concepts.length > 0 && <div className="fx-card" style={{ marginBottom: 14 }}><h2>Concepts (structure / style de CT) sur tout le client</h2>
        <table className="fxap-tb"><thead><tr><th>Concept</th><th>Statut</th><th>Indice</th><th>Créatives</th><th>Angles différents</th></tr></thead><tbody>{v.concepts.slice(0, 14).map((c) => <tr key={c.tag}><td>{c.tag}</td><td><Pastille s={c.statut} /></td><td>{c.indice}</td><td>{c.n}</td><td>{c.angles}</td></tr>)}</tbody></table>
        <div className="fxap-s">Un concept ne gagne que s'il se répète sur au moins 3 créatives et 2 angles différents : un gagnant prouve une combinaison, pas un élément.</div></div>}
      {v.boussole && <BoussoleClient b={v.boussole} />}
      <Retours v={v} recharger={charger} />
    </>}
    {!v && !chg && !err && <div className="fx-empty">Aucun client.</div>}
  </div>
}
