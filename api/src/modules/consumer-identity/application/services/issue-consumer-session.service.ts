import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  CONSUMER_TOKEN_SERVICE,
  ConsumerTokenService,
} from '../ports/consumer-token.service';
import {
  CUSTOMER_REFRESH_TOKEN_REPOSITORY,
  CustomerRefreshTokenRepository,
} from '../../domain/repositories/customer-refresh-token.repository';

export interface ConsumerSession {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

/**
 * Mints a consumer session: a fresh access token + a new (hashed) refresh token.
 * A new login starts a NEW family; rotation passes the existing `familyId`.
 */
@Injectable()
export class IssueConsumerSession {
  constructor(
    @Inject(CONSUMER_TOKEN_SERVICE) private readonly tokens: ConsumerTokenService,
    @Inject(CUSTOMER_REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokens: CustomerRefreshTokenRepository,
  ) {}

  async execute(customerAccountId: string, familyId?: string): Promise<ConsumerSession> {
    const accessToken = this.tokens.signAccessToken({ sub: customerAccountId, aud: 'consumer' });
    const issued = this.tokens.generateRefreshToken();
    await this.refreshTokens.create({
      customerAccountId,
      familyId: familyId ?? randomUUID(),
      tokenHash: issued.tokenHash,
      expiresAt: issued.expiresAt,
    });
    return {
      accessToken,
      refreshToken: issued.token,
      tokenType: 'Bearer',
      expiresIn: this.tokens.accessTokenTtlSeconds(),
    };
  }
}
