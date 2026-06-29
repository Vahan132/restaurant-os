import { BaseDomainEvent } from '../../../../shared/domain/domain-event';

/**
 * Staff-PIN domain events (3A). Namespaced `identity.staff_pin.*`. The audit
 * module records created/reset/revoked/locked_out. The lock-out event carries the
 * full login context (branch, device, IP) so the audit row is actionable.
 */
export class StaffPinCreatedEvent extends BaseDomainEvent {
  readonly eventName = 'identity.staff_pin.created';
  constructor(
    public readonly staffPinId: string,
    public readonly userId: string,
    public readonly restaurantId: string,
    public readonly actorUserId: string | null = null,
  ) {
    super(staffPinId);
  }
}

export class StaffPinResetEvent extends BaseDomainEvent {
  readonly eventName = 'identity.staff_pin.reset';
  constructor(
    public readonly staffPinId: string,
    public readonly userId: string,
    public readonly restaurantId: string,
    public readonly actorUserId: string | null = null,
  ) {
    super(staffPinId);
  }
}

export class StaffPinRevokedEvent extends BaseDomainEvent {
  readonly eventName = 'identity.staff_pin.revoked';
  constructor(
    public readonly staffPinId: string,
    public readonly userId: string,
    public readonly restaurantId: string,
    public readonly actorUserId: string | null = null,
  ) {
    super(staffPinId);
  }
}

export class StaffPinLockedOutEvent extends BaseDomainEvent {
  readonly eventName = 'identity.staff_pin.locked_out';
  constructor(
    public readonly staffPinId: string,
    public readonly userId: string,
    public readonly restaurantId: string,
    public readonly branchId: string | null,
    public readonly deviceId: string | null,
    public readonly failedAttempts: number,
    public readonly lockedUntil: Date,
    public readonly ip: string | null = null,
  ) {
    super(staffPinId);
  }
}
