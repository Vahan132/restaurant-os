'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { FullScreenLoader } from '@/components/ui/full-screen-loader';
import { usePlatformStoreHydrated } from '@/lib/platform/use-platform-hydrated';
import { usePlatformAuthStore } from '@/stores/platform-auth';

/** Protects /platform routes. Redirects to /platform/login when no token is present. */
export function PlatformAuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const ready = usePlatformStoreHydrated();
  const accessToken = usePlatformAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (ready && !accessToken) {
      router.replace('/platform/login');
    }
  }, [ready, accessToken, router]);

  if (!ready || !accessToken) {
    return <FullScreenLoader />;
  }

  return <>{children}</>;
}
