import { BaseDomainEvent } from '../../../../shared/domain/domain-event';

/** Platform domain events (namespaced `platform.*`). */

export class OrganizationProvisionedEvent extends BaseDomainEvent {
  readonly eventName = 'platform.organization.provisioned';
  constructor(
    public readonly organizationId: string,
    public readonly restaurantId: string,
    public readonly ownerUserId: string,
    public readonly planCode: string,
    public readonly actorUserId: string | null = null,
  ) {
    super(organizationId);
  }
}

export class OrganizationSuspendedEvent extends BaseDomainEvent {
  readonly eventName = 'platform.organization.suspended';
  constructor(
    public readonly organizationId: string,
    public readonly actorUserId: string | null = null,
  ) {
    super(organizationId);
  }
}

export class SubscriptionStatusChangedEvent extends BaseDomainEvent {
  readonly eventName = 'platform.subscription.status_changed';
  constructor(
    public readonly organizationId: string,
    public readonly subscriptionId: string,
    public readonly status: string,
    public readonly actorUserId: string | null = null,
  ) {
    super(subscriptionId);
  }
}
