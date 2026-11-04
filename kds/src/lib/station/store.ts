import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Station } from '@/lib/realtime/client';

export const ALL_STATIONS: Station[] = ['KITCHEN', 'BAR', 'DESSERT', 'OTHER'];

interface StationState {
  /** The single station this kiosk is pinned to. null = not yet chosen. */
  station: Station | null;
  hydrated: boolean;
  setStation: (station: Station) => void;
  clear: () => void;
}

/**
 * Pins this kiosk to exactly one station and remembers it across reloads so a
 * kitchen screen comes back to the same board after a power cycle. Paired with
 * the branch store ({@link useBranchStore}) to form the device pin.
 */
export const useStationStore = create<StationState>()(
  persist(
    (set) => ({
      station: null,
      hydrated: false,
      setStation: (station) => set({ station }),
      clear: () => set({ station: null }),
    }),
    {
      name: 'kds-station',
      partialize: (s) => ({ station: s.station }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);
