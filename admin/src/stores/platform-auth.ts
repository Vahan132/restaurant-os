import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { PlatformUserResponse } from '@/api/generated/model';

/**
 * Platform-operator session — SEPARATE from the tenant `useAuthStore`. Platform
 * routes (/platform/*) authenticate with this token; the axios mutator picks the
 * token by URL. Persisted under its own storage key so the two sessions coexist.
 */
interface PlatformAuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: PlatformUserResponse | null;

  setTokens: (accessToken: string, refreshToken: string) => void;
  setAuth: (args: {
    accessToken: string;
    refreshToken: string;
    user: PlatformUserResponse;
  }) => void;
  setUser: (user: PlatformUserResponse) => void;
  clear: () => void;
}

export const PLATFORM_AUTH_STORAGE_KEY = 'restaurant-os-platform-auth';

export const usePlatformAuthStore = create<PlatformAuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,

      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setAuth: ({ accessToken, refreshToken, user }) =>
        set({ accessToken, refreshToken, user }),
      setUser: (user) => set({ user }),
      clear: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    {
      name: PLATFORM_AUTH_STORAGE_KEY,
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        user: s.user,
      }),
    },
  ),
);
