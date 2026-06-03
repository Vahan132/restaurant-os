import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
// Reuse identity's pure value objects (spec-sanctioned).
import { Email } from '../../../identity/domain/value-objects/email';
import { PasswordHash } from '../../../identity/domain/value-objects/password-hash';
import {
  PlatformUserAlreadyBlockedError,
  PlatformUserNotActiveError,
  PlatformUserNotBlockedError,
} from '../platform.errors';

export enum PlatformRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  SUPPORT = 'SUPPORT',
}

export enum PlatformUserStatus {
  ACTIVE = 'ACTIVE',
  BLOCKED = 'BLOCKED',
}

export interface PlatformUserProps {
  email: Email;
  passwordHash: PasswordHash;
  fullName: string;
  role: PlatformRole;
  status: PlatformUserStatus;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * PlatformUser aggregate — a CROSS-TENANT super-admin. Has NO organizationId and
 * never collides with tenant data; authenticated with separate secrets.
 */
export class PlatformUser extends AggregateRoot<string> {
  private props: PlatformUserProps;

  private constructor(id: string, props: PlatformUserProps) {
    super(id);
    this.props = props;
  }

  static reconstitute(id: string, props: PlatformUserProps): PlatformUser {
    return new PlatformUser(id, props);
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
  get role(): PlatformRole {
    return this.props.role;
  }
  get status(): PlatformUserStatus {
    return this.props.status;
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

  isDeleted(): boolean {
    return this.props.deletedAt !== null;
  }

  isActive(): boolean {
    return this.props.status === PlatformUserStatus.ACTIVE && !this.isDeleted();
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  block(): void {
    if (this.props.status === PlatformUserStatus.BLOCKED) {
      throw new PlatformUserAlreadyBlockedError();
    }
    this.props.status = PlatformUserStatus.BLOCKED;
    this.touch();
  }

  unblock(): void {
    if (this.props.status !== PlatformUserStatus.BLOCKED) {
      throw new PlatformUserNotBlockedError();
    }
    this.props.status = PlatformUserStatus.ACTIVE;
    this.touch();
  }

  changePassword(passwordHash: PasswordHash): void {
    this.props.passwordHash = passwordHash;
    this.touch();
  }

  recordLogin(at: Date = new Date()): void {
    if (!this.isActive()) {
      throw new PlatformUserNotActiveError();
    }
    this.props.lastLoginAt = at;
    this.touch();
  }
}
