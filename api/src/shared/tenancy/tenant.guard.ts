import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../auth/public.decorator';
import { TenantContext } from './tenant-context';

/**
 * TenantGuard — ACTIVE (runs after JwtAuthGuard).
 *
 * Builds `request.tenant` from the authenticated principal (`request.user`,
 * set by JwtAuthGuard from the verified JWT). Tenant ids are therefore NEVER
 * taken from the client body/query. Public routes are skipped. Missing auth
 * produces the standard 401 error shape.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

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

    const tenant: TenantContext = {
      organizationId: user.organizationId,
      restaurantId: user.restaurantId ?? null,
      ...(user.branchId ? { branchId: user.branchId } : {}),
    };
    request.tenant = tenant;
    return true;
  }
}
