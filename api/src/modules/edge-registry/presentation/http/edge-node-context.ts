import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * The authenticated edge-node principal — resolved by EdgeAuthGuard from a
 * bearer node token, NEVER from the request body. Tenant + branch come from the
 * node itself. Attached to its own request property so it never collides with
 * the user/device/public principals.
 */
export interface EdgeNodeContext {
  nodeId: string;
  organizationId: string;
  restaurantId: string;
  branchId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      edgeNode?: EdgeNodeContext;
    }
  }
}

/** @CurrentEdgeNode() — injects the resolved edge-node context. */
export const CurrentEdgeNode = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): EdgeNodeContext => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const principal = request.edgeNode;
    if (!principal) {
      // Should never happen: the guard runs first and 401s otherwise.
      throw new Error('EdgeNodeContext missing — EdgeAuthGuard did not run.');
    }
    return principal;
  },
);
