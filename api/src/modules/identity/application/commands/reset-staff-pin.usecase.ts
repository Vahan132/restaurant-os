import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import {
  STAFF_PIN_REPOSITORY,
  StaffPinRepository,
} from '../../domain/repositories/staff-pin.repository';
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/user.repository';
import {
  NoRestaurantInScope,
  PinGenerationFailed,
  SigningKeyUnavailable,
  StaffPinNotFound,
  UserNotFound,
} from '../application.errors';
import { PASSWORD_HASHER, PasswordHasher } from '../ports/password-hasher';
import { RESTAURANT_KEY_PROVIDER, RestaurantKeyProvider } from '../ports/restaurant-key.provider';
import { generatePin, pinFingerprint } from '../../infrastructure/services/device-secret.util';
import { isUniqueViolation } from '../../infrastructure/persistence/prisma-errors';
import { StaffPinIssued } from './create-staff-pin.usecase';

const MAX_PIN_ALLOCATION_TRIES = 8;

export interface ResetStaffPinInput {
  restaurantId: string | null;
  actorUserId: string;
  userId: string;
}

/**
 * Reset a staff member's PIN to a fresh random value, forcing rotation
 * (mustRotate) and clearing any lockout. Returns the new plaintext PIN once.
 */
@Injectable()
export class ResetStaffPinUseCase implements UseCase<ResetStaffPinInput, StaffPinIssued> {
  constructor(
    @Inject(STAFF_PIN_REPOSITORY) private readonly pins: StaffPinRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(RESTAURANT_KEY_PROVIDER) private readonly keys: RestaurantKeyProvider,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: ResetStaffPinInput): Promise<StaffPinIssued> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const user = await this.users.findByIdGlobal(input.userId);
    if (!user || user.isDeleted() || user.restaurantId !== input.restaurantId) {
      throw UserNotFound();
    }
    const pin = await this.pins.findByUserId(input.userId);
    if (!pin) {
      throw StaffPinNotFound();
    }
    const signingKey = await this.keys.getSigningKey(input.restaurantId);
    if (!signingKey) {
      throw SigningKeyUnavailable();
    }

    for (let attempt = 0; attempt < MAX_PIN_ALLOCATION_TRIES; attempt++) {
      const newPin = generatePin();
      const pinHash = await this.hasher.hash(newPin);
      const fingerprint = pinFingerprint(signingKey, newPin);
      try {
        pin.reset(pinHash, fingerprint, input.actorUserId);
        await this.pins.update(pin);
        await this.events.publishFromAggregate(pin);
        return { pin: newPin, mustRotate: pin.mustRotate };
      } catch (err) {
        if (isUniqueViolation(err)) {
          pin.clearDomainEvents();
          continue;
        }
        throw err;
      }
    }
    throw PinGenerationFailed();
  }
}
