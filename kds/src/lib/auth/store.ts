import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Minimal user shape we rely on. Kept local (rather than importing the
 * generated `UserResponse`) so the store stays decoupled from codegen output.
 */
export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  roleId: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  /** Effective permission codes for the signed-in user (from /auth/me). */
  permissions: string[];
  /** Becomes true once zustand has rehydrated from localStorage. */
  hydrated: boolean;

  setTokens: (tokens: AuthTokens) => void;
  setMe: (user: AuthUser, permissions: string[]) => void;
  clear: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      permissions: [],
      hydrated: false,

      setTokens: ({ accessToken, refreshToken }) => set({ accessToken, refreshToken }),
      setMe: (user, permissions) => set({ user, permissions }),
      clear: () =>
        set({ accessToken: null, refreshToken: null, user: null, permissions: [] }),
      isAuthenticated: () => Boolean(get().accessToken),
    }),
    {
      name: 'kds-auth',
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        user: s.user,
        permissions: s.permissions,
      }),
      onRehydrateStorage: () => (state) => {
        // Flag hydration so route guards don't redirect before localStorage loads.
        if (state) state.hydrated = true;
      },
    },
  ),
);

/** Non-React accessor for use inside the axios mutator. */
export const authStore = useAuthStore;
