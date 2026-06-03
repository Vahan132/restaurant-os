import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ChangePlanUseCase as PlatformChangePlanUseCase } from '../../../platform/application/commands/change-plan.usecase';
import {
  PLAN_REPOSITORY,
  PlanRepository,
} from '../../../platform/domain/repositories/plan.repository';
import { ACCOUNT_QUERY, AccountQuery, AccountSubscriptionView } from '../ports/account-query.port';
import { PlanNotAvailable } from '../application.errors';

export interface OwnerChangePlanInput {
  organizationId: string;
  userId: string;
  planCode: string;
}

/**
 * Owner-initiated plan change. Maps planCode -> active plan, delegates to the
 * platform ChangePlan (which appends SubscriptionHistory as changedByType USER).
 * No proration / charging — future.
 */
@Injectable()
export class OwnerChangePlanUseCase implements UseCase<
  OwnerChangePlanInput,
  AccountSubscriptionView
> {
  constructor(
    @Inject(PLAN_REPOSITORY) private readonly plans: PlanRepository,
    private readonly platformChangePlan: PlatformChangePlanUseCase,
    @Inject(ACCOUNT_QUERY) private readonly query: AccountQuery,
  ) {}

  async execute(input: OwnerChangePlanInput): Promise<AccountSubscriptionView> {
    const plan = await this.plans.findByCode(input.planCode);
    if (!plan || !plan.isActive) {
      throw PlanNotAvailable();
    }
    await this.platformChangePlan.execute({
      organizationId: input.organizationId,
      planId: plan.id,
      changedByType: 'USER',
      changedByUserId: input.userId,
      reason: 'owner_change_plan',
    });
    return (await this.query.subscriptionView(input.organizationId))!;
  }
}
