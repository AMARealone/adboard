// finance-phase1-v1 — page « Finance » du CRM : tout en DOLLARS, calculé en direct par le serveur (GET /finance/resume).
// Revenu net (commission Chariow réelle), coûts variables par origine (Factory, AdBoard, AdStats, Prospecteur), coûts fixes au prorata, profit, marges, tendance, fuites.
import React, { useCallback, useEffect, useState } from 'react'
import { Card, Seg, Stat, Chip, Modal, toast, confirmDlg } from '../ui'
import { Area, HBars } from '../charts'
import { serveurAdminJson } from '../api'
import { usePref } from '../prefs'

const usd = (v, forcer) => { const x = Number(v) || 0, a = Math.abs(x), d = forcer !== undefined ? forcer : a > 0 && a < 0.1 ? 4 : 2; return (x < 0 ? '−' : '') + '$' + a.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) }
const pc = (v) => (v === null || v === undefined ? '—' : String(v).replace('.', ',') + ' %')
const ORIGINES = { factory: 'Factory', adboard: 'AdBoard', adstats: 'AdStats (CRM)', prospecteur: 'Prospecteur', autre: 'À classer' }
const NATURES = { production: 'Production (livrables clients)', agent_test: "Tests d'agents", demo: 'Démo (acquisition)', prospecteur: 'Prospection', autre: 'Autre' }
const FOURNISSEURS = { scrapecreators: 'ScrapeCreators', google_vision: 'Google Vision', africastalking_sms: "SMS Africa's Talking", moteur_video: 'Moteur vidéo (Veo, voix, montage)' }
const PERIODES = [[7, '7 jours'], [30, '30 jours'], [90, '90 jours'], [0, 'Tout']]
const NIVEAUX = { critique: ['red', 'Critique'], alerte: ['wa', 'Alerte'], info: ['bl', 'Info'] }
const PARAMS = [
  ['taux_xof_par_usd', 'Taux FCFA pour 1 $', 'Laisse vide : taux du marché, mis à jour automatiquement.'],
  ['commission_chariow_pct', 'Commission Chariow (%)', 'Utilisée seulement si une vente n\'a pas sa commission réelle.'],
  ['prix_credit_scrapecreators_usd', 'Prix d\'un crédit ScrapeCreators ($)', 'Pack 25 000 crédits = 47 $ → 0,00188. À confirmer sur ta facture.'],
  ['prix_vision_web_usd', 'Prix d\'une recherche Google Vision ($)', 'Tarif public : 3,50 $ pour 1 000.'],
  ['prix_sms_usd', 'Prix moyen d\'un SMS ($)', 'Seulement si l\'opérateur ne renvoie pas le coût réel.'],
]
const aujourdhui = () => new Date().toISOString().slice(0, 10)

