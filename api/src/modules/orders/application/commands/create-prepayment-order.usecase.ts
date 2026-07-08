import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { TableSessionChannel } from '../../../table-sessions/domain/enums';
import { OpenOrJoinTableSessionUseCase } from '../../../table-sessions/application/commands/open-or-join-table-session.usecase';
import { Order } from '../../domain/entities/order';
import { OrderType } from '../../domain/enums';
import { ORDER_REPOSITORY, OrderRepository } from '../../domain/repositories/order.repository';
import { CartEmpty, NoRestaurantInScope } from '../application.errors';
import { CartInput } from '../dto/qr-cart.types';
import { ORDER_SETTINGS_READER, OrderSettingsReader } from '../ports/order-settings.reader';
import { CartPricingService } from '../services/cart-pricing.service';

export interface CreatePrepaymentOrderInput extends CartInput {
  restaurantId: string | null;
  /** From the token-resolved session context (guard). */
  branchId: string;
  tableId: string;
  /**
   * ORDER-4: origin channel of the created-or-joined session. Defaults to QR_WEB
   * so the existing QR-web controller is unchanged; the app path passes APP.
   */
  channel?: TableSessionChannel;
  /**
   * ORDER-4: the authenticated app consumer. Bound to BOTH the session participant
   * (open-or-join) and the order (Order.consumerId). Null for anonymous QR-web.
   */
  consumerId?: string | null;
}

export interface CreatePrepaymentOrderResult {
  order: Order;
  tableSessionId: string;
}

/**
 * CreatePrepaymentOrder — create-or-join the table's PREPAYMENT session (ORDER-1)
 * and build a QR-web Order in PENDING_PAYMENT (modelled as DRAFT + UNPAID) from
 * the server-validated cart. Append-only: a second order on an already-open
 * session is a brand-new order that joins the same session. The order stays
 * PENDING_PAYMENT until ConfirmPayment; it is NOT dispatched here.
 */
@Injectable()
export class CreatePrepaymentOrderUseCase
  implements UseCase<CreatePrepaymentOrderInput, CreatePrepaymentOrderResult>
{
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(ORDER_SETTINGS_READER) private readonly settings: OrderSettingsReader,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly pricing: CartPricingService,
    private readonly openOrJoin: OpenOrJoinTableSessionUseCase,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: CreatePrepaymentOrderInput): Promise<CreatePrepaymentOrderResult> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    if (!input.lines || input.lines.length === 0) {
      throw CartEmpty();
    }
    const restaurantId = input.restaurantId;
    const settings = await this.settings.get(restaurantId);

    // ORDER-4: default to QR_WEB so the existing QR-web controller is unchanged;
    // the app path passes APP + the authenticated consumer.
    const channel = input.channel ?? TableSessionChannel.QR_WEB;
    const consumerId = input.consumerId ?? null;

    // Create-or-join the PREPAYMENT session (both channels are PREPAYMENT/OPEN).
    // An existing session on the table is JOINED untouched (append = a new order
    // on the same container); the consumer is bound at the order level below.
    const joined = await this.openOrJoin.execute({
      restaurantId,
      branchId: input.branchId,
      tableId: input.tableId,
      channel,
      consumerAccountId: consumerId,
    });
    const tableSessionId = joined.session.id;

    const order = Order.create({
      id: this.ids.generate(),
      restaurantId,
      branchId: input.branchId,
      type: OrderType.DINE_IN,
      tableId: input.tableId,
      tableSessionId,
      waiterId: null, // customer-placed (QR-web or app), no waiter.
      consumerId, // ORDER-4: bound on the app path; null for QR-web.
      currency: settings.currency,
    });

    const items = await this.pricing.buildItems(
      restaurantId,
      input.branchId,
      order.id,
      input.lines,
    );
    for (const item of items) {
      order.addItem(item, settings.serviceFeeRateBps);
    }

    await this.orders.create(order); // assigns gapless orderNumber, raises OrderCreated
    await this.events.publishFromAggregate(order);
    return { order, tableSessionId };
  }
}
