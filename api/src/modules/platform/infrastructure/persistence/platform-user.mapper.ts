import { PlatformUser as PrismaPlatformUser } from '@prisma/client';
import { Email } from '../../../identity/domain/value-objects/email';
import { PasswordHash } from '../../../identity/domain/value-objects/password-hash';
import {
  PlatformRole,
  PlatformUser,
  PlatformUserStatus,
} from '../../domain/entities/platform-user';

export class PlatformUserMapper {
  static toDomain(record: PrismaPlatformUser): PlatformUser {
    return PlatformUser.reconstitute(record.id, {
      email: Email.create(record.email),
      passwordHash: PasswordHash.fromHash(record.passwordHash),
      fullName: record.fullName,
      role: record.role as PlatformRole,
      status: record.status as PlatformUserStatus,
      lastLoginAt: record.lastLoginAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    });
  }

  static toUpdate(user: PlatformUser) {
    return {
      passwordHash: user.passwordHash.value,
      fullName: user.fullName,
      role: user.role as PlatformRole,
      status: user.status as PlatformUserStatus,
      lastLoginAt: user.lastLoginAt,
      updatedAt: user.updatedAt,
    };
  }
}
