import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { User } from '../../domain/entities/user';
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/user.repository';
import { UserNotFound } from '../application.errors';

export interface UnblockUserInput {
  organizationId: string;
  userId: string;
  actorUserId?: string | null;
}

/** Unblock a previously blocked user (tenant-scoped). */
@Injectable()
export class UnblockUserUseCase implements UseCase<UnblockUserInput, User> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: UnblockUserInput): Promise<User> {
    const user = await this.users.findById(input.organizationId, input.userId);
    if (!user) {
      throw UserNotFound();
    }
    user.unblock(input.actorUserId ?? null); // raises UserUnblocked / throws if not blocked
    await this.users.update(user);
    await this.events.publishFromAggregate(user);
    return user;
  }
}
