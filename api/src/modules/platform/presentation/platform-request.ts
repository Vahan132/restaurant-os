import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { PlatformAccessTokenPayload } from '../application/ports/platform-token.service';

/**
 * The platform principal is attached to a SEPARATE request property than the
 * tenant principal (`request.user`), so the two auth systems never collide.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      platformUser?: PlatformAccessTokenPayload;
    }
  }
}

/** @CurrentPlatformUser() — injects the authenticated platform admin. */
export const CurrentPlatformUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PlatformAccessTokenPayload => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const principal = request.platformUser;
    if (!principal) {
      throw new UnauthorizedException({
        code: 'PLATFORM_UNAUTHENTICATED',
        message: 'No authenticated platform user on the request.',
      });
    }
    return principal;
  },
);
