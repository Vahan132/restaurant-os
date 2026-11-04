import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ORDER_REPOSITORY, OrderRepository } from '../../domain/repositories/order.repository';
import { NoRestaurantInScope, OrderNotFound } from '../application.errors';

export interface AssertOrderOwnedByConsumerInput {
  restaurantId: string | null;
  orderId: string;
  /** The authenticated consumer (JWT `sub` = customerAccountId). */
  consumerId: string;
}

export interface OwnedOrderRef {
  branchId: string;
  sessionId: string;
}

/**
 * ORDER-4 app-path access control. A `sessionId` is a returned identifier, not a
 * secret, so the app's confirm/receipt must verify the order belongs to THIS
 * authenticated consumer — not merely that a passed id matches. This is the one
 * ownership check: it loads the order within the restaurant (branch-agnostic),
 * asserts `order.consumerId === consumerId`, and returns the order's own branch +
 * session so the shared ORDER-2 use-cases run with server-derived scope (the
 * client never supplies branch or session on the app path). A non-owned or
 * missing order is an opaque 404 — no enumeration, no cross-consumer read.
 *
 * The QR-web token-scoping is untouched: this runs ONLY on the app controller.
 */
@Injectable()
export class AssertOrderOwnedByConsumerUseCase
  implements UseCase<AssertOrderOwnedByConsumerInput, OwnedOrderRef>
{
  constructor(@Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository) {}

  async execute(input: AssertOrderOwnedByConsumerInput): Promise<OwnedOrderRef> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    // Branch-agnostic load (findById scopes by branch only when non-null); the
    // authoritative branch is read back from the order itself.
    const order = await this.orders.findById(input.restaurantId, null, input.orderId);
    if (
      !order ||
      order.consumerId === null ||
      order.consumerId !== input.consumerId ||
      order.tableSessionId === null
    ) {
      throw OrderNotFound();
    }
    return { branchId: order.branchId, sessionId: order.tableSessionId };
  }
}
