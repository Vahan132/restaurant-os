import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { Subscription } from '../../domain/entities/subscription';
import { PLAN_REPOSITORY, PlanRepository } from '../../domain/repositories/plan.repository';
import {
  SUBSCRIPTION_REPOSITORY,
  SubscriptionRepository,
} from '../../domain/repositories/subscription.repository';
import { PlanNotFound, SubscriptionNotFound } from '../application.errors';
import { ChangedByType } from '../ports/subscription-history.repository';
import { SubscriptionHistoryAppender } from '../services/subscription-history-appender';

export interface ChangePlanInput {
  organizationId: string;
  planId: string;
  changedByType?: ChangedByType;
  changedByUserId?: string | null;
  reason?: string | null;
}

/** Move an organization's subscription to a different plan. */
@Injectable()
export class ChangePlanUseCase implements UseCase<ChangePlanInput, Subscription> {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subscriptions: SubscriptionRepository,
    @Inject(PLAN_REPOSITORY) private readonly plans: PlanRepository,
    private readonly history: SubscriptionHistoryAppender,
  ) {}

  async execute(input: ChangePlanInput): Promise<Subscription> {
    const subscription = await this.subscriptions.findByOrganizationId(input.organizationId);
    if (!subscription) {
      throw SubscriptionNotFound();
    }
    const plan = await this.plans.findById(input.planId);
    if (!plan) {
      throw PlanNotFound();
    }
    const fromPlanId = subscription.planId;
    subscription.changePlan(plan.id);
    await this.subscriptions.update(subscription);
    await this.history.append({
      organizationId: input.organizationId,
      subscriptionId: subscription.id,
      fromPlanId,
      toPlanId: plan.id,
      changedByType: input.changedByType ?? 'PLATFORM_USER',
      changedByUserId: input.changedByUserId ?? null,
      reason: input.reason ?? 'plan_changed',
    });
    return subscription;
  }
}
