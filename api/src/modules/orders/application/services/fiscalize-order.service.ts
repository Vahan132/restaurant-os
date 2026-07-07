import { Inject, Injectable } from '@nestjs/common';
import { Quantity } from '../../../../shared/domain/value-objects/quantity';
import {
  FISCALIZATION_PORT,
  FiscalizationPort,
  FiscalizationResult,
  FiscalMode,
} from '../../../fiscalization/application/ports/fiscalization.port';
import { Order } from '../../domain/entities/order';

/**
 * Builds the {@link FiscalizationInput} from a PAID order and invokes the
 * FiscalizationPort (stubbed). This is the per-transition FISCALIZATION HOOK for
 * the QR-web prepayment flow: it is called once on the paymentStatus→PAID
 * transition. A second emission at a later FULFILLED transition (see the
 * accountant decision NOTE below) can be added by calling this again with a
 * different `mode` — no flow rework needed.
 *
 * NOTE (accountant decision, pending): QR-web v1 fiscalises a single mode-2
 * (products) receipt at PAID. The alternative the accountants may choose is a
 * mode-3 (prepayment) receipt at PAID plus a mode-2 (products) receipt at
 * fulfilment. Because this service is a hook (mode is a parameter) and
 * Order.applyFiscalResult is idempotent+additive, switching to the two-receipt
 * model is additive — do not refactor the flow for it.
 */
@Injectable()
export class FiscalizeOrderService {
  constructor(
    @Inject(FISCALIZATION_PORT) private readonly fiscalization: FiscalizationPort,
  ) {}

  /** Fiscalise the order's products receipt (mode 2). Channel is QR_WEB (e-HDM). */
  fiscalizeProducts(order: Order): Promise<FiscalizationResult> {
    const lines = order.items
      .filter((i) => !i.isCancelled())
      .map((i) => ({
        name: i.nameSnapshot,
        goodName: i.goodName ?? i.nameSnapshot,
        goodCode: i.goodCode,
        quantityThousandths: Quantity.fromUnits(i.quantity).thousandthsValue,
        unit: i.unit,
        unitPriceAmount: i.unitPriceAmount,
        lineTotalAmount: i.lineTotalAmount,
        adgCode: i.adgCode,
        dep: i.dep,
      }));

    return this.fiscalization.fiscalize({
      restaurantId: order.restaurantId,
      branchId: order.branchId,
      orderRef: order.id,
      currency: order.currency,
      channel: 'QR_WEB',
      mode: FiscalMode.PRODUCTS,
      partnerTin: order.partnerTin,
      lines,
      subtotalAmount: order.subtotalAmount,
      discountAmount: order.discountAmount,
      serviceFeeAmount: order.serviceFeeAmount,
      totalAmount: order.totalAmount,
      cardAmount: order.cardAmount,
      cashAmount: order.cashAmount,
      partialAmount: order.partialAmount,
      prePaymentAmount: order.prePaymentAmount,
      changeAmount: order.changeAmount,
    });
  }
}
