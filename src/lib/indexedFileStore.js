/**
 * indexedFileStore — IndexedDB-backed blob store for the upload queue.
 *
 * Blobs stored here survive page reloads and device restarts.
 * Queue metadata is stored separately in localStorage (useUploadQueue).
 *
 * API:
 *   setFile(id, file)          — persist a File/Blob keyed by queue item id
 *   getFile(id)                — retrieve, returns Blob or null
 *   deleteFile(id)             — remove entry
 *   pruneOrphanedFiles(ids)    — delete any keys NOT in the provided id set
 */

const DB_NAME    = 'purpulse_uploads';
const STORE_NAME = 'files';
const DB_VERSION = 1;

let _db = null;

function openDb() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess  = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror    = (e) => reject(e.target.error);
    req.onblocked  = ()  => reject(new Error('IndexedDB blocked — close other tabs'));
  });
}

export async function setFile(id, file) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).put(file, id);
    req.onsuccess = () => resolve();
    req.onerror   = (e) => reject(e.target.error);
  });
}

export async function getFile(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = (e) => resolve(e.target.result ?? null);
    req.onerror   = (e) => reject(e.target.error);
  });
}

export async function deleteFile(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = (e) => reject(e.target.error);
  });
}

export async function getAllKeys() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAllKeys();
    req.onsuccess = (e) => resolve(e.target.result ?? []);
    req.onerror   = (e) => reject(e.target.error);
  });
}

/**
 * Delete blobs whose IDs are not in the validIds set (orphan cleanup).
 * Returns count of deleted entries.
 */
export async function pruneOrphanedFiles(validIds) {
  const validSet = new Set(validIds);
  const keys     = await getAllKeys();
  const orphans  = keys.filter(k => !validSet.has(k));
  await Promise.all(orphans.map(k => deleteFile(k).catch(() => {})));
  return orphans.length;
}