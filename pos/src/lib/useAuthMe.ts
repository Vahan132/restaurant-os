'use client';

import { useAuthControllerMe } from '@/api/generated/auth/auth';
import { useAuthStore } from '@/stores/auth';

/**
 * Wraps the generated GET /auth/me hook so it only runs once we have a token.
 * Provides the current user, role and effective permissions across the app.
 *
 * Permissions drive UI gating, so they must not go stale silently. A live
 * `role.permissions.updated` socket event invalidates this query (see
 * usePermissionsRealtimeSync); `refetchOnWindowFocus` is the cheap fallback for
 * when the socket was down (e.g. tablet asleep) while permissions changed.
 */
export function useAuthMe() {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useAuthControllerMe({
    query: {
      enabled: Boolean(accessToken),
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: true,
    },
  });
}
