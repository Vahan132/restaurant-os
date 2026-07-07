import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  FiscalizationInput,
  FiscalizationPort,
  FiscalizationResult,
} from '../../application/ports/fiscalization.port';

/**
 * No-op fiscalization adapter: returns a DETERMINISTIC fake receipt so ordering
 * can be built and tested end-to-end without a device. Wired by default via the
 * FISCALIZATION_PORT token; the real e-HDM / physical-HDM adapters swap in later
 * without touching any call site.
 *
 * Deterministic on (orderRef, totalAmount) so the same settlement always yields
 * the same fake identifiers — safe for tests/idempotency, never for production.
 */
@Injectable()
export class StubFiscalizationAdapter implements FiscalizationPort {
  fiscalize(input: FiscalizationInput): Promise<FiscalizationResult> {
    const digest = createHash('sha256')
      .update(`${input.restaurantId}:${input.branchId}:${input.orderRef}:${input.totalAmount}`)
      .digest('hex');
    return Promise.resolve({
      receiptId: `STUB-${digest.slice(0, 16).toUpperCase()}`,
      fiscalReference: `STUBFISC-${digest.slice(16, 32).toUpperCase()}`,
      issuedAt: new Date(),
    });
  }
}
