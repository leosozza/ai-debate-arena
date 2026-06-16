// Persistent cache of rendered MP4 parts (per-speech export) in IndexedDB.
// Key: `${debateId}:${msgId}`. Survives tab close/refresh/modal close, so the
// user never loses already-rendered clips when reopening the export panel.

const DB_NAME = "legends-mp4-parts";
const STORE = "parts";
const VERSION = 1;
// 14 days — long enough to finish a project, short enough not to hoard.
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

type Entry = {
  key: string;
  debateId: string;
  msgId: string;
  blob: Blob;
  size: number;
  createdAt: number;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("no-idb"));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: "key" });
        s.createIndex("debateId", "debateId");
        s.createIndex("createdAt", "createdAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode: IDBTransactionMode) {
  return openDb().then((db) => db.transaction(STORE, mode).objectStore(STORE));
}

const keyFor = (debateId: string, msgId: string) => `${debateId}:${msgId}`;

export async function mp4PartGet(debateId: string, msgId: string): Promise<Blob | null> {
  try {
    const store = await tx("readonly");
    const e = await new Promise<Entry | undefined>((res, rej) => {
      const r = store.get(keyFor(debateId, msgId));
      r.onsuccess = () => res(r.result as Entry | undefined);
      r.onerror = () => rej(r.error);
    });
    return e ? e.blob : null;
  } catch {
    return null;
  }
}

export async function mp4PartPut(debateId: string, msgId: string, blob: Blob): Promise<void> {
  try {
    const store = await tx("readwrite");
    const entry: Entry = {
      key: keyFor(debateId, msgId),
      debateId, msgId, blob, size: blob.size, createdAt: Date.now(),
    };
    await new Promise<void>((res, rej) => {
      const r = store.put(entry);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
  } catch { /* best-effort */ }
}

export async function mp4PartDelete(debateId: string, msgId: string): Promise<void> {
  try {
    const store = await tx("readwrite");
    await new Promise<void>((res) => {
      const r = store.delete(keyFor(debateId, msgId));
      r.onsuccess = () => res();
      r.onerror = () => res();
    });
  } catch { /* noop */ }
}

/** Load every cached part for a debate, keyed by msgId. */
export async function mp4PartsByDebate(debateId: string): Promise<Map<string, Blob>> {
  const out = new Map<string, Blob>();
  try {
    const store = await tx("readonly");
    const idx = store.index("debateId");
    await new Promise<void>((res) => {
      const r = idx.openCursor(IDBKeyRange.only(debateId));
      r.onsuccess = () => {
        const c = r.result;
        if (!c) { res(); return; }
        const e = c.value as Entry;
        out.set(e.msgId, e.blob);
        c.continue();
      };
      r.onerror = () => res();
    });
  } catch { /* noop */ }
  return out;
}

/** Load only cached part ids for a debate, without pulling MP4 blobs into RAM. */
export async function mp4PartIdsByDebate(debateId: string): Promise<Set<string>> {
  const out = new Set<string>();
  try {
    const store = await tx("readonly");
    const idx = store.index("debateId");
    await new Promise<void>((res) => {
      const r = idx.openKeyCursor(IDBKeyRange.only(debateId));
      r.onsuccess = () => {
        const c = r.result;
        if (!c) { res(); return; }
        const key = String(c.primaryKey ?? "");
        const prefix = `${debateId}:`;
        if (key.startsWith(prefix)) out.add(key.slice(prefix.length));
        c.continue();
      };
      r.onerror = () => res();
    });
  } catch { /* noop */ }
  return out;
}

let pruned = false;
export async function mp4PartsPrune(): Promise<void> {
  if (pruned) return;
  pruned = true;
  try {
    const store = await tx("readwrite");
    const idx = store.index("createdAt");
    const cutoff = Date.now() - MAX_AGE_MS;
    await new Promise<void>((res) => {
      const r = idx.openCursor(IDBKeyRange.upperBound(cutoff));
      r.onsuccess = () => {
        const c = r.result;
        if (c) { c.delete(); c.continue(); } else res();
      };
      r.onerror = () => res();
    });
  } catch { /* noop */ }
}
