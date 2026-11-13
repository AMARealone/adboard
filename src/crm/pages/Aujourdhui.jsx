import React, { useMemo } from 'react'
import { useCrm } from '../store'
import { aFaire, ecritActif, ecritB1Saute } from '../domain/rules'
import { ECRIT_ETAPES } from '../domain/defaults'
import { N, duree } from '../domain/notes'
import { pitchVariante } from '../domain/messages'
import { BoutonMajAds } from './MajAds'
import { Chip, Icon } from '../ui'
import { Bars, Ring } from '../charts'
import { usePref, ecrirePref } from '../prefs'
import { useNavigate } from 'react-router-dom'

const jourLocal = (d) => new Date(d).toLocaleDateString('sv-SE')
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'], MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

export default function Aujourdhui() {
  const { prospects, cfg, ouvrirFiche, A } = useCrm(), nav = useNavigate()
  const [obj, setObj] = usePref('obj_contacts', 30)
  const t = aFaire(prospects, cfg)
  const adsAMajour = prospects.filter((p) => { const n = N(p); return n.ecrit_etat === 'actif' && !n.ecrit_sent_b1 && !ecritB1Saute(n) && !pitchVariante(p, cfg).maj }).length
  const total = t.appels.length + t.noshow.length + t.closing.length + t.ecrit.length + t.relances.length + t.acheteurs.length
  const aContacter = prospects.filter((p) => p.statut === 'a_contacter').length
  const pitchs = prospects.filter((p) => { const n = N(p); return p.statut === 'en_suivi' && p.a_repondu && !n.pitch_envoye && !n.pas_interesse && !ecritActif(p) }).length
  const serie = useMemo(() => {
    const m = {}; prospects.forEach((p) => { if (p.date_contact) { const k = jourLocal(p.date_contact); m[k] = (m[k] || 0) + 1 } })
    const out = []; for (let k = 13; k >= 0; k--) { const d = new Date(Date.now() - k * 86400000), j = jourLocal(d); out.push({ l: d.getDate() + '/' + (d.getMonth() + 1), v: m[j] || 0, hl: k === 0 }) }
    return out
  }, [prospects])
  const auj = serie[serie.length - 1].v, hier = serie[serie.length - 2].v, moy7 = Math.round(serie.slice(-8, -1).reduce((s, x) => s + x.v, 0) / 7)
  const d = new Date()
  const ouvrir = (to, pref) => { if (pref) ecrirePref(pref[0], pref[1]); nav(to) }
  const Bloc = ({ titre, to, items, children }) => items.length > 0 && (
    <section className="cx-bloc"><header><b>{titre}</b><Chip c="bl">{items.length}</Chip><button className="cx-lnk" onClick={() => nav(to)}>Tout ouvrir →</button></header>{children}</section>)
  const Ligne = ({ p, chips, action }) => <div className="cx-li"><button className="cx-name" onClick={() => ouvrirFiche(p.id)}>{p.nom_marque || '—'}</button><span className="cx-meta">{p.produit}</span>{chips}{action}</div>
  const Tuile = ({ ic, l, v, s, to, hot, pref }) => <button className={'cx-gotile' + (hot && v > 0 ? ' hot' : '') + (v === 0 ? ' zero' : '')} onClick={() => ouvrir(to, pref)}><span className="t"><Icon n={ic} s={15} />{l}</span><b>{v}</b><small>{s}</small></button>
  return (<>
    <div className="cx-today">
      <div className="cx-big">
        <Ring v={auj} max={obj} size={96} label="Contacts envoyés aujourd'hui" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3>{JOURS[d.getDay()][0].toUpperCase() + JOURS[d.getDay()].slice(1)} {d.getDate()} {MOIS[d.getMonth()]}</h3>
          <p>{auj >= obj ? 'Objectif atteint 🎯' : auj + ' contactés sur ' + obj + ' · il en reste ' + (obj - auj)} · {aContacter} prospects en attente</p>
          <div className="cx-bar2">
            <button className="cx-btn primary" onClick={() => nav('/a-contacter')}><Icon n="send" s={15} /> Contacter</button>
            <span className="cx-step2" title="Objectif du jour"><button onClick={() => setObj(Math.max(5, obj - 5))} aria-label="Moins">−</button><b style={{ minWidth: 30, textAlign: 'center' }}>{obj}</b><button onClick={() => setObj(obj + 5)} aria-label="Plus">+</button></span>
          </div>
        </div>
      </div>
      <section className="cx-bloc" style={{ margin: 0 }}><header><b>Contactés par jour</b><span className="cx-note">hier {hier} · moy. 7 j {moy7}</span></header><div className="cx-pad"><Bars data={serie} h={84} /></div></section>
    </div>
    <div className="cx-go">
      <Tuile ic="send" l="À contacter" v={aContacter} s="dans la file" to="/a-contacter" />
      <Tuile ic="eye" l="Pitch à envoyer" v={pitchs} s="ont répondu" to="/suivi" hot pref={['suivi_f', 'pitch']} />
      <Tuile ic="phone" l="Appels" v={t.appels.length + t.noshow.length} s={t.noshow.length ? t.noshow.length + ' no-show' : 'du jour'} to="/appels" hot />
      <Tuile ic="check" l="Closing" v={t.closing.length} s="relances dues" to="/closing" hot />
      <Tuile ic="pen" l="Closing écrit" v={t.ecrit.length} s="prochain bloc" to="/ecrit" hot />
      <Tuile ic="flame" l="Relances leads" v={t.relances.length} s="dues" to="/leads" hot />
      <Tuile ic="star" l="Acheteurs" v={t.acheteurs.length} s="étape à faire" to="/acheteurs" hot />
    </div>
    {adsAMajour > 0 && <div className="cx-banner wa">{adsAMajour} prospect{adsAMajour > 1 ? 's' : ''} en Écrit {adsAMajour > 1 ? 'ont' : 'a'} besoin des ads à jour avant l'audit : lance « Ads J+3 » sur ton PC. <BoutonMajAds compact /></div>}
    {total === 0 && <section className="cx-bloc"><div className="cx-pad" style={{ textAlign: 'center', color: 'var(--sec)' }}>Rien d'urgent côté relances 🎉 : tout ce qui est dû est traité. Le plus utile maintenant : contacter de nouveaux prospects.</div></section>}
    <Bloc titre="No-show à appliquer" to="/appels" items={t.noshow}>{t.noshow.map(({ p, depuis }) => <Ligne key={p.id} p={p} chips={<Chip c="wa">programmé il y a {duree(depuis)}</Chip>} action={<button className="cx-btn sm" onClick={() => A.noShow(p.id, true)}>Marquer no-show</button>} />)}</Bloc>
    <Bloc titre="Appels du jour" to="/appels" items={t.appels}>{t.appels.map(({ p, retard, at }) => <Ligne key={p.id} p={p} chips={retard ? <Chip c="red">en retard de {duree(Date.now() - at)}</Chip> : <Chip c="bl">{new Date(at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Chip>} />)}</Bloc>
    <Bloc titre="Closing à envoyer" to="/closing" items={t.closing}>{t.closing.map(({ p, j, age }) => <Ligne key={p.id} p={p} chips={<Chip c="red">Relance J+{j} · appel il y a {age} j</Chip>} />)}</Bloc>
    <Bloc titre="Closing écrit : prochain bloc" to="/ecrit" items={t.ecrit}>{t.ecrit.map(({ p, etape }) => <Ligne key={p.id} p={p} chips={<Chip c="bl">{(ECRIT_ETAPES.find((e) => e.key === etape) || {}).label}</Chip>} />)}</Bloc>
    <Bloc titre="Acheteurs : étape à faire" to="/acheteurs" items={t.acheteurs}>{t.acheteurs.map(({ p, etape }) => <Ligne key={p.id} p={p} chips={<Chip c="bl">J+{etape.jour} · {etape.label}</Chip>} />)}</Bloc>
    <Bloc titre="Relances leads" to="/leads" items={t.relances}>{t.relances.map(({ p, j, retard }) => <Ligne key={p.id} p={p} chips={<Chip c={retard > 0 ? 'red' : 'bl'}>J+{j}{retard > 0 ? ' · ' + retard + ' j de retard' : ''}</Chip>} />)}</Bloc>
  </>)
}
