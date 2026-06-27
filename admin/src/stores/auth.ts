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

/** A branch the caller may act on, from the extended /auth/me (BR-1). */
export interface AccessibleBranch {
  id: string;
  name: string;
  isDefault: boolean;
  status?: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  /**
   * Restaurant-wide permission keys from GET /auth/me. Used by restaurant-level
   * screens (branch management, users, settings, audit) and as the fallback for
   * all-branch users on branch-scoped screens.
   */
  permissions: string[];
  /**
   * Effective permission keys per accessible branch (BR-1). Branch-scoped
   * screens resolve gating at the active branch from this map.
   */
  branchPermissions: Record<string, string[]>;
  /** Branches the caller may switch between (BR-1). */
  accessibleBranches: AccessibleBranch[];
  /** The caller's default branch id (BR-1), used to initialise the switcher. */
  defaultBranchId: string | null;
  /** Whether /auth/me hydration has completed (so guards can wait). */
  hydrated: boolean;

  setTokens: (accessToken: string, refreshToken: string) => void;
  setAuth: (args: {
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
  }) => void;
  setUser: (args: {
    user: AuthUser;
    permissions: string[];
    branchPermissions?: Record<string, string[]>;
    accessibleBranches?: AccessibleBranch[];
    defaultBranchId?: string | null;
  }) => void;
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
      branchPermissions: {},
      accessibleBranches: [],
      defaultBranchId: null,
      hydrated: false,

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),

      setAuth: ({ accessToken, refreshToken, user }) =>
        set({ accessToken, refreshToken, user }),

      setUser: ({
        user,
        permissions,
        branchPermissions,
        accessibleBranches,
        defaultBranchId,
      }) =>
        set({
          user,
          permissions,
          branchPermissions: branchPermissions ?? {},
          accessibleBranches: accessibleBranches ?? [],
          defaultBranchId: defaultBranchId ?? null,
          hydrated: true,
        }),

      setHydrated: (hydrated) => set({ hydrated }),

      clear: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          permissions: [],
          branchPermissions: {},
          accessibleBranches: [],
          defaultBranchId: null,
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
        branchPermissions: state.branchPermissions,
        accessibleBranches: state.accessibleBranches,
        defaultBranchId: state.defaultBranchId,
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
