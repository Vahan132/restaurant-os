import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import {
  RESTAURANT_KEY_PROVIDER,
  RestaurantKeyProvider,
} from '../../modules/identity/application/ports/restaurant-key.provider';
import { TOKEN_SERVICE, TokenService } from '../../modules/identity/application/ports/token.service';
import { IS_PUBLIC_KEY } from './public.decorator';

/**
 * Global authentication guard (runs first). OFF-5: it reads the restaurantId
 * claim UNVERIFIED, resolves that restaurant's per-restaurant signing key, then
 * verifies the access token with it — so a token issued by either the cloud or
 * the restaurant's edge validates here. Sets `request.user` to the decoded
 * payload. Routes marked @Public() are skipped. Failures produce the standard
 * 401 shape.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
    @Inject(RESTAURANT_KEY_PROVIDER) private readonly keys: RestaurantKeyProvider,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.isPublic(context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearer(request);
    if (!token) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Missing or malformed Authorization header.',
      });
    }

    const restaurantId = this.tokens.decodeRestaurantId(token);
    const signingKey = await this.keys.getSigningKey(restaurantId);
    if (!signingKey) {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'Access token is invalid or expired.',
      });
    }

    try {
      request.user = this.tokens.verifyAccessToken(token, signingKey);
      return true;
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'Access token is invalid or expired.',
      });
    }
  }

  private isPublic(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false
    );
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
