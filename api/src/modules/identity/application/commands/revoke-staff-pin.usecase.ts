import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import {
  STAFF_PIN_REPOSITORY,
  StaffPinRepository,
} from '../../domain/repositories/staff-pin.repository';
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/user.repository';
import { NoRestaurantInScope, StaffPinNotFound, UserNotFound } from '../application.errors';

export interface RevokeStaffPinInput {
  restaurantId: string | null;
  actorUserId: string;
  userId: string;
}

/**
 * Revoke a staff member's PIN (e.g. offboarding). Takes effect immediately — the
 * verification path requires an ACTIVE PIN row, so a revoked PIN can no longer
 * sign in anywhere.
 */
@Injectable()
export class RevokeStaffPinUseCase implements UseCase<RevokeStaffPinInput, void> {
  constructor(
    @Inject(STAFF_PIN_REPOSITORY) private readonly pins: StaffPinRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: RevokeStaffPinInput): Promise<void> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const user = await this.users.findByIdGlobal(input.userId);
    if (!user || user.isDeleted() || user.restaurantId !== input.restaurantId) {
      throw UserNotFound();
    }
    const pin = await this.pins.findByUserId(input.userId);
    if (!pin || !pin.isActive()) {
      throw StaffPinNotFound();
    }
    pin.revoke(input.actorUserId);
    await this.pins.update(pin);
    await this.events.publishFromAggregate(pin);
  }
}
