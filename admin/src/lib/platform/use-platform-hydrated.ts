'use client';

import { useEffect, useState } from 'react';

import { usePlatformAuthStore } from '@/stores/platform-auth';

/** True once the persisted platform-auth store has rehydrated from localStorage. */
export function usePlatformStoreHydrated(): boolean {
  const [hydrated, setHydrated] = useState(
    () => usePlatformAuthStore.persist?.hasHydrated() ?? false,
  );

  useEffect(() => {
    const persist = usePlatformAuthStore.persist;
    if (!persist) {
      setHydrated(true);
      return;
    }
    const unsub = persist.onFinishHydration(() => setHydrated(true));
    setHydrated(persist.hasHydrated());
    return unsub;
  }, []);

  return hydrated;
}
