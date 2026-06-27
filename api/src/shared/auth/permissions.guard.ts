import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { REQUIRED_PERMISSIONS_KEY } from './permissions.decorator';

/**
 * Global authorization guard (runs after auth + tenant). Enforces
 * @RequirePermissions(...) by checking the user's permission snapshot.
 * Requires ALL listed permissions; otherwise responds 403 in the standard shape.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
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

    // On @BranchScoped routes, BranchAccessGuard has resolved the caller's
    // EFFECTIVE permissions at the active branch (restaurant-wide ∪ branch role)
    // and stashed them on the request; prefer those over the JWT snapshot.
    const effective = request.effectivePermissions ?? user.permissions ?? [];
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
