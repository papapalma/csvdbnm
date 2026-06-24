// IndexedDB Database Manager for Offline Data Storage
import logger from './logger';

const DB_NAME = 'BMDC_DB';
const DB_VERSION = 1;

// Store names
export const STORES = {
  TRAINEES: 'trainees',
  ITEMS: 'items',
  LENDINGS: 'lendings',
  PROGRAMS: 'programs',
  PENDING_SYNC: 'pendingSync',
  SETTINGS: 'settings',
  CACHE_TIMESTAMP: 'cacheTimestamp',
} as const;

// Open database connection
export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains(STORES.TRAINEES)) {
        const traineeStore = db.createObjectStore(STORES.TRAINEES, { keyPath: 'id' });
        traineeStore.createIndex('name', 'name', { unique: false });
        traineeStore.createIndex('email', 'email', { unique: false });
        traineeStore.createIndex('status', 'status', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.ITEMS)) {
        const itemStore = db.createObjectStore(STORES.ITEMS, { keyPath: 'id' });
        itemStore.createIndex('name', 'name', { unique: false });
        itemStore.createIndex('category', 'category', { unique: false });
        itemStore.createIndex('status', 'status', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.LENDINGS)) {
        const lendingStore = db.createObjectStore(STORES.LENDINGS, { keyPath: 'id' });
        lendingStore.createIndex('traineeId', 'traineeId', { unique: false });
        lendingStore.createIndex('itemId', 'itemId', { unique: false });
        lendingStore.createIndex('status', 'status', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.PROGRAMS)) {
        const programStore = db.createObjectStore(STORES.PROGRAMS, { keyPath: 'id' });
        programStore.createIndex('title', 'title', { unique: false });
        programStore.createIndex('status', 'status', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.PENDING_SYNC)) {
        db.createObjectStore(STORES.PENDING_SYNC, { keyPath: 'id', autoIncrement: true });
      }

      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains(STORES.CACHE_TIMESTAMP)) {
        db.createObjectStore(STORES.CACHE_TIMESTAMP, { keyPath: 'key' });
      }
    };
  });
}

// Generic CRUD operations
export async function addItem<T>(storeName: string, item: T): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.add(item);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function updateItem<T>(storeName: string, item: T): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(item);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteItem(storeName: string, id: string | number): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getItem<T>(storeName: string, id: string | number): Promise<T | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllItems<T>(storeName: string): Promise<T[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function clearStore(storeName: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Pending sync operations
export interface PendingSyncItem {
  id?: number;
  type: 'create' | 'update' | 'delete';
  storeName: string;
  data: any;
  timestamp: number;
  retryCount: number;
}

export async function addPendingSync(item: Omit<PendingSyncItem, 'id'>): Promise<void> {
  await addItem(STORES.PENDING_SYNC, item);
}

export async function getPendingSync(): Promise<PendingSyncItem[]> {
  return await getAllItems<PendingSyncItem>(STORES.PENDING_SYNC);
}

export async function removePendingSync(id: number): Promise<void> {
  await deleteItem(STORES.PENDING_SYNC, id);
}

export async function clearPendingSync(): Promise<void> {
  await clearStore(STORES.PENDING_SYNC);
}

// Cache timestamp management
export async function setCacheTimestamp(key: string, timestamp: number): Promise<void> {
  await updateItem(STORES.CACHE_TIMESTAMP, { key, timestamp });
}

export async function getCacheTimestamp(key: string): Promise<number | null> {
  const item = await getItem<{ key: string; timestamp: number }>(STORES.CACHE_TIMESTAMP, key);
  return item ? item.timestamp : null;
}

// Check if data needs refresh (older than 5 minutes)
export async function needsRefresh(key: string, maxAge: number = 5 * 60 * 1000): Promise<boolean> {
  const timestamp = await getCacheTimestamp(key);
  if (!timestamp) return true;
  return Date.now() - timestamp > maxAge;
}

// Bulk operations
export async function bulkAdd<T>(storeName: string, items: T[]): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);

    items.forEach(item => store.put(item));

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function bulkDelete(storeName: string, ids: (string | number)[]): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);

    ids.forEach(id => store.delete(id));

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// Search operations
export async function searchByIndex<T>(
  storeName: string,
  indexName: string,
  value: any
): Promise<T[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Database info
export async function getDatabaseSize(): Promise<number> {
  let totalSize = 0;
  
  for (const storeName of Object.values(STORES)) {
    const items = await getAllItems(storeName);
    const storeSize = JSON.stringify(items).length;
    totalSize += storeSize;
  }
  
  return totalSize;
}

export async function clearDatabase(): Promise<void> {
  const db = await openDatabase();
  const storeNames = Array.from(db.objectStoreNames);
  
  for (const storeName of storeNames) {
    await clearStore(storeName);
  }
}

// Export all data
export async function exportAllData(): Promise<Record<string, any[]>> {
  const data: Record<string, any[]> = {};
  
  for (const storeName of Object.values(STORES)) {
    data[storeName] = await getAllItems(storeName);
  }
  
  return data;
}

// Import all data
export async function importAllData(data: Record<string, any[]>): Promise<void> {
  for (const [storeName, items] of Object.entries(data)) {
    await bulkAdd(storeName, items);
  }
}

// Check if database is available
export function isDatabaseAvailable(): boolean {
  return 'indexedDB' in window;
}

// Initialize database
export async function initializeDatabase(): Promise<void> {
  if (!isDatabaseAvailable()) {
    logger.warn('IndexedDB is not available');
    return;
  }

  try {
    await openDatabase();
    logger.info('Offline database initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize offline database', { error });
  }
}
