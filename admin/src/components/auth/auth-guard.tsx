'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { FullScreenLoader } from '@/components/ui/full-screen-loader';
import { hydrateUser } from '@/lib/auth/auth-service';
import { useStoreHydrated } from '@/lib/auth/use-store-hydrated';
import { useAuthStore } from '@/stores/auth';

/**
 * Protects authenticated routes. Redirects to /login when no token is present,
 * and hydrates the user via /auth/me on app load when a token exists.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const storeReady = useStoreHydrated();
  const accessToken = useAuthStore((s) => s.accessToken);
  const userHydrated = useAuthStore((s) => s.hydrated);

  useEffect(() => {
    if (!storeReady) return;
    if (!accessToken) {
      router.replace('/login');
      return;
    }
    if (!userHydrated) {
      void hydrateUser();
    }
  }, [storeReady, accessToken, userHydrated, router]);

  if (!storeReady || !accessToken || !userHydrated) {
    return <FullScreenLoader />;
  }

  return <>{children}</>;
}
