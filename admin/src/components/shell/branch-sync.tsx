'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { invalidateBranchScopedQueries } from '@/lib/branch/branch-queries';
import { useActiveBranchStore } from '@/stores/active-branch';

/**
 * Watches the active branch and invalidates branch-scoped queries whenever it
 * changes, so every branch-scoped screen reloads for the newly selected branch
 * (BR-7 §1). Renders nothing; mounted once in the app shell.
 */
export function BranchSync() {
  const qc = useQueryClient();
  const activeBranchId = useActiveBranchStore((s) => s.activeBranchId);
  const previous = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    // Skip the first run (initial hydration), only react to real changes.
    if (previous.current !== undefined && previous.current !== activeBranchId) {
      void invalidateBranchScopedQueries(qc);
    }
    previous.current = activeBranchId;
  }, [activeBranchId, qc]);

  return null;
}
