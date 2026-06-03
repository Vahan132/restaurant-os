import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Station } from '@/lib/realtime/client';

export const ALL_STATIONS: Station[] = ['KITCHEN', 'BAR', 'DESSERT', 'OTHER'];

interface StationState {
  /** Stations this kiosk is showing. Empty = not yet chosen (show picker). */
  stations: Station[];
  hydrated: boolean;
  setStations: (stations: Station[]) => void;
  clear: () => void;
}

/**
 * Remembers the kiosk's station selection across reloads so a kitchen screen
 * comes back to the same board after a power cycle.
 */
export const useStationStore = create<StationState>()(
  persist(
    (set) => ({
      stations: [],
      hydrated: false,
      setStations: (stations) => set({ stations }),
      clear: () => set({ stations: [] }),
    }),
    {
      name: 'kds-station',
      partialize: (s) => ({ stations: s.stations }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);
