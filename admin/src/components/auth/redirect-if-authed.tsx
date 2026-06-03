'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { useStoreHydrated } from '@/lib/auth/use-store-hydrated';
import { useAuthStore } from '@/stores/auth';

/** Wraps public auth pages: sends already-authenticated users to the app. */
export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const router = useRouter();
  const storeReady = useStoreHydrated();
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (storeReady && accessToken) {
      router.replace('/');
    }
  }, [storeReady, accessToken, router]);

  if (storeReady && accessToken) {
    return null;
  }

  return <>{children}</>;
}
