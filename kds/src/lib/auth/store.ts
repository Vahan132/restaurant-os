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

/** A branch the caller can access, with their effective permissions there. */
export interface BranchAccess {
  id: string;
  name: string;
  permissions: string[];
}

/** The branch-aware slice of /auth/me used to resolve permissions per branch. */
export interface MeAccess {
  user: AuthUser;
  /** Restaurant-wide permission set (used when {@link allBranches} is true). */
  permissions: string[];
  /** True if the caller's role applies at every branch (restaurant-wide). */
  allBranches: boolean;
  /** Branches the caller can access, each with effective permissions. */
  accessibleBranches: BranchAccess[];
  /** The caller's default branch id, if any. */
  defaultBranchId: string | null;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  /** Restaurant-wide permission set from /auth/me (applies when allBranches). */
  permissions: string[];
  allBranches: boolean;
  accessibleBranches: BranchAccess[];
  defaultBranchId: string | null;
  /** Becomes true once zustand has rehydrated from localStorage. */
  hydrated: boolean;

  setTokens: (tokens: AuthTokens) => void;
  setMe: (me: MeAccess) => void;
  clear: () => void;
  isAuthenticated: () => boolean;
}

/**
 * Effective permissions for the caller at a given branch. Restaurant-wide
 * callers (`allBranches`) carry their global set everywhere; otherwise only the
 * pinned branch's own set counts — so KDS access at one branch never leaks to
 * another. An unknown/unpinned branch resolves to no permissions.
 */
export function permissionsForBranch(
  state: Pick<AuthState, 'allBranches' | 'accessibleBranches' | 'permissions'>,
  branchId: string | null,
): string[] {
  if (state.allBranches) return state.permissions;
  if (!branchId) return [];
  return state.accessibleBranches.find((b) => b.id === branchId)?.permissions ?? [];
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      permissions: [],
      allBranches: false,
      accessibleBranches: [],
      defaultBranchId: null,
      hydrated: false,

      setTokens: ({ accessToken, refreshToken }) => set({ accessToken, refreshToken }),
      setMe: (me) =>
        set({
          user: me.user,
          permissions: me.permissions,
          allBranches: me.allBranches,
          accessibleBranches: me.accessibleBranches,
          defaultBranchId: me.defaultBranchId,
        }),
      clear: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          permissions: [],
          allBranches: false,
          accessibleBranches: [],
          defaultBranchId: null,
        }),
      isAuthenticated: () => Boolean(get().accessToken),
    }),
    {
      name: 'kds-auth',
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        user: s.user,
        permissions: s.permissions,
        allBranches: s.allBranches,
        accessibleBranches: s.accessibleBranches,
        defaultBranchId: s.defaultBranchId,
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

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== 'kds-auth') return;
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
      state.setTokens({ accessToken: nextAccess, refreshToken: nextRefresh });
    } else {
      state.clear();
    }
  });
}
