'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Device-anchored admin auth (3A/3B). The ADMIN-surface device secret is
 * provisioned once at enrollment and kept in IndexedDB on this machine — never
 * re-fetchable from the server. It is sent as `deviceSecret` on email/password
 * login so a non-Owner admin/manager can sign in when the restaurant requires an
 * enrolled ADMIN device. This mirrors the POS/KDS device-secret storage, scoped
 * to the ADMIN surface.
 *
 * IndexedDB (not localStorage) is used so the secret is not trivially readable
 * alongside the auth tokens and survives independently of the auth session.
 */

const DB_NAME = 'restaurant-os-admin-device';
const DB_VERSION = 1;
const STORE = 'kv';
const KEY = 'admin-device';

export interface StoredAdminDevice {
  /** Plaintext device secret, sent as `deviceSecret` on admin login. */
  secret: string;
  /** Enrolled device id (for display + cross-checking against the device list). */
  deviceId: string;
  /** Human label given at enrollment. */
  label: string;
  /** Branch the device was enrolled for. */
  branchId: string;
  /** ISO timestamp of enrollment on this machine. */
  enrolledAt: string;
}

function hasIndexedDb(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
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
        const transaction = db.transaction(STORE, mode);
        const request = run(transaction.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
      }),
  );
}

/** Read the enrolled ADMIN device for this machine, or null. Never throws. */
export async function getAdminDevice(): Promise<StoredAdminDevice | null> {
  if (!hasIndexedDb()) return null;
  try {
    const value = await tx<StoredAdminDevice | undefined>('readonly', (s) => s.get(KEY));
    return value ?? null;
  } catch {
    return null;
  }
}

/** Convenience: just the secret, or null. */
export async function getAdminDeviceSecret(): Promise<string | null> {
  const device = await getAdminDevice();
  return device?.secret ?? null;
}

/** Persist the enrolled ADMIN device secret on this machine. */
export async function saveAdminDevice(device: StoredAdminDevice): Promise<void> {
  if (!hasIndexedDb()) return;
  await tx('readwrite', (s) => s.put(device, KEY));
}

/** Forget the enrolled ADMIN device on this machine. */
export async function clearAdminDevice(): Promise<void> {
  if (!hasIndexedDb()) return;
  try {
    await tx('readwrite', (s) => s.delete(KEY));
  } catch {
    // Best-effort.
  }
}

/**
 * Reactive view of the enrolled ADMIN device for this machine. Used by the
 * device management screen to show whether the current Admin device is anchored.
 */
export function useAdminDevice(): {
  device: StoredAdminDevice | null;
  loading: boolean;
  reload: () => Promise<void>;
  forget: () => Promise<void>;
} {
  const [device, setDevice] = useState<StoredAdminDevice | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const next = await getAdminDevice();
    setDevice(next);
    setLoading(false);
  }, []);

  const forget = useCallback(async () => {
    await clearAdminDevice();
    setDevice(null);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { device, loading, reload, forget };
}
