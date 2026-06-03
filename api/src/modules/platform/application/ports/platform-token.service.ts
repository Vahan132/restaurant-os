/** DI token for the PlatformTokenService port. */
export const PLATFORM_TOKEN_SERVICE = Symbol('PlatformTokenService');

/**
 * Platform access-token claims. `scope: "platform"` plus separate signing
 * secrets guarantee a tenant token can never authorize a platform route. NO
 * organizationId — platform admins are cross-tenant.
 */
export interface PlatformAccessTokenPayload {
  sub: string;
  scope: 'platform';
  role: string;
}

export interface PlatformRefreshTokenPayload {
  sub: string;
  scope: 'platform';
  jti: string;
}

export interface IssuedPlatformRefreshToken {
  token: string;
  tokenHash: string;
  expiresAt: Date;
  jti: string;
}

export interface PlatformTokenService {
  signAccessToken(payload: PlatformAccessTokenPayload): string;
  issueRefreshToken(sub: string): IssuedPlatformRefreshToken;
  verifyAccessToken(token: string): PlatformAccessTokenPayload;
  verifyRefreshToken(token: string): PlatformRefreshTokenPayload;
  hashRefreshToken(token: string): string;
  accessTokenTtlSeconds(): number;
}
