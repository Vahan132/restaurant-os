import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { RestaurantTable } from '../../domain/entities/restaurant-table';
import { TableStatus } from '../../domain/enums';
import {
  RESTAURANT_TABLE_REPOSITORY,
  RestaurantTableRepository,
} from '../../domain/repositories/restaurant-table.repository';
import { NoRestaurantInScope } from '../application.errors';

export interface ListTablesInput {
  restaurantId: string | null;
  branchId: string;
  floorId?: string;
  status?: TableStatus;
}

/** List tables (tenant-scoped), optionally filtered by floor / status. */
@Injectable()
export class ListTablesUseCase implements UseCase<ListTablesInput, RestaurantTable[]> {
  constructor(
    @Inject(RESTAURANT_TABLE_REPOSITORY) private readonly tables: RestaurantTableRepository,
  ) {}

  execute(input: ListTablesInput): Promise<RestaurantTable[]> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    return this.tables.list({
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      floorId: input.floorId,
      status: input.status,
    });
  }
}
