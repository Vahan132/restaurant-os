import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { CallDevice } from '../../domain/entities/call-device';
import {
  CALL_DEVICE_REPOSITORY,
  CallDeviceRepository,
} from '../../domain/repositories/call-device.repository';
import { NoRestaurantInScope } from '../application.errors';

export interface ListCallDevicesInput {
  restaurantId: string | null;
  branchId: string;
}

/** List registered call devices for the current restaurant (newest first). */
@Injectable()
export class ListCallDevicesUseCase implements UseCase<ListCallDevicesInput, CallDevice[]> {
  constructor(@Inject(CALL_DEVICE_REPOSITORY) private readonly devices: CallDeviceRepository) {}

  execute(input: ListCallDevicesInput): Promise<CallDevice[]> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    return this.devices.list(input.restaurantId, input.branchId);
  }
}
