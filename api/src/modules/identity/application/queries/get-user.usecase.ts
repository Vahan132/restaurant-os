import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { User } from '../../domain/entities/user';
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/user.repository';
import { UserNotFound } from '../application.errors';

export interface GetUserInput {
  organizationId: string;
  userId: string;
}

/** Fetch a single user by id (tenant-scoped). */
@Injectable()
export class GetUserUseCase implements UseCase<GetUserInput, User> {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async execute(input: GetUserInput): Promise<User> {
    const user = await this.users.findById(input.organizationId, input.userId);
    if (!user) {
      throw UserNotFound();
    }
    return user;
  }
}
