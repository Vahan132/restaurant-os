export const CUSTOMER_REFRESH_TOKEN_REPOSITORY = Symbol('CustomerRefreshTokenRepository');

export interface RefreshTokenRecord {
  id: string;
  customerAccountId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
}

export interface CustomerRefreshTokenRepository {
  /** Persist a new (hashed) refresh token; returns the generated id. */
  create(input: {
    customerAccountId: string;
    familyId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<RefreshTokenRecord>;
  /** Lookup by hash (the only way a presented token is resolved). */
  findByTokenHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  /** Revoke a single token, optionally recording its successor. */
  markRevoked(id: string, replacedById: string | null): Promise<void>;
  /** Revoke every (still-active) token in a family — reuse response / sign-out. */
  revokeFamily(familyId: string): Promise<void>;
}
