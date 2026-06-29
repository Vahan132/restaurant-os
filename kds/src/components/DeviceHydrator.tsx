'use client';

import { useEffect } from 'react';
import { hydrateDeviceStore } from '@/lib/device/store';

/**
 * Loads the persisted device secret from IndexedDB into the in-memory mirror on
 * app boot, before any screen decides whether to show enrollment, the staff
 * picker, or the board. Renders nothing. Mounted high in the tree (root layout)
 * so the secret is available to the axios mutator for the first request.
 */
export function DeviceHydrator() {
  useEffect(() => {
    void hydrateDeviceStore();
  }, []);
  return null;
}
