'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';

const PUBLIC_ROUTES = ['/login'];

/**
 * Client-side route protection. Redirects unauthenticated users to /login and
 * sends authenticated users away from /login. Waits for the persisted store to
 * rehydrate to avoid an auth-flash / wrong redirect on first paint.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useAuthStore((s) => s.hydrated);
  const accessToken = useAuthStore((s) => s.accessToken);

  const isPublic = PUBLIC_ROUTES.includes(pathname);
  const isAuthed = Boolean(accessToken);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthed && !isPublic) {
      router.replace('/login');
    } else if (isAuthed && isPublic) {
      router.replace('/');
    }
  }, [hydrated, isAuthed, isPublic, pathname, router]);

  // Avoid flashing protected content before redirect / rehydration.
  if (!hydrated) return null;
  if (!isAuthed && !isPublic) return null;
  if (isAuthed && isPublic) return null;

  return <>{children}</>;
}
