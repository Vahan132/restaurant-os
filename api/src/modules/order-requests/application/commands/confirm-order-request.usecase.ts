import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { Order } from '../../../orders/domain/entities/order';
import { SubmitRequestedItemsUseCase } from '../../../orders/application/commands/submit-requested-items.usecase';
import { RequestNotPendingError } from '../../domain/order-requests.errors';
import { CustomerOrderRequestStatus } from '../../domain/enums';
import {
  ORDER_REQUEST_REPOSITORY,
  OrderRequestRepository,
} from '../../domain/repositories/order-request.repository';
import { NoRestaurantInScope, OrderRequestNotFound } from '../application.errors';

export interface ConfirmOrderRequestInput {
  restaurantId: string | null;
  requestId: string;
  userId: string;
}

/**
 * STAFF: confirm a request. Create-or-merge the table's open DINE_IN order from
 * the request SNAPSHOTS and send those items to the kitchen (orders module owns
 * the mutation), then mark the request CONFIRMED + linkedOrderId. Returns the order.
 */
@Injectable()
export class ConfirmOrderRequestUseCase implements UseCase<ConfirmOrderRequestInput, Order> {
  constructor(
    @Inject(ORDER_REQUEST_REPOSITORY) private readonly requests: OrderRequestRepository,
    private readonly submitItems: SubmitRequestedItemsUseCase,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: ConfirmOrderRequestInput): Promise<Order> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const request = await this.requests.findById(input.restaurantId, input.requestId);
    if (!request) {
      throw OrderRequestNotFound();
    }
    if (request.status !== CustomerOrderRequestStatus.PENDING) {
      throw new RequestNotPendingError();
    }

    const order = await this.submitItems.execute({
      restaurantId: input.restaurantId,
      tableId: request.tableId,
      waiterId: input.userId,
      items: request.items.map((i) => ({
        menuItemId: i.menuItemId,
        nameSnapshot: i.nameSnapshot,
        unitPriceAmount: i.unitPriceAmount,
        quantity: i.quantity,
        note: i.note,
        modifiers: i.modifiers.map((m) => ({
          modifierGroupId: m.modifierGroupId,
          modifierOptionId: m.modifierOptionId,
          nameSnapshot: m.nameSnapshot,
          priceDeltaAmount: m.priceDeltaAmount,
        })),
      })),
    });

    request.confirm(order.id, input.userId);
    await this.requests.save(request);
    await this.events.publishFromAggregate(request);
    return order;
  }
}
