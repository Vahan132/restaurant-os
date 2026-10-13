export const SESSION_TOKEN_SERVICE = Symbol('SessionTokenService');

export interface IssuedSessionToken {
  /** The opaque plaintext token — returned to the client exactly once, never stored. */
  token: string;
  /** SHA-256 of the token — the only thing persisted (mirrors CustomerRefreshToken). */
  tokenHash: string;
}

/**
 * Issues + hashes opaque server-side session tokens for anonymous QR-web
 * reattach. Tokens are never client-supplied; only their hash is persisted.
 */
export interface SessionTokenService {
  generate(): IssuedSessionToken;
  hash(token: string): string;
}
