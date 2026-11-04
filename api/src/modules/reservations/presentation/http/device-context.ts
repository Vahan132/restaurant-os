import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * The authenticated call-device principal — resolved by DeviceTokenGuard from a
 * bearer device token, NEVER from the request body. The tenant (restaurantId) is
 * derived from the device itself. Attached to its own request property so it
 * never collides with the user (`request.user`) or public (`request.public`)
 * principals.
 */
export interface DeviceContext {
  deviceId: string;
  restaurantId: string;
  branchId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      device?: DeviceContext;
    }
  }
}

/** @CurrentDevice() — injects the resolved call-device context. */
export const CurrentDevice = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): DeviceContext => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const principal = request.device;
    if (!principal) {
      // Should never happen: the guard runs first and 401s otherwise.
      throw new Error('DeviceContext missing — DeviceTokenGuard did not run.');
    }
    return principal;
  },
);
