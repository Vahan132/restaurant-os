'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { usePlatformStoreHydrated } from '@/lib/platform/use-platform-hydrated';
import { usePlatformAuthStore } from '@/stores/platform-auth';

/** Wraps the platform login page: sends already-authenticated operators to the catalog. */
export function RedirectIfPlatformAuthed({ children }: { children: ReactNode }) {
  const router = useRouter();
  const ready = usePlatformStoreHydrated();
  const accessToken = usePlatformAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (ready && accessToken) {
      router.replace('/platform/catalog');
    }
  }, [ready, accessToken, router]);

  if (ready && accessToken) {
    return null;
  }

  return <>{children}</>;
}
