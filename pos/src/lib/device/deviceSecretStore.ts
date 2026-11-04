/**
 * Device-secret storage — IndexedDB, per-device (NOT per-user).
 *
 * A POS terminal is enrolled ONCE (see DevicesController_enroll). The backend
 * returns the plaintext device secret a single time; we persist it here so it
 * survives reloads AND kiosk/app restarts. IndexedDB (not localStorage/
 * sessionStorage) is used deliberately: it's the durable client store and isn't
 * wiped by the same "clear site data on close" kiosk policies that target
 * localStorage, and it keeps the secret out of the synchronous web-storage that
 * the auth/branch/endpoint stores share.
 *
 * The secret is device-anchored auth material (3A): it is attached to PIN login
 * (in the body) and to every device-anchored request (as the `X-Device-Secret`
 * header — see the axios mutator). Because the mutator's request interceptor is
 * synchronous and IndexedDB is async, we keep an in-memory mirror (`cached`)
 * that is hydrated once at boot via `loadDeviceSecret()` and kept in lock-step on
 * every write/clear. `getDeviceSecret()` reads that mirror synchronously.
 */

const DB_NAME = 'pos-device';
const DB_VERSION = 1;
const STORE_NAME = 'kv';
const SECRET_KEY = 'device-secret';

/** Synchronous mirror of the persisted secret (see file header). */
let cached: string | null = null;
/** True once we've attempted to read IndexedDB at least once. */
let loaded = false;
/** Shared in-flight hydration so concurrent callers await one read. */
let loadPromise: Promise<string | null> | null = null;

type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** Subscribe to secret changes (set/clear/hydrate). Returns an unsubscribe fn. */
export function subscribeDeviceSecret(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The current secret, read synchronously from the in-memory mirror. */
export function getDeviceSecret(): string | null {
  return cached;
}

/** Whether this device currently has an enrolled secret. */
export function isDeviceEnrolled(): boolean {
  return cached !== null;
}

/** True once IndexedDB has been read at least once (avoids gate flashes). */
export function isDeviceSecretHydrated(): boolean {
  return loaded;
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const request = run(tx.objectStore(STORE_NAME));
        tx.oncomplete = () => {
          resolve(request.result as T);
          db.close();
        };
        tx.onerror = () => {
          reject(tx.error);
          db.close();
        };
        tx.onabort = () => {
          reject(tx.error);
          db.close();
        };
      }),
  );
}

/**
 * Hydrate the in-memory mirror from IndexedDB. Safe to call repeatedly — the
 * read is shared and, once resolved, subsequent calls are cheap. On any failure
 * (private mode, blocked DB, SSR) we degrade to "not enrolled" rather than throw.
 */
export function loadDeviceSecret(): Promise<string | null> {
  if (loaded) return Promise.resolve(cached);
  if (loadPromise) return loadPromise;

  if (!hasIndexedDb()) {
    loaded = true;
    notify();
    return Promise.resolve(null);
  }

  loadPromise = withStore<string | undefined>('readonly', (store) => store.get(SECRET_KEY))
    .then((value) => {
      cached = typeof value === 'string' && value.length > 0 ? value : null;
      return cached;
    })
    .catch(() => {
      cached = null;
      return null;
    })
    .finally(() => {
      loaded = true;
      loadPromise = null;
      notify();
    });

  return loadPromise;
}

/** Persist a freshly-enrolled secret and update the mirror. */
export async function setDeviceSecret(secret: string): Promise<void> {
  cached = secret;
  loaded = true;
  notify();
  if (!hasIndexedDb()) return;
  try {
    await withStore('readwrite', (store) => store.put(secret, SECRET_KEY));
  } catch {
    // The mirror is already set; a persistence failure means the secret simply
    // won't survive a restart. Surfaced to the user via re-enrollment if needed.
  }
}

/** Remove the enrolled secret (e.g. on revoke / re-enroll). */
export async function clearDeviceSecret(): Promise<void> {
  cached = null;
  loaded = true;
  notify();
  if (!hasIndexedDb()) return;
  try {
    await withStore('readwrite', (store) => store.delete(SECRET_KEY));
  } catch {
    // Best-effort; the mirror is already cleared.
  }
}
