'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import {
  getRestaurantControllerProfileQueryKey,
  getRestaurantControllerSettingsQueryKey,
} from '@/api/generated/restaurant/restaurant';
import { getBranchesControllerListQueryKey } from '@/api/generated/branches/branches';

/** bps (basis points) -> percent string with up to 2 decimals. 250 -> "2.5". */
export function bpsToPercent(bps: number): string {
  return String(Math.round((bps / 100) * 100) / 100);
}

/** percent (0–100, up to 2 decimals) -> integer bps. 2.5 -> 250. null if invalid. */
export function percentToBps(input: string): number | null {
  const n = parseFloat(String(input).trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return Math.round(n * 100);
}

/**
 * Invalidates restaurant profile + settings caches. Crucially also invalidates
 * the A1 `useRestaurant` query (key ['restaurant']) that the app shell and
 * money formatter read, so currency/name changes apply app-wide immediately.
 */
export function useSettingsInvalidation() {
  const qc = useQueryClient();
  const invalidateProfile = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['restaurant'] }),
      qc.invalidateQueries({ queryKey: getRestaurantControllerProfileQueryKey() }),
    ]);
  }, [qc]);
  const invalidateSettings = useCallback(
    () => qc.invalidateQueries({ queryKey: getRestaurantControllerSettingsQueryKey() }),
    [qc],
  );
  const invalidateBranches = useCallback(
    () => qc.invalidateQueries({ queryKey: getBranchesControllerListQueryKey() }),
    [qc],
  );
  return { invalidateProfile, invalidateSettings, invalidateBranches };
}
