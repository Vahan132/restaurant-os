import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { RestaurantTable } from '../../domain/entities/restaurant-table';
import {
  RESTAURANT_TABLE_REPOSITORY,
  RestaurantTableRepository,
} from '../../domain/repositories/restaurant-table.repository';
import { NoRestaurantInScope, TableNotFound } from '../application.errors';

export interface GetTableInput {
  restaurantId: string | null;
  tableId: string;
}

/** Fetch a single table by id (tenant-scoped). */
@Injectable()
export class GetTableUseCase implements UseCase<GetTableInput, RestaurantTable> {
  constructor(
    @Inject(RESTAURANT_TABLE_REPOSITORY) private readonly tables: RestaurantTableRepository,
  ) {}

  async execute(input: GetTableInput): Promise<RestaurantTable> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const table = await this.tables.findById(input.restaurantId, input.tableId);
    if (!table) {
      throw TableNotFound();
    }
    return table;
  }
}
