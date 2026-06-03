import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ACCOUNT_QUERY, AccountOverview, AccountQuery } from '../ports/account-query.port';

export interface GetAccountInput {
  organizationId: string;
  userId: string;
}

@Injectable()
export class GetAccountUseCase implements UseCase<GetAccountInput, AccountOverview> {
  constructor(@Inject(ACCOUNT_QUERY) private readonly query: AccountQuery) {}

  async execute(input: GetAccountInput): Promise<AccountOverview> {
    const overview = await this.query.overview(input.organizationId, input.userId);
    if (!overview) {
      throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND', message: 'Account not found.' });
    }
    return overview;
  }
}
