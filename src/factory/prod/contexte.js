// finance-v2 — Pendant une production liée à une commande, chaque appel au serveur porte l'identifiant de la commande
// (en-tête X-Commande) : le serveur range alors la dépense sur cette commande (coût par production, par client, par offre).
// L'en-tête n'est ajouté que si le serveur annonce qu'il l'accepte : un serveur plus ancien continue de marcher comme avant.
import { SERVER, prodv2State } from './state'

let pret = false, pose = false
export function activerContexteCommande() {
  if (pose || typeof window === 'undefined') return
  pose = true
  fetch(SERVER + '/finance/capacites').then((r) => (r.ok ? r.json() : null)).then((j) => { pret = !!(j && j.commande) }).catch(() => {})
  const natif = window.fetch.bind(window)
  window.fetch = (entree, init) => {
    try {
      const url = typeof entree === 'string' ? entree : (entree && entree.url) || ''
      const id = prodv2State.commandeId
      if (pret && id && prodv2State.briefSource === 'commande' && typeof entree === 'string' && url.startsWith(SERVER) && /^[A-Za-z0-9_-]{4,80}$/.test(String(id))) {
        const h = new Headers((init && init.headers) || {})
        if (!h.has('X-Commande')) h.set('X-Commande', String(id))
        return natif(entree, { ...(init || {}), headers: h })
      }
    } catch (_) { /* jamais bloquant */ }
    return natif(entree, init)
  }
}
