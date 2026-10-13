import { Inject, Injectable, Logger } from '@nestjs/common';
import { EdgeConfigService } from '../../../../shared/edge/edge-config.service';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import {
  FISCAL_PRINT_MODE_READER,
  FiscalPrintModeReader,
} from '../../../fiscal-config/application/ports/fiscal-print-mode.reader';
import { FatalFiscalError } from '../../../fiscalization/application/ports/fiscal-errors';
import { Order } from '../../domain/entities/order';
import { ORDER_REPOSITORY, OrderRepository } from '../../domain/repositories/order.repository';
import { FiscalizeOrderService } from './fiscalize-order.service';

/**
 * Outcome of a single fiscalize attempt against the physical adapter. Callers map
 * it to their own semantics (AUTO ignores it; the manual command surfaces it):
 *   - FISCALIZED: receipt issued + applied to the order.
 *   - FATAL: recorded via markFiscalFatal (code preserved, incl. 155/156).
 *   - RETRYABLE: transport/session failure; the order is left PAID + PENDING.
 */
export type FiscalizeAttemptOutcome =
  | { status: 'FISCALIZED' }
  | { status: 'FATAL'; code: string }
  | { status: 'RETRYABLE'; message: string };

/**
 * FISCAL-EDGE-3 — dine-in POS fiscalize trigger. Runs on the HUB only (the
 * physical HDM is on the LAN) and mirrors ConfirmPayment's Phase-B, with ONE
 * crucial difference: it NEVER throws. The payment is already committed by the
 * time this runs, so a fiscal failure must not surface as an error to the payment
 * call nor roll settlement back.
 *
 * Behaviour by branch print mode (read via the NON-THROWING reader):
 *   - `null` (no active fiscal config) → do nothing; the order's fiscal state is
 *     left COMPLETELY UNTOUCHED (never marked FAILED on a non-fiscal branch).
 *   - `MANUAL` → skip the auto call; order stays PAID + fiscalStatus PENDING for a
 *     later manual trigger.
 *   - `AUTO` → fiscalize via the physical adapter; a FatalFiscalError is recorded
 *     (markFiscalFatal, SRC code preserved incl. 155/156), a retryable failure is
 *     logged and left PAID + PENDING for a re-trigger.
 */
@Injectable()
export class DineInFiscalizeService {
  private readonly logger = new Logger(DineInFiscalizeService.name);

  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(FISCAL_PRINT_MODE_READER) private readonly printMode: FiscalPrintModeReader,
    private readonly fiscalize: FiscalizeOrderService,
    private readonly edge: EdgeConfigService,
    private readonly events: DomainEventPublisher,
  ) {}

  /**
   * Fiscalize a dine-in order that just became PAID. Idempotent and safe to
   * re-run: the isFiscalized/hasFatalFiscalError guards + applyFiscalResult ensure
   * a retry never double-fiscalizes. Never throws.
   */
  async onOrderPaid(restaurantId: string, branchId: string, orderId: string): Promise<void> {
    // The physical device is hub-only; on cloud, dine-in POS does nothing fiscal.
    if (!this.edge.isEdge) {
      return;
    }
    const mode = await this.printMode.getPrintMode(restaurantId, branchId);
    // null (no active fiscal config) or MANUAL → leave the order untouched.
    if (mode !== 'AUTO') {
      return;
    }

    const order = await this.orders.findById(restaurantId, branchId, orderId);
    if (!order || order.isFiscalized() || order.hasFatalFiscalError()) {
      return;
    }
    // AUTO ignores the outcome — the payment response is what the caller returns.
    await this.attempt(restaurantId, branchId, orderId, order);
  }

  /**
   * Core fiscalize attempt — shared by the AUTO trigger and the FISCAL-EDGE-4
   * manual command. Caller-agnostic: it does NOT check the print mode, the PAID
   * state, or isFiscalized (callers guard those). It fiscalizes via the physical
   * adapter and applies the result / records a fatal code, returning a
   * discriminated outcome. It NEVER throws — settlement/commit is the caller's
   * concern, and a fiscal failure must never surface as an unexpected error.
   */
  async attempt(
    restaurantId: string,
    branchId: string,
    orderId: string,
    order: Order,
  ): Promise<FiscalizeAttemptOutcome> {
    try {
      const result = await this.fiscalize.fiscalizeProducts(order);
      const done = await this.orders.withOrderLock(restaurantId, branchId, orderId, (o) => {
        o.applyFiscalResult({
          receiptId: result.receiptId,
          fiscalNumber: result.fiscalNumber,
          qr: result.qr,
          issuedAt: result.issuedAt,
        });
      });
      if (done) {
        await this.events.publishFromAggregate(done.order);
      }
      return { status: 'FISCALIZED' };
    } catch (err) {
      if (err instanceof FatalFiscalError) {
        // Fatal-config (incl. 155/156): record the SRC code to STOP the loop. The
        // payment still stands — settlement is never rolled back. A successful
        // retry later (applyFiscalResult) clears this marker.
        const marked = await this.orders.withOrderLock(restaurantId, branchId, orderId, (o) =>
          o.markFiscalFatal(err.code),
        );
        if (marked) {
          await this.events.publishFromAggregate(marked.order);
        }
        return { status: 'FATAL', code: err.code };
      }
      // Retryable (transport/session): leave PAID + PENDING. No secret is logged.
      this.logger.warn(
        `Dine-in fiscalize deferred (retryable) for order ${orderId}: ${(err as Error).message}`,
      );
      return { status: 'RETRYABLE', message: (err as Error).message };
    }
  }
}
