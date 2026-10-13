'use client';

import { useEffect, useState } from 'react';

import { useAuthStore } from '@/stores/auth';

/**
 * True once the persisted auth store has rehydrated from localStorage.
 * Guards must wait for this before deciding to redirect, otherwise the very
 * first client render (tokens still null) would bounce a logged-in user.
 */
export function useStoreHydrated(): boolean {
  // `persist` is attached by the zustand middleware, but it can be momentarily
  // unavailable during server render — guard so SSR never throws.
  const [hydrated, setHydrated] = useState(
    () => useAuthStore.persist?.hasHydrated() ?? false,
  );

  useEffect(() => {
    const persist = useAuthStore.persist;
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
