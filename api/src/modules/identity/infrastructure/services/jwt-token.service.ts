import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { AccessTokenPayload, RefreshTokenPayload } from '../../../../shared/auth/jwt-payload';
import { IssuedRefreshToken, TokenService } from '../../application/ports/token.service';

const ACCESS_TTL = '15m';
const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL = '7d';
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * TokenService backed by @nestjs/jwt (OFF-5).
 *
 * Signing uses a PER-RESTAURANT root key. Separate access/refresh secrets are
 * DERIVED from the root via HMAC-SHA256 (`HMAC(root, "access"|"refresh")`), so
 * access/refresh separation is preserved AND any holder of the same root (cloud
 * or the restaurant's edge) verifies the same tokens. Access tokens (15m) carry
 * a permissions SNAPSHOT; refresh tokens (7d) carry restaurantId so a refresh can
 * resolve the key before verifying. Only sha256(refresh) is ever persisted.
 */
@Injectable()
export class JwtTokenService implements TokenService {
  constructor(private readonly jwt: JwtService) {}

  /** Derive the access/refresh signing secret from the restaurant root key. */
  private deriveKey(rootKey: string, purpose: 'access' | 'refresh'): string {
    return createHmac('sha256', rootKey).update(purpose).digest('hex');
  }

  signAccessToken(payload: AccessTokenPayload, signingKey: string): string {
    return this.jwt.sign(payload, {
      secret: this.deriveKey(signingKey, 'access'),
      expiresIn: ACCESS_TTL,
    });
  }

  issueRefreshToken(
    payload: Omit<RefreshTokenPayload, 'jti'>,
    signingKey: string,
  ): IssuedRefreshToken {
    const jti = randomUUID();
    const token = this.jwt.sign(
      {
        sub: payload.sub,
        organizationId: payload.organizationId,
        restaurantId: payload.restaurantId,
        jti,
      },
      { secret: this.deriveKey(signingKey, 'refresh'), expiresIn: REFRESH_TTL },
    );
    return {
      token,
      tokenHash: this.hashRefreshToken(token),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      jti,
    };
  }

  verifyAccessToken(token: string, signingKey: string): AccessTokenPayload {
    return this.jwt.verify<AccessTokenPayload>(token, {
      secret: this.deriveKey(signingKey, 'access'),
    });
  }

  verifyRefreshToken(token: string, signingKey: string): RefreshTokenPayload {
    return this.jwt.verify<RefreshTokenPayload>(token, {
      secret: this.deriveKey(signingKey, 'refresh'),
    });
  }

  decodeRestaurantId(token: string): string | null {
    const decoded = this.jwt.decode(token) as { restaurantId?: string | null } | null;
    return decoded?.restaurantId ?? null;
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  accessTokenTtlSeconds(): number {
    return ACCESS_TTL_SECONDS;
  }
}
