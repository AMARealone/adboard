// Données qualitatives : chatbot Ava + 3 formulaires. Fonctions pures (testées sans réseau).
export const QUIZ_QUESTIONS = new Set([
  "Aujourd'hui, qu'est-ce qui vous frustre le plus avec vos pubs ?", 'Combien dépensez-vous par mois en publicité actuellement ?', 'Où en êtes-vous avec vos ventes en ligne ?',
  "Qu'avez-vous déjà essayé pour vos créatives publicitaires ?", 'Quel est votre objectif de revenus pour les prochains mois ?', 'Si notre solution vous faisait gagner plusieurs heures chaque semaine, ça changerait quoi ?',
  "Qu'est-ce qui vous ferait hésiter à essayer notre solution ?", 'Vous gérez combien de produits ou marques actuellement ?', "Qu'est-ce qui compte le plus pour vous dans une offre comme la nôtre ?", "Pourquoi c'est important pour vous de régler ça maintenant ?",
])
export const SOURCES = [
  { id: 'chatbot', titre: '💬 Verbatim Chatbot Ava', fichier: 'adstack_verbatim_chatbot.md', type: 'chat' },
  { id: 'prepurchase_form', titre: '🎯 Réponses formulaire pré-achat', fichier: 'adstack_reponses_prepurchase.md', type: 'form' },
  { id: 'postpurchase_form', titre: '✅ Réponses formulaire post-achat', fichier: 'adstack_reponses_postpurchase.md', type: 'form' },
  { id: 'commentaire_libre', titre: '💬 Commentaires libres AdBoard', fichier: 'adstack_commentaires_libres.md', type: 'form' },
]
const VIDES = new Set('alors avec avoir bien cela comme dans donc elle etre faire juste leur mais même meme nous pour plus quand quel quelle sont sous tous toute tres très vais vers voir vous votre vraiment aussi être peut fait deja déjà encore depuis pendant ainsi cette ceci the and for you your with have this that from are'.split(' '))
const txt = (t) => (t || '').toString().replace(/\r\n/g, '\n').trim()
const frDate = (d) => (d ? new Date(d).toLocaleString('fr-FR') : '')

