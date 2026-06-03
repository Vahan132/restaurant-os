import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { CurrentUserContext } from './tenant-context';

/**
 * @CurrentUser() — injects the authenticated principal (decoded access token).
 * Throws a clear 401 if no user is present (route not behind JwtAuthGuard).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserContext => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'No authenticated user on the request.',
      });
    }
    return user;
  },
);
