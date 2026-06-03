import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ACCOUNT_QUERY, AccountQuery, PublicPlanView } from '../ports/account-query.port';

@Injectable()
export class GetPlansUseCase implements UseCase<void, PublicPlanView[]> {
  constructor(@Inject(ACCOUNT_QUERY) private readonly query: AccountQuery) {}
  execute(): Promise<PublicPlanView[]> {
    return this.query.activePlans();
  }
}