// Origine d'une conversation d'après l'identifiant de session : « as_ » = page de vente, « sess_ » ou identifiant de compte = AdBoard.
export const ORIGINES = { vente: 'Page de vente', adboard: 'AdBoard' }
export const origineDe = (id) => (/^as_/.test(id || '') ? 'vente' : 'adboard')
const PAUSE_VISITE = 30 * 60 * 1000
const heure = (t) => (t ? new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '')
const jourLong = (t) => (t ? new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '')
// Une conversation = un visiteur (un appareil) : tous ses messages, dans l'ordre, découpés en visites (pause de plus de 30 min).
export function groupesChat(rows) {
  const par = {}
  ;(rows || []).forEach((r) => { (par[r.session_id] = par[r.session_id] || []).push(r) })
  return Object.entries(par).map(([id, ms]) => {
    ms.sort((a, b) => Date.parse(a.created_at || 0) - Date.parse(b.created_at || 0))
    const origine = origineDe(id), fin4 = (id || '').slice(-4)
    let prec = null, visites = 0
    const entries = ms.map((m) => {
      const at = Date.parse(m.created_at) || 0, nouvelle = prec === null || at - prec > PAUSE_VISITE
      if (nouvelle) visites++
      prec = at
      return { qui: m.role === 'user' ? 'Visiteur' : 'Ava', visiteur: m.role === 'user', texte: m.content, at, heure: heure(at), nouvelle, quand: nouvelle ? jourLong(at) + ' · ' + heure(at) : '' }
    })
    const premier = ms[0] && ms[0].created_at, dernier = ms[ms.length - 1] && ms[ms.length - 1].created_at
    return { id, origine, label: (origine === 'vente' ? 'Visiteur du site' : 'Client AdBoard') + ' · ' + fin4, date: premier ? Date.parse(premier) : 0, fin: dernier ? Date.parse(dernier) : 0, dateAff: frDate(premier), visites, nbVisiteur: entries.filter((e) => e.visiteur).length, entries }
  })
}
export function groupesForm(rows) {
  const par = {}
  ;(rows || []).forEach((r) => { const k = r.email || 'anonyme_' + (r.created_at || ''); (par[k] = par[k] || []).push(r) })
  return Object.entries(par).map(([k, rs]) => {
    const anon = k.startsWith('anonyme_'), entries = []
    rs.forEach((r) => { entries.push({ qui: 'Q', texte: r.question }); entries.push({ qui: 'R', visiteur: true, texte: r.answer }) })
    return { id: k, label: anon ? 'Anonyme' : k, date: rs[0] && rs[0].created_at ? new Date(rs[0].created_at).getTime() : 0, dateAff: frDate(rs[0] && rs[0].created_at), format: rs.some((r) => QUIZ_QUESTIONS.has(r.question)) ? 'quiz' : 'libre', entries }
  })
}
export function markdown(titre, groupes, chat) {
  if (!groupes.length) return `# ${titre}\n\n_Aucune ${chat ? 'conversation' : 'réponse'} pour l'instant._\n`
  let md = `# ${titre}\n\n_Généré le ${new Date().toLocaleString('fr-FR')} — ${groupes.length} ${chat ? 'conversation(s)' : 'répondant(s)'}_\n\n---\n\n`
  groupes.forEach((g) => {
    md += `## ${g.label} — ${g.dateAff}${g.format ? ' (' + (g.format === 'quiz' ? 'Quiz' : 'Texte libre') + ')' : ''}\n\n`
    g.entries.forEach((e) => { md += chat ? `**${e.qui}** : ${txt(e.texte)}\n\n` : e.qui === 'Q' ? `**Q :** ${txt(e.texte)}\n` : `**R :** ${txt(e.texte)}\n\n` })
    md += '---\n\n'
  })
  return md
}
const normaliser = (t) => (t || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const VIDES2 = new Set('faites fais voir veux part reviens vois sais pouvoir est les des une pas que qui par sur ses mes nos vos mon ton son leur leurs cet ces aux dont chez entre sans sous vers ete suis sommes etes etait serait sera aurait avez avons ont avait faut faire fais fait dire dit veux veut voudrais peux pouvez peut puis puisque parce comme comment pourquoi quand combien quoi bonjour bonsoir salut merci svp ok oui non rien tout tous toute toutes autre autres meme tres trop assez deja encore toujours jamais souvent aussi alors donc mais car ainsi bien beaucoup peu plus moins quel quelle quels quelles cette celui celle ceux celles voila ici labas apres avant depuis pendant votre notre'.split(' '))
const vide = (m) => m.length < 4 || VIDES.has(m) || VIDES2.has(m) || /^\d+$/.test(m)
const sing = (m) => (m.length > 5 && m.endsWith('s') && !m.endsWith('ss') ? m.slice(0, -1) : m)
// Ce que disent les visiteurs, et seulement eux (jamais les réponses du chatbot, ni les questions posées par le formulaire).
const mesVisiteur = (g) => g.entries.filter((e) => e.visiteur && e.texte)
const jetons = (t) => normaliser(t).replace(/[^a-z0-9\s']/g, ' ').replace(/'/g, ' ').split(/\s+/).filter(Boolean)
// Mots qui reviennent : comptés une seule fois par conversation (X conversations en parlent), sur les messages du visiteur uniquement.
export function motsCles(groupes, n = 10) {
  const f = {}, aff = {}
  groupes.forEach((g) => {
    const vus = new Set()
    mesVisiteur(g).forEach((e) => {
      const orig = (e.texte || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/)
      orig.forEach((o) => { const m = sing(normaliser(o)); if (!m || vide(m) || vus.has(m)) return; vus.add(m); f[m] = (f[m] || 0) + 1; if (!aff[m]) aff[m] = o })
    })
  })
  return Object.entries(f).sort((a, b) => b[1] - a[1]).slice(0, n).map(([m, c]) => [aff[m] || m, c])
}
// Expressions (deux mots qui se suivent) dites par au moins deux visiteurs : « budget pub », « pas de ventes »…
export function expressions(groupes, n = 8) {
  const f = {}, aff = {}
  groupes.forEach((g) => {
    const vus = new Set()
    mesVisiteur(g).forEach((e) => {
      const brut = (e.texte || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean)
      for (let i = 0; i < brut.length - 1; i++) {
        const a = sing(normaliser(brut[i])), b = sing(normaliser(brut[i + 1]))
        if (vide(a) || vide(b) || a === b) continue
        const k = a + ' ' + b; if (vus.has(k)) continue
        vus.add(k); f[k] = (f[k] || 0) + 1; if (!aff[k]) aff[k] = brut[i] + ' ' + brut[i + 1]
      }
    })
  })
  return Object.entries(f).filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, c]) => [aff[k], c])
}
// Par question : nombre de fois où chaque réponse a été choisie. Seules les questions posées à l'identique à ≥ 2 personnes comptent.
export function tally(groupes) {
  const par = {}, ordre = []
  groupes.forEach((g) => { const e = g.entries; for (let i = 0; i < e.length - 1; i += 2) { const q = e[i] && e[i].texte, r = e[i + 1] && e[i + 1].texte; if (!q || !r || q === 'Score quiz / Offre recommandée') continue; if (!par[q]) { par[q] = {}; ordre.push(q) } par[q][r] = (par[q][r] || 0) + 1 } })
  return ordre.map((q) => ({ question: q, reponses: Object.entries(par[q]).sort((a, b) => b[1] - a[1]), total: Object.values(par[q]).reduce((a, b) => a + b, 0) })).filter((x) => x.total >= 2).sort((a, b) => b.total - a.total)
}
export function statsGlobales(groupes) {
  const scores = [], offres = {}
  groupes.forEach((g) => { const e = g.entries; for (let i = 0; i < e.length - 1; i += 2) { if (e[i].texte !== 'Score quiz / Offre recommandée' || !e[i + 1].texte) continue; const m = e[i + 1].texte.match(/Score:\s*(\d+)\s*—\s*Recommandé:\s*(.+)/); if (!m) continue; scores.push(+m[1]); const o = m[2].trim(); offres[o] = (offres[o] || 0) + 1 } })
  return scores.length ? { n: scores.length, moyenne: scores.reduce((a, b) => a + b, 0) / scores.length, offres: Object.entries(offres).sort((a, b) => b[1] - a[1]) } : null
}
// Recherche (sans accents ni majuscules) dans ce que dit le visiteur uniquement, plus le nom de la conversation.
export function filtrer(groupes, q, tri, origine) {
  const s = normaliser((q || '').trim())
  let l = origine ? groupes.filter((g) => g.origine === origine) : groupes
  if (s) l = l.filter((g) => normaliser(g.label).includes(s) || mesVisiteur(g).some((e) => normaliser(e.texte).includes(s)))
  return [...l].sort((a, b) => (tri === 'ancien' ? (a.date || 0) - (b.date || 0) : tri === 'actif' ? (b.fin || b.date || 0) - (a.fin || a.date || 0) : (b.date || 0) - (a.date || 0)))
}

