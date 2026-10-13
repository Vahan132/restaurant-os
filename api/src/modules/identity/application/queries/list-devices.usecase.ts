import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { Device } from '../../domain/entities/device';
import { DEVICE_REPOSITORY, DeviceRepository } from '../../domain/repositories/device.repository';
import { NoRestaurantInScope } from '../application.errors';

export interface ListDevicesInput {
  restaurantId: string | null;
  branchId: string;
}

/** Branch-scoped device list (secret hashes are never exposed in the response). */
@Injectable()
export class ListDevicesUseCase implements UseCase<ListDevicesInput, Device[]> {
  constructor(@Inject(DEVICE_REPOSITORY) private readonly devices: DeviceRepository) {}

  async execute(input: ListDevicesInput): Promise<Device[]> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    return this.devices.listByBranch(input.restaurantId, input.branchId);
  }
}
