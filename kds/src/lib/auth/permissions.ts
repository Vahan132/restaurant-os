import { useAuthStore } from './store';

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

/** Reactive hook: true if the signed-in user holds the given permission. */
export function usePermission(code: PermissionCode): boolean {
  return useAuthStore((s) => s.permissions.includes(code));
}

/** Non-reactive check, e.g. inside event handlers or guards. */
export function hasPermission(code: PermissionCode): boolean {
  return useAuthStore.getState().permissions.includes(code);
}
