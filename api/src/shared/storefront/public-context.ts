import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * The public storefront principal — resolved from the request host/slug by
 * PublicRestaurantResolverGuard, NEVER from a client-supplied id. Attached to a
 * dedicated request property so it never collides with the tenant principal
 * (`request.tenant`) or the platform principal (`request.platformUser`).
 */
export interface PublicContext {
  restaurantId: string;
  organizationId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      public?: PublicContext;
    }
  }
}

/** @CurrentPublic() — injects the resolved public storefront context. */
export const CurrentPublic = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PublicContext => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const principal = request.public;
    if (!principal) {
      // Should never happen: the guard runs first and 404s otherwise.
      throw new Error('PublicContext missing — PublicRestaurantResolverGuard did not run.');
    }
    return principal;
  },
);
