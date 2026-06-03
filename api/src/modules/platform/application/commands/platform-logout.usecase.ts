import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  PLATFORM_REFRESH_TOKEN_REPOSITORY,
  PlatformRefreshTokenRepository,
} from '../ports/platform-refresh-token.repository';
import { PLATFORM_TOKEN_SERVICE, PlatformTokenService } from '../ports/platform-token.service';

export interface PlatformLogoutInput {
  refreshToken: string;
}

/** Revoke the presented platform refresh token (idempotent). */
@Injectable()
export class PlatformLogoutUseCase implements UseCase<PlatformLogoutInput, void> {
  constructor(
    @Inject(PLATFORM_REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokens: PlatformRefreshTokenRepository,
    @Inject(PLATFORM_TOKEN_SERVICE) private readonly tokens: PlatformTokenService,
  ) {}

  async execute(input: PlatformLogoutInput): Promise<void> {
    const hash = this.tokens.hashRefreshToken(input.refreshToken);
    const record = await this.refreshTokens.findByHash(hash);
    if (record && !record.revokedAt) {
      await this.refreshTokens.revoke(record.id);
    }
  }
}
