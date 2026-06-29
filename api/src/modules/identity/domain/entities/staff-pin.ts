import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import {
  StaffPinCreatedEvent,
  StaffPinLockedOutEvent,
  StaffPinResetEvent,
  StaffPinRevokedEvent,
} from '../events/staff-pin-events';

export enum StaffPinStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
}

export interface StaffPinProps {
  userId: string;
  restaurantId: string;
  /** argon2 hash of the PIN. */
  pinHash: string;
  /** Keyed fingerprint (HMAC of the PIN with the per-restaurant key); enforces
   * active-PIN uniqueness within a restaurant. Null once revoked. */
  pinFingerprint: string | null;
  status: StaffPinStatus;
  failedAttempts: number;
  lockedUntil: Date | null;
  mustRotate: boolean;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStaffPinInput {
  id: string;
  userId: string;
  restaurantId: string;
  pinHash: string;
  pinFingerprint: string;
  createdByUserId: string;
}

/** Context attached to a lock-out event (login surface details the entity does
 * not otherwise hold). */
export interface PinLockContext {
  branchId: string | null;
  deviceId: string | null;
  ip: string | null;
}

/**
 * StaffPin aggregate (one per user). The PIN is verified by argon2 in infra; this
 * aggregate owns the rate-limit + lockout STATE MACHINE (per user) and raises the
 * audit-worthy events. There is no PIN path that doesn't go through an enrolled
 * device — that coupling is enforced by the verification use case, never here.
 */
export class StaffPin extends AggregateRoot<string> {
  private props: StaffPinProps;

  private constructor(id: string, props: StaffPinProps) {
    super(id);
    this.props = props;
  }

  static create(input: CreateStaffPinInput): StaffPin {
    const now = new Date();
    const pin = new StaffPin(input.id, {
      userId: input.userId,
      restaurantId: input.restaurantId,
      pinHash: input.pinHash,
      pinFingerprint: input.pinFingerprint,
      status: StaffPinStatus.ACTIVE,
      failedAttempts: 0,
      lockedUntil: null,
      mustRotate: false,
      createdByUserId: input.createdByUserId,
      createdAt: now,
      updatedAt: now,
    });
    pin.addDomainEvent(
      new StaffPinCreatedEvent(input.id, input.userId, input.restaurantId, input.createdByUserId),
    );
    return pin;
  }

  static reconstitute(id: string, props: StaffPinProps): StaffPin {
    return new StaffPin(id, props);
  }

  get userId(): string {
    return this.props.userId;
  }
  get restaurantId(): string {
    return this.props.restaurantId;
  }
  get pinHash(): string {
    return this.props.pinHash;
  }
  get pinFingerprint(): string | null {
    return this.props.pinFingerprint;
  }
  get status(): StaffPinStatus {
    return this.props.status;
  }
  get failedAttempts(): number {
    return this.props.failedAttempts;
  }
  get lockedUntil(): Date | null {
    return this.props.lockedUntil;
  }
  get mustRotate(): boolean {
    return this.props.mustRotate;
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
    return this.props.status === StaffPinStatus.ACTIVE;
  }

  isLocked(now: Date = new Date()): boolean {
    return this.props.lockedUntil !== null && this.props.lockedUntil.getTime() > now.getTime();
  }

  private touch(at: Date = new Date()): void {
    this.props.updatedAt = at;
  }

  /**
   * Re-establish a fresh PIN on an existing (previously revoked) row. Treated as
   * a CREATE (does not force rotation); raises StaffPinCreated.
   */
  recreate(pinHash: string, pinFingerprint: string, actorUserId: string | null = null): void {
    this.props.pinHash = pinHash;
    this.props.pinFingerprint = pinFingerprint;
    this.props.status = StaffPinStatus.ACTIVE;
    this.props.mustRotate = false;
    this.props.failedAttempts = 0;
    this.props.lockedUntil = null;
    this.props.createdByUserId = actorUserId ?? this.props.createdByUserId;
    this.touch();
    this.addDomainEvent(
      new StaffPinCreatedEvent(this.id, this.props.userId, this.props.restaurantId, actorUserId),
    );
  }

  /** Reset to a new PIN (manager-driven). Forces rotation and clears lockout. */
  reset(pinHash: string, pinFingerprint: string, actorUserId: string | null = null): void {
    this.props.pinHash = pinHash;
    this.props.pinFingerprint = pinFingerprint;
    this.props.status = StaffPinStatus.ACTIVE;
    this.props.mustRotate = true;
    this.props.failedAttempts = 0;
    this.props.lockedUntil = null;
    this.touch();
    this.addDomainEvent(
      new StaffPinResetEvent(this.id, this.props.userId, this.props.restaurantId, actorUserId),
    );
  }

  /** Revoke (offboarding). Nulls the fingerprint so the value frees up. */
  revoke(actorUserId: string | null = null): void {
    this.props.status = StaffPinStatus.REVOKED;
    this.props.pinFingerprint = null;
    this.props.failedAttempts = 0;
    this.props.lockedUntil = null;
    this.touch();
    this.addDomainEvent(
      new StaffPinRevokedEvent(this.id, this.props.userId, this.props.restaurantId, actorUserId),
    );
  }

  /**
   * Record a failed verification. Increments the per-user counter and, on the
   * Nth failure, locks the PIN for `lockoutMs` and raises a lock-out event.
   * Returns true if this call just triggered the lock.
   */
  registerFailure(maxAttempts: number, lockoutMs: number, context: PinLockContext): boolean {
    const now = new Date();
    this.props.failedAttempts += 1;
    this.touch(now);
    if (this.props.failedAttempts >= maxAttempts && !this.isLocked(now)) {
      const lockedUntil = new Date(now.getTime() + lockoutMs);
      this.props.lockedUntil = lockedUntil;
      this.addDomainEvent(
        new StaffPinLockedOutEvent(
          this.id,
          this.props.userId,
          this.props.restaurantId,
          context.branchId,
          context.deviceId,
          this.props.failedAttempts,
          lockedUntil,
          context.ip,
        ),
      );
      return true;
    }
    return false;
  }

  /** Record a successful verification — clears the failure counter + lockout. */
  registerSuccess(): void {
    this.props.failedAttempts = 0;
    this.props.lockedUntil = null;
    this.touch();
  }
}
