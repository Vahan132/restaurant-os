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
 * OFF-5: tokens are signed with a PER-RESTAURANT root key (resolved via
 * RESTAURANT_KEY_PROVIDER). Distinct access/refresh signing secrets are DERIVED
 * from the root via HMAC, preserving access/refresh separation while letting the
 * cloud and the restaurant's edge — which share the root — validate each other's
 * tokens. The same root → same derived secrets → cross-side interop.
 *
 * - Access token: TTL 15m, carries the full AccessTokenPayload (permissions
 *   snapshot).
 * - Refresh token: TTL 7d; only sha256(token) is ever persisted. It carries the
 *   restaurantId claim so a refresh can resolve the signing key before verifying.
 */
export interface TokenService {
  signAccessToken(payload: AccessTokenPayload, signingKey: string): string;
  issueRefreshToken(
    payload: Omit<RefreshTokenPayload, 'jti'>,
    signingKey: string,
  ): IssuedRefreshToken;
  verifyAccessToken(token: string, signingKey: string): AccessTokenPayload;
  verifyRefreshToken(token: string, signingKey: string): RefreshTokenPayload;
  /**
   * Read the restaurantId claim WITHOUT verifying the signature (so the caller
   * can resolve the per-restaurant key, then verify). Returns null if absent.
   */
  decodeRestaurantId(token: string): string | null;
  /** sha256 hex digest of a raw refresh token (for lookup/storage). */
  hashRefreshToken(token: string): string;
  /** Access-token TTL in seconds (for response metadata). */
  accessTokenTtlSeconds(): number;
}
