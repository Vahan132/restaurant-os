import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Active-branch context (BR-7). Persisted so the chosen branch survives reloads
 * and is shared across tabs. Initialised from /auth/me's default branch by the
 * auth hydration flow and constrained to the caller's accessible branches.
 *
 * The axios mutator reads `activeBranchId` to attach `X-Branch-Id` on every
 * request; branch-scoped endpoints honour it, restaurant-scoped ones ignore it.
 */
interface ActiveBranchState {
  activeBranchId: string | null;
  setActiveBranch: (branchId: string | null) => void;
  clear: () => void;
}

export const useActiveBranchStore = create<ActiveBranchState>()(
  persist(
    (set) => ({
      activeBranchId: null,
      setActiveBranch: (branchId) => set({ activeBranchId: branchId }),
      clear: () => set({ activeBranchId: null }),
    }),
    { name: 'restaurant-os-active-branch' },
  ),
);
