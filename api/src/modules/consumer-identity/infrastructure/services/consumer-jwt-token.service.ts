import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { AppConfig } from '../../../../shared/infrastructure/config/env.schema';
import {
  ConsumerAccessTokenPayload,
  ConsumerTokenService,
  IssuedRefreshToken,
} from '../../application/ports/consumer-token.service';

/**
 * Consumer TokenService — signs access tokens with CONSUMER_JWT_ACCESS_SECRET
 * (DISTINCT from tenant + platform secrets) and stamps `aud: 'consumer'`. Because
 * the secret differs, a staff/platform token can never verify here and vice-versa;
 * the ConsumerAuthGuard additionally asserts the `aud` claim.
 *
 * Refresh tokens are OPAQUE random strings (never JWTs); only their SHA-256 hash is
 * persisted (rotation/reuse handled by RefreshConsumerToken + the repository).
 */
@Injectable()
export class ConsumerJwtTokenService implements ConsumerTokenService {
  private readonly accessSecret: string;
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlMs: number;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.accessSecret = config.get('CONSUMER_JWT_ACCESS_SECRET', { infer: true });
    this.accessTtlSeconds = config.get('CONSUMER_ACCESS_TTL_MINUTES', { infer: true }) * 60;
    this.refreshTtlMs =
      config.get('CONSUMER_REFRESH_TTL_DAYS', { infer: true }) * 24 * 60 * 60 * 1000;
  }

  signAccessToken(payload: ConsumerAccessTokenPayload): string {
    return this.jwt.sign(payload, {
      secret: this.accessSecret,
      expiresIn: this.accessTtlSeconds,
    });
  }

  verifyAccessToken(token: string): ConsumerAccessTokenPayload {
    return this.jwt.verify<ConsumerAccessTokenPayload>(token, { secret: this.accessSecret });
  }

  accessTokenTtlSeconds(): number {
    return this.accessTtlSeconds;
  }

  generateRefreshToken(): IssuedRefreshToken {
    const token = randomBytes(48).toString('base64url');
    return {
      token,
      tokenHash: this.hashRefreshToken(token),
      expiresAt: new Date(Date.now() + this.refreshTtlMs),
    };
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
