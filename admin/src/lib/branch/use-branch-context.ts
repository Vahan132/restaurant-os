'use client';

import { useCallback, useMemo } from 'react';

import { useActiveBranchStore } from '@/stores/active-branch';
import { useAuthStore, type AccessibleBranch } from '@/stores/auth';

export interface BranchContext {
  /** Branches the caller may switch between (from /auth/me). */
  accessibleBranches: AccessibleBranch[];
  activeBranchId: string | null;
  /** The resolved active branch object, if known. */
  activeBranch: AccessibleBranch | null;
  /** True when the caller has more than one accessible branch. */
  hasMultiple: boolean;
  /** Switch the active branch (no-op if not accessible). */
  setActiveBranch: (branchId: string) => void;
}

/**
 * Active-branch context for the app shell and branch-scoped screens. Reads the
 * accessible branches from the auth store and the current selection from the
 * persisted active-branch store, and guards selection to accessible branches.
 */
export function useBranchContext(): BranchContext {
  const accessibleBranches = useAuthStore((s) => s.accessibleBranches);
  const activeBranchId = useActiveBranchStore((s) => s.activeBranchId);
  const set = useActiveBranchStore((s) => s.setActiveBranch);

  const activeBranch = useMemo(
    () => accessibleBranches.find((b) => b.id === activeBranchId) ?? null,
    [accessibleBranches, activeBranchId],
  );

  const setActiveBranch = useCallback(
    (branchId: string) => {
      if (accessibleBranches.some((b) => b.id === branchId)) {
        set(branchId);
      }
    },
    [accessibleBranches, set],
  );

  return {
    accessibleBranches,
    activeBranchId,
    activeBranch,
    hasMultiple: accessibleBranches.length > 1,
    setActiveBranch,
  };
}
