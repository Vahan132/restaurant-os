'use client';

import { usePathname } from 'next/navigation';
import { type ReactNode } from 'react';

import { setActiveSlug, slugFromPathname } from '@/lib/tenant';

/**
 * Publishes the active restaurant slug derived from Next's `usePathname()`.
 *
 * `usePathname()` returns the path with the configured basePath (/res/m)
 * ALREADY STRIPPED — so on /res/m/demo?qr=5 it yields "/demo" and we resolve the
 * slug as "demo". (Reading `window.location.pathname` would wrongly yield "res".)
 *
 * We publish during render — not in an effect — because the slug must be set
 * before descendant query effects fire (parent render precedes child mount).
 * `setActiveSlug` no-ops on the server, so this is safe to run during SSR.
 */
export default function TenantProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  setActiveSlug(slugFromPathname(pathname));
  return <>{children}</>;
}
