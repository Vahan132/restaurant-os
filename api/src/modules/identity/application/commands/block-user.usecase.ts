import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { User } from '../../domain/entities/user';
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/user.repository';
import { CannotBlockSelf, UserNotFound } from '../application.errors';

export interface BlockUserInput {
  organizationId: string;
  userId: string;
  /** The acting user (cannot block themselves). */
  actorUserId: string;
}

/** Block a user account (tenant-scoped). */
@Injectable()
export class BlockUserUseCase implements UseCase<BlockUserInput, User> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: BlockUserInput): Promise<User> {
    if (input.userId === input.actorUserId) {
      throw CannotBlockSelf();
    }
    const user = await this.users.findById(input.organizationId, input.userId);
    if (!user) {
      throw UserNotFound();
    }
    user.block(input.actorUserId); // raises UserBlocked / throws if already blocked
    await this.users.update(user);
    await this.events.publishFromAggregate(user);
    return user;
  }
}
