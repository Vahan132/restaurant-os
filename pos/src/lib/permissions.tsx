'use client';

import { useMemo, type ReactNode } from 'react';
import { useAuthMe } from '@/lib/useAuthMe';
import { useBranchStore } from '@/stores/branch';

/**
 * POS-relevant permission keys. These mirror the backend's RESOURCE_ACTION codes
 * (full catalog at GET /permissions). The user's effective permissions arrive via
 * GET /auth/me. P2–P5 gate their actions with these.
 */
export const PERMISSIONS = {
  ORDER_CREATE: 'ORDER_CREATE',
  ORDER_EDIT: 'ORDER_EDIT',
  ORDER_CANCEL: 'ORDER_CANCEL',
  DISCOUNT_APPLY: 'DISCOUNT_APPLY',
  PAYMENT_PROCESS: 'PAYMENT_PROCESS',
  TABLE_STATUS_UPDATE: 'TABLE_STATUS_UPDATE',
  DASHBOARD_VIEW: 'DASHBOARD_VIEW',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * The caller's EFFECTIVE permission set at the currently selected branch.
 *
 * A user can hold different roles per branch (manager at one, waiter at another),
 * so /auth/me returns a permission set per accessible branch. Gating must resolve
 * against the active branch (BR-8a store) — never the flat restaurant-wide list —
 * so capabilities change when the terminal switches branch.
 *
 * Returns an empty set (deny-all) until a branch is resolved; BranchGate blocks
 * the app until one is selected, so gated UI only renders once this is populated.
 */
export function useEffectivePermissions(): string[] {
  const { data } = useAuthMe();
  const activeBranchId = useBranchStore((s) => s.activeBranchId);

  return useMemo(() => {
    if (!data) return [];
    const branch = data.accessibleBranches.find((b) => b.id === activeBranchId);
    return branch?.permissions ?? [];
  }, [data, activeBranchId]);
}

/** Returns whether the caller holds the given permission at the active branch. */
export function usePermission(permission: Permission): boolean {
  const granted = useEffectivePermissions();
  return granted.includes(permission);
}

/** Returns whether the caller holds ALL of the given permissions at the active branch. */
export function usePermissions(...permissions: Permission[]): boolean {
  const granted = useEffectivePermissions();
  return permissions.every((p) => granted.includes(p));
}

interface CanProps {
  /** Permission(s) required. When multiple, ALL are required. */
  perform: Permission | Permission[];
  children: ReactNode;
  /** Rendered when the user lacks the permission. */
  fallback?: ReactNode;
}

/** Conditionally render children based on the caller's active-branch permissions. */
export function Can({ perform, children, fallback = null }: CanProps) {
  const required = Array.isArray(perform) ? perform : [perform];
  const granted = useEffectivePermissions();
  const allowed = required.every((p) => granted.includes(p));
  return <>{allowed ? children : fallback}</>;
}
