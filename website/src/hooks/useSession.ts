"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useAuthStore } from "@/stores/auth";

/**
 * Read the persisted session. `ready` is true once zustand has rehydrated
 * from localStorage, so consumers can avoid flashing the wrong UI on first
 * paint.
 */
export function useSession() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.hasHydrated);
  return { ready, isAuthenticated: Boolean(accessToken), user };
}

/**
 * Gate a client route on a valid session. Redirects to /login (preserving the
 * intended destination) once hydration confirms there is no token.
 */
export function useRequireAuth() {
  const router = useRouter();
  const pathname = usePathname();
  const { ready, isAuthenticated } = useSession();

  useEffect(() => {
    if (ready && !isAuthenticated) {
      // `usePathname()` is basePath-stripped, so the saved destination round-trips
      // cleanly back through `router.replace` (which re-adds the basePath) — using
      // `window.location.pathname` here would double the /res prefix. The query
      // string is unaffected by basePath, so read it straight off the URL (this
      // also avoids `useSearchParams()`, which would force a CSR suspense bailout).
      const search = typeof window !== "undefined" ? window.location.search : "";
      const next = encodeURIComponent(`${pathname}${search}`);
      router.replace(`/login${next ? `?next=${next}` : ""}`);
    }
  }, [ready, isAuthenticated, router, pathname]);

  return { ready, isAuthenticated };
}
