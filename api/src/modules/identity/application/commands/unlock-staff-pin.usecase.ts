import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import {
  STAFF_PIN_REPOSITORY,
  StaffPinRepository,
} from '../../domain/repositories/staff-pin.repository';
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/user.repository';
import { NoRestaurantInScope, StaffPinNotFound, UserNotFound } from '../application.errors';

export interface UnlockStaffPinInput {
  restaurantId: string | null;
  actorUserId: string;
  userId: string;
}

/**
 * PIN-UNLOCK-1 — clear a staff member's PIN lockout (too many wrong PINs) without
 * changing the PIN. Works on the cloud AND on the local hub:
 *  - on the hub the repository records a STAFF_PIN_AUTH outbox entry, so the
 *    unlock reaches the cloud when the link is up;
 *  - on the cloud the row's updatedAt bump makes config sync carry it down.
 * The stamped lockResetAt lets the newer unlock win over the counter merge.
 */
@Injectable()
export class UnlockStaffPinUseCase implements UseCase<UnlockStaffPinInput, void> {
  constructor(
    @Inject(STAFF_PIN_REPOSITORY) private readonly pins: StaffPinRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: UnlockStaffPinInput): Promise<void> {
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
    pin.unlock(input.actorUserId);
    await this.pins.update(pin);
    await this.events.publishFromAggregate(pin);
  }
}
