import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import {
  CONSUMER_TOKEN_SERVICE,
  ConsumerTokenService,
} from '../../application/ports/consumer-token.service';

export interface ConsumerPrincipal {
  /** customerAccountId. */
  sub: string;
}

type RequestWithConsumer = Request & { consumerUser?: ConsumerPrincipal };

/**
 * Protects all authenticated /consumer/me routes. Verifies the access token with
 * the CONSUMER signing secret and asserts `aud === 'consumer'`, then sets
 * request.consumerUser. A staff/platform token fails here (different secret + the
 * aud check). Consumer routes are also @Public() so the GLOBAL staff guards skip
 * them — they are protected SOLELY by this guard (mirrors PlatformAuthGuard).
 */
@Injectable()
export class ConsumerAuthGuard implements CanActivate {
  constructor(@Inject(CONSUMER_TOKEN_SERVICE) private readonly tokens: ConsumerTokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithConsumer>();
    const token = this.extractBearer(request);
    if (!token) {
      throw new UnauthorizedException({
        code: 'CONSUMER_UNAUTHENTICATED',
        message: 'Missing or malformed Authorization header.',
      });
    }
    try {
      const payload = this.tokens.verifyAccessToken(token);
      if (payload.aud !== 'consumer') {
        throw new Error('wrong audience');
      }
      request.consumerUser = { sub: payload.sub };
      return true;
    } catch {
      throw new UnauthorizedException({
        code: 'CONSUMER_UNAUTHENTICATED',
        message: 'Consumer access token is invalid or expired.',
      });
    }
  }

  private extractBearer(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header) return null;
    const [scheme, value] = header.split(' ');
    return scheme === 'Bearer' && value ? value : null;
  }
}
