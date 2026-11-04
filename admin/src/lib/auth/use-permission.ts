'use client';

import { useActiveBranchStore } from '@/stores/active-branch';
import { useAuthStore } from '@/stores/auth';
import type { PermissionKey } from '@/lib/permissions';

/**
 * Where a permission check is resolved (BR-7):
 * - `branch` (default): the active branch's effective permissions, falling back
 *   to restaurant-wide permissions for all-branch users. Used by branch-scoped
 *   screens (menu, inventory, orders, tables, KDS, reservations…).
 * - `restaurant`: restaurant-wide permissions only. Used by restaurant-level
 *   screens (branch management, users, settings, audit).
 */
export type PermissionScope = 'branch' | 'restaurant';

/** Resolve the effective permission set for the requested scope. */
function useEffectivePermissions(scope: PermissionScope): string[] {
  const restaurantPermissions = useAuthStore((s) => s.permissions);
  const branchPermissions = useAuthStore((s) => s.branchPermissions);
  const activeBranchId = useActiveBranchStore((s) => s.activeBranchId);

  if (scope === 'restaurant') return restaurantPermissions;
  if (activeBranchId) {
    const atBranch = branchPermissions[activeBranchId];
    if (atBranch) return atBranch;
  }
  // All-branch users carry no per-branch entries; fall back to restaurant-wide.
  return restaurantPermissions;
}

/** Returns true if the user holds the given permission at the given scope. */
export function usePermission(
  permission: PermissionKey | string,
  scope: PermissionScope = 'branch',
): boolean {
  const permissions = useEffectivePermissions(scope);
  return permissions.includes(permission);
}

/** Returns true if the user holds at least one of the given permissions. */
export function useAnyPermission(
  permissions: Array<PermissionKey | string>,
  scope: PermissionScope = 'branch',
): boolean {
  const effective = useEffectivePermissions(scope);
  return permissions.length === 0
    ? true
    : permissions.some((p) => effective.includes(p));
}
