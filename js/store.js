/* ==========================================================================
   store.js — keeping a farm alive.

   localStorage on its own is the weakest link: Safari clears script-writable
   storage for sites you have not opened in seven days, a half-written record
   can corrupt the only copy, and clearing website data wipes it outright.
   So every save is written three ways:

     1. localStorage  — the fast synchronous copy the game reads on boot
     2. IndexedDB     — a mirror with its own quota, restored from if 1 is gone
     3. rolling backups — the last few good snapshots, to undo a bad write

   On top of that we ask the browser to mark the origin as persistent, and we
   tell the player plainly when their farm is only as safe as their browser
   cache. A downloadable backup file is the one copy nothing can evict.
   ========================================================================== */

const DB = 'sunnyacres';
const STORE = 'saves';
const BACKUPS = 'backups';
const KEEP_BACKUPS = 5;

/* ------------------------------- validity -------------------------------- */

/** Cheap structural check — enough to reject a truncated or foreign record. */
export function looksLikeSave(text) {
  if (!text || typeof text !== 'string') return false;
  try {
    const d = JSON.parse(text);
    return !!d && typeof d === 'object' && d.v === 1 &&
      Array.isArray(d.plots) && typeof d.coins === 'number' && typeof d.level === 'number';
  } catch {
    return false;
  }
}

/* ------------------------------- IndexedDB ------------------------------- */

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise(resolve => {
    if (!('indexedDB' in globalThis)) return resolve(null);
    let req;
    try {
      req = indexedDB.open(DB, 1);
    } catch {
      return resolve(null);
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains(BACKUPS)) db.createObjectStore(BACKUPS, { autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);        // private mode, quota, whatever
    req.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function tx(db, store, mode, run) {
  return new Promise(resolve => {
    let out;
    try {
      const t = db.transaction(store, mode);
      out = run(t.objectStore(store));
      t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
      t.onerror = t.onabort = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function idbGet(key) {
  const db = await open();
  if (!db) return null;
  const v = await tx(db, STORE, 'readonly', s => s.get(key));
  return typeof v === 'string' ? v : null;
}

export async function idbSet(key, value) {
  const db = await open();
  if (!db) return false;
  await tx(db, STORE, 'readwrite', s => s.put(value, key));
  return true;
}

export async function idbDel(key) {
  const db = await open();
  if (!db) return;
  await tx(db, STORE, 'readwrite', s => s.delete(key));
}

/* -------------------------------- backups -------------------------------- */

/** Keeps the last KEEP_BACKUPS good snapshots, newest last. */
export async function pushBackup(key, value) {
  const db = await open();
  if (!db) return;
  await tx(db, BACKUPS, 'readwrite', s => s.add({ key, value, at: Date.now() }));

  const all = await listBackups();
  const mine = all.filter(b => b.key === key);
  if (mine.length > KEEP_BACKUPS) {
    const drop = mine.slice(0, mine.length - KEEP_BACKUPS);
    await tx(db, BACKUPS, 'readwrite', s => { for (const b of drop) s.delete(b.id); });
  }
}

export async function listBackups() {
  const db = await open();
  if (!db) return [];
  return new Promise(resolve => {
    const out = [];
    try {
      const t = db.transaction(BACKUPS, 'readonly');
      const req = t.objectStore(BACKUPS).openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (!c) return;
        out.push({ id: c.key, ...c.value });
        c.continue();
      };
      t.oncomplete = () => resolve(out);
      t.onerror = t.onabort = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

/** The newest usable snapshot for a slot, or null. */
export async function latestBackup(key) {
  const mine = (await listBackups()).filter(b => b.key === key && looksLikeSave(b.value));
  return mine.length ? mine[mine.length - 1] : null;
}

/* ------------------------------ the mirror ------------------------------- */

/**
 * Runs once at boot. Anything present in IndexedDB but missing or corrupt in
 * localStorage is restored, so a cleared cache or a half-written record is
 * recovered without the player noticing.
 */
export async function hydrate(keys) {
  const restored = [];
  for (const key of keys) {
    let local = null;
    try { local = localStorage.getItem(key); } catch { /* private mode */ }

    if (looksLikeSave(local)) {
      // Local copy is good — make sure the mirror agrees with it.
      const mirror = await idbGet(key);
      if (mirror !== local) await idbSet(key, local);
      continue;
    }

    const mirror = await idbGet(key);
    const source = looksLikeSave(mirror) ? mirror : (await latestBackup(key) || {}).value;
    if (looksLikeSave(source)) {
      try {
        localStorage.setItem(key, source);
        restored.push(key);
      } catch { /* nothing more we can do */ }
    }
  }
  return restored;
}

/** Called on every save: mirror it, and snapshot it now and then. */
let lastBackupAt = 0;
export function mirror(key, value) {
  if (!looksLikeSave(value)) return;
  idbSet(key, value);
  // One snapshot every few minutes is plenty to undo a bad write.
  if (Date.now() - lastBackupAt > 5 * 60 * 1000) {
    lastBackupAt = Date.now();
    pushBackup(key, value);
  }
}

/* ---------------------------- durability report -------------------------- */

/** Ask the browser not to evict us. Safari only grants this to installed apps. */
export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist();
  } catch { /* unsupported */ }
  return false;
}

export function isInstalled() {
  return !!(navigator.standalone ||
    (window.matchMedia && matchMedia('(display-mode: standalone)').matches));
}

export async function report() {
  let persisted = false, usage = 0, quota = 0;
  try {
    if (navigator.storage && navigator.storage.persisted) persisted = await navigator.storage.persisted();
    if (navigator.storage && navigator.storage.estimate) {
      const e = await navigator.storage.estimate();
      usage = e.usage || 0;
      quota = e.quota || 0;
    }
  } catch { /* unsupported */ }
  return { persisted, usage, quota, installed: isInstalled(), mirrored: !!(await open()) };
}

/* ---------------------------- the file you keep -------------------------- */

/** Downloads every slot as one JSON file — the copy no browser can clear. */
export function downloadBackup(payload, name) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Reads a backup file the player picks. Resolves to the parsed payload. */
export function readBackupFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(String(r.result));
        if (!data || typeof data !== 'object' || !data.slots) throw new Error('shape');
        resolve(data);
      } catch {
        reject(new Error('That file is not a Sunny Acres backup.'));
      }
    };
    r.onerror = () => reject(new Error('That file could not be read.'));
    r.readAsText(file);
  });
}
