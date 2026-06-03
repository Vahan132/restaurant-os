export const SUBSCRIPTION_HISTORY_REPOSITORY = Symbol('SubscriptionHistoryRepository');

export type ChangedByType = 'SYSTEM' | 'PLATFORM_USER' | 'USER';

export interface SubscriptionHistoryRecord {
  id: string;
  organizationId: string;
  subscriptionId: string;
  fromStatus: string | null;
  toStatus: string | null;
  fromPlanId: string | null;
  toPlanId: string | null;
  changedByType: ChangedByType;
  changedByUserId: string | null;
  reason: string | null;
  createdAt: Date;
}

/** Append-only subscription change log (feeds owner account view + platform admin). */
export interface SubscriptionHistoryRepository {
  append(record: SubscriptionHistoryRecord): Promise<void>;
  listByOrg(
    organizationId: string,
    skip: number,
    take: number,
  ): Promise<{ items: SubscriptionHistoryRecord[]; total: number }>;
  recent(organizationId: string, limit: number): Promise<SubscriptionHistoryRecord[]>;
}
