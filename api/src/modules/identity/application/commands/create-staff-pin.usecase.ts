import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { StaffPin } from '../../domain/entities/staff-pin';
import {
  STAFF_PIN_REPOSITORY,
  StaffPinRepository,
} from '../../domain/repositories/staff-pin.repository';
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/user.repository';
import {
  NoRestaurantInScope,
  PinAlreadyExists,
  PinGenerationFailed,
  SigningKeyUnavailable,
  UserNotFound,
} from '../application.errors';
import { ID_GENERATOR, IdGenerator } from '../ports/id-generator';
import { PASSWORD_HASHER, PasswordHasher } from '../ports/password-hasher';
import { RESTAURANT_KEY_PROVIDER, RestaurantKeyProvider } from '../ports/restaurant-key.provider';
import { generatePin, pinFingerprint } from '../../infrastructure/services/device-secret.util';
import { isUniqueViolation } from '../../infrastructure/persistence/prisma-errors';

const MAX_PIN_ALLOCATION_TRIES = 8;

export interface CreateStaffPinInput {
  restaurantId: string | null;
  actorUserId: string;
  userId: string;
}

export interface StaffPinIssued {
  /** Plaintext PIN — returned ONCE to the manager; only the hash is stored. */
  pin: string;
  mustRotate: boolean;
}

/**
 * Create a staff member's PIN. Mints a random, restaurant-unique 6-digit PIN
 * (retrying on the active-uniqueness constraint), hashes it with argon2, and
 * returns the plaintext exactly once. A revoked PIN row is re-activated.
 */
@Injectable()
export class CreateStaffPinUseCase implements UseCase<CreateStaffPinInput, StaffPinIssued> {
  constructor(
    @Inject(STAFF_PIN_REPOSITORY) private readonly pins: StaffPinRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(RESTAURANT_KEY_PROVIDER) private readonly keys: RestaurantKeyProvider,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: CreateStaffPinInput): Promise<StaffPinIssued> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const user = await this.users.findByIdGlobal(input.userId);
    if (!user || user.isDeleted() || user.restaurantId !== input.restaurantId) {
      throw UserNotFound();
    }
    const existing = await this.pins.findByUserId(input.userId);
    if (existing && existing.isActive()) {
      throw PinAlreadyExists();
    }
    const signingKey = await this.keys.getSigningKey(input.restaurantId);
    if (!signingKey) {
      throw SigningKeyUnavailable();
    }

    for (let attempt = 0; attempt < MAX_PIN_ALLOCATION_TRIES; attempt++) {
      const pin = generatePin();
      const pinHash = await this.hasher.hash(pin);
      const fingerprint = pinFingerprint(signingKey, pin);
      try {
        let entity: StaffPin;
        if (existing) {
          existing.recreate(pinHash, fingerprint, input.actorUserId);
          await this.pins.update(existing);
          entity = existing;
        } else {
          entity = StaffPin.create({
            id: this.ids.generate(),
            userId: input.userId,
            restaurantId: input.restaurantId,
            pinHash,
            pinFingerprint: fingerprint,
            createdByUserId: input.actorUserId,
          });
          await this.pins.create(entity);
        }
        await this.events.publishFromAggregate(entity);
        return { pin, mustRotate: entity.mustRotate };
      } catch (err) {
        if (isUniqueViolation(err)) {
          // PIN value collided with another active PIN in the restaurant — drop
          // the queued event and retry with a fresh PIN.
          existing?.clearDomainEvents();
          continue;
        }
        throw err;
      }
    }
    throw PinGenerationFailed();
  }
}
