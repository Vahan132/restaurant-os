'use client';

import { useCallback, useState } from 'react';
import { axiosInstance, NormalizedError } from '@/api/mutator';
import { AuthUser, useAuthStore } from './store';
import { realtimeClient } from '@/lib/realtime/client';
import { useStationStore } from '@/lib/station/store';

interface MePayload {
  user: AuthUser;
  permissions: string[];
}

/**
 * Auth actions on top of the store. Login/me go through the shared axios
 * instance directly (so the flow doesn't depend on generated hook names);
 * the mutator still unwraps the envelope and normalizes errors.
 */
export function useAuth() {
  const { setTokens, setMe, clear } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<NormalizedError | null>(null);

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        const tokens = await axiosInstance
          .post('/auth/login', { email, password })
          .then((r) => unwrapData<{ accessToken: string; refreshToken: string }>(r.data));
        setTokens({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });

        const me = await axiosInstance
          .get('/auth/me')
          .then((r) => unwrapData<MePayload>(r.data));
        setMe(me.user, me.permissions);
        return true;
      } catch (e) {
        setError(e as NormalizedError);
        clear();
        return false;
      } finally {
        setLoading(false);
      }
    },
    [setTokens, setMe, clear],
  );

  const logout = useCallback(async () => {
    const refreshToken = useAuthStore.getState().refreshToken;
    try {
      if (refreshToken) {
        await axiosInstance.post('/auth/logout', { refreshToken });
      }
    } catch {
      // best-effort; clear locally regardless
    } finally {
      realtimeClient.disconnect();
      useStationStore.getState().clear();
      clear();
    }
  }, [clear]);

  return { login, logout, loading, error };
}

function unwrapData<T>(body: unknown): T {
  if (body && typeof body === 'object' && !Array.isArray(body) && 'data' in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}
