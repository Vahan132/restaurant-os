import { Inject, Injectable } from '@nestjs/common';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { RestaurantTable } from '../../domain/entities/restaurant-table';
import { TableStatus } from '../../domain/enums';
import {
  RESTAURANT_TABLE_REPOSITORY,
  RestaurantTableRepository,
} from '../../domain/repositories/restaurant-table.repository';
import { NoRestaurantInScope, TableNotFound } from '../application.errors';

/**
 * SYSTEM-driven table status transitions, EXPORTED for other modules to call:
 *   - Orders (prompt 6): markOccupied on open, markCleaning on bill close.
 *   - Reservations (prompt 8): markReserved / releaseReservation.
 *
 * IMPORTANT: callers must first check RestaurantSettings.allowManualTableStatus.
 *   - auto mode (allowManualTableStatus = false) -> call these (system drives status).
 *   - manual mode (allowManualTableStatus = true) -> SKIP these; staff drive status.
 *
 * All transitions here use source='SYSTEM' and go through the aggregate's state
 * machine, so an invalid transition still throws INVALID_TABLE_TRANSITION.
 */
@Injectable()
export class TableStatusService {
  constructor(
    @Inject(RESTAURANT_TABLE_REPOSITORY) private readonly tables: RestaurantTableRepository,
    private readonly events: DomainEventPublisher,
  ) {}

  markOccupied(restaurantId: string, tableId: string): Promise<RestaurantTable> {
    return this.transition(restaurantId, tableId, TableStatus.OCCUPIED);
  }

  markCleaning(restaurantId: string, tableId: string): Promise<RestaurantTable> {
    return this.transition(restaurantId, tableId, TableStatus.CLEANING);
  }

  markAvailable(restaurantId: string, tableId: string): Promise<RestaurantTable> {
    return this.transition(restaurantId, tableId, TableStatus.AVAILABLE);
  }

  markReserved(restaurantId: string, tableId: string): Promise<RestaurantTable> {
    return this.transition(restaurantId, tableId, TableStatus.RESERVED);
  }

  /** RESERVED -> AVAILABLE (e.g. reservation cancelled / expired). */
  releaseReservation(restaurantId: string, tableId: string): Promise<RestaurantTable> {
    return this.transition(restaurantId, tableId, TableStatus.AVAILABLE);
  }

  private async transition(
    restaurantId: string | null,
    tableId: string,
    target: TableStatus,
  ): Promise<RestaurantTable> {
    if (!restaurantId) {
      throw NoRestaurantInScope();
    }
    const table = await this.tables.findById(restaurantId, tableId);
    if (!table) {
      throw TableNotFound();
    }
    table.changeStatus(target, 'SYSTEM');
    await this.tables.update(table);
    await this.events.publishFromAggregate(table);
    return table;
  }
}
