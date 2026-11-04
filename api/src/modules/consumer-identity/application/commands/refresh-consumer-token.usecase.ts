import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  RefreshTokenInvalidError,
  RefreshTokenReusedError,
} from '../../domain/consumer-identity.errors';
import {
  CUSTOMER_REFRESH_TOKEN_REPOSITORY,
  CustomerRefreshTokenRepository,
} from '../../domain/repositories/customer-refresh-token.repository';
import {
  CONSUMER_TOKEN_SERVICE,
  ConsumerTokenService,
} from '../ports/consumer-token.service';
import { ConsumerSession } from '../services/issue-consumer-session.service';

export interface RefreshConsumerTokenInput {
  refreshToken: string;
}

/**
 * Rotate a refresh token within its family.
 *  - unknown hash / expired → REFRESH_TOKEN_INVALID.
 *  - hash matches an ALREADY-REVOKED row → reuse → revoke the whole family +
 *    REFRESH_TOKEN_REUSED.
 *  - valid → issue a new access token + a new refresh token in the same family, and
 *    revoke the presented one (recording its successor).
 */
@Injectable()
export class RefreshConsumerTokenUseCase
  implements UseCase<RefreshConsumerTokenInput, ConsumerSession>
{
  constructor(
    @Inject(CUSTOMER_REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokens: CustomerRefreshTokenRepository,
    @Inject(CONSUMER_TOKEN_SERVICE) private readonly tokens: ConsumerTokenService,
  ) {}

  async execute(input: RefreshConsumerTokenInput): Promise<ConsumerSession> {
    const tokenHash = this.tokens.hashRefreshToken(input.refreshToken);
    const record = await this.refreshTokens.findByTokenHash(tokenHash);

    if (!record) throw new RefreshTokenInvalidError();

    if (record.revokedAt !== null) {
      // The token was already rotated/revoked but is being presented again → reuse.
      await this.refreshTokens.revokeFamily(record.familyId);
      throw new RefreshTokenReusedError();
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      throw new RefreshTokenInvalidError();
    }

    // Rotate within the same family.
    const accessToken = this.tokens.signAccessToken({
      sub: record.customerAccountId,
      aud: 'consumer',
    });
    const issued = this.tokens.generateRefreshToken();
    const created = await this.refreshTokens.create({
      customerAccountId: record.customerAccountId,
      familyId: record.familyId,
      tokenHash: issued.tokenHash,
      expiresAt: issued.expiresAt,
    });
    await this.refreshTokens.markRevoked(record.id, created.id);

    return {
      accessToken,
      refreshToken: issued.token,
      tokenType: 'Bearer',
      expiresIn: this.tokens.accessTokenTtlSeconds(),
    };
  }
}
