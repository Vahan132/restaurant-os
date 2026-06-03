import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { FLOOR_REPOSITORY, FloorRepository } from '../../domain/repositories/floor.repository';
import { FloorNotFound, NoRestaurantInScope } from '../application.errors';

export interface DeleteFloorInput {
  restaurantId: string | null;
  floorId: string;
}

/** Soft-delete a floor; blocked (409 FLOOR_HAS_TABLES) if it has non-deleted tables. */
@Injectable()
export class DeleteFloorUseCase implements UseCase<DeleteFloorInput, void> {
  constructor(@Inject(FLOOR_REPOSITORY) private readonly floors: FloorRepository) {}

  async execute(input: DeleteFloorInput): Promise<void> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const floor = await this.floors.findById(input.restaurantId, input.floorId);
    if (!floor) {
      throw FloorNotFound();
    }
    const activeTables = await this.floors.countActiveTables(input.restaurantId, floor.id);
    floor.softDelete(activeTables); // throws FLOOR_HAS_TABLES if > 0
    await this.floors.update(floor);
  }
}
