import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { Floor } from '../../domain/entities/floor';
import { ZoneStatus } from '../../domain/enums';
import { FLOOR_REPOSITORY, FloorRepository } from '../../domain/repositories/floor.repository';
import { FloorNotFound, NoRestaurantInScope } from '../application.errors';

export interface SetFloorStatusInput {
  restaurantId: string | null;
  floorId: string;
  status: ZoneStatus;
}

/** Activate / deactivate a floor (tenant-scoped). */
@Injectable()
export class SetFloorStatusUseCase implements UseCase<SetFloorStatusInput, Floor> {
  constructor(@Inject(FLOOR_REPOSITORY) private readonly floors: FloorRepository) {}

  async execute(input: SetFloorStatusInput): Promise<Floor> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const floor = await this.floors.findById(input.restaurantId, input.floorId);
    if (!floor) {
      throw FloorNotFound();
    }
    if (input.status === ZoneStatus.ACTIVE) {
      floor.activate();
    } else {
      floor.deactivate();
    }
    await this.floors.update(floor);
    return floor;
  }
}
