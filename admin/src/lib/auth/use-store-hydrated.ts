'use client';

import { useEffect, useState } from 'react';

import { useAuthStore } from '@/stores/auth';

/**
 * True once the persisted auth store has rehydrated from localStorage.
 * Guards must wait for this before deciding to redirect, otherwise the very
 * first client render (tokens still null) would bounce a logged-in user.
 */
export function useStoreHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() =>
    useAuthStore.persist.hasHydrated(),
  );

  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() =>
      setHydrated(true),
    );
    setHydrated(useAuthStore.persist.hasHydrated());
    return unsub;
  }, []);

  return hydrated;
}
