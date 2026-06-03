import { BaseDomainEvent } from '../../../../shared/domain/domain-event';

/** Menu domain events (namespaced `menu.*`). Audit/KDS handlers come later. */

export class MenuItemCreatedEvent extends BaseDomainEvent {
  readonly eventName = 'menu.item.created';
  constructor(
    public readonly menuItemId: string,
    public readonly restaurantId: string,
    public readonly categoryId: string,
    public readonly actorUserId: string | null = null,
  ) {
    super(menuItemId);
  }
}

export class MenuItemPriceChangedEvent extends BaseDomainEvent {
  readonly eventName = 'menu.item.price_changed';
  constructor(
    public readonly menuItemId: string,
    public readonly restaurantId: string,
    public readonly oldPriceAmount: number,
    public readonly newPriceAmount: number,
    public readonly actorUserId: string | null = null,
  ) {
    super(menuItemId);
  }
}

export class MenuItemAvailabilityChangedEvent extends BaseDomainEvent {
  readonly eventName = 'menu.item.availability_changed';
  constructor(
    public readonly menuItemId: string,
    public readonly restaurantId: string,
    public readonly availability: string,
  ) {
    super(menuItemId);
  }
}

export class MenuItemDeletedEvent extends BaseDomainEvent {
  readonly eventName = 'menu.item.deleted';
  constructor(
    public readonly menuItemId: string,
    public readonly restaurantId: string,
    public readonly actorUserId: string | null = null,
  ) {
    super(menuItemId);
  }
}
