import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * The authenticated DEVICE principal — resolved by DeviceSecretGuard from the
 * `X-Device-Secret` header, never from the request body/query. The tenant
 * (restaurantId/branchId) is derived from the device itself. Stored on its own
 * request property so it never collides with `request.user` (JWT) or
 * `request.device` (reservations call-device).
 */
export interface DeviceAuthContext {
  deviceId: string;
  restaurantId: string;
  branchId: string;
  surface: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      deviceAuth?: DeviceAuthContext;
    }
  }
}

/** @CurrentDeviceAuth() — injects the resolved device principal. */
export const CurrentDeviceAuth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): DeviceAuthContext => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const principal = request.deviceAuth;
    if (!principal) {
      // Should never happen: DeviceSecretGuard runs first and 401s otherwise.
      throw new Error('DeviceAuthContext missing — DeviceSecretGuard did not run.');
    }
    return principal;
  },
);
