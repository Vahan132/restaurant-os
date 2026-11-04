import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { Device } from '../../domain/entities/device';
import { DEVICE_REPOSITORY, DeviceRepository } from '../../domain/repositories/device.repository';
import { DeviceNotFound, NoRestaurantInScope } from '../application.errors';

export interface RevokeDeviceInput {
  restaurantId: string | null;
  branchId: string;
  deviceId: string;
  actorUserId: string | null;
}

/**
 * Revoke a device. Takes effect immediately: PIN login resolves the device live
 * (status ACTIVE), and anchored admin login re-checks the device on every login,
 * so a revoked device can no longer authenticate anything.
 */
@Injectable()
export class RevokeDeviceUseCase implements UseCase<RevokeDeviceInput, Device> {
  constructor(
    @Inject(DEVICE_REPOSITORY) private readonly devices: DeviceRepository,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: RevokeDeviceInput): Promise<Device> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const device = await this.devices.findByIdInBranch(
      input.restaurantId,
      input.branchId,
      input.deviceId,
    );
    if (!device) {
      throw DeviceNotFound();
    }
    device.revoke(input.actorUserId);
    await this.devices.update(device);
    await this.events.publishFromAggregate(device);
    return device;
  }
}
