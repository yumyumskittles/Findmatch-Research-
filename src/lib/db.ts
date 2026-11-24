import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  runTransaction,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import type { FoundItem, SearchLogEntry } from '../types';
import { firestore } from './firebase';

// ---------------------------------------------------------------------------
// Firestore collections
//   foundItems  -> one document per found item (photo is stored inside it)
//   searchLogs  -> one document per search
//   meta        -> itemCounter document used to create FI-001, FI-002, ...
// ---------------------------------------------------------------------------
const ITEMS = 'foundItems';
const LOGS = 'searchLogs';

export async function getAllFoundItems(): Promise<FoundItem[]> {
  const snap = await getDocs(collection(firestore, ITEMS));
  const items = snap.docs.map((d) => d.data() as FoundItem);
  return items.sort((a, b) => a.id.localeCompare(b.id));
}

export async function saveFoundItem(item: FoundItem): Promise<void> {
  await setDoc(doc(firestore, ITEMS, item.id), item);
}

export async function deleteFoundItem(id: string): Promise<void> {
  await deleteDoc(doc(firestore, ITEMS, id));
}

export async function getNextItemId(): Promise<string> {
  const counterRef = doc(firestore, 'meta', 'itemCounter');
  const next = await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists() ? Number(snap.data().next) || 1 : 1;
    tx.set(counterRef, { next: current + 1 });
    return current;
  });
  return `FI-${String(next).padStart(3, '0')}`;
}

export async function getAllSearchLogs(): Promise<SearchLogEntry[]> {
  const snap = await getDocs(collection(firestore, LOGS));
  const logs = snap.docs.map((d) => d.data() as SearchLogEntry);
  return logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function saveSearchLog(entry: SearchLogEntry): Promise<void> {
  await setDoc(doc(firestore, LOGS, entry.id), entry);
}

export async function clearAllSearchLogs(): Promise<void> {
  const snap = await getDocs(collection(firestore, LOGS));
  // Firestore batches hold up to 500 writes.
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(firestore);
    snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

// ---------------------------------------------------------------------------
// Local cache (stays in the browser's IndexedDB on purpose).
// It only stores computed scores/embeddings so repeat searches are instant;
// it does not need to be shared, so it does not go to Firebase.
// ---------------------------------------------------------------------------
const CACHE_DB = 'findmatch_cache';
const CACHE_STORE = 'cache';

function openCacheDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CACHE_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open local cache'));
  });
}

async function withCache<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openCacheDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE, mode);
    const req = fn(tx.objectStore(CACHE_STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Local cache error'));
    tx.oncomplete = () => db.close();
  });
}

export async function getCacheValue<T>(key: string): Promise<T | null> {
  const rec = await withCache<{ key: string; value: T } | undefined>('readonly', (s) =>
    s.get(key),
  );
  return rec ? rec.value : null;
}

export async function setCacheValue<T>(key: string, value: T): Promise<void> {
  await withCache('readwrite', (s) => s.put({ key, value }));
}
