import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ACCOUNT_QUERY, AccountQuery, AccountSubscriptionView } from '../ports/account-query.port';

@Injectable()
export class GetSubscriptionUseCase implements UseCase<
  { organizationId: string },
  AccountSubscriptionView
> {
  constructor(@Inject(ACCOUNT_QUERY) private readonly query: AccountQuery) {}

  async execute(input: { organizationId: string }): Promise<AccountSubscriptionView> {
    const view = await this.query.subscriptionView(input.organizationId);
    if (!view) {
      throw new NotFoundException({
        code: 'SUBSCRIPTION_NOT_FOUND',
        message: 'Subscription not found.',
      });
    }
    return view;
  }
}
