'use client';

import type { ReactNode } from 'react';

import { usePermission } from '@/lib/auth/use-permission';
import type { PermissionKey } from '@/lib/permissions';

interface CanProps {
  permission: PermissionKey | string;
  children: ReactNode;
  /** Rendered when the user lacks the permission. Defaults to nothing. */
  fallback?: ReactNode;
}

/** Conditionally renders children based on the current user's permissions. */
export function Can({ permission, children, fallback = null }: CanProps) {
  const allowed = usePermission(permission);
  return <>{allowed ? children : fallback}</>;
}
