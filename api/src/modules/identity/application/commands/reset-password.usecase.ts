import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { UseCase } from '../../../../shared/application/use-case';
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/user.repository';
import { PasswordHash } from '../../domain/value-objects/password-hash';
import { RawPassword } from '../../domain/value-objects/raw-password';
import { InvalidResetToken } from '../application.errors';
import { PASSWORD_HASHER, PasswordHasher } from '../ports/password-hasher';
import {
  PASSWORD_RESET_TOKEN_REPOSITORY,
  PasswordResetTokenRepository,
} from '../ports/password-reset-token.repository';
import {
  REFRESH_TOKEN_REPOSITORY,
  RefreshTokenRepository,
} from '../ports/refresh-token.repository';

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
}

/**
 * Consume a reset token: validate (hash match, not expired, not used), set the
 * new password (argon2), mark the token used, and revoke the user's refresh
 * tokens so existing sessions can't refresh.
 */
@Injectable()
export class ResetPasswordUseCase implements UseCase<ResetPasswordInput, void> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_RESET_TOKEN_REPOSITORY)
    private readonly tokens: PasswordResetTokenRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: RefreshTokenRepository,
  ) {}

  async execute(input: ResetPasswordInput): Promise<void> {
    const tokenHash = createHash('sha256').update(input.token).digest('hex');
    const record = await this.tokens.findByHash(tokenHash);
    if (!record || record.usedAt !== null || record.expiresAt.getTime() < Date.now()) {
      throw InvalidResetToken();
    }
    const user = await this.users.findByIdGlobal(record.userId);
    if (!user || !user.isActive()) {
      throw InvalidResetToken();
    }
    const raw = RawPassword.create(input.newPassword);
    const hash = PasswordHash.fromHash(await this.hasher.hash(raw.value));
    user.changePassword(hash);
    await this.users.update(user);
    await this.tokens.markUsed(record.id);
    await this.refreshTokens.revokeAllForUser(user.id);
  }
}
