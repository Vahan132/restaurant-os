import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { StaffPinViewedEvent } from '../../domain/events/staff-pin-events';
import {
  STAFF_PIN_REPOSITORY,
  StaffPinRepository,
} from '../../domain/repositories/staff-pin.repository';
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/user.repository';
import { openPin } from '../../infrastructure/services/device-secret.util';
import {
  NoRestaurantInScope,
  SigningKeyUnavailable,
  StaffPinNotFound,
  UserNotFound,
} from '../application.errors';
import { RESTAURANT_KEY_PROVIDER, RestaurantKeyProvider } from '../ports/restaurant-key.provider';

export interface RevealStaffPinInput {
  restaurantId: string | null;
  actorUserId: string;
  userId: string;
}

export interface RevealStaffPinResult {
  /** The current PIN, or null when it was issued before PINs became viewable. */
  pin: string | null;
}

/**
 * PIN-VIEW-1 — show a staff member's CURRENT PIN to a manager (STAFF_PIN_MANAGE).
 * Every look-up is audited (STAFF_PIN_VIEWED). Works on the cloud and the hub
 * (the sealed copy syncs down; the restaurant key is on both). PINs issued
 * before this feature have no sealed copy → `pin: null` (reset to make viewable).
 */
@Injectable()
export class RevealStaffPinUseCase implements UseCase<RevealStaffPinInput, RevealStaffPinResult> {
  constructor(
    @Inject(STAFF_PIN_REPOSITORY) private readonly pins: StaffPinRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(RESTAURANT_KEY_PROVIDER) private readonly keys: RestaurantKeyProvider,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: RevealStaffPinInput): Promise<RevealStaffPinResult> {
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
    if (!pin.pinCipher) {
      return { pin: null };
    }
    const key = await this.keys.getSigningKey(input.restaurantId);
    if (!key) {
      throw SigningKeyUnavailable();
    }
    const value = openPin(key, pin.pinCipher);
    await this.events.publish(
      new StaffPinViewedEvent(pin.id, pin.userId, pin.restaurantId, input.actorUserId),
    );
    return { pin: value };
  }
}
