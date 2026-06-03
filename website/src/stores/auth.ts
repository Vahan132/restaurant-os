"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Authenticated session, persisted to localStorage.
 *
 * Decoupled from the generated API model on purpose (so the store has no
 * codegen dependency): `SessionUser` is a structural subset of the API's
 * UserResponse — anything extra is preserved via the index signature.
 */
export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  organizationId?: string | null;
  restaurantId?: string | null;
  [key: string]: unknown;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: SessionUser | null;
  /** True once the persisted state has been read back from storage. */
  hasHydrated: boolean;

  setSession: (session: {
    accessToken: string;
    refreshToken: string;
    user: SessionUser;
  }) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: SessionUser) => void;
  clear: () => void;
  setHasHydrated: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      hasHydrated: false,

      setSession: ({ accessToken, refreshToken, user }) =>
        set({ accessToken, refreshToken, user }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setUser: (user) => set({ user }),
      clear: () => set({ accessToken: null, refreshToken: null, user: null }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: "ros-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
);

/** Convenience: is there an access token right now (non-reactive read). */
export const isAuthenticated = () => Boolean(useAuthStore.getState().accessToken);
