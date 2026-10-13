import { Inject, Injectable } from '@nestjs/common';
import { EdgeConfigService } from '../../../../shared/edge/edge-config.service';
import { UseCase } from '../../../../shared/application/use-case';
import {
  FISCAL_PRINT_MODE_READER,
  FiscalPrintModeReader,
} from '../../../fiscal-config/application/ports/fiscal-print-mode.reader';
import { Order } from '../../domain/entities/order';
import { PaymentStatus } from '../../domain/enums';
import { ORDER_REPOSITORY, OrderRepository } from '../../domain/repositories/order.repository';
import {
  FiscalDeviceUnavailable,
  FiscalizeHubOnly,
  FiscalNotConfiguredForBranch,
  NoRestaurantInScope,
  OrderNotFound,
  OrderNotPaidForFiscalize,
} from '../application.errors';
import { DineInFiscalizeService } from '../services/dine-in-fiscalize.service';

export interface FiscalizeOrderManuallyInput {
  restaurantId: string | null;
  branchId: string;
  orderId: string;
}

/**
 * FISCAL-EDGE-4 — operator "fiscalize now" command for a MANUAL (or previously
 * FAILED/PENDING) paid dine-in order. Hub-side only; reuses the SAME fiscalize
 * path as AUTO via DineInFiscalizeService.attempt. Accepted state machine:
 *
 *   not found                → 404
 *   not PAID                 → 409 ORDER_NOT_PAID
 *   off the hub              → 409 FISCALIZE_HUB_ONLY
 *   no active fiscal config  → 409 FISCAL_NOT_CONFIGURED (clean reject, NOT FAILED)
 *   already fiscalized (OK)  → idempotent: return the order as-is (reprint reads it)
 *   PENDING or FAILED        → attempt (retry allowed from FAILED after a fix):
 *       FISCALIZED → return the fiscalized order
 *       FATAL      → markFiscalFatal(code) recorded; return the order (fiscalStatus FAILED)
 *       RETRYABLE  → 503 FISCAL_DEVICE_UNAVAILABLE (order stays PENDING; retry)
 */
@Injectable()
export class FiscalizeOrderManuallyUseCase
  implements UseCase<FiscalizeOrderManuallyInput, Order>
{
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(FISCAL_PRINT_MODE_READER) private readonly printMode: FiscalPrintModeReader,
    private readonly edge: EdgeConfigService,
    private readonly fiscalize: DineInFiscalizeService,
  ) {}

  async execute(input: FiscalizeOrderManuallyInput): Promise<Order> {
    const { restaurantId, branchId, orderId } = input;
    if (!restaurantId) {
      throw NoRestaurantInScope();
    }
    // The physical device is on the LAN — the command only runs on the hub.
    if (!this.edge.isEdge) {
      throw FiscalizeHubOnly();
    }

    const order = await this.orders.findById(restaurantId, branchId, orderId);
    if (!order) {
      throw OrderNotFound();
    }
    if (order.paymentStatus !== PaymentStatus.PAID) {
      throw OrderNotPaidForFiscalize();
    }
    // Idempotent: a fiscalized order is never re-fiscalized (reprint reads it).
    if (order.isFiscalized()) {
      return order;
    }
    // Gate on an ACTIVE fiscal config so a non-fiscal branch is a clean reject,
    // never marked FAILED (mirrors the FISCAL-EDGE-3 skip semantics).
    const mode = await this.printMode.getPrintMode(restaurantId, branchId);
    if (mode === null) {
      throw FiscalNotConfiguredForBranch();
    }

    // PENDING or FAILED (retry allowed after the operator fixes the cause).
    const outcome = await this.fiscalize.attempt(restaurantId, branchId, orderId, order);
    if (outcome.status === 'RETRYABLE') {
      throw FiscalDeviceUnavailable(outcome.message);
    }

    // FISCALIZED or FATAL: re-read so the response reflects the fiscal columns or
    // the recorded fatal code (fiscalStatus OK vs FAILED).
    const updated = await this.orders.findById(restaurantId, branchId, orderId);
    if (!updated) {
      throw OrderNotFound();
    }
    return updated;
  }
}
