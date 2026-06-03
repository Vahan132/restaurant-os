import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { User } from '../../domain/entities/user';
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/user.repository';
import { PasswordHash } from '../../domain/value-objects/password-hash';
import { RawPassword } from '../../domain/value-objects/raw-password';
import { UserNotFound } from '../application.errors';
import { PASSWORD_HASHER, PasswordHasher } from '../ports/password-hasher';
import {
  REFRESH_TOKEN_REPOSITORY,
  RefreshTokenRepository,
} from '../ports/refresh-token.repository';

export interface ChangePasswordInput {
  organizationId: string;
  userId: string;
  newPassword: string;
}

/**
 * Change a user's password (tenant-scoped) and revoke all of that user's
 * refresh tokens so existing sessions can no longer be refreshed.
 */
@Injectable()
export class ChangePasswordUseCase implements UseCase<ChangePasswordInput, User> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: RefreshTokenRepository,
  ) {}

  async execute(input: ChangePasswordInput): Promise<User> {
    const user = await this.users.findById(input.organizationId, input.userId);
    if (!user) {
      throw UserNotFound();
    }
    const raw = RawPassword.create(input.newPassword);
    const hash = PasswordHash.fromHash(await this.hasher.hash(raw.value));
    user.changePassword(hash);
    await this.users.update(user);
    await this.refreshTokens.revokeAllForUser(user.id);
    return user;
  }
}
