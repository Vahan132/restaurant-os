import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ConsumerGender } from '../../domain/entities/customer-account';
import {
  ConsumerAccountNotFoundError,
  EmailImmutableError,
} from '../../domain/consumer-identity.errors';
import {
  CUSTOMER_ACCOUNT_REPOSITORY,
  CustomerAccountRepository,
} from '../../domain/repositories/customer-account.repository';
import { ConsumerProfileView, toProfileView } from '../dto/profile-view';

export interface UpdateMyProfileInput {
  customerAccountId: string;
  name?: string | null;
  gender?: ConsumerGender | null;
  /** ISO date (YYYY-MM-DD) or null. */
  birthday?: string | null;
  /** Present only to be explicitly rejected (email is provider-owned). */
  email?: string;
}

/**
 * Update freely-editable profile fields (name/gender/birthday). Email is
 * provider-owned: any attempt to change it is rejected with EMAIL_IMMUTABLE. Phone
 * is changed via the OTP re-verify flow, not here.
 */
@Injectable()
export class UpdateMyProfileUseCase implements UseCase<UpdateMyProfileInput, ConsumerProfileView> {
  constructor(
    @Inject(CUSTOMER_ACCOUNT_REPOSITORY) private readonly accounts: CustomerAccountRepository,
  ) {}

  async execute(input: UpdateMyProfileInput): Promise<ConsumerProfileView> {
    if (input.email !== undefined) throw new EmailImmutableError();

    const account = await this.accounts.findById(input.customerAccountId);
    if (!account) throw new ConsumerAccountNotFoundError();

    account.updateProfile({
      name: input.name,
      gender: input.gender,
      birthday: input.birthday === undefined ? undefined : parseDate(input.birthday),
    });
    await this.accounts.save(account);
    return toProfileView(account);
  }
}

function parseDate(value: string | null): Date | null {
  if (value === null) return null;
  return new Date(`${value}T00:00:00.000Z`);
}
