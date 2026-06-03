'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/** Mute toggle for the incoming-request alert sound (persisted per device). */
interface RequestSoundState {
  muted: boolean;
  toggle: () => void;
}

export const useRequestSound = create<RequestSoundState>()(
  persist(
    (set) => ({
      muted: false,
      toggle: () => set((s) => ({ muted: !s.muted })),
    }),
    { name: 'pos-request-sound', storage: createJSONStorage(() => localStorage) },
  ),
);