function FormFixe({ init, onClose, onSave }) {
  const [f, setF] = useState(init || { nom: '', categorie: 'outil', montant: '', devise: 'USD', periodicite: 'mensuel', actif: true, date_debut: aujourdhui(), date_fin: '', note: '' })
  const [enCours, setEnCours] = useState(false)
  const maj = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const valider = async (e) => { e.preventDefault(); setEnCours(true); try { await onSave({ ...f, montant: Number(f.montant) }) } finally { setEnCours(false) } }
  return (
    <Modal title={init && init.id ? "Modifier l'abonnement" : 'Ajouter un abonnement'} onClose={onClose}>
      <form className="cx-form" onSubmit={valider} style={{ padding: 16 }}>
        <label>Nom<input value={f.nom} onChange={(e) => maj('nom', e.target.value)} placeholder="ex. Trend Track" required /></label>
        <div className="cx-grp" style={{ flexDirection: 'row', gap: 10 }}>
          <label style={{ flex: 1 }}>Montant<input type="number" min="0" step="any" value={f.montant} onChange={(e) => maj('montant', e.target.value)} required /></label>
          <label>Devise<select value={f.devise} onChange={(e) => maj('devise', e.target.value)}><option value="USD">Dollars ($)</option><option value="XOF">FCFA</option></select></label>
          <label>Rythme<select value={f.periodicite} onChange={(e) => maj('periodicite', e.target.value)}><option value="mensuel">par mois</option><option value="annuel">par an</option></select></label>
        </div>
        <div className="cx-grp" style={{ flexDirection: 'row', gap: 10 }}>
          <label style={{ flex: 1 }}>Compté à partir du<input type="date" value={f.date_debut || ''} onChange={(e) => maj('date_debut', e.target.value)} required /></label>
          <label style={{ flex: 1 }}>Jusqu'au (facultatif)<input type="date" value={f.date_fin || ''} onChange={(e) => maj('date_fin', e.target.value)} /></label>
        </div>
        <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={!!f.actif} onChange={(e) => maj('actif', e.target.checked)} style={{ width: 'auto' }} />Déjà payé (décompte les coûts depuis cette date)</label>
        <label>Note<input value={f.note || ''} onChange={(e) => maj('note', e.target.value)} /></label>
        <div className="cx-acts"><button type="button" className="cx-btn" onClick={onClose}>Annuler</button><button className="cx-btn primary" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Enregistrer'}</button></div>
      </form>
    </Modal>
  )
}
function FormDepense({ onClose, onSave }) {
  const [f, setF] = useState({ nom: '', categorie: 'autre', montant: '', devise: 'USD', date: aujourdhui(), note: '' })
  const [enCours, setEnCours] = useState(false)
  const maj = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const valider = async (e) => { e.preventDefault(); setEnCours(true); try { await onSave({ ...f, montant: Number(f.montant) }) } finally { setEnCours(false) } }
  return (
    <Modal title="Ajouter une dépense ponctuelle" onClose={onClose}>
      <form className="cx-form" onSubmit={valider} style={{ padding: 16 }}>
        <label>Nom<input value={f.nom} onChange={(e) => maj('nom', e.target.value)} placeholder="ex. Recharge ElevenLabs" required /></label>
        <div className="cx-grp" style={{ flexDirection: 'row', gap: 10 }}>
          <label style={{ flex: 1 }}>Montant<input type="number" min="0" step="any" value={f.montant} onChange={(e) => maj('montant', e.target.value)} required /></label>
          <label>Devise<select value={f.devise} onChange={(e) => maj('devise', e.target.value)}><option value="USD">Dollars ($)</option><option value="XOF">FCFA</option></select></label>
          <label style={{ flex: 1 }}>Date<input type="date" value={f.date} onChange={(e) => maj('date', e.target.value)} required /></label>
        </div>
        {f.devise === 'XOF' && <p className="cx-note" style={{ margin: 0 }}>Le taux du jour est figé sur cette dépense : elle ne bougera plus si le taux change.</p>}
        <label>Note<input value={f.note} onChange={(e) => maj('note', e.target.value)} /></label>
        <div className="cx-acts"><button type="button" className="cx-btn" onClick={onClose}>Annuler</button><button className="cx-btn primary" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Enregistrer'}</button></div>
      </form>
    </Modal>
  )
}
function ChampParam({ p, courant, onSave }) {
  const [cle, label, aide] = p
  const ligne = courant || {}
  const [v, setV] = useState(ligne.source === 'saisi' ? String(ligne.valeur) : '')
  useEffect(() => { setV(ligne.source === 'saisi' ? String(ligne.valeur) : '') }, [ligne.source, ligne.valeur])
  const placeholder = cle === 'taux_xof_par_usd' ? 'taux du marché' : ligne.valeur !== undefined ? String(ligne.valeur) : ''
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--bd)' }}>
      <div style={{ flex: '1 1 220px', minWidth: 0 }}><b style={{ fontSize: 13 }}>{label}</b><div className="cx-note" style={{ fontSize: 11.5, whiteSpace: 'normal' }}>{aide}</div></div>
      <input type="number" min="0" step="any" value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} style={{ background: '#0d1016', border: '1px solid var(--bd2)', borderRadius: 9, padding: '8px 10px', flex: '1 1 110px', maxWidth: 160, minWidth: 0 }} />
      <button className="cx-btn sm" onClick={() => onSave(cle, v)}>Enregistrer</button>
    </div>
  )
}

