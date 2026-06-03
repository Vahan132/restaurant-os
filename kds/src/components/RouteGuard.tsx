'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuthStore } from '@/lib/auth/store';

/**
 * Client-side route protection. Waits for the persisted store to rehydrate,
 * then redirects unauthenticated users to /login.
 */
export function RouteGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthed = useAuthStore((s) => Boolean(s.accessToken));

  useEffect(() => {
    if (hydrated && !isAuthed) {
      router.replace('/login');
    }
  }, [hydrated, isAuthed, router]);

  if (!hydrated || !isAuthed) {
    return (
      <div className="flex h-screen items-center justify-center text-kiosk-lg text-kiosk-muted">
        …
      </div>
    );
  }

  return <>{children}</>;
}
