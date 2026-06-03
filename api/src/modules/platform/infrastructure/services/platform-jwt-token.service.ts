import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import { AppConfig } from '../../../../shared/infrastructure/config/env.schema';
import {
  IssuedPlatformRefreshToken,
  PlatformAccessTokenPayload,
  PlatformRefreshTokenPayload,
  PlatformTokenService,
} from '../../application/ports/platform-token.service';

const ACCESS_TTL = '15m';
const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL = '7d';
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Platform TokenService — signs with PLATFORM_JWT_* secrets (DISTINCT from the
 * tenant secrets). Because the secrets differ, a tenant access token can never
 * be verified here and vice-versa.
 */
@Injectable()
export class PlatformJwtTokenService implements PlatformTokenService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.accessSecret = config.get('PLATFORM_JWT_ACCESS_SECRET', { infer: true });
    this.refreshSecret = config.get('PLATFORM_JWT_REFRESH_SECRET', { infer: true });
  }

  signAccessToken(payload: PlatformAccessTokenPayload): string {
    return this.jwt.sign(payload, { secret: this.accessSecret, expiresIn: ACCESS_TTL });
  }

  issueRefreshToken(sub: string): IssuedPlatformRefreshToken {
    const jti = randomUUID();
    const token = this.jwt.sign(
      { sub, scope: 'platform', jti },
      { secret: this.refreshSecret, expiresIn: REFRESH_TTL },
    );
    return {
      token,
      tokenHash: this.hashRefreshToken(token),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      jti,
    };
  }

  verifyAccessToken(token: string): PlatformAccessTokenPayload {
    return this.jwt.verify<PlatformAccessTokenPayload>(token, { secret: this.accessSecret });
  }

  verifyRefreshToken(token: string): PlatformRefreshTokenPayload {
    return this.jwt.verify<PlatformRefreshTokenPayload>(token, { secret: this.refreshSecret });
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  accessTokenTtlSeconds(): number {
    return ACCESS_TTL_SECONDS;
  }
}
