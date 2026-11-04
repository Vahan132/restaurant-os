import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { E164Phone } from '../../domain/value-objects/e164-phone';
import { PhoneAlreadyInUseError } from '../../domain/consumer-identity.errors';
import {
  CUSTOMER_ACCOUNT_REPOSITORY,
  CustomerAccountRepository,
} from '../../domain/repositories/customer-account.repository';
import {
  CUSTOMER_IDENTITY_REPOSITORY,
  CustomerIdentityRepository,
} from '../../domain/repositories/customer-identity.repository';
import { RequestPhoneOtpUseCase } from './request-phone-otp.usecase';

export interface RequestPhoneChangeOtpInput {
  customerAccountId: string;
  newPhone: string;
  locale?: string | null;
}

/**
 * Start a phone change: validate the new number is free, then send an OTP to it
 * (reusing the OTP issuance flow). The change is applied only after ConfirmPhoneChange.
 */
@Injectable()
export class RequestPhoneChangeOtpUseCase implements UseCase<RequestPhoneChangeOtpInput, void> {
  constructor(
    @Inject(CUSTOMER_ACCOUNT_REPOSITORY) private readonly accounts: CustomerAccountRepository,
    @Inject(CUSTOMER_IDENTITY_REPOSITORY) private readonly identities: CustomerIdentityRepository,
    private readonly requestOtp: RequestPhoneOtpUseCase,
  ) {}

  async execute(input: RequestPhoneChangeOtpInput): Promise<void> {
    const newPhone = E164Phone.normalizeOrThrow(input.newPhone);
    await assertPhoneFree(this.accounts, this.identities, newPhone, input.customerAccountId);
    await this.requestOtp.execute({ phone: newPhone, locale: input.locale });
  }
}

/** Throws PHONE_ALREADY_IN_USE if the number belongs to a different account. */
export async function assertPhoneFree(
  accounts: CustomerAccountRepository,
  identities: CustomerIdentityRepository,
  phone: string,
  selfAccountId: string,
): Promise<void> {
  const byPhone = await accounts.findByPhone(phone);
  if (byPhone && byPhone.id !== selfAccountId) throw new PhoneAlreadyInUseError();
  const identity = await identities.findByProviderSubject('PHONE', phone);
  if (identity && identity.customerAccountId !== selfAccountId) throw new PhoneAlreadyInUseError();
}
