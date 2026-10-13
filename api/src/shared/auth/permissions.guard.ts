import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RolePermissionsCache } from '../../modules/identity/infrastructure/services/role-permissions.cache';
import { REQUIRED_PERMISSIONS_KEY } from './permissions.decorator';

/**
 * Global authorization guard (runs after auth + tenant). Enforces
 * @RequirePermissions(...) against the caller's SERVER-RESOLVED permissions.
 * Requires ALL listed permissions; otherwise responds 403 in the standard shape.
 *
 * Authorization never trusts the JWT permission snapshot (frozen at login). On
 * @BranchScoped routes BranchAccessGuard has already resolved the caller's
 * effective permissions for the active branch; otherwise we resolve the caller's
 * restaurant-wide role permissions fresh (Redis-cached, invalidated on role
 * update) so a permission change takes effect without re-login.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rolePermissions: RolePermissionsCache,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Authentication is required.',
      });
    }

    const effective =
      request.effectivePermissions ??
      (await this.rolePermissions.get(user.organizationId, user.roleId));
    const granted = new Set(effective);
    const missing = required.filter((p) => !granted.has(p));
    if (missing.length > 0) {
      throw new ForbiddenException({
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'You do not have permission to perform this action.',
        details: { required, missing },
      });
    }
    return true;
  }
}
