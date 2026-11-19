import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useData } from '../data'
import { etat, getCtImages, getCtVideos, prio, SERVER, calendrierCommande } from '../api'
import { OrderRow } from './Commandes'
import Icon from '../Icon'

const tok = () => { try { return (JSON.parse(localStorage.getItem('factory_admin_sb_session') || 'null') || {}).access_token || '' } catch (_) { return '' } }
const heure = (t) => new Date(t).toLocaleString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })

// La chaîne : une commande avance de station en station, de gauche à droite
const STATIONS = [
  { k: 'wait', label: 'En attente', d: 'Le client peut encore annuler', icon: 'clock', c: 'var(--wa)' },
  { k: 'prod', label: 'En production', d: 'Les agents travaillent', icon: 'bolt', c: 'var(--ac)' },
  { k: 'ready', label: 'Prêtes à envoyer', d: 'À vérifier puis envoyer', icon: 'check', c: 'var(--pu)' },
  { k: 'done', label: 'Livrées', d: 'Chez le client', icon: 'send', c: 'var(--ok)' },
]

export default function Dashboard() {
  const { cmd, reload, srv } = useData()
  const nav = useNavigate()
  const [ct, setCt] = useState({ img: null, vid: null })
  const [auto, setAuto] = useState(null)
  useEffect(() => {
    getCtImages().then((l) => setCt((p) => ({ ...p, img: l.length }))).catch(() => setCt((p) => ({ ...p, img: '–' })))
    getCtVideos().then((l) => setCt((p) => ({ ...p, vid: l.length }))).catch(() => setCt((p) => ({ ...p, vid: '–' })))
    fetch(SERVER + '/auto/dossiers', { headers: { Authorization: 'Bearer ' + tok() } }).then((r) => r.json()).then((j) => setAuto(j && j.reglages ? j : { reglages: {}, dossiers: [] })).catch(() => setAuto({ reglages: {}, dossiers: [], erreur: true }))
  }, [])
  const n = (k) => cmd.list.filter((b) => etat(b).key === k).length
  const top = [...cmd.list].sort((a, b) => etat(a).rang - etat(b).rang || prio(a) - prio(b) || new Date(b.created_at) - new Date(a.created_at)).filter((b) => etat(b).rang < 3).slice(0, 6)
  // Prochains événements de la production automatique
  const prochains = useMemo(() => {
    const now = Date.now(), l = []
    cmd.list.forEach((b) => {
      const c = calendrierCommande(b), nom = b.product?.nom || 'Commande'
      if (b.status === 'pending' && c.finAttente > now) l.push({ t: c.finAttente, txt: 'Démarrage automatique', nom })
      if ((b.status === 'pending' || b.status === 'in_production') && c.envoi > now) l.push({ t: c.envoi, txt: 'Heure d’envoi', nom })
    })
    return l.sort((a, b) => a.t - b.t).slice(0, 3)
  }, [cmd.list])
  const h = new Date().getHours()
  const salut = h < 5 ? 'Bonne nuit' : h < 18 ? 'Bonjour' : 'Bonsoir'
  const jour = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const R = (auto && auto.reglages) || {}
  return (
    <div className="fx-wrap">
      <div className="fx-h"><div><div className="fx-kicker">{jour}</div><h1>{salut}</h1><p>Voici l’état de l’atelier : ce qui avance, ce qui attend ton regard.</p></div>
        <button className="fx-btn" onClick={reload}><Icon n="refresh" /> Actualiser</button></div>

      <div className="fx-line">
        {STATIONS.map((s, i) => (
          <React.Fragment key={s.k}>
            <button className={'fx-sta' + (s.k === 'ready' && n('ready') ? ' hot' : '')} style={{ '--c': s.c }} onClick={() => nav('/commandes?f=' + s.k)}>
              <span className="fx-sta-i"><Icon n={s.icon} /></span>
              <b>{cmd.loading ? '…' : n(s.k)}</b>
              <span className="fx-sta-l">{s.label}</span>
              <small>{s.d}</small>
            </button>
            {i < STATIONS.length - 1 && <span className="fx-conv" aria-hidden="true"><i /><i /><i /></span>}
          </React.Fragment>
        ))}
      </div>

      <div className="fx-grid2">
        <div className="fx-card"><div className="fx-card-h"><h2>À traiter en priorité</h2><Link to="/commandes" className="fx-lnk">Toutes les commandes <Icon n="arrow" /></Link></div>
          {cmd.error && <div className="fx-err">{cmd.error}</div>}
          {cmd.loading ? <><div className="fx-skel" /><div className="fx-skel" /></> : top.length ? top.map((b) => <OrderRow key={b.id} b={b} compact />) : <div className="fx-empty"><b>Rien à traiter.</b><br />Les nouvelles demandes de tes clients apparaîtront ici.</div>}
        </div>
        <div className="fx-col">
          <div className="fx-card fx-auto">
            <div className="fx-card-h"><h2>Production automatique</h2>{auto && <span className={'fx-pill2 ' + (R.production_auto ? 'ok' : 'off')}><i />{R.production_auto ? 'Allumée' : 'Éteinte'}</span>}</div>
            {!auto ? <div className="fx-skel" style={{ height: 60 }} /> : <>
              <p className="fx-s wrap">{R.production_auto
                ? 'Après l’attente, les agents produisent seuls dans le cloud. Tu es prévenu par email dès qu’un lot est prêt à vérifier.'
                : auto.erreur ? 'Réglages illisibles : le serveur n’a pas répondu.' : 'Le serveur n’a pas la clé de l’ouvrier (AUTO_PROD_SECRET sur Render) : tu reçois un rappel à la fin de l’attente et tu lances la production toi-même.'}</p>
              <div className="fx-kvr"><span>Envoi au client</span><b>{R.envoi_auto ? 'Automatique' : 'Par toi'}</b></div>
              <div className="fx-kvr"><span>Dossiers conservés</span><b>{(auto.dossiers || []).length}</b></div>
              {prochains.length > 0 && <div className="fx-next">{prochains.map((p, i) => <div key={i}><Icon n="clock" /><span><b>{p.txt}</b> · {p.nom}</span><em>{heure(p.t)}</em></div>)}</div>}
            </>}
          </div>
          <div className="fx-card"><div className="fx-card-h"><h2>Bibliothèques</h2></div>
            <Link to="/galerie" className="fx-lib"><span className="fx-lib-i"><Icon n="image" /></span><div className="fx-grow"><div className="fx-t">CT image</div><div className="fx-s">Créatives modèles</div></div><b>{ct.img ?? '…'}</b></Link>
            <Link to="/galerie-video" className="fx-lib"><span className="fx-lib-i v"><Icon n="film" /></span><div className="fx-grow"><div className="fx-t">CT vidéo</div><div className="fx-s">Créatives modèles vidéo</div></div><b>{ct.vid ?? '…'}</b></Link>
            <div className="fx-lib"><span className={'fx-lib-i ' + (srv.ok ? 'ok' : srv.ok === false ? 'er' : '')}><Icon n="server" /></span><div className="fx-grow"><div className="fx-t">Serveur de production</div><div className="fx-s">{srv.ok === null ? 'Vérification…' : srv.ok ? `En ligne · ${srv.ms} ms` : 'Injoignable (il se réveille parfois en ~30 s)'}</div></div></div>
          </div>
        </div>
      </div>
    </div>
  )
}
