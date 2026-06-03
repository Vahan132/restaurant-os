import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { PlatformUser } from '../../domain/entities/platform-user';
import {
  PLATFORM_USER_REPOSITORY,
  PlatformUserRepository,
} from '../../domain/repositories/platform-user.repository';
import { PlatformUserNotFound } from '../application.errors';

/** Return the current platform admin. */
@Injectable()
export class PlatformGetMeUseCase implements UseCase<{ userId: string }, PlatformUser> {
  constructor(@Inject(PLATFORM_USER_REPOSITORY) private readonly users: PlatformUserRepository) {}

  async execute(input: { userId: string }): Promise<PlatformUser> {
    const user = await this.users.findById(input.userId);
    if (!user) {
      throw PlatformUserNotFound();
    }
    return user;
  }
}
