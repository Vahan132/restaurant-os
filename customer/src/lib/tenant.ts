/**
 * Multi-tenant resolution for the public Customer QR Menu app.
 *
 * The frontend is a single deployment that serves many restaurants. It resolves
 * which restaurant ("slug") it is rendering CLIENT-SIDE and forwards that slug to
 * the backend on every request via the `X-Restaurant-Slug` header (the backend's
 * dev / slug fallback). The table, when present, comes from the `?qr=` query param.
 *
 * IMPORTANT — path-based deployment: the app is served under a Next.js basePath
 * (e.g. /res/m), so `window.location.pathname` still INCLUDES that prefix
 * ("/res/m/<slug>"). The slug must be read from the basePath-STRIPPED path that
 * Next exposes via `usePathname()`. `TenantProvider` publishes that value here so
 * non-React callers (the axios interceptor, the cart storage key) can read it.
 */

/** Slug published by TenantProvider from Next's basePath-stripped pathname. */
let activeSlug = '';

/**
 * Extract the restaurant slug from a basePath-STRIPPED path (what `usePathname()`
 * returns), e.g. "/demo" or "/demo/anything" -> "demo". Returns '' for "/".
 */
export function slugFromPathname(pathname: string | null | undefined): string {
  const first = (pathname ?? '').split('/').filter(Boolean)[0];
  return first ? decodeURIComponent(first).toLowerCase() : '';
}

/**
 * Publish the active slug (called by TenantProvider on the client). Ignored on
 * the server so a shared module instance never leaks one request's slug into
 * another's — all tenant-scoped fetches run client-side.
 */
export function setActiveSlug(slug: string): void {
  if (typeof window === 'undefined') return;
  activeSlug = slug;
}

/**
 * Resolve the active restaurant slug.
 *
 * Priority:
 *   1. NEXT_PUBLIC_RESTAURANT_SLUG env override (handy in dev / single-tenant builds)
 *   2. The slug published by TenantProvider (from Next's `usePathname()`)
 *
 * Returns an empty string when nothing can be resolved (e.g. during SSR before the
 * browser context exists). The backend treats a missing slug via its own fallback.
 */
export function resolveSlug(): string {
  const envSlug = process.env.NEXT_PUBLIC_RESTAURANT_SLUG?.trim();
  if (envSlug) return envSlug;
  return activeSlug;
}

/**
 * Resolve the table QR identifier from the `?qr=` query param.
 * May be absent — the menu still renders without a table. (The query string is
 * unaffected by basePath, so reading it directly is safe.)
 */
export function resolveTableQr(): string | null {
  if (typeof window === 'undefined') return null;
  const qr = new URLSearchParams(window.location.search).get('qr');
  const trimmed = qr?.trim();
  return trimmed ? trimmed : null;
}
