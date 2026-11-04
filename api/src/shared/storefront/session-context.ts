import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * The resolved QR-web ordering-session principal. Set by SessionTokenGuard from
 * the opaque ORDER-1 reattach token (never a client-supplied id), and scoped to
 * the restaurant already resolved by PublicRestaurantResolverGuard. Attached to a
 * dedicated request property, distinct from `request.public`.
 */
export interface SessionContext {
  sessionId: string;
  restaurantId: string;
  branchId: string;
  tableId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tableSession?: SessionContext;
    }
  }
}

/** @CurrentSession() — injects the token-resolved ordering session context. */
export const CurrentSession = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionContext => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const session = request.tableSession;
    if (!session) {
      // Should never happen: SessionTokenGuard runs first and 401s otherwise.
      throw new Error('SessionContext missing — SessionTokenGuard did not run.');
    }
    return session;
  },
);
