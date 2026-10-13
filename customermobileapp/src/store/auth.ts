import { create } from 'zustand';
import type { ConsumerSessionResponse } from '@/api/generated/model';
import { secureStore } from '@/lib/secure-store';

/**
 * Auth/session store — the SINGLE source of auth truth (CX-APP-2).
 *
 * - `accessToken` lives in MEMORY only (never written to disk).
 * - the rotating `refreshToken` is persisted in expo-secure-store.
 * - `status` drives routing: 'loading' (hydrating on launch) → 'authed' | 'anon'.
 *
 * The axios mutator reads the access token via `getAccessToken()`; launch hydration
 * and the 401 path live in src/auth/session.ts.
 */
export type AuthStatus = 'loading' | 'authed' | 'anon';

interface AuthState {
  accessToken: string | null;
  status: AuthStatus;
  /** Persist a new session (access in memory, refresh in secure-store) → authed. */
  setSession: (session: ConsumerSessionResponse) => Promise<void>;
  /** Wipe memory + secure-store refresh → anon. */
  clear: () => Promise<void>;
  setStatus: (status: AuthStatus) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  status: 'loading',

  setSession: async (session) => {
    await secureStore.set(secureStore.keys.refreshToken, session.refreshToken);
    set({ accessToken: session.accessToken, status: 'authed' });
  },

  clear: async () => {
    await secureStore.remove(secureStore.keys.refreshToken);
    set({ accessToken: null, status: 'anon' });
  },

  setStatus: (status) => set({ status }),
}));

/** Non-hook accessor for the mutator. Current access token, or null. */
export function getAccessToken(): string | null {
  return useAuthStore.getState().accessToken;
}

/** Whether the user is currently authenticated (non-hook). */
export function isAuthed(): boolean {
  return useAuthStore.getState().status === 'authed';
}
