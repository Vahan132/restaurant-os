import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { PlatformUser } from '../../domain/entities/platform-user';
import {
  PLATFORM_USER_REPOSITORY,
  PlatformUserRepository,
} from '../../domain/repositories/platform-user.repository';
import { PlatformAccountBlocked, PlatformInvalidRefreshToken } from '../application.errors';
import {
  PLATFORM_REFRESH_TOKEN_REPOSITORY,
  PlatformRefreshTokenRepository,
} from '../ports/platform-refresh-token.repository';
import { PLATFORM_TOKEN_SERVICE, PlatformTokenService } from '../ports/platform-token.service';
import { PlatformTokenIssuer } from '../services/platform-token-issuer';

export interface PlatformRefreshInput {
  refreshToken: string;
}

export interface PlatformRefreshOutput {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: PlatformUser;
}

/** Rotate a platform refresh token; reuse of a revoked/expired token fails. */
@Injectable()
export class PlatformRefreshUseCase implements UseCase<
  PlatformRefreshInput,
  PlatformRefreshOutput
> {
  constructor(
    @Inject(PLATFORM_USER_REPOSITORY) private readonly users: PlatformUserRepository,
    @Inject(PLATFORM_REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokens: PlatformRefreshTokenRepository,
    @Inject(PLATFORM_TOKEN_SERVICE) private readonly tokens: PlatformTokenService,
    private readonly issuer: PlatformTokenIssuer,
  ) {}

  async execute(input: PlatformRefreshInput): Promise<PlatformRefreshOutput> {
    let payload;
    try {
      payload = this.tokens.verifyRefreshToken(input.refreshToken);
    } catch {
      throw PlatformInvalidRefreshToken();
    }

    const hash = this.tokens.hashRefreshToken(input.refreshToken);
    const record = await this.refreshTokens.findByHash(hash);
    if (!record || record.revokedAt || record.expiresAt.getTime() <= Date.now()) {
      throw PlatformInvalidRefreshToken();
    }

    const user = await this.users.findById(payload.sub);
    if (!user || user.isDeleted()) {
      throw PlatformInvalidRefreshToken();
    }
    if (!user.isActive()) {
      throw PlatformAccountBlocked();
    }

    await this.refreshTokens.revoke(record.id);
    const issued = await this.issuer.issueFor(user);
    return { ...issued, user };
  }
}