export default function Finance() {
  const [per, setPer] = usePref('fin_per', 30)
  const [de, setDe] = usePref('fin_de', ''), [a, setA] = usePref('fin_a', '')
  const [d, setD] = useState(null), [err, setErr] = useState(''), [charge, setCharge] = useState(true)
  const [modal, setModal] = useState(null)
  const perso = !!(de && a)
  const requete = perso ? '?du=' + de + '&au=' + a : per === 0 ? '?tout=1' : '?jours=' + per
  const charger = useCallback(async () => {
    setCharge(true); setErr('')
    try { setD(await serveurAdminJson('/finance/resume' + requete, 'GET', undefined, 90000)) } catch (e) { setErr(e.name === 'AbortError' ? 'Le serveur met trop de temps à répondre (il se réveille peut-être) : réessaie dans un instant.' : e.message) }
    setCharge(false)
  }, [requete])
  useEffect(() => { charger() }, [charger])
  const envoyer = async (chemin, corps, ok) => { try { await serveurAdminJson(chemin, 'POST', corps); if (ok) toast(ok); setModal(null); await charger(); return true } catch (e) { toast('Échec : ' + e.message); return false } }
  const bascule = (l) => envoyer('/finance/cout-fixe', { ...l, actif: !l.actif, date_debut: !l.actif ? aujourdhui() : l.date_debut }, l.actif ? l.nom + ' arrêté : plus de coût compté.' : l.nom + ' activé à partir d\'aujourd\'hui.')
  const supprimer = async (chemin, id, nom) => { if (await confirmDlg('Supprimer « ' + nom + ' » définitivement ?', 'Supprimer')) envoyer(chemin, { id, supprimer: true }, 'Supprimé.') }
  const param = (cle, v) => envoyer('/finance/parametre', { cle, valeur: v === '' ? null : v }, v === '' ? 'Retour à la valeur automatique.' : 'Paramètre enregistré.')

  const R = d && d.resultat, V = d && d.variable, C = d && d.comparaison
  const delta = (x) => (x === null || x === undefined ? undefined : Math.round(x))
  const paramsPar = d ? Object.fromEntries(d.config.parametres.map((p) => [p.cle, p])) : {}
  return (<>
    <div className="cx-tools"><div className="cx-bar2">
      <Seg value={perso ? 'perso' : per} onChange={(v) => { setDe(''); setA(''); setPer(v) }} options={PERIODES} />
      <span className="cx-range" style={{ marginLeft: 0 }}><input type="date" value={de} onChange={(e) => setDe(e.target.value)} /><i>→</i><input type="date" value={a} onChange={(e) => setA(e.target.value)} /></span>
      <button className="cx-btn sm" onClick={charger} disabled={charge}>{charge ? 'Calcul…' : '↻ Actualiser'}</button>
    </div></div>
    {err && <div className="cx-banner">⚠ {err}</div>}
    {charge && !d && <p className="cx-sub">Calcul en direct… (le serveur peut mettre jusqu'à une minute à se réveiller)</p>}
    {d && <>
      <p className="cx-sub" style={{ marginTop: 0 }}>Tout est en dollars · du {d.periode.du} au {d.periode.au} ({d.periode.jours} jour{d.periode.jours > 1 ? 's' : ''}) · 1 $ = {d.taux.xof_par_usd} FCFA ({d.taux.source}) · calculé par le serveur à {new Date(d.genere_a).toLocaleTimeString('fr-FR')}</p>
      {d.fuites.length > 0 && <Card t="Fuites et alertes" note={d.fuites.length + ' point' + (d.fuites.length > 1 ? 's' : '')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{d.fuites.map((f, i) => <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}><Chip c={NIVEAUX[f.niveau][0]}>{NIVEAUX[f.niveau][1]}</Chip><div><b style={{ fontSize: 13 }}>{f.titre}</b><div className="cx-note" style={{ fontSize: 12.5 }}>{f.detail}</div></div></div>)}</div>
      </Card>}
      <div className="cx-stats wrap">
        <Stat l="Revenu net" v={usd(d.revenu.net_usd)} t="acc" d={delta(C && C.revenu_net_delta_pct)} />
        <Stat l="Dépenses totales" v={usd(R.depenses_usd)} />
        <Stat l="Profit" v={usd(R.profit_usd)} t={R.profit_usd >= 0 ? 'ok' : 'hot'} />
        <Stat l="Marge nette" v={pc(R.marge_nette_pct)} />
        <Stat l="Marge de contribution" v={pc(R.marge_contribution_pct)} />
        <Stat l="Coût variable par vente" v={V.par_vente_usd === null ? '—' : usd(V.par_vente_usd)} />
      </div>
      <p className="cx-foot-note" style={{ marginTop: -6 }}>Le revenu net est après la commission Chariow réelle ({usd(d.revenu.commission_usd)} sur {usd(d.revenu.brut_usd)} encaissés, {d.revenu.nb_ventes} vente{d.revenu.nb_ventes > 1 ? 's' : ''}). Marge de contribution = revenu net moins coûts variables, sans les abonnements. La rémunération du fondateur n'est pas comptée.</p>
      <div className="cx-g2">
        <Card t="Revenu net par jour" note={d.tendance.pas_jours > 1 ? 'par semaine' : 'par jour'}><Area data={d.tendance.points.map((p) => ({ l: p.date.slice(5), v: Math.round(p.revenu_net_usd * 100) / 100 }))} unite=" $" color="var(--ok)" /></Card>
        <Card t="Dépenses par jour" note="variables + fixes + ponctuelles"><Area data={d.tendance.points.map((p) => ({ l: p.date.slice(5), v: Math.round(p.depenses_usd * 100) / 100 }))} unite=" $" color="var(--wa)" /></Card>
      </div>
      <div className="cx-g2">
        <Card t="Coûts variables par origine" note={usd(V.total_usd) + ' au total'}>
          <HBars rows={V.par_origine.map((o) => ({ l: ORIGINES[o.origine] || o.origine, v: o.usd }))} fmtV={(v) => usd(v)} />
          <p className="cx-foot-note">AdStats (CRM) à 0 $ : aucun appel payant repéré dans le serveur. Les appels « À classer » sont listés dans les alertes.</p>
        </Card>
        <Card t="Par nature d'appel" note="jamais mélangées">
          <HBars rows={V.par_nature.map((n) => ({ l: NATURES[n.nature] || n.nature, v: n.usd }))} fmtV={(v) => usd(v)} color="#9B7BFF" />
        </Card>
      </div>
      <div className="cx-g2">
        <Card t="Les postes les plus chers" note="appels Vertex / IA"><HBars rows={V.par_type.slice(0, 10).map((t) => ({ l: t.type, v: t.usd }))} fmtV={(v) => usd(v)} color="#2EF2E8" /></Card>
        <Card t="Fournisseurs hors Vertex" note="relevés automatiquement">
          {V.fournisseurs_externes.length ? <div className="cx-scroll"><table className="cx-tbl"><thead><tr><th style={{ textAlign: 'left' }}>Fournisseur</th><th>Unités</th><th>Coût</th></tr></thead><tbody>
            {V.fournisseurs_externes.map((f) => <tr key={f.fournisseur}><td style={{ textAlign: 'left' }}>{FOURNISSEURS[f.fournisseur] || f.fournisseur}</td><td>{f.unites}</td><td>{usd(f.usd)}</td></tr>)}</tbody></table></div>
            : <span className="cx-sub">Rien de relevé sur la période. Les coûts apparaissent dès le prochain balayage, SMS ou vidéo.</span>}
        </Card>
      </div>
      {d.revenu.par_plan.length > 0 && <Card t="Revenu net par offre"><div className="cx-scroll"><table className="cx-tbl"><thead><tr><th style={{ textAlign: 'left' }}>Offre</th><th>Ventes</th><th>Revenu net</th></tr></thead><tbody>{d.revenu.par_plan.map((p) => <tr key={p.plan}><td style={{ textAlign: 'left' }}>{p.plan}</td><td>{p.ventes}</td><td>{usd(p.net_usd)}</td></tr>)}</tbody></table></div></Card>}

      <Card t="Coûts fixes (abonnements)" note={usd(d.fixes.mensuel_actif_usd) + ' / mois en cours · ' + usd(d.fixes.total_usd) + ' sur la période'}>
        <div className="cx-scroll"><table className="cx-tbl"><thead><tr><th style={{ textAlign: 'left' }}>Abonnement</th><th>Montant</th><th>≈ $ / mois</th><th>Compté depuis</th><th>État</th><th></th></tr></thead><tbody>
          {d.config.fixes.map((l) => <tr key={l.id}>
            <td style={{ textAlign: 'left' }}><b>{l.nom}</b>{l.note && <div className="cx-note" style={{ fontSize: 11.5, whiteSpace: 'normal', maxWidth: 360 }}>{l.note}</div>}</td>
            <td>{l.devise === 'XOF' ? Math.round(l.montant).toLocaleString('fr-FR') + ' FCFA' : usd(l.montant)}{l.periodicite === 'annuel' ? ' / an' : ' / mois'}</td><td>{usd(l.mensuel_usd)}</td><td>{l.date_debut}{l.date_fin ? ' → ' + l.date_fin : ''}</td>
            <td>{l.actif ? <Chip c="ok">Payé</Chip> : <Chip c="off">Pas encore payé</Chip>}</td>
            <td style={{ whiteSpace: 'nowrap' }}><button className="cx-btn sm" onClick={() => bascule(l)}>{l.actif ? 'Arrêter' : "Activer aujourd'hui"}</button> <button className="cx-btn sm" onClick={() => setModal({ t: 'fixe', l })}>Modifier</button> <button className="cx-btn sm red" onClick={() => supprimer('/finance/cout-fixe', l.id, l.nom)}>✕</button></td>
          </tr>)}
          {!d.config.fixes.length && <tr><td colSpan="6" style={{ textAlign: 'center' }} className="cx-sub">Aucun abonnement. Si tu viens d'exécuter le SQL, actualise.</td></tr>}
        </tbody></table></div>
        <div className="cx-acts" style={{ marginTop: 10 }}><button className="cx-btn primary" onClick={() => setModal({ t: 'fixe' })}>+ Ajouter un abonnement</button></div>
        <p className="cx-foot-note">Chaque abonnement est compté jour par jour (mensuel × 12 ÷ 365) à partir de sa date de début. Supabase et Render restent à 0 $ tant que tu ne cliques pas « Activer aujourd'hui » le jour du premier paiement.</p>
      </Card>

      <Card t="Dépenses ponctuelles" note={usd(d.ponctuelles.total_usd) + ' sur la période'}>
        {d.ponctuelles.lignes.length > 0 && <div className="cx-scroll"><table className="cx-tbl"><thead><tr><th style={{ textAlign: 'left' }}>Date</th><th style={{ textAlign: 'left' }}>Dépense</th><th>Montant</th><th>En $</th><th></th></tr></thead><tbody>
          {d.ponctuelles.lignes.map((l) => <tr key={l.id}><td style={{ textAlign: 'left' }}>{l.date}</td><td style={{ textAlign: 'left' }}>{l.nom}</td><td>{l.devise === 'XOF' ? Math.round(l.montant).toLocaleString('fr-FR') + ' FCFA (1 $ = ' + Math.round(l.taux_xof_par_usd) + ')' : usd(l.montant)}</td><td>{usd(l.usd)}</td><td><button className="cx-btn sm red" onClick={() => supprimer('/finance/depense', l.id, l.nom)}>✕</button></td></tr>)}</tbody></table></div>}
        {!d.ponctuelles.lignes.length && <span className="cx-sub">Aucune dépense ponctuelle sur la période.</span>}
        <div className="cx-acts" style={{ marginTop: 10 }}><button className="cx-btn" onClick={() => setModal({ t: 'depense' })}>+ Ajouter une dépense</button></div>
      </Card>

      <Card t="Paramètres" note="valeurs utilisées dans les calculs">{PARAMS.map((p) => <ChampParam key={p.join()} p={p} courant={paramsPar[p[0]] || (p[0] === 'taux_xof_par_usd' ? { valeur: d.taux.xof_par_usd, source: d.taux.source === 'saisi' ? 'saisi' : 'auto' } : undefined)} onSave={param} />)}</Card>

      <Card t="Ce qui est suivi" note="et ce qui reste à saisir">
        <b style={{ fontSize: 12.5 }}>Automatique, en temps réel</b>
        <ul style={{ margin: '6px 0 12px 18px', padding: 0, fontSize: 12.5, lineHeight: 1.6 }}>{d.couverture.automatique.map((x) => <li key={x}>{x}</li>)}</ul>
        <b style={{ fontSize: 12.5 }}>À saisir</b>
        <ul style={{ margin: '6px 0 12px 18px', padding: 0, fontSize: 12.5, lineHeight: 1.6 }}>{d.couverture.a_saisir.map((x) => <li key={x}>{x}</li>)}</ul>
        <b style={{ fontSize: 12.5 }}>À savoir</b>
        <ul style={{ margin: '6px 0 0 18px', padding: 0, fontSize: 12.5, lineHeight: 1.6 }}>{d.couverture.notes.map((x) => <li key={x}>{x}</li>)}</ul>
      </Card>
    </>}
    {modal && modal.t === 'fixe' && <FormFixe init={modal.l} onClose={() => setModal(null)} onSave={(f) => envoyer('/finance/cout-fixe', { ...(modal.l ? { id: modal.l.id } : {}), ...f, date_fin: f.date_fin || null }, 'Abonnement enregistré.')} />}
    {modal && modal.t === 'depense' && <FormDepense onClose={() => setModal(null)} onSave={(f) => envoyer('/finance/depense', f, 'Dépense enregistrée.')} />}
  </>)
}
