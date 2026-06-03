import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  REFRESH_TOKEN_REPOSITORY,
  RefreshTokenRepository,
} from '../ports/refresh-token.repository';
import { TOKEN_SERVICE, TokenService } from '../ports/token.service';

export interface LogoutInput {
  refreshToken: string;
}

/**
 * Revoke the presented refresh token. Idempotent: revoking an unknown or
 * already-revoked token still succeeds (no information leak).
 */
@Injectable()
export class LogoutUseCase implements UseCase<LogoutInput, void> {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: RefreshTokenRepository,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
  ) {}

  async execute(input: LogoutInput): Promise<void> {
    const hash = this.tokens.hashRefreshToken(input.refreshToken);
    const record = await this.refreshTokens.findByHash(hash);
    if (record && !record.revokedAt) {
      await this.refreshTokens.revoke(record.id);
    }
  }
}
