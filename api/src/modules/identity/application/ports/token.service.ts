import { AccessTokenPayload, RefreshTokenPayload } from '../../../../shared/auth/jwt-payload';

/** DI token for the TokenService port. */
export const TOKEN_SERVICE = Symbol('TokenService');

export interface IssuedRefreshToken {
  /** The raw refresh token (returned to the client, never stored raw). */
  token: string;
  /** sha256(token) — this is what gets persisted. */
  tokenHash: string;
  expiresAt: Date;
  jti: string;
}

/**
 * TokenService port. Implemented in infrastructure with @nestjs/jwt.
 *
 * - Access token: TTL 15m, signed with JWT_ACCESS_SECRET, carries the full
 *   AccessTokenPayload (permissions snapshot).
 * - Refresh token: TTL 7d, signed with JWT_REFRESH_SECRET. Only sha256(token)
 *   is ever persisted (see RefreshTokenRepository).
 */
export interface TokenService {
  signAccessToken(payload: AccessTokenPayload): string;
  issueRefreshToken(payload: Omit<RefreshTokenPayload, 'jti'>): IssuedRefreshToken;
  verifyAccessToken(token: string): AccessTokenPayload;
  verifyRefreshToken(token: string): RefreshTokenPayload;
  /** sha256 hex digest of a raw refresh token (for lookup/storage). */
  hashRefreshToken(token: string): string;
  /** Access-token TTL in seconds (for response metadata). */
  accessTokenTtlSeconds(): number;
}
