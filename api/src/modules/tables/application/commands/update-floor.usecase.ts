import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { Floor } from '../../domain/entities/floor';
import { FLOOR_REPOSITORY, FloorRepository } from '../../domain/repositories/floor.repository';
import { FloorNotFound, NoRestaurantInScope } from '../application.errors';

export interface UpdateFloorInput {
  restaurantId: string | null;
  branchId: string;
  floorId: string;
  name?: string;
  description?: string | null;
  displayOrder?: number;
}

/** Rename / re-describe / reorder a floor (tenant-scoped). */
@Injectable()
export class UpdateFloorUseCase implements UseCase<UpdateFloorInput, Floor> {
  constructor(@Inject(FLOOR_REPOSITORY) private readonly floors: FloorRepository) {}

  async execute(input: UpdateFloorInput): Promise<Floor> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const floor = await this.floors.findById(input.restaurantId, input.branchId, input.floorId);
    if (!floor) {
      throw FloorNotFound();
    }
    if (input.name !== undefined || input.description !== undefined) {
      floor.rename(input.name ?? floor.name, input.description);
    }
    if (input.displayOrder !== undefined) {
      floor.reorder(input.displayOrder);
    }
    await this.floors.update(floor);
    return floor;
  }
}
