import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Branch session store — per-device (NOT per-user) branch selection.
 *
 * A POS terminal lives at one branch. The active branch is persisted to
 * localStorage so it survives reloads, logouts and shift changes — staff aren't
 * re-asked "which branch is this terminal at?" every time they sign in. It is
 * only re-prompted when the selection is missing or no longer accessible to the
 * signed-in user (handled by BranchGate).
 *
 * The active branch drives every branch-scoped request (X-Branch-Id header in
 * the mutator) and the realtime handshake, so menu/prices, tables/floor and
 * orders all reflect the selected branch.
 */

interface BranchState {
  /** Currently selected branch id, or null when none is selected yet. */
  activeBranchId: string | null;
  /** True once persisted state has rehydrated (avoids a picker-flash on first paint). */
  hydrated: boolean;

  setActiveBranch: (branchId: string) => void;
  /** Clear the selection (e.g. when the user can no longer access it). */
  clearBranch: () => void;
}

export const useBranchStore = create<BranchState>()(
  persist(
    (set) => ({
      activeBranchId: null,
      hydrated: false,

      setActiveBranch: (branchId) => set({ activeBranchId: branchId }),
      clearBranch: () => set({ activeBranchId: null }),
    }),
    {
      // Device-level key, intentionally separate from `pos-auth` so the branch
      // outlives any single user session on this terminal.
      name: 'pos-branch',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ activeBranchId: state.activeBranchId }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);
