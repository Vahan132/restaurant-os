import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { RestaurantTable } from '../../domain/entities/restaurant-table';
import { FLOOR_REPOSITORY, FloorRepository } from '../../domain/repositories/floor.repository';
import {
  RESTAURANT_TABLE_REPOSITORY,
  RestaurantTableRepository,
} from '../../domain/repositories/restaurant-table.repository';
import { CrossBranchReference, FloorNotFound, NoRestaurantInScope } from '../application.errors';

export interface CreateTableInput {
  restaurantId: string | null;
  branchId: string;
  floorId: string;
  name: string;
  seatCapacity: number;
  qrIdentifier?: string | null;
}

/** Create a table (verifies the floor belongs to the same restaurant + active branch). */
@Injectable()
export class CreateTableUseCase implements UseCase<CreateTableInput, RestaurantTable> {
  constructor(
    @Inject(RESTAURANT_TABLE_REPOSITORY) private readonly tables: RestaurantTableRepository,
    @Inject(FLOOR_REPOSITORY) private readonly floors: FloorRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(input: CreateTableInput): Promise<RestaurantTable> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const floor = await this.floors.findById(input.restaurantId, input.branchId, input.floorId);
    if (!floor) {
      throw FloorNotFound();
    }
    // A table's floor must live in the same branch (intra-branch integrity).
    if (floor.branchId !== input.branchId) {
      throw CrossBranchReference('Floor belongs to a different branch.');
    }
    const table = RestaurantTable.create({
      id: this.ids.generate(),
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      floorId: input.floorId,
      name: input.name,
      seatCapacity: input.seatCapacity,
      qrIdentifier: input.qrIdentifier ?? null,
    });
    await this.tables.create(table);
    return table;
  }
}
