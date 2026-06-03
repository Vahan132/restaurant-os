import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { UseCase } from '../../../../shared/application/use-case';
import { AppConfig } from '../../../../shared/infrastructure/config/env.schema';
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/user.repository';
import { ID_GENERATOR, IdGenerator } from '../ports/id-generator';
import { EMAIL_SERVICE, EmailService } from '../ports/email.service';
import {
  PASSWORD_RESET_TOKEN_REPOSITORY,
  PasswordResetTokenRepository,
} from '../ports/password-reset-token.repository';

export interface ForgotPasswordInput {
  email: string;
}

const RESET_TTL_MS = 60 * 60 * 1000; // 1h

/**
 * Issue a password-reset token + email link for an active user. ALWAYS resolves
 * (never reveals whether the email exists). The stored value is sha256(token).
 */
@Injectable()
export class ForgotPasswordUseCase implements UseCase<ForgotPasswordInput, void> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_RESET_TOKEN_REPOSITORY)
    private readonly tokens: PasswordResetTokenRepository,
    @Inject(EMAIL_SERVICE) private readonly email: EmailService,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async execute(input: ForgotPasswordInput): Promise<void> {
    const email = input.email.trim().toLowerCase();
    const user = await this.users.findByEmailGlobalUnique(email);
    if (!user || !user.isActive()) {
      return; // non-enumerable: behave identically whether or not the user exists
    }
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await this.tokens.create({
      id: this.ids.generate(),
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
    });
    const root = this.config.get('PLATFORM_ROOT_DOMAIN', { infer: true });
    const link = `https://app.${root}/reset-password?token=${token}`;
    await this.email.sendPasswordReset(user.email.value, link);
  }
}