// Comportement (Clarity) : cumul par page, moyennes pondérées par sessions
export function comportement(rows, jours) {
  let r = rows || []
  if (jours > 0) { const seuil = Date.now() - jours * 864e5; r = r.filter((x) => x.captured_at && new Date(x.captured_at).getTime() >= seuil) }
  const par = {}
  r.forEach((x) => {
    const u = x.url || 'inconnue', p = (par[u] = par[u] || { url: u, rage: 0, dead: 0, quickback: 0, scrollExces: 0, sessions: 0, visiteurs: 0, sc: 0, en: 0 })
    p.rage += x.rage_click_count || 0; p.dead += x.dead_click_count || 0; p.quickback += x.quickback_click || 0; p.scrollExces += x.excessive_scroll || 0
    p.sessions += x.traffic_sessions || 0; p.visiteurs += x.visiteurs_uniques || 0; p.sc += (x.scroll_depth || 0) * (x.traffic_sessions || 0); p.en += (x.engagement_time || 0) * (x.traffic_sessions || 0)
  })
  const pages = Object.values(par).map((p) => ({ ...p, friction: p.rage + p.dead + p.quickback + p.scrollExces, scrollMoyen: p.sessions ? Math.round(p.sc / p.sessions) : 0, engageMoyen: p.sessions ? Math.round(p.en / p.sessions) : 0 }))
  const S = (k) => pages.reduce((s, p) => s + p[k], 0), sessions = S('sessions')
  const jour = {}
  r.forEach((x) => { if (x.captured_at) { const j = x.captured_at.slice(0, 10); jour[j] = (jour[j] || 0) + (x.traffic_sessions || 0) } })
  return { n: r.length, pages, sessions, visiteurs: S('visiteurs'), friction: S('friction'), engage: sessions ? Math.round(S('en') / sessions) : 0, scroll: sessions ? Math.round(S('sc') / sessions) : 0, jours: Object.entries(jour).sort((a, b) => a[0].localeCompare(b[0])) }
}
