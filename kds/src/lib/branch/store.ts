import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface BranchState {
  /** Active branch id. null = not yet chosen (show setup picker). */
  branchId: string | null;
  /** Human-readable branch name, kept for the always-visible header label. */
  branchName: string | null;
  hydrated: boolean;
  setBranch: (branchId: string, branchName: string) => void;
  clear: () => void;
}

/**
 * Pins this kiosk to a single branch and remembers it across reloads, so a
 * kitchen screen always comes back to the same location after a power cycle.
 * Paired with the station store ({@link useStationStore}) to form the device pin.
 */
export const useBranchStore = create<BranchState>()(
  persist(
    (set) => ({
      branchId: null,
      branchName: null,
      hydrated: false,
      setBranch: (branchId, branchName) => set({ branchId, branchName }),
      clear: () => set({ branchId: null, branchName: null }),
    }),
    {
      name: 'kds-branch',
      partialize: (s) => ({ branchId: s.branchId, branchName: s.branchName }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);

/** Non-React accessor (e.g. for the axios mutator / realtime client). */
export const branchStore = useBranchStore;

/** Current pinned branch id, or null. Safe to call outside React. */
export function getActiveBranchId(): string | null {
  return useBranchStore.getState().branchId;
}
