import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { RestaurantTable } from '../../domain/entities/restaurant-table';
import { TableStatus } from '../../domain/enums';
import {
  RESTAURANT_TABLE_REPOSITORY,
  RestaurantTableRepository,
} from '../../domain/repositories/restaurant-table.repository';
import { isManualAllowedWhenRestricted } from '../../domain/table-status.policy';
import {
  ManualTableStatusDisabled,
  NoRestaurantInScope,
  TableNotFound,
} from '../application.errors';
import { TABLE_SETTINGS_READER, TableSettingsReader } from '../ports/table-settings.reader';

export interface ChangeTableStatusManualInput {
  restaurantId: string | null;
  tableId: string;
  status: TableStatus;
}

/**
 * Staff-driven (MANUAL) status change, gated by RestaurantSettings:
 *  - allowManualTableStatus = true  -> any valid transition is permitted.
 *  - allowManualTableStatus = false -> only MANUAL-only-anytime transitions
 *    (cleaning->available, enabling/disabling); SYSTEM-driven targets are
 *    rejected with MANUAL_TABLE_STATUS_DISABLED.
 * The state machine itself (aggregate) still rejects invalid transitions.
 */
@Injectable()
export class ChangeTableStatusManualUseCase implements UseCase<
  ChangeTableStatusManualInput,
  RestaurantTable
> {
  constructor(
    @Inject(RESTAURANT_TABLE_REPOSITORY) private readonly tables: RestaurantTableRepository,
    @Inject(TABLE_SETTINGS_READER) private readonly settings: TableSettingsReader,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: ChangeTableStatusManualInput): Promise<RestaurantTable> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const table = await this.tables.findById(input.restaurantId, input.tableId);
    if (!table) {
      throw TableNotFound();
    }

    const allowManual = await this.settings.allowManualTableStatus(input.restaurantId);
    if (!allowManual && !isManualAllowedWhenRestricted(table.status, input.status)) {
      throw ManualTableStatusDisabled();
    }

    table.changeStatus(input.status, 'MANUAL'); // state machine validates the move
    await this.tables.update(table);
    await this.events.publishFromAggregate(table);
    return table;
  }
}
