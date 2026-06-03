import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { OrderItemBuilder } from '../../../orders/application/services/order-item-builder';
import { CustomerOrderRequest } from '../../domain/entities/customer-order-request';
import { RequestItem } from '../../domain/entities/request-item';
import { RequestItemModifier } from '../../domain/entities/request-item-modifier';
import {
  ORDER_REQUEST_REPOSITORY,
  OrderRequestRepository,
} from '../../domain/repositories/order-request.repository';
import {
  CustomerOrderingDisabled,
  NoRestaurantInScope,
  TableNotFound,
} from '../application.errors';
import {
  ORDER_REQUEST_SETTINGS_READER,
  OrderRequestSettingsReader,
} from '../ports/order-request-settings.reader';
import {
  ORDER_REQUEST_TABLE_READER,
  OrderRequestTableReader,
} from '../ports/order-request-table.reader';

export interface CreateOrderRequestItemInput {
  menuItemId: string;
  quantity: number;
  modifierOptionIds: string[];
  note?: string | null;
}
export interface CreateOrderRequestInput {
  restaurantId: string | null;
  qr: string;
  customerName?: string | null;
  note?: string | null;
  items: CreateOrderRequestItemInput[];
}

/**
 * PUBLIC: create a PENDING customer order request. Gated by enableCustomerOrdering.
 * Items are validated (ACTIVE + AVAILABLE + modifier rules) and SNAPSHOTTED via
 * the orders OrderItemBuilder, so later menu price changes never alter the request.
 */
@Injectable()
export class CreateOrderRequestUseCase implements UseCase<
  CreateOrderRequestInput,
  CustomerOrderRequest
> {
  constructor(
    @Inject(ORDER_REQUEST_REPOSITORY) private readonly requests: OrderRequestRepository,
    @Inject(ORDER_REQUEST_SETTINGS_READER) private readonly settings: OrderRequestSettingsReader,
    @Inject(ORDER_REQUEST_TABLE_READER) private readonly tables: OrderRequestTableReader,
    private readonly builder: OrderItemBuilder,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: CreateOrderRequestInput): Promise<CustomerOrderRequest> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const settings = await this.settings.get(input.restaurantId);
    if (!settings.enableCustomerOrdering) {
      throw CustomerOrderingDisabled();
    }
    const tableId = await this.tables.resolveTableIdByQr(input.restaurantId, input.qr);
    if (!tableId) {
      throw TableNotFound();
    }

    const items: RequestItem[] = [];
    for (const it of input.items) {
      // Validate + snapshot via the orders builder (reuses menu rules + price snapshot).
      const built = await this.builder.build({
        restaurantId: input.restaurantId,
        orderId: 'request', // not an order yet; only snapshots are read off the result
        menuItemId: it.menuItemId,
        quantity: it.quantity,
        selectedOptionIds: it.modifierOptionIds,
        note: it.note ?? null,
      });
      const modifiers = built.modifiers.map((m) =>
        RequestItemModifier.create(this.ids.generate(), {
          modifierGroupId: m.modifierGroupId,
          modifierOptionId: m.modifierOptionId,
          nameSnapshot: m.nameSnapshot,
          priceDeltaAmount: m.priceDeltaAmount,
        }),
      );
      items.push(
        RequestItem.create(this.ids.generate(), {
          menuItemId: built.menuItemId,
          nameSnapshot: built.nameSnapshot,
          unitPriceAmount: built.unitPriceAmount,
          quantity: built.quantity,
          note: built.note,
          modifiers,
        }),
      );
    }

    const request = CustomerOrderRequest.create({
      id: this.ids.generate(),
      restaurantId: input.restaurantId,
      tableId,
      customerName: input.customerName ?? null,
      note: input.note ?? null,
      items,
    });
    await this.requests.create(request);
    await this.events.publishFromAggregate(request);
    return request;
  }
}
