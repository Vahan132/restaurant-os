import { Inject, Injectable } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import { UseCase } from '../../../../shared/application/use-case';
import { CustomerAccount } from '../../domain/entities/customer-account';
import { E164Phone } from '../../domain/value-objects/e164-phone';
import {
  CUSTOMER_ACCOUNT_REPOSITORY,
  CustomerAccountRepository,
} from '../../domain/repositories/customer-account.repository';
import {
  CUSTOMER_IDENTITY_REPOSITORY,
  CustomerIdentityRepository,
} from '../../domain/repositories/customer-identity.repository';
import { ConsumerSession, IssueConsumerSession } from '../services/issue-consumer-session.service';
import { VerifyOtpChallenge } from '../services/verify-otp-challenge.service';

export interface VerifyPhoneOtpInput {
  phone: string;
  code: string;
}

/**
 * Verify a phone OTP and issue a session. Phone is a PRIMARY method: a successful
 * verify find-or-creates the account by its PHONE identity. The raw code check +
 * lockout live in VerifyOtpChallenge (shared with phone-change).
 */
@Injectable()
export class VerifyPhoneOtpUseCase implements UseCase<VerifyPhoneOtpInput, ConsumerSession> {
  constructor(
    @Inject(CUSTOMER_ACCOUNT_REPOSITORY) private readonly accounts: CustomerAccountRepository,
    @Inject(CUSTOMER_IDENTITY_REPOSITORY) private readonly identities: CustomerIdentityRepository,
    private readonly challenge: VerifyOtpChallenge,
    private readonly issueSession: IssueConsumerSession,
  ) {}

  async execute(input: VerifyPhoneOtpInput): Promise<ConsumerSession> {
    const phone = E164Phone.normalizeOrThrow(input.phone);
    await this.challenge.execute(phone, input.code);

    const accountId = await this.findOrCreateByPhone(phone);
    return this.issueSession.execute(accountId);
  }

  private async findOrCreateByPhone(phone: string): Promise<string> {
    const identity = await this.identities.findByProviderSubject('PHONE', phone);
    if (identity) return identity.customerAccountId;

    const existing = await this.accounts.findByPhone(phone);
    if (existing) {
      await this.identities.create({
        customerAccountId: existing.id,
        provider: 'PHONE',
        subject: phone,
        emailVerified: false,
      });
      return existing.id;
    }

    const id = createId();
    const account = CustomerAccount.create({ id, phone });
    await this.accounts.save(account);
    await this.identities.create({
      customerAccountId: id,
      provider: 'PHONE',
      subject: phone,
      emailVerified: false,
    });
    return id;
  }
}
