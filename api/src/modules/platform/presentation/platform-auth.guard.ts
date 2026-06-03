import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import {
  PLATFORM_TOKEN_SERVICE,
  PlatformTokenService,
} from '../application/ports/platform-token.service';

/**
 * Protects ALL /platform/* routes. Validates the platform access token
 * (verified with PLATFORM_JWT_ACCESS_SECRET, scope must be "platform") and sets
 * request.platformUser. A tenant token fails here (different secret + scope).
 *
 * Platform routes are also marked @Public() so the GLOBAL tenant guards skip
 * them — they are protected SOLELY by this guard.
 */
@Injectable()
export class PlatformAuthGuard implements CanActivate {
  constructor(@Inject(PLATFORM_TOKEN_SERVICE) private readonly tokens: PlatformTokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearer(request);
    if (!token) {
      throw new UnauthorizedException({
        code: 'PLATFORM_UNAUTHENTICATED',
        message: 'Missing or malformed Authorization header.',
      });
    }
    try {
      const payload = this.tokens.verifyAccessToken(token);
      if (payload.scope !== 'platform') {
        throw new Error('wrong scope');
      }
      request.platformUser = payload;
      return true;
    } catch {
      throw new UnauthorizedException({
        code: 'PLATFORM_INVALID_TOKEN',
        message: 'Platform access token is invalid or expired.',
      });
    }
  }

  private extractBearer(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header) {
      return null;
    }
    const [scheme, value] = header.split(' ');
    return scheme === 'Bearer' && value ? value : null;
  }
}
