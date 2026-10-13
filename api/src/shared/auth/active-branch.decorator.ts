import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * @ActiveBranchId() — injects the validated active branch id for the request,
 * set by BranchAccessGuard on @BranchScoped endpoints (from the X-Branch-Id
 * header after access validation). Throws if used on a route that is not
 * branch-scoped (the guard never populated it).
 */
export const ActiveBranchId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const branchId = request.tenant?.branchId;
    if (!branchId) {
      throw new InternalServerErrorException(
        'No active branch on the request. Ensure the route is marked @BranchScoped().',
      );
    }
    return branchId;
  },
);
