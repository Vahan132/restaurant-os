/** DI token for the RefreshTokenRepository port. */
export const REFRESH_TOKEN_REPOSITORY = Symbol('RefreshTokenRepository');

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface NewRefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

/**
 * RefreshTokenRepository port — persistence for hashed refresh tokens.
 * (Not a domain aggregate; a thin infrastructure record.) Prisma impl in infra.
 */
export interface RefreshTokenRepository {
  create(token: NewRefreshToken): Promise<void>;
  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  revoke(id: string): Promise<void>;
  /** Revoke every active refresh token for a user (e.g. on password change). */
  revokeAllForUser(userId: string): Promise<void>;
}
