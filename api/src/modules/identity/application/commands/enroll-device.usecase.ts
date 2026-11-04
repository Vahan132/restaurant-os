import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { Device, DeviceSurface } from '../../domain/entities/device';
import { DEVICE_REPOSITORY, DeviceRepository } from '../../domain/repositories/device.repository';
import { NoRestaurantInScope } from '../application.errors';
import { ID_GENERATOR, IdGenerator } from '../ports/id-generator';
import {
  deriveCidr,
  generateDeviceSecret,
  hashDeviceSecret,
} from '../../infrastructure/services/device-secret.util';

export interface EnrollDeviceInput {
  restaurantId: string | null;
  branchId: string;
  surface: DeviceSurface;
  label: string;
  enrolledByUserId: string;
  ip?: string | null;
}

export interface EnrollDeviceResult {
  device: Device;
  /** Plaintext secret — returned ONCE; only sha256(secret) is persisted. */
  secret: string;
}

/**
 * Enroll an in-store device for a branch. Mints a high-entropy secret, stores
 * only its sha256 hash, records the enrolling IP and a derived CIDR, and returns
 * the plaintext exactly once for the operator to install on the device.
 */
@Injectable()
export class EnrollDeviceUseCase implements UseCase<EnrollDeviceInput, EnrollDeviceResult> {
  constructor(
    @Inject(DEVICE_REPOSITORY) private readonly devices: DeviceRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: EnrollDeviceInput): Promise<EnrollDeviceResult> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const secret = generateDeviceSecret();
    const device = Device.create({
      id: this.ids.generate(),
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      label: input.label,
      surface: input.surface,
      deviceSecretHash: hashDeviceSecret(secret),
      enrolledByUserId: input.enrolledByUserId,
      enrolledIp: input.ip ?? null,
      enrolledCidr: deriveCidr(input.ip),
    });
    await this.devices.create(device);
    await this.events.publishFromAggregate(device);
    return { device, secret };
  }
}
