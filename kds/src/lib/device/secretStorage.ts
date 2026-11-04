/**
 * Persistent storage for this device's enrollment secret.
 *
 * The secret is written to IndexedDB (NOT localStorage) so it survives a reload,
 * a kiosk power-cycle and Next's bfcache, and is namespaced away from the
 * auth/branch/station localStorage keys. It is the device's long-lived credential
 * (the 3A device anchor) and is attached as `X-Device-Secret` on PIN login and
 * every anchored request via the axios mutator.
 *
 * One tiny key/value object store; no external deps. All access is async; the
 * in-memory mirror in `./store` keeps a synchronous copy for the mutator.
 */

const DB_NAME = 'kds-device';
const STORE_NAME = 'kv';
const SECRET_KEY = 'deviceSecret';
const SURFACE_KEY = 'deviceSurface';
const DB_VERSION = 1;

/** What an enrolled device persists locally. */
export interface StoredDeviceSecret {
  secret: string;
  /** The surface this device was enrolled for (always 'KDS' in this app). */
  surface: string;
}

function hasIndexedDB(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        const request = run(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
      }),
  );
}

/** Read the enrolled device secret, or null if this device is not enrolled. */
export async function readDeviceSecret(): Promise<StoredDeviceSecret | null> {
  if (!hasIndexedDB()) return null;
  try {
    const secret = await tx<string | undefined>('readonly', (s) => s.get(SECRET_KEY));
    if (!secret) return null;
    const surface = await tx<string | undefined>('readonly', (s) => s.get(SURFACE_KEY));
    return { secret, surface: surface ?? 'KDS' };
  } catch {
    // A blocked/unavailable IndexedDB is treated as "not enrolled" rather than
    // crashing the kiosk; the enrollment gate will simply ask to enroll again.
    return null;
  }
}

/** Persist the device secret returned once at enrollment. */
export async function writeDeviceSecret(value: StoredDeviceSecret): Promise<void> {
  if (!hasIndexedDB()) return;
  await tx('readwrite', (s) => s.put(value.secret, SECRET_KEY));
  await tx('readwrite', (s) => s.put(value.surface, SURFACE_KEY));
}

/** Remove the device secret (de-enroll this device). */
export async function clearDeviceSecret(): Promise<void> {
  if (!hasIndexedDB()) return;
  try {
    await tx('readwrite', (s) => s.delete(SECRET_KEY));
    await tx('readwrite', (s) => s.delete(SURFACE_KEY));
  } catch {
    // best-effort
  }
}
