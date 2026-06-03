import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { User } from '../../../identity/domain/entities/user';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../../identity/domain/repositories/user.repository';
import { AccountUserNotFound } from '../application.errors';

export interface UpdateProfileInput {
  organizationId: string;
  userId: string;
  fullName?: string;
}

/** Owner self-service: update own display name (email change is out of scope for now). */
@Injectable()
export class UpdateProfileUseCase implements UseCase<UpdateProfileInput, User> {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async execute(input: UpdateProfileInput): Promise<User> {
    const user = await this.users.findById(input.organizationId, input.userId);
    if (!user) {
      throw AccountUserNotFound();
    }
    if (input.fullName !== undefined) {
      user.rename(input.fullName);
    }
    await this.users.update(user);
    return user;
  }
}
