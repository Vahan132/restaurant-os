export const PLATFORM_REFRESH_TOKEN_REPOSITORY = Symbol('PlatformRefreshTokenRepository');

export interface PlatformRefreshTokenRecord {
  id: string;
  platformUserId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface NewPlatformRefreshToken {
  id: string;
  platformUserId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface PlatformRefreshTokenRepository {
  create(token: NewPlatformRefreshToken): Promise<void>;
  findByHash(tokenHash: string): Promise<PlatformRefreshTokenRecord | null>;
  revoke(id: string): Promise<void>;
}
