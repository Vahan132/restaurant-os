import { User as PrismaUser, UserStatus as PrismaUserStatus } from '@prisma/client';
import { User, UserStatus } from '../../domain/entities/user';
import { Email } from '../../domain/value-objects/email';
import { PasswordHash } from '../../domain/value-objects/password-hash';

/** Maps between Prisma `users` records and the User domain aggregate. */
export class UserMapper {
  static toDomain(record: PrismaUser): User {
    return User.reconstitute(record.id, {
      organizationId: record.organizationId,
      restaurantId: record.restaurantId,
      branchId: record.branchId,
      email: Email.create(record.email),
      passwordHash: PasswordHash.fromHash(record.passwordHash),
      fullName: record.fullName,
      status: record.status === PrismaUserStatus.BLOCKED ? UserStatus.BLOCKED : UserStatus.ACTIVE,
      roleId: record.roleId,
      lastLoginAt: record.lastLoginAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    });
  }

  /** Full row for inserts. */
  static toCreate(user: User) {
    return {
      id: user.id,
      organizationId: user.organizationId,
      restaurantId: user.restaurantId,
      branchId: user.branchId,
      email: user.email.value,
      passwordHash: user.passwordHash.value,
      fullName: user.fullName,
      status: user.status as PrismaUserStatus,
      roleId: user.roleId,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
    };
  }

  /** Mutable fields for updates (id/org/createdAt are immutable). */
  static toUpdate(user: User) {
    return {
      restaurantId: user.restaurantId,
      branchId: user.branchId,
      email: user.email.value,
      passwordHash: user.passwordHash.value,
      fullName: user.fullName,
      status: user.status as PrismaUserStatus,
      roleId: user.roleId,
      lastLoginAt: user.lastLoginAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
    };
  }
}
