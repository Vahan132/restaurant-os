import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { RestaurantTable } from '../../domain/entities/restaurant-table';
import { FLOOR_REPOSITORY, FloorRepository } from '../../domain/repositories/floor.repository';
import {
  RESTAURANT_TABLE_REPOSITORY,
  RestaurantTableRepository,
} from '../../domain/repositories/restaurant-table.repository';
import {
  CrossBranchReference,
  FloorNotFound,
  NoRestaurantInScope,
  TableNotFound,
} from '../application.errors';

export interface UpdateTableInput {
  restaurantId: string | null;
  branchId: string;
  tableId: string;
  name?: string;
  seatCapacity?: number;
  floorId?: string;
  qrIdentifier?: string | null;
}

/** Update table details and/or move to another floor (same restaurant). */
@Injectable()
export class UpdateTableUseCase implements UseCase<UpdateTableInput, RestaurantTable> {
  constructor(
    @Inject(RESTAURANT_TABLE_REPOSITORY) private readonly tables: RestaurantTableRepository,
    @Inject(FLOOR_REPOSITORY) private readonly floors: FloorRepository,
  ) {}

  async execute(input: UpdateTableInput): Promise<RestaurantTable> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const table = await this.tables.findById(input.restaurantId, input.branchId, input.tableId);
    if (!table) {
      throw TableNotFound();
    }
    if (input.floorId !== undefined && input.floorId !== table.floorId) {
      const floor = await this.floors.findById(input.restaurantId, input.branchId, input.floorId);
      if (!floor) {
        throw FloorNotFound();
      }
      // The target floor must live in the same branch as the table.
      if (floor.branchId !== table.branchId) {
        throw CrossBranchReference('Floor belongs to a different branch.');
      }
    }
    table.updateDetails({
      name: input.name,
      seatCapacity: input.seatCapacity,
      floorId: input.floorId,
      qrIdentifier: input.qrIdentifier,
    });
    await this.tables.update(table);
    return table;
  }
}
