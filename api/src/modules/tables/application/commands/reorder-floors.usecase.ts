import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { Floor } from '../../domain/entities/floor';
import { FLOOR_REPOSITORY, FloorRepository } from '../../domain/repositories/floor.repository';
import { FloorNotFound, NoRestaurantInScope } from '../application.errors';

export interface ReorderFloorsInput {
  restaurantId: string | null;
  order: { id: string; displayOrder: number }[];
}

/** Apply a new displayOrder to multiple floors (tenant-scoped). */
@Injectable()
export class ReorderFloorsUseCase implements UseCase<ReorderFloorsInput, Floor[]> {
  constructor(@Inject(FLOOR_REPOSITORY) private readonly floors: FloorRepository) {}

  async execute(input: ReorderFloorsInput): Promise<Floor[]> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const updated: Floor[] = [];
    for (const entry of input.order) {
      const floor = await this.floors.findById(input.restaurantId, entry.id);
      if (!floor) {
        throw FloorNotFound();
      }
      floor.reorder(entry.displayOrder);
      await this.floors.update(floor);
      updated.push(floor);
    }
    return updated;
  }
}
