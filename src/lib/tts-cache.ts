// Persistent TTS cache em IndexedDB. Sobrevive a refresh, abrir/fechar
// editor e re-exportar. Chave: provider|voiceId|msgId|contentHash.
// Guarda o áudio como Blob (não data: URL) pra não estourar memória.

const DB_NAME = "legends-tts-cache";
const STORE = "clips";
const VERSION = 1;
// Limpa entradas mais velhas que isso (ms). 30 dias.
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

type Entry = {
  key: string;
  blob: Blob;
  duration: number; // 0 quando desconhecida (chamador recalcula)
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

export async function ttsCacheGet(key: string): Promise<{ blob: Blob; duration: number } | null> {
  try {
    const store = await tx("readonly");
    const e = await new Promise<Entry | undefined>((res, rej) => {
      const r = store.get(key);
      r.onsuccess = () => res(r.result as Entry | undefined);
      r.onerror = () => rej(r.error);
    });
    if (!e) return null;
    return { blob: e.blob, duration: e.duration };
  } catch {
    return null;
  }
}

export async function ttsCachePut(key: string, blob: Blob, duration: number): Promise<void> {
  try {
    const store = await tx("readwrite");
    await new Promise<void>((res, rej) => {
      const r = store.put({ key, blob, duration, createdAt: Date.now() } satisfies Entry);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
  } catch {
    /* noop — cache é best-effort */
  }
}

/** Procura no cache qualquer áudio cuja chave contenha `|${msgId}|` (qualquer provider/voz). */
export async function ttsCacheFindByMsgId(msgId: string): Promise<{ blob: Blob; duration: number } | null> {
  try {
    const store = await tx("readonly");
    const needle = `|${msgId}|`;
    return await new Promise((res) => {
      const r = store.openCursor();
      r.onsuccess = () => {
        const c = r.result;
        if (!c) { res(null); return; }
        const e = c.value as Entry;
        if (e.key.includes(needle)) { res({ blob: e.blob, duration: e.duration }); return; }
        c.continue();
      };
      r.onerror = () => res(null);
    });
  } catch {
    return null;
  }
}

/** Apaga entradas mais velhas que MAX_AGE_MS. Chamada uma vez por sessão. */
let pruned = false;
export async function ttsCachePrune(): Promise<void> {
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

/** Converte Blob -> URL temporária do objeto (revogável). */
export function blobToUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

/** Hash determinístico de string (djb2). */
export function hashContent(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Converte data:URL em Blob. */
export async function dataUrlToBlob(url: string): Promise<Blob> {
  const r = await fetch(url);
  return await r.blob();
}
