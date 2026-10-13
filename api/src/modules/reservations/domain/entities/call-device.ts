import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { CallDeviceStatus } from '../enums';

export interface CallDeviceProps {
  restaurantId: string;
  branchId: string;
  name: string;
  tokenHash: string;
  status: CallDeviceStatus;
  lastSeenAt: Date | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCallDeviceInput {
  id: string;
  restaurantId: string;
  branchId: string;
  name: string;
  /** sha256 hash of the plaintext device token (the plaintext is never stored). */
  tokenHash: string;
  createdByUserId: string;
}

/**
 * CallDevice — a registered Android companion that ingests missed calls. It
 * authenticates with a bearer device token; only the sha256 hash is persisted.
 * Pure domain (no framework / no hashing here — the use case hashes the token).
 */
export class CallDevice extends AggregateRoot<string> {
  private props: CallDeviceProps;

  private constructor(id: string, props: CallDeviceProps) {
    super(id);
    this.props = props;
  }

  static create(input: CreateCallDeviceInput): CallDevice {
    const now = new Date();
    return new CallDevice(input.id, {
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      name: input.name,
      tokenHash: input.tokenHash,
      status: CallDeviceStatus.ACTIVE,
      lastSeenAt: null,
      createdByUserId: input.createdByUserId,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(id: string, props: CallDeviceProps): CallDevice {
    return new CallDevice(id, props);
  }

  get restaurantId(): string {
    return this.props.restaurantId;
  }
  get branchId(): string {
    return this.props.branchId;
  }
  get name(): string {
    return this.props.name;
  }
  get tokenHash(): string {
    return this.props.tokenHash;
  }
  get status(): CallDeviceStatus {
    return this.props.status;
  }
  get lastSeenAt(): Date | null {
    return this.props.lastSeenAt;
  }
  get createdByUserId(): string {
    return this.props.createdByUserId;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isActive(): boolean {
    return this.props.status === CallDeviceStatus.ACTIVE;
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  /** Idempotent revoke — a revoked device can no longer authenticate. */
  revoke(): void {
    this.props.status = CallDeviceStatus.REVOKED;
    this.touch();
  }

  markSeen(now: Date = new Date()): void {
    this.props.lastSeenAt = now;
    this.touch();
  }
}
