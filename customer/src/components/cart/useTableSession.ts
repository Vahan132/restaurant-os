'use client';

import { useCallback } from 'react';

import { usePublicTableSessionsControllerOpen } from '@/api/generated/public/public';
import type { ApiError } from '@/api/mutator';
import {
  clearActiveSessionToken,
  resolveSessionToken,
  setActiveSessionToken,
} from '@/lib/session';

/**
 * Table-session lifecycle for the QR-web prepayment flow (ORDER-2).
 *
 * The QR-orders controller is session-gated, so an ordering action must run
 * inside an open table session. This hook opens/joins that session LAZILY — it
 * is only called at checkout intent, never on browse — and persists the
 * returned token via {@link setActiveSessionToken} so the axios interceptor
 * attaches `X-Session-Token` to every subsequent session call and a revisit
 * reattaches.
 *
 *  - `ensureSession()` reattaches to a stored token if present, otherwise opens.
 *  - `resetSession()` drops the token and opens a fresh session (401 / expiry).
 */
export function useTableSession(qr: string) {
  const openMut = usePublicTableSessionsControllerOpen<ApiError>();

  /** Open a brand-new session and persist its token. */
  const open = useCallback(async (): Promise<string> => {
    const res = await openMut.mutateAsync({ data: { qr } });
    if (res.token) {
      setActiveSessionToken(res.token);
      return res.token;
    }
    // `token` is only returned on CREATE. A null token means the backend joined
    // an already-active session for this table that we don't hold the token
    // for (e.g. opened on another device). We can't authenticate ordering calls
    // in that case — surface it so the UI can restart cleanly.
    throw {
      code: 'SESSION_UNAVAILABLE',
      message: 'Could not start a table session.',
    } satisfies ApiError;
  }, [openMut, qr]);

  /**
   * Ensure a usable session token exists, reattaching to the stored one first.
   * Returns the active token.
   */
  const ensureSession = useCallback(async (): Promise<string> => {
    const existing = resolveSessionToken();
    if (existing) return existing;
    return open();
  }, [open]);

  /**
   * Drop the current (expired) token and open a fresh session. Call this after
   * a 401 from a session-scoped request, then retry the request once.
   */
  const resetSession = useCallback(async (): Promise<string> => {
    clearActiveSessionToken();
    return open();
  }, [open]);

  return {
    ensureSession,
    resetSession,
    isOpening: openMut.isPending,
  };
}
