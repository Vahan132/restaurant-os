'use client';

import { useQueryClient } from '@tanstack/react-query';
import { getAuthControllerMeQueryKey } from '@/api/generated/auth/auth';
import { useRealtimeEvent } from './useRealtimeEvent';

/**
 * Keeps permissions live: when an admin edits a role, the server broadcasts
 * `role.permissions.updated` to the org room. We invalidate GET /auth/me so the
 * effective-permission set (and every `Can` / `usePermission` gate derived from
 * it) re-resolves within seconds — no logout/login.
 *
 * The event is org-scoped, so it may fire for a role this user doesn't hold;
 * invalidating /auth/me regardless is cheap and self-correcting.
 */
export function usePermissionsRealtimeSync(): void {
  const queryClient = useQueryClient();

  useRealtimeEvent('role.permissions.updated', () => {
    void queryClient.invalidateQueries({ queryKey: getAuthControllerMeQueryKey() });
  });
}
