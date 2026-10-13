import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  FiscalizationInput,
  FiscalizationPort,
  FiscalizationResult,
} from '../../application/ports/fiscalization.port';

/**
 * No-op fiscalization adapter: returns a DETERMINISTIC fake receipt — including a
 * plausible SRC-format `qr` string — so ordering can be built and tested end to
 * end without a device. Wired by default via the FISCALIZATION_PORT token; the
 * real e-HDM / physical-HDM adapters swap in later without touching any call site.
 *
 * Deterministic on (restaurantId, branchId, orderRef, totalAmount) so the same
 * settlement always yields the same fake identifiers — safe for tests /
 * idempotency, never for production.
 */
@Injectable()
export class StubFiscalizationAdapter implements FiscalizationPort {
  fiscalize(input: FiscalizationInput): Promise<FiscalizationResult> {
    const digest = createHash('sha256')
      .update(`${input.restaurantId}:${input.branchId}:${input.orderRef}:${input.totalAmount}`)
      .digest('hex');
    const receiptId = `STUB-${digest.slice(0, 16).toUpperCase()}`;
    const fiscalNumber = digest.slice(16, 28).toUpperCase();
    const sn = `SN${digest.slice(28, 40).toUpperCase()}`;
    const issuedAt = new Date();
    const issuedAtEpochMs = issuedAt.getTime();
    // Fixed-format QR mirroring the SRC electronic receipt URL the customer app
    // renders as a QR code. Deterministic; NOT a real e-receipt endpoint.
    const qr =
      `https://e-receipt.taxservice.am/#/receipt/${fiscalNumber}` +
      `?sn=${sn}&total=${input.totalAmount}&time=${issuedAtEpochMs}`;
    return Promise.resolve({
      receiptId,
      fiscalReference: `STUBFISC-${digest.slice(16, 32).toUpperCase()}`,
      fiscalNumber,
      sn,
      qr,
      issuedAtEpochMs,
      totalAmount: input.totalAmount,
      changeAmount: input.changeAmount,
      issuedAt,
    });
  }
}
