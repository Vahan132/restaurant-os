import type { QueryClient } from '@tanstack/react-query';

/**
 * Query-key roots that are RESTAURANT-scoped (they ignore `X-Branch-Id`).
 * Everything else is treated as branch-scoped and reloaded when the active
 * branch changes. Keys are the URL paths the generated hooks use as their first
 * key segment, plus the shell's `['restaurant']` convenience query.
 */
const RESTAURANT_SCOPED_ROOTS = [
  'restaurant', // useRestaurant -> ['restaurant']
  '/restaurant', // profile / settings / (legacy) /restaurant/branches
  '/branches', // branch management list + per-user branch-memberships live under /users
  '/users', // users list + /users/:id/branch-memberships
  '/roles',
  '/permissions',
  '/account',
  '/audit-logs',
];

/** True when a query key belongs to a branch-scoped screen. */
export function isBranchScopedKey(key: unknown): boolean {
  if (!Array.isArray(key) || key.length === 0) return true;
  const root = key[0];
  if (typeof root !== 'string') return true;
  return !RESTAURANT_SCOPED_ROOTS.some(
    (r) => root === r || root.startsWith(`${r}/`),
  );
}

/**
 * Invalidate every branch-scoped query so screens (menu, inventory, orders,
 * tables, KDS, reservations, dashboard, reports…) reload for the newly selected
 * branch. Restaurant-scoped queries are left intact to avoid shell flicker.
 */
export function invalidateBranchScopedQueries(qc: QueryClient): Promise<void> {
  return qc.invalidateQueries({
    predicate: (query) => isBranchScopedKey(query.queryKey),
  });
}
