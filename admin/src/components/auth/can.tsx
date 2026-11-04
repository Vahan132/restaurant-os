'use client';

import type { ReactNode } from 'react';

import { usePermission, type PermissionScope } from '@/lib/auth/use-permission';
import type { PermissionKey } from '@/lib/permissions';

interface CanProps {
  permission: PermissionKey | string;
  children: ReactNode;
  /** Rendered when the user lacks the permission. Defaults to nothing. */
  fallback?: ReactNode;
  /**
   * Resolution scope (BR-7). Defaults to `branch` (active-branch effective
   * permissions). Restaurant-level screens pass `restaurant`.
   */
  scope?: PermissionScope;
}

/** Conditionally renders children based on the current user's permissions. */
export function Can({
  permission,
  children,
  fallback = null,
  scope = 'branch',
}: CanProps) {
  const allowed = usePermission(permission, scope);
  return <>{allowed ? children : fallback}</>;
}
