import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { CallDevice } from '../../domain/entities/call-device';
import {
  CALL_DEVICE_REPOSITORY,
  CallDeviceRepository,
} from '../../domain/repositories/call-device.repository';
import { NoRestaurantInScope } from '../application.errors';

export interface RegisterCallDeviceInput {
  restaurantId: string | null;
  branchId: string;
  createdByUserId: string;
  name: string;
}

export interface RegisterCallDeviceResult {
  device: CallDevice;
  /** Plaintext token — returned ONCE; only its sha256 hash is persisted. */
  token: string;
}

/** sha256 hex of a raw device token (what gets stored / matched). */
export function hashDeviceToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Register a call device. Mints a random bearer token, stores only sha256(token),
 * and returns the plaintext exactly once for the operator to install on the phone.
 */
@Injectable()
export class RegisterCallDeviceUseCase implements UseCase<
  RegisterCallDeviceInput,
  RegisterCallDeviceResult
> {
  constructor(
    @Inject(CALL_DEVICE_REPOSITORY) private readonly devices: CallDeviceRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(input: RegisterCallDeviceInput): Promise<RegisterCallDeviceResult> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const token = randomBytes(32).toString('hex');
    const device = CallDevice.create({
      id: this.ids.generate(),
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      name: input.name,
      tokenHash: hashDeviceToken(token),
      createdByUserId: input.createdByUserId,
    });
    await this.devices.create(device);
    return { device, token };
  }
}
