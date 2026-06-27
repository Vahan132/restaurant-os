'use client';

import { useMemo } from 'react';
import type { AccessibleBranchResponse } from '@/api/generated/model';
import { useAuthMe } from '@/lib/useAuthMe';
import { useBranchStore } from '@/stores/branch';

/**
 * One branch the signed-in user can operate at, as returned by GET /auth/me
 * (`accessibleBranches`), each carrying its own effective permission set.
 */
export type AccessibleBranch = AccessibleBranchResponse;

/**
 * The branches accessible to the current user, sourced from /auth/me. Drives the
 * single-vs-multi branch decision (auto-select vs. require a pick) in BranchGate.
 */
export function useAccessibleBranches() {
  const query = useAuthMe();
  const me = query.data;

  const branches = useMemo<AccessibleBranch[]>(
    () => me?.accessibleBranches ?? [],
    [me],
  );

  return {
    branches,
    defaultBranchId: me?.defaultBranchId ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

/** The currently selected branch object (resolved against the accessible list). */
export function useActiveBranch(): AccessibleBranch | null {
  const { branches } = useAccessibleBranches();
  const activeBranchId = useBranchStore((s) => s.activeBranchId);
  return useMemo(
    () => branches.find((b) => b.id === activeBranchId) ?? null,
    [branches, activeBranchId],
  );
}
