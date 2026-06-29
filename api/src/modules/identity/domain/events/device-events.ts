import { BaseDomainEvent } from '../../../../shared/domain/domain-event';

/**
 * Device domain events (3A). Namespaced `identity.device.*` so the audit module
 * subscribes with `@OnEvent('identity.device.enrolled')` etc.
 */
export class DeviceEnrolledEvent extends BaseDomainEvent {
  readonly eventName = 'identity.device.enrolled';
  constructor(
    public readonly deviceId: string,
    public readonly restaurantId: string,
    public readonly branchId: string,
    public readonly surface: string,
    public readonly enrolledByUserId: string,
    public readonly ip: string | null = null,
  ) {
    super(deviceId);
  }
}

export class DeviceRevokedEvent extends BaseDomainEvent {
  readonly eventName = 'identity.device.revoked';
  constructor(
    public readonly deviceId: string,
    public readonly restaurantId: string,
    public readonly branchId: string,
    public readonly actorUserId: string | null = null,
  ) {
    super(deviceId);
  }
}
