import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { Order } from '../../domain/entities/order';
import { ORDER_REPOSITORY, OrderRepository } from '../../domain/repositories/order.repository';
import { NoRestaurantInScope, OrderNotFound } from '../application.errors';
import { ORDER_SETTINGS_READER, OrderSettingsReader } from '../ports/order-settings.reader';

export interface SplitItemsToNewCheckInput {
  restaurantId: string | null;
  branchId: string;
  orderId: string;
  itemIds: string[];
}

export interface SplitItemsResult {
  sourceOrder: Order;
  newCheck: Order;
}

/**
 * Move selected items to a NEW linked child check (ORDER_EDIT). Both checks share
 * the table and recompute their totals; the child gets a gapless order number on
 * create. The source is saved first (releasing the moved item rows) then the
 * child is created (re-inserting them under the new order id).
 */
@Injectable()
export class SplitItemsToNewCheckUseCase implements UseCase<
  SplitItemsToNewCheckInput,
  SplitItemsResult
> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(ORDER_SETTINGS_READER) private readonly settings: OrderSettingsReader,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: SplitItemsToNewCheckInput): Promise<SplitItemsResult> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const order = await this.orders.findById(input.restaurantId, input.branchId, input.orderId);
    if (!order) {
      throw OrderNotFound();
    }
    const settings = await this.settings.get(input.restaurantId);
    const child = order.splitItemsToNewCheck(
      this.ids.generate(),
      input.itemIds,
      settings.serviceFeeRateBps,
    );
    await this.orders.save(order);
    await this.orders.create(child);
    await this.events.publishFromAggregate(order);
    await this.events.publishFromAggregate(child);
    return { sourceOrder: order, newCheck: child };
  }
}
