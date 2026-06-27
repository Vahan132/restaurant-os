import { permissionsForBranch, useAuthStore } from './store';
import { useBranchStore } from '@/lib/branch/store';

/**
 * Permission codes the KDS app cares about. The backend owns the full catalog
 * (GET /permissions); we only enumerate what this app gates on. Listed here for
 * completeness and to give `usePermission` a typed surface.
 */
export const PERMISSIONS = {
  /** Required to view the kitchen display and subscribe to station rooms. */
  KDS_ACCESS: 'KDS_ACCESS',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS] | (string & {});

/**
 * Reactive hook: true if the signed-in user holds the given permission **at the
 * currently pinned branch**. Resolves against that branch's effective set, so a
 * user with access only at another branch is correctly denied here. Re-renders
 * when either the auth state or the pinned branch changes.
 */
export function usePermission(code: PermissionCode): boolean {
  const branchId = useBranchStore((s) => s.branchId);
  return useAuthStore((s) => permissionsForBranch(s, branchId).includes(code));
}

/** Non-reactive check at the pinned branch, e.g. inside event handlers/guards. */
export function hasPermission(code: PermissionCode): boolean {
  const branchId = useBranchStore.getState().branchId;
  return permissionsForBranch(useAuthStore.getState(), branchId).includes(code);
}

/**
 * Reactive hook: true if the user holds the permission at **any** branch they
 * can access (or restaurant-wide). Used to tell "no kitchen access anywhere"
 * apart from "pinned to a branch where they lack it".
 */
export function useHasPermissionAnyBranch(code: PermissionCode): boolean {
  return useAuthStore((s) =>
    s.allBranches
      ? s.permissions.includes(code)
      : s.accessibleBranches.some((b) => b.permissions.includes(code)),
  );
}
