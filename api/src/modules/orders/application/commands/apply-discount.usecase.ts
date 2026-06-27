import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { Order } from '../../domain/entities/order';
import { DiscountType } from '../../domain/enums';
import { ORDER_REPOSITORY, OrderRepository } from '../../domain/repositories/order.repository';
import { DiscountsDisabled, NoRestaurantInScope, OrderNotFound } from '../application.errors';
import { ORDER_SETTINGS_READER, OrderSettingsReader } from '../ports/order-settings.reader';
import { ApprovalChecker } from '../services/approval-checker';

export interface ApplyDiscountInput {
  restaurantId: string | null;
  branchId: string;
  organizationId: string;
  orderId: string;
  type: DiscountType;
  value: number;
  approvedByUserId?: string | null;
  actorUserId?: string | null;
}

/** Apply a discount. Gated by allowDiscounts; honors requireApprovalForDiscount. */
@Injectable()
export class ApplyDiscountUseCase implements UseCase<ApplyDiscountInput, Order> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(ORDER_SETTINGS_READER) private readonly settings: OrderSettingsReader,
    private readonly approval: ApprovalChecker,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: ApplyDiscountInput): Promise<Order> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const order = await this.orders.findById(input.restaurantId, input.branchId, input.orderId);
    if (!order) {
      throw OrderNotFound();
    }
    const settings = await this.settings.get(input.restaurantId);
    if (!settings.allowDiscounts) {
      throw DiscountsDisabled();
    }
    const approvedBy = await this.approval.resolve({
      organizationId: input.organizationId,
      required: settings.requireApprovalForDiscount,
      approvedByUserId: input.approvedByUserId,
      permission: PERMISSIONS.DISCOUNT_APPLY,
      action: 'discount',
    });
    order.applyDiscount(
      input.type,
      input.value,
      approvedBy,
      settings.serviceFeeRateBps,
      input.actorUserId ?? null,
    );
    await this.orders.save(order);
    await this.events.publishFromAggregate(order);
    return order;
  }
}
