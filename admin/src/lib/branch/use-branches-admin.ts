'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import {
  useBranchesControllerList,
  getBranchesControllerListQueryKey,
} from '@/api/generated/branches/branches';
import type { BranchResponse } from '@/api/generated/model';
import { hydrateUser } from '@/lib/auth/auth-service';
import { normalizeList } from '@/lib/normalize-list';

/** Branch management list (BR-3), normalized (array or { items }). */
export function useBranchesAdmin() {
  const query = useBranchesControllerList();
  const branches = useMemo(
    () => normalizeList<BranchResponse>(query.data).items,
    [query.data],
  );
  return { ...query, branches };
}

/**
 * Invalidate the branch list after a write, and refresh /auth/me so the top-bar
 * switcher reflects the new default / disabled state.
 */
export function useBranchesAdminInvalidation() {
  const qc = useQueryClient();
  return useCallback(async () => {
    await qc.invalidateQueries({
      queryKey: getBranchesControllerListQueryKey(),
    });
    await hydrateUser();
  }, [qc]);
}
