// Service vidéo (labo) : adresse + clé d'accès gardées dans ce navigateur, comme dans l'ancien Factory.
export const labKey = () => { try { return localStorage.getItem('adstack_lab_key') || '' } catch (_) { return '' } }
export const labUrl = () => { let u = 'http://localhost:8787'; try { u = localStorage.getItem('adstack_lab_url') || u } catch (_) {} return u.replace(/\/+$/, '') }
export const saveLabKey = (v) => { try { localStorage.setItem('adstack_lab_key', v.trim()) } catch (_) {} }
export const saveLabUrl = (v) => { try { localStorage.setItem('adstack_lab_url', v.trim()) } catch (_) {} }
// Toutes les demandes passent par ici : la clé d'accès (si elle existe) est ajoutée en en-tête.
export function labFetch(chemin, opts = {}) { const k = labKey(); if (k) opts.headers = Object.assign({}, opts.headers || {}, { 'x-lab-key': k }); return fetch(labUrl() + chemin, opts) }
// Adresse directe (lecteur vidéo, téléchargement) : la clé passe dans l'adresse.
export function labQuery(chemin, extra) { const k = labKey(); const q = []; if (k) q.push('k=' + encodeURIComponent(k)); if (extra) q.push(extra); return labUrl() + chemin + (q.length ? '?' + q.join('&') : '') }
