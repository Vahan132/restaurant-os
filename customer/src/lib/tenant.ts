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
 * The Next.js basePath the app is served under (path-based multi-tenant deploy).
 * MUST mirror `basePath` in next.config.mjs — both read the same env so they can
 * never drift. Used to strip the prefix off `window.location.pathname` in the
 * {@link resolveSlug} fallback below. Empty string = no basePath.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '/res/m';

/**
 * Extract the restaurant slug from a basePath-STRIPPED path (what `usePathname()`
 * returns), e.g. "/demo" or "/demo/anything" -> "demo". Returns '' for "/".
 */
export function slugFromPathname(pathname: string | null | undefined): string {
  const first = (pathname ?? '').split('/').filter(Boolean)[0];
  return first ? decodeURIComponent(first).toLowerCase() : '';
}

/**
 * Fallback slug resolution straight from `window.location.pathname` (always
 * synchronously correct on the client), stripping the known basePath first so
 * "/res/m/tavern-ararat" -> "tavern-ararat" (NOT "res"). Returns '' on the
 * server or for the basePath root. This is the safety net that makes the
 * `X-Restaurant-Slug` header reliable regardless of when TenantProvider publishes.
 */
function slugFromLocation(): string {
  if (typeof window === 'undefined') return '';
  const pathname = window.location.pathname;
  const stripped =
    BASE_PATH && (pathname === BASE_PATH || pathname.startsWith(`${BASE_PATH}/`))
      ? pathname.slice(BASE_PATH.length)
      : pathname;
  return slugFromPathname(stripped);
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
 * Resolve the active restaurant slug — the slug published by TenantProvider from
 * Next's `usePathname()` (i.e. the real tenant from the page route).
 *
 * Prefers the slug published by TenantProvider; if that hasn't been published
 * yet (React may not have committed TenantProvider's render before the first
 * API request fires), it falls back to reading `window.location.pathname`
 * directly (basePath stripped). This keeps the `X-Restaurant-Slug` header
 * reliable on the very first request instead of racing render timing.
 *
 * There is deliberately NO fixed-tenant fallback (e.g. `NEXT_PUBLIC_RESTAURANT_SLUG=demo`):
 * in a multi-tenant deployment that would mask every route's slug and silently
 * serve one fixed tenant. When the URL genuinely has no slug (the basePath root)
 * this returns '' so dependent queries stay disabled and the request surfaces as
 * not-found rather than silently resolving to some default.
 *
 * Returns '' during SSR (before the browser context exists) or for the root path.
 */
export function resolveSlug(): string {
  return activeSlug || slugFromLocation();
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

/**
 * Resolve the chosen branch slug from the `?branch=` query param.
 *
 * Used only in the NO-TABLE flow (a plain menu or "book a table" link), where
 * the customer picks a location. When a table is scanned, the branch is implied
 * by the table (BR-9 returns it in table resolution) and this is ignored.
 * Returns null when no branch has been chosen yet (show the location picker).
 */
export function resolveBranchSlug(): string | null {
  if (typeof window === 'undefined') return null;
  const branch = new URLSearchParams(window.location.search).get('branch');
  const trimmed = branch?.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

/**
 * Build a basePath-relative URL for the current page with `?branch=` set to the
 * given slug (preserving an existing `?qr=`). Suitable for `router.replace` so
 * the chosen location is shareable/bookmarkable. `pathname` is Next's
 * basePath-stripped path (from `usePathname()`).
 */
export function withBranchParam(pathname: string, branchSlug: string): string {
  const params = new URLSearchParams(
    typeof window !== 'undefined' ? window.location.search : '',
  );
  params.set('branch', branchSlug);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
