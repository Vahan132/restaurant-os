import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ConsumerAccountNotFoundError } from '../../domain/consumer-identity.errors';
import {
  CUSTOMER_ACCOUNT_REPOSITORY,
  CustomerAccountRepository,
} from '../../domain/repositories/customer-account.repository';
import { ConsumerProfileView, toProfileView } from '../dto/profile-view';

@Injectable()
export class GetMyProfileUseCase implements UseCase<string, ConsumerProfileView> {
  constructor(
    @Inject(CUSTOMER_ACCOUNT_REPOSITORY) private readonly accounts: CustomerAccountRepository,
  ) {}

  async execute(customerAccountId: string): Promise<ConsumerProfileView> {
    const account = await this.accounts.findById(customerAccountId);
    if (!account) throw new ConsumerAccountNotFoundError();
    return toProfileView(account);
  }
}
