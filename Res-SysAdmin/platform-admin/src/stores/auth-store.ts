import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PlatformUserResponse } from "@/api/generated/model";

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  platformUser: PlatformUserResponse | null;
  setSession: (tokens: { accessToken: string; refreshToken: string }) => void;
  setPlatformUser: (user: PlatformUserResponse | null) => void;
  clear: () => void;
}

/**
 * Platform auth store. Persisted to localStorage so a refresh keeps the session.
 * This store is intentionally dependency-free (it does NOT import the api client)
 * so the api client can read/write tokens here without a circular import.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      platformUser: null,
      setSession: ({ accessToken, refreshToken }) => set({ accessToken, refreshToken }),
      setPlatformUser: (platformUser) => set({ platformUser }),
      clear: () => set({ accessToken: null, refreshToken: null, platformUser: null }),
    }),
    {
      name: "platform-admin-auth",
    },
  ),
);

/** Non-React accessor used by the api client mutator. */
export const authStore = {
  get: () => useAuthStore.getState(),
};
