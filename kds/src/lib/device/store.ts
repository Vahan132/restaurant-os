import { create } from 'zustand';
import {
  clearDeviceSecret,
  readDeviceSecret,
  writeDeviceSecret,
} from './secretStorage';

/**
 * In-memory mirror of the device secret held in IndexedDB ({@link ./secretStorage}).
 *
 * IndexedDB is async but the axios mutator needs the secret synchronously to
 * attach `X-Device-Secret`, so this store keeps a live copy — exactly how the
 * auth store mirrors the bearer token. The secret is NOT persisted to
 * localStorage here; IndexedDB remains the only on-disk home for it.
 *
 * Store actions are named `setEnrolled`/`clearEnrolled` (NOT `use*`) so the
 * `react-hooks/rules-of-hooks` lint never mistakes them for hooks.
 */
interface DeviceState {
  /** The enrolled device secret, or null when this device is not enrolled. */
  secret: string | null;
  /** Surface this device was enrolled for (always 'KDS' here). */
  surface: string | null;
  /** True once the initial IndexedDB read has finished. */
  hydrated: boolean;

  setEnrolled: (secret: string, surface: string) => void;
  clearEnrolled: () => void;
}

export const useDeviceStore = create<DeviceState>((set) => ({
  secret: null,
  surface: null,
  hydrated: false,

  setEnrolled: (secret, surface) => set({ secret, surface }),
  clearEnrolled: () => set({ secret: null, surface: null }),
}));

/** Non-React accessor for use inside the axios mutator. */
export const deviceStore = useDeviceStore;

/** True if this device currently holds an enrollment secret. Safe outside React. */
export function isDeviceEnrolled(): boolean {
  return Boolean(useDeviceStore.getState().secret);
}

/** The current device secret (or null). Safe to call outside React. */
export function getDeviceSecret(): string | null {
  return useDeviceStore.getState().secret;
}

/**
 * Load the persisted secret from IndexedDB into the in-memory mirror. Called
 * once on app boot (see DeviceHydrator) before the enrollment gate decides what
 * to render. Idempotent and safe to await repeatedly.
 */
export async function hydrateDeviceStore(): Promise<void> {
  const stored = await readDeviceSecret();
  useDeviceStore.setState({
    secret: stored?.secret ?? null,
    surface: stored?.surface ?? null,
    hydrated: true,
  });
}

/**
 * Persist a freshly-enrolled secret to IndexedDB and update the mirror. The
 * backend returns the plaintext secret exactly once at enrollment.
 */
export async function persistEnrollment(secret: string, surface: string): Promise<void> {
  await writeDeviceSecret({ secret, surface });
  useDeviceStore.getState().setEnrolled(secret, surface);
}

/** De-enroll this device: wipe IndexedDB and the in-memory mirror. */
export async function clearEnrollment(): Promise<void> {
  await clearDeviceSecret();
  useDeviceStore.getState().clearEnrolled();
}
