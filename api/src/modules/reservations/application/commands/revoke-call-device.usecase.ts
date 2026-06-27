import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { CallDevice } from '../../domain/entities/call-device';
import {
  CALL_DEVICE_REPOSITORY,
  CallDeviceRepository,
} from '../../domain/repositories/call-device.repository';
import { CallDeviceNotFound, NoRestaurantInScope } from '../application.errors';

export interface RevokeCallDeviceInput {
  restaurantId: string | null;
  branchId: string;
  deviceId: string;
}

/** Revoke a call device (tenant-scoped). A revoked device can no longer ingest. */
@Injectable()
export class RevokeCallDeviceUseCase implements UseCase<RevokeCallDeviceInput, CallDevice> {
  constructor(@Inject(CALL_DEVICE_REPOSITORY) private readonly devices: CallDeviceRepository) {}

  async execute(input: RevokeCallDeviceInput): Promise<CallDevice> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const device = await this.devices.findById(input.restaurantId, input.branchId, input.deviceId);
    if (!device) {
      throw CallDeviceNotFound();
    }
    device.revoke();
    await this.devices.save(device);
    return device;
  }
}
