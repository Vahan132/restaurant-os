import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { DeviceEnrolledEvent, DeviceRevokedEvent } from '../events/device-events';

/** Surface an enrolled device serves. PIN login is for POS/KDS only; ADMIN
 * devices anchor email/password dashboard login. */
export enum DeviceSurface {
  POS = 'POS',
  KDS = 'KDS',
  ADMIN = 'ADMIN',
}

export enum DeviceStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
}

export interface DeviceProps {
  restaurantId: string;
  branchId: string;
  label: string;
  surface: DeviceSurface;
  /** sha256(secret) — the plaintext is shown once at enrollment and never stored. */
  deviceSecretHash: string;
  enrolledByUserId: string;
  enrolledIp: string | null;
  enrolledCidr: string | null;
  status: DeviceStatus;
  lastSeenAt: Date | null;
  lastSeenIp: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDeviceInput {
  id: string;
  restaurantId: string;
  branchId: string;
  label: string;
  surface: DeviceSurface;
  deviceSecretHash: string;
  enrolledByUserId: string;
  enrolledIp?: string | null;
  enrolledCidr?: string | null;
}

/**
 * Device aggregate — an enrolled in-store device. Possession of its secret is the
 * REAL first factor of staff auth (a 6-digit PIN is only acceptable because of
 * this coupling). Only sha256(secret) is ever held; the plaintext is returned
 * exactly once at enrollment. Branch-scoped.
 */
export class Device extends AggregateRoot<string> {
  private props: DeviceProps;

  private constructor(id: string, props: DeviceProps) {
    super(id);
    this.props = props;
  }

  static create(input: CreateDeviceInput): Device {
    const now = new Date();
    const device = new Device(input.id, {
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      label: input.label,
      surface: input.surface,
      deviceSecretHash: input.deviceSecretHash,
      enrolledByUserId: input.enrolledByUserId,
      enrolledIp: input.enrolledIp ?? null,
      enrolledCidr: input.enrolledCidr ?? null,
      status: DeviceStatus.ACTIVE,
      lastSeenAt: null,
      lastSeenIp: null,
      createdAt: now,
      updatedAt: now,
    });
    device.addDomainEvent(
      new DeviceEnrolledEvent(
        input.id,
        input.restaurantId,
        input.branchId,
        input.surface,
        input.enrolledByUserId,
        input.enrolledIp ?? null,
      ),
    );
    return device;
  }

  static reconstitute(id: string, props: DeviceProps): Device {
    return new Device(id, props);
  }

  get restaurantId(): string {
    return this.props.restaurantId;
  }
  get branchId(): string {
    return this.props.branchId;
  }
  get label(): string {
    return this.props.label;
  }
  get surface(): DeviceSurface {
    return this.props.surface;
  }
  get deviceSecretHash(): string {
    return this.props.deviceSecretHash;
  }
  get enrolledByUserId(): string {
    return this.props.enrolledByUserId;
  }
  get enrolledIp(): string | null {
    return this.props.enrolledIp;
  }
  get enrolledCidr(): string | null {
    return this.props.enrolledCidr;
  }
  get status(): DeviceStatus {
    return this.props.status;
  }
  get lastSeenAt(): Date | null {
    return this.props.lastSeenAt;
  }
  get lastSeenIp(): string | null {
    return this.props.lastSeenIp;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isActive(): boolean {
    return this.props.status === DeviceStatus.ACTIVE;
  }

  /** Record a successful sighting (SOFT IP mode trusts + stores the seen IP). */
  recordSeen(ip: string | null, at: Date = new Date()): void {
    this.props.lastSeenAt = at;
    this.props.lastSeenIp = ip;
    this.props.updatedAt = at;
  }

  /** Revoke the device — immediately invalidates PIN login + anchored use. */
  revoke(actorUserId: string | null = null): void {
    if (this.props.status === DeviceStatus.REVOKED) {
      return;
    }
    this.props.status = DeviceStatus.REVOKED;
    this.props.updatedAt = new Date();
    this.addDomainEvent(
      new DeviceRevokedEvent(this.id, this.props.restaurantId, this.props.branchId, actorUserId),
    );
  }
}
