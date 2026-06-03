import { Injectable } from '@nestjs/common';
import { TableStatusService } from '../../../tables/application/services/table-status.service';
import { TableStatusGateway } from '../../application/ports/table-status.gateway';

/**
 * Adapter to the tables context: delegates reservation table effects to the
 * tables module's exported TableStatusService (SYSTEM transitions). Callers in
 * the application layer pre-check the live status, so transitions are valid.
 */
@Injectable()
export class TablesTableStatusGateway implements TableStatusGateway {
  constructor(private readonly tableStatus: TableStatusService) {}

  async markReserved(restaurantId: string, tableId: string): Promise<void> {
    await this.tableStatus.markReserved(restaurantId, tableId);
  }

  async markOccupied(restaurantId: string, tableId: string): Promise<void> {
    await this.tableStatus.markOccupied(restaurantId, tableId);
  }

  async releaseReservation(restaurantId: string, tableId: string): Promise<void> {
    await this.tableStatus.releaseReservation(restaurantId, tableId);
  }
}
