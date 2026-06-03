import { Inject, Injectable } from '@nestjs/common';
import { ReservationTableDisabled } from '../application.errors';
import {
  RESERVATION_SETTINGS_READER,
  ReservationSettingsReader,
} from '../ports/reservation-settings.reader';
import {
  RESERVATIONS_TABLE_READER,
  ReservationsTableReader,
} from '../ports/reservations-table.reader';
import { TABLE_STATUS_GATEWAY, TableStatusGateway } from '../ports/table-status.gateway';

const AVAILABLE = 'AVAILABLE';
const OCCUPIED = 'OCCUPIED';
const RESERVED = 'RESERVED';
const DISABLED = 'DISABLED';

/**
 * Auto-mode, best-effort table-status effects for reservations. In manual mode
 * (allowManualTableStatus = true) every method is a no-op — staff drive status.
 * Never corrupts table state: each effect checks the live status first.
 */
@Injectable()
export class ReservationTableSync {
  constructor(
    @Inject(RESERVATION_SETTINGS_READER) private readonly settings: ReservationSettingsReader,
    @Inject(RESERVATIONS_TABLE_READER) private readonly tables: ReservationsTableReader,
    @Inject(TABLE_STATUS_GATEWAY) private readonly gateway: TableStatusGateway,
  ) {}

  private async isAutoMode(restaurantId: string): Promise<boolean> {
    const s = await this.settings.get(restaurantId);
    return !s.allowManualTableStatus;
  }

  /** Arrived: hold an AVAILABLE assigned table as RESERVED (skip otherwise). */
  async onArrived(restaurantId: string, tableId: string | null): Promise<void> {
    if (!tableId || !(await this.isAutoMode(restaurantId))) {
      return;
    }
    const status = await this.tables.findTableStatus(restaurantId, tableId);
    if (status === AVAILABLE) {
      await this.gateway.markReserved(restaurantId, tableId);
    }
  }

  /** Seated: occupy the assigned table (reject if DISABLED; idempotent if OCCUPIED). */
  async onSeated(restaurantId: string, tableId: string | null): Promise<void> {
    if (!tableId || !(await this.isAutoMode(restaurantId))) {
      return;
    }
    const status = await this.tables.findTableStatus(restaurantId, tableId);
    if (status === DISABLED) {
      throw ReservationTableDisabled();
    }
    if (status === OCCUPIED) {
      return; // idempotent
    }
    if (status === AVAILABLE || status === RESERVED) {
      await this.gateway.markOccupied(restaurantId, tableId);
    }
    // any other state (e.g. CLEANING) -> best-effort skip; POS still owns the table
  }

  /** Released (cancel/no-show): free a table only if it is RESERVED for this plan. */
  async onReleased(restaurantId: string, tableId: string | null): Promise<void> {
    if (!tableId || !(await this.isAutoMode(restaurantId))) {
      return;
    }
    const status = await this.tables.findTableStatus(restaurantId, tableId);
    if (status === RESERVED) {
      await this.gateway.releaseReservation(restaurantId, tableId);
    }
  }
}
