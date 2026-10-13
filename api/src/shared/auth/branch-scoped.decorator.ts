import { SetMetadata } from '@nestjs/common';

export const IS_BRANCH_SCOPED_KEY = 'isBranchScoped';

/**
 * @BranchScoped() — marks an endpoint as operating within a single ACTIVE branch
 * (BR-1). On such endpoints the BranchAccessGuard:
 *   - reads the active branch from the `X-Branch-Id` request header,
 *   - validates the caller's access to it,
 *   - populates `TenantContext.branchId`, and
 *   - resolves the caller's EFFECTIVE permissions at that branch so the
 *     PermissionsGuard checks @RequirePermissions against them.
 *
 * Restaurant-scoped endpoints (branch management, settings, users) omit this and
 * are checked against the restaurant-wide role snapshot in the JWT, as before.
 */
export const BranchScoped = () => SetMetadata(IS_BRANCH_SCOPED_KEY, true);
