/**
 * Builds the exact on-device state the POS/KDS apps read on boot, so a context
 * starts already authenticated — no PIN UI. Two stores per surface:
 *   - localStorage (zustand-persist) → tokens + branch (+ KDS station/permissions)
 *   - IndexedDB → the device secret (the device anchor)
 *
 * Shapes verified against the app stores:
 *   POS  pos-auth / pos-branch          ; IDB `pos-device`/`kv`/`device-secret`
 *   KDS  kds-auth / kds-branch / kds-station ; IDB `kds-device`/`kv`/{deviceSecret,deviceSurface}
 */
import type { Page } from '@playwright/test';
import type { PinLoginResult, MeResult } from './api';

type StorageState = {
  cookies: never[];
  origins: Array<{ origin: string; localStorage: Array<{ name: string; value: string }> }>;
};

/** zustand-persist envelope: { state: <partialized>, version: 0 }. */
function zustand(state: Record<string, unknown>): string {
  return JSON.stringify({ state, version: 0 });
}

export function posStorageState(origin: string, login: PinLoginResult): StorageState {
  return {
    cookies: [],
    origins: [
      {
        origin,
        localStorage: [
          {
            name: 'pos-auth',
            value: zustand({
              accessToken: login.accessToken,
              refreshToken: login.refreshToken,
              user: login.user,
            }),
          },
          { name: 'pos-branch', value: zustand({ activeBranchId: login.branchId }) },
        ],
      },
    ],
  };
}

export function kdsStorageState(
  origin: string,
  login: PinLoginResult,
  me: MeResult,
  station: string,
): StorageState {
  const branchId = login.branchId;
  const branchName = me.accessibleBranches.find((b) => b.id === branchId)?.name ?? '';
  return {
    cookies: [],
    origins: [
      {
        origin,
        localStorage: [
          {
            name: 'kds-auth',
            value: zustand({
              accessToken: login.accessToken,
              refreshToken: login.refreshToken,
              user: me.user,
              permissions: me.permissions,
              allBranches: me.allBranches,
              accessibleBranches: me.accessibleBranches,
              defaultBranchId: me.defaultBranchId,
            }),
          },
          { name: 'kds-branch', value: zustand({ branchId, branchName }) },
          { name: 'kds-station', value: zustand({ station }) },
        ],
      },
    ],
  };
}

/**
 * Write the POS device secret into IndexedDB (out-of-line key, store has no
 * keyPath). Run AFTER the first navigation, then reload so DeviceEnrollmentGate
 * re-hydrates as "enrolled".
 */
export async function seedPosDeviceSecret(page: Page, secret: string): Promise<void> {
  await page.evaluate(async (s: string) => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('pos-device', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(s, 'device-secret');
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  }, secret);
}

/** KDS variant: two keys — deviceSecret + deviceSurface — in `kds-device`/`kv`. */
export async function seedKdsDeviceSecret(
  page: Page,
  secret: string,
  surface: string,
): Promise<void> {
  await page.evaluate(
    async ({ s, surf }: { s: string; surf: string }) => {
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('kds-device', 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
        };
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('kv', 'readwrite');
          tx.objectStore('kv').put(s, 'deviceSecret');
          tx.objectStore('kv').put(surf, 'deviceSurface');
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    },
    { s: secret, surf: surface },
  );
}
