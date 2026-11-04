import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { EdgeConfigService } from '../edge/edge-config.service';
import { TenantContext } from '../tenancy/tenant-context';
import { BRANCH_ACCESS_RESOLVER, BranchAccessResolver } from './branch-access.resolver';
import { IS_BRANCH_SCOPED_KEY } from './branch-scoped.decorator';
import { IS_PUBLIC_KEY } from './public.decorator';

const BRANCH_HEADER = 'x-branch-id';

/**
 * BranchAccessGuard — ACTIVE on @BranchScoped routes only (BR-1).
 *
 * Runs AFTER JwtAuthGuard + TenantGuard and BEFORE PermissionsGuard. For a
 * branch-scoped endpoint it:
 *   1. requires the `X-Branch-Id` header        -> else BRANCH_REQUIRED (400)
 *   2. checks the branch exists in the restaurant -> else BRANCH_NOT_FOUND (404)
 *   3. checks the caller's access to it           -> else BRANCH_ACCESS_DENIED (403)
 *   4. sets TenantContext.branchId and stashes the caller's EFFECTIVE permissions
 *      on the request so PermissionsGuard checks @RequirePermissions against them.
 *
 * Non-branch-scoped and @Public routes pass through untouched.
 */
@Injectable()
export class BranchAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(BRANCH_ACCESS_RESOLVER) private readonly resolver: BranchAccessResolver,
    private readonly edge: EdgeConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const isBranchScoped = this.reflector.getAllAndOverride<boolean>(IS_BRANCH_SCOPED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic || !isBranchScoped) {
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
    if (!user.restaurantId) {
      throw new BadRequestException({
        code: 'BRANCH_REQUIRED',
        message: 'A branch-scoped endpoint requires a restaurant-scoped account.',
      });
    }

    const header = request.headers[BRANCH_HEADER];
    let explicitBranchId = Array.isArray(header) ? header[0] : header;

    // EDGE mode (OFF-1): the hub serves exactly one branch. X-Branch-Id is
    // implicitly the edge branch; if supplied it MUST match, otherwise it is
    // rejected (there is no other branch's data here). Access + effective
    // permissions are still resolved per-branch below.
    if (this.edge.isEdge) {
      const edgeBranchId = this.edge.getIdentity().branchId;
      if (explicitBranchId && explicitBranchId !== edgeBranchId) {
        throw new NotFoundException({
          code: 'BRANCH_NOT_FOUND',
          message: 'Branch not found in your restaurant.',
        });
      }
      explicitBranchId = edgeBranchId;
    }

    let branchId: string;
    let permissions: string[];

    if (explicitBranchId) {
      // Explicit active branch: validate access against it.
      const result = await this.resolver.resolveForBranch({
        organizationId: user.organizationId,
        restaurantId: user.restaurantId,
        userId: user.sub,
        branchId: explicitBranchId,
      });
      if (!result.branchExists) {
        throw new NotFoundException({
          code: 'BRANCH_NOT_FOUND',
          message: 'Branch not found in your restaurant.',
        });
      }
      if (!result.hasAccess) {
        throw new ForbiddenException({
          code: 'BRANCH_ACCESS_DENIED',
          message: 'You do not have access to this branch.',
        });
      }
      branchId = explicitBranchId;
      permissions = result.permissions;
    } else {
      // BR-2 §0: no header → fall back to the caller's default branch (keeps
      // existing single-branch clients working). BRANCH_REQUIRED only if the
      // caller has no accessible branch at all.
      const fallback = await this.resolver.resolveDefaultBranchAccess({
        organizationId: user.organizationId,
        restaurantId: user.restaurantId,
        userId: user.sub,
      });
      if (!fallback) {
        throw new BadRequestException({
          code: 'BRANCH_REQUIRED',
          message: 'No accessible branch; provide an X-Branch-Id you have access to.',
        });
      }
      branchId = fallback.branchId;
      permissions = fallback.permissions;
    }

    // Promote the validated branch into the tenant context and stash effective
    // permissions for PermissionsGuard.
    const tenant: TenantContext = request.tenant ?? {
      organizationId: user.organizationId,
      restaurantId: user.restaurantId,
    };
    tenant.branchId = branchId;
    request.tenant = tenant;
    request.effectivePermissions = permissions;
    return true;
  }
}
