import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import { AccessTokenPayload, RefreshTokenPayload } from '../../../../shared/auth/jwt-payload';
import { AppConfig } from '../../../../shared/infrastructure/config/env.schema';
import { IssuedRefreshToken, TokenService } from '../../application/ports/token.service';

const ACCESS_TTL = '15m';
const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL = '7d';
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * TokenService backed by @nestjs/jwt.
 *
 * Access tokens (15m) are signed with JWT_ACCESS_SECRET and carry a permissions
 * SNAPSHOT — so permission/role changes only take effect on the next refresh.
 * Refresh tokens (7d) are signed with JWT_REFRESH_SECRET; only sha256(token) is
 * ever persisted.
 */
@Injectable()
export class JwtTokenService implements TokenService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.accessSecret = config.get('JWT_ACCESS_SECRET', { infer: true });
    this.refreshSecret = config.get('JWT_REFRESH_SECRET', { infer: true });
  }

  signAccessToken(payload: AccessTokenPayload): string {
    return this.jwt.sign(payload, { secret: this.accessSecret, expiresIn: ACCESS_TTL });
  }

  issueRefreshToken(payload: Omit<RefreshTokenPayload, 'jti'>): IssuedRefreshToken {
    const jti = randomUUID();
    const token = this.jwt.sign(
      { sub: payload.sub, organizationId: payload.organizationId, jti },
      { secret: this.refreshSecret, expiresIn: REFRESH_TTL },
    );
    return {
      token,
      tokenHash: this.hashRefreshToken(token),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      jti,
    };
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    return this.jwt.verify<AccessTokenPayload>(token, { secret: this.accessSecret });
  }

  verifyRefreshToken(token: string): RefreshTokenPayload {
    return this.jwt.verify<RefreshTokenPayload>(token, { secret: this.refreshSecret });
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  accessTokenTtlSeconds(): number {
    return ACCESS_TTL_SECONDS;
  }
}
