import { AccessTokenPayload } from '../auth/jwt-payload';

/**
 * TenantContext — the resolved tenant for the current request.
 *
 * Hierarchy: Organization (billing/account) -> Restaurant (operations) -> Branch.
 *   - organizationId : account key (billing, subscription, plan limits)
 *   - restaurantId   : operations key (null for organization-wide principals,
 *                      e.g. an org-level admin not bound to a single restaurant)
 *   - branchId       : optional finer scope within a restaurant
 *
 * The server NEVER trusts client-supplied tenant ids. This context is derived
 * from a verified JWT (authenticated surfaces) or from host resolution
 * (public surfaces). See TenantResolverService / TenantGuard.
 */
export interface TenantContext {
  organizationId: string;
  restaurantId: string | null;
  branchId?: string;
}

/**
 * Authenticated principal attached to the request — the decoded access-token
 * payload set by JwtAuthGuard.
 */
export type CurrentUserContext = AccessTokenPayload;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenant?: TenantContext;
      user?: AccessTokenPayload;
      /**
       * Effective permission keys at the active branch, set by BranchAccessGuard
       * on @BranchScoped routes. When present, PermissionsGuard checks against
       * these instead of the JWT permission snapshot.
       */
      effectivePermissions?: string[];
    }
  }
}
