import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { UserResponse } from '@/api/generated/model';

/**
 * Auth store — mirrors the admin app.
 *
 * MVP: email/password login, tokens + user persisted to localStorage.
 * FUTURE (POS hardening): PIN-based login for fast staff switching, and moving
 * tokens to httpOnly cookies instead of client storage.
 */

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserResponse | null;
  /** True once persisted state has rehydrated (avoids auth-flash on first paint). */
  hydrated: boolean;

  setSession: (tokens: { accessToken: string; refreshToken: string }, user: UserResponse) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: UserResponse) => void;
  clear: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      hydrated: false,

      setSession: (tokens, user) =>
        set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          user,
        }),

      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),

      setUser: (user) => set({ user }),

      clear: () => set({ accessToken: null, refreshToken: null, user: null }),

      isAuthenticated: () => Boolean(get().accessToken),
    }),
    {
      name: 'pos-auth',
      storage: createJSONStorage(() => localStorage),
      // Persist only the durable session fields.
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== 'pos-auth') return;
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
