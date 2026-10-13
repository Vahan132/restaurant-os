'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { invalidateBranchScopedQueries } from '@/lib/branch/branch-queries';

/**
 * After a successful import/clone APPLY into the active branch, reload all
 * branch-scoped screens (menu, inventory, recipes, processes…) so they reflect
 * the newly populated catalog (BR-7 §5).
 */
export function useCatalogRefetch() {
  const qc = useQueryClient();
  return useCallback(() => invalidateBranchScopedQueries(qc), [qc]);
}
