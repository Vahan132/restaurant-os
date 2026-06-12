import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Minimal user shape kept in the store. Mirrors the backend `UserResponse`
 * but is declared locally so the store does not depend on generated code.
 */
export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  roleId: string;
  organizationId: string;
  restaurantId: string | null;
  branchId: string | null;
  status: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  /** Permission keys from GET /auth/me. Drives nav gating and <Can>. */
  permissions: string[];
  /** Whether /auth/me hydration has completed (so guards can wait). */
  hydrated: boolean;

  setTokens: (accessToken: string, refreshToken: string) => void;
  setAuth: (args: {
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
  }) => void;
  setUser: (user: AuthUser, permissions: string[]) => void;
  setHydrated: (hydrated: boolean) => void;
  clear: () => void;
}

// NOTE: MVP stores tokens in localStorage for simplicity. A future hardening
// step is to move the refresh token into an httpOnly cookie so it is not
// reachable from JS; that requires backend cookie support and is out of scope
// for the foundation.
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      permissions: [],
      hydrated: false,

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),

      setAuth: ({ accessToken, refreshToken, user }) =>
        set({ accessToken, refreshToken, user }),

      setUser: (user, permissions) => set({ user, permissions, hydrated: true }),

      setHydrated: (hydrated) => set({ hydrated }),

      clear: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          permissions: [],
          hydrated: true,
        }),
    }),
    {
      name: 'restaurant-os-auth',
      // Only persist what we need; `hydrated` is per-session runtime state.
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        permissions: state.permissions,
      }),
    },
  ),
);

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== 'restaurant-os-auth') return;
    const state = useAuthStore.getState();
    let next: { accessToken?: string | null; refreshToken?: string | null } | null = null;
    if (event.newValue) {
      try {
        next =
          (JSON.parse(event.newValue) as {
            state?: { accessToken?: string | null; refreshToken?: string | null };
          }).state ?? null;
      } catch {
        next = null;
      }
    }
    const nextAccess = next?.accessToken ?? null;
    const nextRefresh = next?.refreshToken ?? null;
    if (nextAccess === state.accessToken && nextRefresh === state.refreshToken) return;
    if (nextAccess && nextRefresh) {
      state.setTokens(nextAccess, nextRefresh);
    } else {
      state.clear();
    }
  });
}
