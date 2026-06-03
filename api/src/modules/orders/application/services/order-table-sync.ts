import { Inject, Injectable } from '@nestjs/common';
import { ORDER_SETTINGS_READER, OrderSettingsReader } from '../ports/order-settings.reader';
import { TABLE_STATUS_GATEWAY, TableStatusGateway } from '../ports/table-status.gateway';

/**
 * Auto-mode table-status wiring. Only drives table status when the restaurant
 * is in flow-driven mode (allowManualTableStatus = false). In manual mode the
 * staff control table status, so these are no-ops.
 */
@Injectable()
export class OrderTableSync {
  constructor(
    @Inject(ORDER_SETTINGS_READER) private readonly settings: OrderSettingsReader,
    @Inject(TABLE_STATUS_GATEWAY) private readonly tableStatus: TableStatusGateway,
  ) {}

  private async isAutoMode(restaurantId: string): Promise<boolean> {
    const s = await this.settings.get(restaurantId);
    return !s.allowManualTableStatus;
  }

  async occupy(restaurantId: string, tableId: string | null): Promise<void> {
    if (tableId && (await this.isAutoMode(restaurantId))) {
      await this.tableStatus.markOccupied(restaurantId, tableId);
    }
  }

  async release(restaurantId: string, tableId: string | null): Promise<void> {
    if (tableId && (await this.isAutoMode(restaurantId))) {
      await this.tableStatus.markAvailable(restaurantId, tableId);
    }
  }

  async cleaning(restaurantId: string, tableId: string | null): Promise<void> {
    if (tableId && (await this.isAutoMode(restaurantId))) {
      await this.tableStatus.markCleaning(restaurantId, tableId);
    }
  }
}
