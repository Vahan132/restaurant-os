'use client';

import { useAuthControllerMe } from '@/api/generated/auth/auth';
import { useAuthStore } from '@/stores/auth';

/**
 * Wraps the generated GET /auth/me hook so it only runs once we have a token.
 * Provides the current user, role and effective permissions across the app.
 */
export function useAuthMe() {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useAuthControllerMe({
    query: {
      enabled: Boolean(accessToken),
      staleTime: 5 * 60 * 1000,
    },
  });
}
