import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  SUBSCRIPTION_HISTORY_REPOSITORY,
  SubscriptionHistoryRepository,
} from '../../../platform/application/ports/subscription-history.repository';
import { ACCOUNT_QUERY, AccountQuery, BillingView } from '../ports/account-query.port';
import { SubscriptionHistoryResponse } from '../dto/responses';

export interface GetBillingResult {
  billing: BillingView | null;
  subscriptionHistory: SubscriptionHistoryResponse[];
  invoices: unknown[];
}

@Injectable()
export class GetBillingUseCase implements UseCase<{ organizationId: string }, GetBillingResult> {
  constructor(
    @Inject(ACCOUNT_QUERY) private readonly query: AccountQuery,
    @Inject(SUBSCRIPTION_HISTORY_REPOSITORY)
    private readonly history: SubscriptionHistoryRepository,
  ) {}

  async execute(input: { organizationId: string }): Promise<GetBillingResult> {
    const billing = await this.query.billing(input.organizationId);
    const rows = await this.history.recent(input.organizationId, 10);
    return {
      billing,
      subscriptionHistory: rows.map((r) => ({
        id: r.id,
        fromStatus: r.fromStatus,
        toStatus: r.toStatus,
        fromPlanId: r.fromPlanId,
        toPlanId: r.toPlanId,
        changedByType: r.changedByType,
        reason: r.reason,
        createdAt: r.createdAt.toISOString(),
      })),
      invoices: [], // placeholder — invoicing is future
    };
  }
}
