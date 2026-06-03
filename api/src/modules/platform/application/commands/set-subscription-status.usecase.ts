import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { Subscription, SubscriptionStatus } from '../../domain/entities/subscription';
import {
  SUBSCRIPTION_REPOSITORY,
  SubscriptionRepository,
} from '../../domain/repositories/subscription.repository';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { SubscriptionNotFound } from '../application.errors';
import { ChangedByType } from '../ports/subscription-history.repository';
import { SubscriptionHistoryAppender } from '../services/subscription-history-appender';

export interface SetSubscriptionStatusInput {
  organizationId: string;
  status: SubscriptionStatus;
  changedByType?: ChangedByType;
  changedByUserId?: string | null;
  reason?: string | null;
}

/** Set an organization's subscription status (TRIALING/ACTIVE/PAST_DUE/...). */
@Injectable()
export class SetSubscriptionStatusUseCase implements UseCase<
  SetSubscriptionStatusInput,
  Subscription
> {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subscriptions: SubscriptionRepository,
    private readonly events: DomainEventPublisher,
    private readonly history: SubscriptionHistoryAppender,
  ) {}

  async execute(input: SetSubscriptionStatusInput): Promise<Subscription> {
    const subscription = await this.subscriptions.findByOrganizationId(input.organizationId);
    if (!subscription) {
      throw SubscriptionNotFound();
    }
    const fromStatus = subscription.status;
    subscription.setStatus(input.status);
    await this.subscriptions.update(subscription);
    await this.history.append({
      organizationId: input.organizationId,
      subscriptionId: subscription.id,
      fromStatus,
      toStatus: input.status,
      changedByType: input.changedByType ?? 'PLATFORM_USER',
      changedByUserId: input.changedByUserId ?? null,
      reason: input.reason ?? 'status_changed',
    });
    await this.events.publishFromAggregate(subscription);
    return subscription;
  }
}
