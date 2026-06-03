'use client';

import { useAuthStore } from '@/stores/auth';
import type { PermissionKey } from '@/lib/permissions';

/** Returns true if the current user holds the given permission key. */
export function usePermission(permission: PermissionKey | string): boolean {
  return useAuthStore((s) => s.permissions.includes(permission));
}

/** Returns true if the user holds at least one of the given permissions. */
export function useAnyPermission(permissions: Array<PermissionKey | string>): boolean {
  return useAuthStore((s) =>
    permissions.length === 0
      ? true
      : permissions.some((p) => s.permissions.includes(p)),
  );
}
