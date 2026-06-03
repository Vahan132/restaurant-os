import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import {
  UserBlockedEvent,
  UserCreatedEvent,
  UserLoggedInEvent,
  UserUnblockedEvent,
} from '../events/user-events';
import {
  UserAlreadyBlockedError,
  UserNotActiveError,
  UserNotBlockedError,
} from '../identity.errors';
import { Email } from '../value-objects/email';
import { PasswordHash } from '../value-objects/password-hash';

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  BLOCKED = 'BLOCKED',
}

export interface UserProps {
  organizationId: string;
  restaurantId: string | null;
  branchId: string | null;
  email: Email;
  passwordHash: PasswordHash;
  fullName: string;
  status: UserStatus;
  roleId: string;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateUserInput {
  id: string;
  organizationId: string;
  restaurantId?: string | null;
  branchId?: string | null;
  email: Email;
  passwordHash: PasswordHash;
  fullName: string;
  roleId: string;
  actorUserId?: string | null;
}

/**
 * User aggregate root. Belongs to exactly one organization. Enforces account
 * invariants and raises domain events; persistence/hashing live in infra.
 */
export class User extends AggregateRoot<string> {
  private props: UserProps;

  private constructor(id: string, props: UserProps) {
    super(id);
    this.props = props;
  }

  /** Create a brand-new active user (raises UserCreated). */
  static create(input: CreateUserInput): User {
    const now = new Date();
    const user = new User(input.id, {
      organizationId: input.organizationId,
      restaurantId: input.restaurantId ?? null,
      branchId: input.branchId ?? null,
      email: input.email,
      passwordHash: input.passwordHash,
      fullName: input.fullName,
      status: UserStatus.ACTIVE,
      roleId: input.roleId,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    user.addDomainEvent(
      new UserCreatedEvent(
        input.id,
        input.organizationId,
        input.email.value,
        input.roleId,
        input.actorUserId ?? null,
      ),
    );
    return user;
  }

  /** Rebuild from persistence (no events). */
  static reconstitute(id: string, props: UserProps): User {
    return new User(id, props);
  }

  // ── getters ────────────────────────────────────────────────────────────
  get organizationId(): string {
    return this.props.organizationId;
  }
  get restaurantId(): string | null {
    return this.props.restaurantId;
  }
  get branchId(): string | null {
    return this.props.branchId;
  }
  get email(): Email {
    return this.props.email;
  }
  get passwordHash(): PasswordHash {
    return this.props.passwordHash;
  }
  get fullName(): string {
    return this.props.fullName;
  }
  get status(): UserStatus {
    return this.props.status;
  }
  get roleId(): string {
    return this.props.roleId;
  }
  get lastLoginAt(): Date | null {
    return this.props.lastLoginAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }

  isDeleted(): boolean {
    return this.props.deletedAt !== null;
  }

  isActive(): boolean {
    return this.props.status === UserStatus.ACTIVE && !this.isDeleted();
  }

  // ── behavior (invariants) ────────────────────────────────────────────────
  private touch(): void {
    this.props.updatedAt = new Date();
  }

  block(actorUserId: string | null = null): void {
    if (this.props.status === UserStatus.BLOCKED) {
      throw new UserAlreadyBlockedError();
    }
    this.props.status = UserStatus.BLOCKED;
    this.touch();
    this.addDomainEvent(new UserBlockedEvent(this.id, this.props.organizationId, actorUserId));
  }

  unblock(actorUserId: string | null = null): void {
    if (this.props.status !== UserStatus.BLOCKED) {
      throw new UserNotBlockedError();
    }
    this.props.status = UserStatus.ACTIVE;
    this.touch();
    this.addDomainEvent(new UserUnblockedEvent(this.id, this.props.organizationId, actorUserId));
  }

  changeRole(roleId: string): void {
    this.props.roleId = roleId;
    this.touch();
  }

  /** Change the tenancy scope (restaurant/branch) of the user. */
  assignScope(restaurantId: string | null, branchId: string | null): void {
    this.props.restaurantId = restaurantId;
    this.props.branchId = branchId;
    this.touch();
  }

  rename(fullName: string): void {
    this.props.fullName = fullName;
    this.touch();
  }

  changePassword(passwordHash: PasswordHash): void {
    this.props.passwordHash = passwordHash;
    this.touch();
  }

  /** Record a successful login (raises UserLoggedIn). Rejects inactive users. */
  recordLogin(
    at: Date = new Date(),
    ip: string | null = null,
    userAgent: string | null = null,
  ): void {
    if (!this.isActive()) {
      throw new UserNotActiveError();
    }
    this.props.lastLoginAt = at;
    this.touch();
    this.addDomainEvent(
      new UserLoggedInEvent(this.id, this.props.organizationId, at, ip, userAgent),
    );
  }
}
