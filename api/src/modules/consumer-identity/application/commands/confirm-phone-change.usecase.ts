import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { E164Phone } from '../../domain/value-objects/e164-phone';
import { ConsumerAccountNotFoundError } from '../../domain/consumer-identity.errors';
import {
  CUSTOMER_ACCOUNT_REPOSITORY,
  CustomerAccountRepository,
} from '../../domain/repositories/customer-account.repository';
import {
  CUSTOMER_IDENTITY_REPOSITORY,
  CustomerIdentityRepository,
} from '../../domain/repositories/customer-identity.repository';
import { ConsumerProfileView, toProfileView } from '../dto/profile-view';
import { VerifyOtpChallenge } from '../services/verify-otp-challenge.service';
import { assertPhoneFree } from './request-phone-change-otp.usecase';

export interface ConfirmPhoneChangeInput {
  customerAccountId: string;
  newPhone: string;
  code: string;
}

/**
 * Confirm a phone change: re-check availability, verify the OTP for the new number,
 * then atomically update the account phone + repoint (or create) its PHONE identity.
 */
@Injectable()
export class ConfirmPhoneChangeUseCase
  implements UseCase<ConfirmPhoneChangeInput, ConsumerProfileView>
{
  constructor(
    @Inject(CUSTOMER_ACCOUNT_REPOSITORY) private readonly accounts: CustomerAccountRepository,
    @Inject(CUSTOMER_IDENTITY_REPOSITORY) private readonly identities: CustomerIdentityRepository,
    private readonly challenge: VerifyOtpChallenge,
  ) {}

  async execute(input: ConfirmPhoneChangeInput): Promise<ConsumerProfileView> {
    const newPhone = E164Phone.normalizeOrThrow(input.newPhone);
    await assertPhoneFree(this.accounts, this.identities, newPhone, input.customerAccountId);

    await this.challenge.execute(newPhone, input.code);

    const account = await this.accounts.findById(input.customerAccountId);
    if (!account) throw new ConsumerAccountNotFoundError();
    account.setPhone(newPhone);
    await this.accounts.save(account);

    const phoneIdentity = await this.identities.findByAccountAndProvider(
      input.customerAccountId,
      'PHONE',
    );
    if (phoneIdentity) {
      await this.identities.updateSubject(phoneIdentity.id, newPhone);
    } else {
      await this.identities.create({
        customerAccountId: input.customerAccountId,
        provider: 'PHONE',
        subject: newPhone,
        emailVerified: false,
      });
    }

    return toProfileView(account);
  }
}
