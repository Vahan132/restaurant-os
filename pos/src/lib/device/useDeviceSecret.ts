'use client';

import { useEffect, useSyncExternalStore } from 'react';
import {
  clearDeviceSecret,
  getDeviceSecret,
  isDeviceSecretHydrated,
  loadDeviceSecret,
  setDeviceSecret,
  subscribeDeviceSecret,
} from './deviceSecretStore';

export interface DeviceSecretState {
  /** The enrolled device secret, or null when this device isn't enrolled. */
  secret: string | null;
  /** True once IndexedDB has been read (so gates don't flash). */
  hydrated: boolean;
  /** True when a secret is present. */
  enrolled: boolean;
  /** Persist a freshly-enrolled secret. */
  enroll: (secret: string) => Promise<void>;
  /** Drop the enrolled secret (revoke / re-enroll). */
  reset: () => Promise<void>;
}

/**
 * React access to the device secret. Backed by the module-level IndexedDB store
 * (`deviceSecretStore`) via `useSyncExternalStore`, so every consumer re-renders
 * on enroll/clear/hydrate. Triggers a one-time hydration on mount.
 */
export function useDeviceSecret(): DeviceSecretState {
  const secret = useSyncExternalStore(
    subscribeDeviceSecret,
    getDeviceSecret,
    () => null, // server snapshot: never enrolled during SSR
  );
  const hydrated = useSyncExternalStore(
    subscribeDeviceSecret,
    isDeviceSecretHydrated,
    () => false,
  );

  useEffect(() => {
    void loadDeviceSecret();
  }, []);

  return {
    secret,
    hydrated,
    enrolled: secret !== null,
    enroll: setDeviceSecret,
    reset: clearDeviceSecret,
  };
}
