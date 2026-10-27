// Sauvegarde locale des compétences (skills) : un dossier de l'ordinateur choisi une fois, mémorisé dans ce navigateur.
// Fonctionne avec Chrome / Edge (écriture directe dans le dossier, après autorisation).
const DB = 'fx-backup', ST = 'h'
let mem = null
const idb = () => new Promise((ok, ko) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(ST); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error) })
export const backupSupported = () => typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
export async function getBackupDir() {
  if (mem) return mem
  try { const db = await idb(); return await new Promise((ok) => { const q = db.transaction(ST).objectStore(ST).get('dir'); q.onsuccess = () => ok(q.result || null); q.onerror = () => ok(null) }) } catch (_) { return null }
}
export async function pickBackupDir() {
  const h = await window.showDirectoryPicker({ mode: 'readwrite' })
  mem = h
  try { const db = await idb(); await new Promise((ok, ko) => { const t = db.transaction(ST, 'readwrite'); t.objectStore(ST).put(h, 'dir'); t.oncomplete = ok; t.onerror = () => ko(t.error) }) } catch (_) {}
  return h
}
async function allowed(h) {
  let p = await h.queryPermission({ mode: 'readwrite' })
  if (p !== 'granted') p = await h.requestPermission({ mode: 'readwrite' })
  return p === 'granted'
}
// Écrit les fichiers {nom: texte}. Retourne {ok, dir, n} ou {ok:false, reason}.
export async function writeSkills(files) {
  const h = await getBackupDir()
  if (!h) return { ok: false, reason: 'no-dir' }
  try {
    if (!(await allowed(h))) return { ok: false, reason: 'denied' }
    let n = 0
    for (const [name, text] of Object.entries(files)) {
      if (!text) continue
      const f = await h.getFileHandle(name, { create: true }); const w = await f.createWritable(); await w.write(text); await w.close(); n++
    }
    return { ok: true, dir: h.name, n }
  } catch (e) { return { ok: false, reason: e.message || String(e) } }
}
