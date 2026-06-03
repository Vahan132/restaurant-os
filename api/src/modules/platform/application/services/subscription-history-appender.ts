import { Inject, Injectable } from '@nestjs/common';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import {
  ChangedByType,
  SUBSCRIPTION_HISTORY_REPOSITORY,
  SubscriptionHistoryRepository,
} from '../ports/subscription-history.repository';

export interface AppendHistoryInput {
  organizationId: string;
  subscriptionId: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  fromPlanId?: string | null;
  toPlanId?: string | null;
  changedByType: ChangedByType;
  changedByUserId?: string | null;
  reason?: string | null;
}

/** Appends a SubscriptionHistory row (id + createdAt generated). Reused by signup, owner + platform. */
@Injectable()
export class SubscriptionHistoryAppender {
  constructor(
    @Inject(SUBSCRIPTION_HISTORY_REPOSITORY)
    private readonly repo: SubscriptionHistoryRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async append(input: AppendHistoryInput): Promise<void> {
    await this.repo.append({
      id: this.ids.generate(),
      organizationId: input.organizationId,
      subscriptionId: input.subscriptionId,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      fromPlanId: input.fromPlanId ?? null,
      toPlanId: input.toPlanId ?? null,
      changedByType: input.changedByType,
      changedByUserId: input.changedByUserId ?? null,
      reason: input.reason ?? null,
      createdAt: new Date(),
    });
  }
}
