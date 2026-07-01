import axios from 'axios';
import { API_BASE_URL } from '@/config';
import { useAuthStore } from '@/store/auth';
import { secureStore } from '@/lib/secure-store';
import type { ConsumerSessionResponse } from '@/api/generated/model';

/**
 * Session lifecycle: launch hydration + single-flight refresh.
 *
 * Refresh is performed with a BARE axios call (NOT the generated client / customInstance)
 * so it can never re-enter the mutator's 401 interceptor and never participates in the
 * circular import axios-instance ↔ generated client. Concurrent callers share one
 * in-flight refresh (single-flight) to avoid refresh storms.
 */
let refreshPromise: Promise<string | null> | null = null;

/** Defensive envelope unwrap, matching the mutator (`{ data: T }` → T, else passthrough). */
function unwrap<T>(body: unknown): T {
  if (body !== null && typeof body === 'object' && 'data' in (body as Record<string, unknown>)) {
    return (body as { data: T }).data;
  }
  return body as T;
}

/**
 * Refresh the session using the stored refresh token. Returns the new access token,
 * or null if refresh is impossible/failed (in which case the session is cleared → anon).
 * Single-flight: concurrent calls await the same request.
 */
export function performRefresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = doRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function doRefresh(): Promise<string | null> {
  const refreshToken = await secureStore.get(secureStore.keys.refreshToken);
  if (!refreshToken) {
    await useAuthStore.getState().clear();
    return null;
  }
  try {
    const res = await axios.post(
      `${API_BASE_URL}/consumer/auth/refresh`,
      { refreshToken },
      { headers: { 'Content-Type': 'application/json' }, timeout: 15000 },
    );
    const session = unwrap<ConsumerSessionResponse>(res.data);
    await useAuthStore.getState().setSession(session);
    return session.accessToken;
  } catch {
    // Includes REFRESH_TOKEN_REUSED / REFRESH_TOKEN_INVALID → drop to anon.
    await useAuthStore.getState().clear();
    return null;
  }
}

/**
 * Launch hydration: a stored refresh token → silent session restore, else clean anon.
 * Sets status to 'loading' first so the splash shows until resolved.
 */
export async function hydrateSession(): Promise<void> {
  useAuthStore.getState().setStatus('loading');
  const refreshToken = await secureStore.get(secureStore.keys.refreshToken);
  if (!refreshToken) {
    useAuthStore.getState().setStatus('anon');
    return;
  }
  await performRefresh(); // sets authed (on success) or anon (on failure)
}
