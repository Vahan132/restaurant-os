import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  CUSTOMER_REFRESH_TOKEN_REPOSITORY,
  CustomerRefreshTokenRepository,
} from '../../domain/repositories/customer-refresh-token.repository';
import {
  CONSUMER_TOKEN_SERVICE,
  ConsumerTokenService,
} from '../ports/consumer-token.service';

export interface SignOutConsumerInput {
  refreshToken: string;
}

/** Revoke the presented token's whole family. Idempotent (unknown token = no-op). */
@Injectable()
export class SignOutConsumerUseCase implements UseCase<SignOutConsumerInput, void> {
  constructor(
    @Inject(CUSTOMER_REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokens: CustomerRefreshTokenRepository,
    @Inject(CONSUMER_TOKEN_SERVICE) private readonly tokens: ConsumerTokenService,
  ) {}

  async execute(input: SignOutConsumerInput): Promise<void> {
    const tokenHash = this.tokens.hashRefreshToken(input.refreshToken);
    const record = await this.refreshTokens.findByTokenHash(tokenHash);
    if (record) await this.refreshTokens.revokeFamily(record.familyId);
  }
}
