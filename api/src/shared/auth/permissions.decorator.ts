import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';

/**
 * @RequirePermissions('USER_MANAGE', ...) — requires the authenticated user's
 * permission snapshot to include ALL listed keys. Enforced by PermissionsGuard.
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
