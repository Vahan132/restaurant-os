/**
 * QR-web table-session token store (ORDER-2).
 *
 * The QR-orders backend controller is session-gated: every ordering call
 * (validate-cart, create, confirm-payment, receipt) — as well as the table
 * session view — must carry an `X-Session-Token`. This module is the single
 * source of truth for that token, mirroring the tenant-slug pattern in
 * {@link file://./tenant.ts}: a module-level singleton the axios interceptor can
 * read SYNCHRONOUSLY on the very first request, backed by localStorage so a
 * refresh (or a later revisit) reattaches to the same table session.
 *
 * Storage key: `resqr.session:<slug>:<qr>` — scoped by restaurant + table so a
 * different table (or restaurant) never replays another's token. This mirrors
 * the cart storage key in {@link file://../components/cart/CartProvider.tsx}.
 *
 * Browsing stays session-free: no token is minted until the first ordering
 * action (checkout intent), so `resolveSessionToken()` simply returns null while
 * the customer is only browsing the menu.
 */

import { resolveSlug, resolveTableQr } from './tenant';

const STORAGE_PREFIX = 'resqr.session';

/**
 * The active token, published synchronously so the axios interceptor sees it on
 * the first request after open/reattach without waiting for a React render or a
 * localStorage read. Null = no active session (browsing).
 */
let activeToken: string | null = null;

/** Per-table storage key, or null on the server / before a table is known. */
function storageKey(): string | null {
  if (typeof window === 'undefined') return null;
  const slug = resolveSlug() || 'unknown';
  const qr = resolveTableQr() ?? 'no-table';
  return `${STORAGE_PREFIX}:${slug}:${qr}`;
}

/** Read the persisted token for the current table (private-mode safe). */
function loadFromStorage(): string | null {
  const key = storageKey();
  if (!key) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Storage may be unavailable (Safari private mode) — treat as no token.
    return null;
  }
}

/**
 * Resolve the active session token. Prefers the in-memory singleton (freshest,
 * set the moment a session opens); falls back to localStorage so a page refresh
 * or revisit reattaches. Returns null while browsing (no session yet).
 */
export function resolveSessionToken(): string | null {
  return activeToken ?? loadFromStorage();
}

/**
 * Publish + persist a freshly minted session token (called after a successful
 * `open`). No-op on the server. Persist is best-effort (private mode).
 */
export function setActiveSessionToken(token: string): void {
  if (typeof window === 'undefined') return;
  activeToken = token;
  const key = storageKey();
  if (!key) return;
  try {
    window.localStorage.setItem(key, token);
  } catch {
    /* storage unavailable — the in-memory token still works for this tab */
  }
}

/**
 * Clear the active session token (on 401 / expiry, before opening a fresh one).
 */
export function clearActiveSessionToken(): void {
  activeToken = null;
  const key = storageKey();
  if (!key) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** True when a token exists for the current table (in memory or persisted). */
export function hasSessionToken(): boolean {
  return resolveSessionToken() != null;
}
