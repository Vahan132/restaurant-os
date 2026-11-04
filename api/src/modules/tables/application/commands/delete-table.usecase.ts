import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  RESTAURANT_TABLE_REPOSITORY,
  RestaurantTableRepository,
} from '../../domain/repositories/restaurant-table.repository';
import { NoRestaurantInScope, TableNotFound } from '../application.errors';

export interface DeleteTableInput {
  restaurantId: string | null;
  branchId: string;
  tableId: string;
}

/** Soft-delete a table; blocked (409 TABLE_NOT_DELETABLE) if OCCUPIED or RESERVED. */
@Injectable()
export class DeleteTableUseCase implements UseCase<DeleteTableInput, void> {
  constructor(
    @Inject(RESTAURANT_TABLE_REPOSITORY) private readonly tables: RestaurantTableRepository,
  ) {}

  async execute(input: DeleteTableInput): Promise<void> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const table = await this.tables.findById(input.restaurantId, input.branchId, input.tableId);
    if (!table) {
      throw TableNotFound();
    }
    table.softDelete(); // throws TABLE_NOT_DELETABLE if OCCUPIED/RESERVED
    await this.tables.update(table);
  }
}
