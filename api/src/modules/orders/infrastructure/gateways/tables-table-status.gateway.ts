import { Injectable } from '@nestjs/common';
import { TableStatusService } from '../../../tables/application/services/table-status.service';
import { TableStatusGateway } from '../../application/ports/table-status.gateway';

/**
 * Adapter to the tables context: delegates the orders module's table-status
 * gateway to the tables module's exported TableStatusService (SYSTEM transitions).
 */
@Injectable()
export class TablesTableStatusGateway implements TableStatusGateway {
  constructor(private readonly tableStatus: TableStatusService) {}

  async markOccupied(restaurantId: string, tableId: string): Promise<void> {
    await this.tableStatus.markOccupied(restaurantId, tableId);
  }

  async markAvailable(restaurantId: string, tableId: string): Promise<void> {
    await this.tableStatus.markAvailable(restaurantId, tableId);
  }

  async markCleaning(restaurantId: string, tableId: string): Promise<void> {
    await this.tableStatus.markCleaning(restaurantId, tableId);
  }
}
