import { BaseDomainEvent } from '../../../../shared/domain/domain-event';
import { StatusChangeSource } from '../enums';

/** Emitted on every table status change (audit + real-time wiring come later). */
export class TableStatusChangedEvent extends BaseDomainEvent {
  readonly eventName = 'tables.table.status_changed';
  constructor(
    public readonly tableId: string,
    public readonly restaurantId: string,
    public readonly fromStatus: string,
    public readonly toStatus: string,
    public readonly source: StatusChangeSource,
  ) {
    super(tableId);
  }
}
