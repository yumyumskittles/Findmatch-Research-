import type { FoundItem, SearchLogEntry } from '../types';

const DB_NAME = 'findmatch_db';
const DB_VERSION = 1;

const STORE_ITEMS = 'items';
const STORE_LOGS = 'logs';
const STORE_CACHE = 'cache';
const STORE_META = 'meta';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_ITEMS)) {
        db.createObjectStore(STORE_ITEMS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_LOGS)) {
        db.createObjectStore(STORE_LOGS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_CACHE)) {
        db.createObjectStore(STORE_CACHE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error(`IndexedDB error in ${storeName}`));
    tx.oncomplete = () => db.close();
  });
}

export async function getAllFoundItems(): Promise<FoundItem[]> {
  const items = await withStore<FoundItem[]>(STORE_ITEMS, 'readonly', (s) => s.getAll());
  return items.sort((a, b) => a.id.localeCompare(b.id));
}

export async function saveFoundItem(item: FoundItem): Promise<void> {
  await withStore(STORE_ITEMS, 'readwrite', (s) => s.put(item));
}

export async function deleteFoundItem(id: string): Promise<void> {
  await withStore(STORE_ITEMS, 'readwrite', (s) => s.delete(id));
}

export async function getNextItemId(): Promise<string> {
  const db = await openDatabase();
  const items = await new Promise<FoundItem[]>((resolve, reject) => {
    const tx = db.transaction(STORE_ITEMS, 'readonly');
    const req = tx.objectStore(STORE_ITEMS).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  const metaRec = await new Promise<{ key: string; value: number } | undefined>(
    (resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readonly');
      const req = tx.objectStore(STORE_META).get('next_item_num');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    },
  );

  let maxNum = metaRec?.value ?? 1;
  for (const item of items) {
    const match = /^FI-(\d+)$/.exec(item.id);
    if (match) {
      const n = Number(match[1]);
      if (n >= maxNum) maxNum = n + 1;
    }
  }

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put({ key: 'next_item_num', value: maxNum + 1 });
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });

  return `FI-${String(maxNum).padStart(3, '0')}`;
}

export async function getAllSearchLogs(): Promise<SearchLogEntry[]> {
  const logs = await withStore<SearchLogEntry[]>(STORE_LOGS, 'readonly', (s) => s.getAll());
  return logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function saveSearchLog(entry: SearchLogEntry): Promise<void> {
  await withStore(STORE_LOGS, 'readwrite', (s) => s.put(entry));
}

export async function clearAllSearchLogs(): Promise<void> {
  await withStore(STORE_LOGS, 'readwrite', (s) => s.clear());
}

export async function getCacheValue<T>(key: string): Promise<T | null> {
  const rec = await withStore<{ key: string; value: T } | undefined>(
    STORE_CACHE,
    'readonly',
    (s) => s.get(key),
  );
  return rec ? rec.value : null;
}

export async function setCacheValue<T>(key: string, value: T): Promise<void> {
  await withStore(STORE_CACHE, 'readwrite', (s) => s.put({ key, value }));
}
