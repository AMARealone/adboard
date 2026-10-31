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

export function groupesChat(rows) {
  const par = {}
  ;(rows || []).forEach((r) => { (par[r.session_id] = par[r.session_id] || []).push(r) })
  return Object.entries(par).map(([id, ms]) => ({ id, label: 'Session ' + (id || '').slice(0, 8), date: ms[0] && ms[0].created_at ? new Date(ms[0].created_at).getTime() : 0, dateAff: frDate(ms[0] && ms[0].created_at), entries: ms.map((m) => ({ qui: m.role === 'user' ? 'Visiteur' : 'Ava', visiteur: m.role === 'user', texte: m.content })) }))
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
export function motsCles(groupes, n = 10) {
  const f = {}
  groupes.forEach((g) => g.entries.forEach((e) => (e.texte || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).forEach((m) => { if (m.length < 4 || VIDES.has(m)) return; f[m] = (f[m] || 0) + 1 })))
  return Object.entries(f).sort((a, b) => b[1] - a[1]).slice(0, n)
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
export function filtrer(groupes, q, tri) {
  const s = (q || '').trim().toLowerCase()
  const l = !s ? groupes : groupes.filter((g) => g.label.toLowerCase().includes(s) || g.entries.some((e) => (e.texte || '').toLowerCase().includes(s)))
  return [...l].sort((a, b) => (tri === 'ancien' ? (a.date || 0) - (b.date || 0) : (b.date || 0) - (a.date || 0)))
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
