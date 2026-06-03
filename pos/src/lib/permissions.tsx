'use client';

import type { ReactNode } from 'react';
import { useAuthMe } from '@/lib/useAuthMe';

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

/** Returns whether the current user holds the given permission. */
export function usePermission(permission: Permission): boolean {
  const { data } = useAuthMe();
  return data?.permissions?.includes(permission) ?? false;
}

/** Returns whether the current user holds ALL of the given permissions. */
export function usePermissions(...permissions: Permission[]): boolean {
  const { data } = useAuthMe();
  const granted = data?.permissions ?? [];
  return permissions.every((p) => granted.includes(p));
}

interface CanProps {
  /** Permission(s) required. When multiple, ALL are required. */
  perform: Permission | Permission[];
  children: ReactNode;
  /** Rendered when the user lacks the permission. */
  fallback?: ReactNode;
}

/** Conditionally render children based on the current user's permissions. */
export function Can({ perform, children, fallback = null }: CanProps) {
  const required = Array.isArray(perform) ? perform : [perform];
  const { data } = useAuthMe();
  const granted = data?.permissions ?? [];
  const allowed = required.every((p) => granted.includes(p));
  return <>{allowed ? children : fallback}</>;
}
