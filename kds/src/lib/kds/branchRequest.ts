import { getKdsControllerTicketsQueryKey } from '@/api/generated/kds/kds';
import type { Station } from '@/lib/realtime/client';

/** Transport header the backend uses to scope KDS calls to one branch. */
export const BRANCH_HEADER = 'X-Branch-Id';

/**
 * Header bag carrying the active branch. Spread into the orval `request` option
 * so ticket queries and status mutations are branch-scoped without hand-editing
 * the generated hooks (the header is a transport concern, not in the spec).
 */
export function branchHeaders(branchId: string): Record<string, string> {
  return { [BRANCH_HEADER]: branchId };
}

/**
 * Branch-scoped query key for a station's tickets. Extends the generated key
 * with the branch id so a re-pin to another branch reads/caches separately and
 * never shows the previous location's tickets. Invalidating with the generated
 * key still matches by prefix.
 */
export function ticketsQueryKey(station: Station, branchId: string) {
  return [...getKdsControllerTicketsQueryKey(station), branchId] as const;
}
