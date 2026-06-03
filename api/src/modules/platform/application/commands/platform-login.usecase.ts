import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  PASSWORD_HASHER,
  PasswordHasher,
} from '../../../identity/application/ports/password-hasher';
import { PlatformUser } from '../../domain/entities/platform-user';
import {
  PLATFORM_USER_REPOSITORY,
  PlatformUserRepository,
} from '../../domain/repositories/platform-user.repository';
import { PlatformAccountBlocked, PlatformInvalidCredentials } from '../application.errors';
import { PlatformTokenIssuer } from '../services/platform-token-issuer';

export interface PlatformLoginInput {
  email: string;
  password: string;
}

export interface PlatformLoginOutput {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: PlatformUser;
}

/** Authenticate a platform super-admin (separate secrets from tenant auth). */
@Injectable()
export class PlatformLoginUseCase implements UseCase<PlatformLoginInput, PlatformLoginOutput> {
  constructor(
    @Inject(PLATFORM_USER_REPOSITORY) private readonly users: PlatformUserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    private readonly issuer: PlatformTokenIssuer,
  ) {}

  async execute(input: PlatformLoginInput): Promise<PlatformLoginOutput> {
    const email = input.email.trim().toLowerCase();
    const user = await this.users.findByEmail(email);
    if (!user || user.isDeleted()) {
      throw PlatformInvalidCredentials();
    }
    const ok = await this.hasher.verify(user.passwordHash.value, input.password);
    if (!ok) {
      throw PlatformInvalidCredentials();
    }
    if (!user.isActive()) {
      throw PlatformAccountBlocked();
    }
    user.recordLogin();
    await this.users.update(user);
    const tokens = await this.issuer.issueFor(user);
    return { ...tokens, user };
  }
}
