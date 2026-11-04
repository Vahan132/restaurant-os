import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../auth/public.decorator';
import { EdgeConfigService } from '../edge/edge-config.service';
import { TenantContext } from './tenant-context';

/**
 * TenantGuard — ACTIVE (runs after JwtAuthGuard).
 *
 * Builds `request.tenant` from the authenticated principal (`request.user`,
 * set by JwtAuthGuard from the verified JWT). Tenant ids are therefore NEVER
 * taken from the client body/query. Public routes are skipped. Missing auth
 * produces the standard 401 error shape.
 *
 * EDGE mode (OFF-1): the hub serves exactly one org -> restaurant -> branch, so
 * the tenant is PINNED to the configured edge identity for every request,
 * regardless of token claims. A token minted for another organization or
 * restaurant is rejected (EDGE_TENANT_MISMATCH) — the node has no other data.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly edge: EdgeConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Authentication is required to resolve the tenant context.',
      });
    }

    if (this.edge.isEdge) {
      const identity = this.edge.getIdentity();
      // Reject any token that targets a different org/restaurant than this hub.
      const orgMismatch = user.organizationId !== identity.organizationId;
      const restaurantMismatch =
        user.restaurantId != null && user.restaurantId !== identity.restaurantId;
      if (orgMismatch || restaurantMismatch) {
        throw new ForbiddenException({
          code: 'EDGE_TENANT_MISMATCH',
          message: 'This token does not belong to the tenant served by this edge hub.',
        });
      }
      // Pin to the edge identity (org/restaurant/branch) for every request.
      request.tenant = {
        organizationId: identity.organizationId,
        restaurantId: identity.restaurantId,
        branchId: identity.branchId,
      };
      return true;
    }

    const tenant: TenantContext = {
      organizationId: user.organizationId,
      restaurantId: user.restaurantId ?? null,
      ...(user.branchId ? { branchId: user.branchId } : {}),
    };
    request.tenant = tenant;
    return true;
  }
}
