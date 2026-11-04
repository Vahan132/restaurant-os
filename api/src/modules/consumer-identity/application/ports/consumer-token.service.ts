/** DI token for the ConsumerTokenService port. */
export const CONSUMER_TOKEN_SERVICE = Symbol('ConsumerTokenService');

/**
 * Consumer access-token claims. `aud: 'consumer'` plus a SEPARATE signing secret
 * guarantee a staff/platform token can never authorize a consumer route and
 * vice-versa (signature mismatch + audience check).
 */
export interface ConsumerAccessTokenPayload {
  sub: string;
  aud: 'consumer';
}

/** A freshly minted (opaque) refresh token + its at-rest hash + expiry. */
export interface IssuedRefreshToken {
  token: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface ConsumerTokenService {
  signAccessToken(payload: ConsumerAccessTokenPayload): string;
  verifyAccessToken(token: string): ConsumerAccessTokenPayload;
  accessTokenTtlSeconds(): number;
  /** Opaque random refresh token (never a JWT); only its hash is persisted. */
  generateRefreshToken(): IssuedRefreshToken;
  hashRefreshToken(token: string): string;
}
