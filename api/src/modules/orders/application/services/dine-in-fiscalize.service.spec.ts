import { EdgeConfigService } from '../../../../shared/edge/edge-config.service';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import {
  FiscalPrintMode,
  FiscalPrintModeReader,
} from '../../../fiscal-config/application/ports/fiscal-print-mode.reader';
import { FatalFiscalError } from '../../../fiscalization/application/ports/fiscal-errors';
import { FiscalizationResult } from '../../../fiscalization/application/ports/fiscalization.port';
import { OrderRepository } from '../../domain/repositories/order.repository';
import { DineInFiscalizeService } from './dine-in-fiscalize.service';
import { FiscalizeOrderService } from './fiscalize-order.service';

/**
 * FISCAL-EDGE-3 — dine-in trigger orchestration. Verifies AUTO fiscalizes,
 * MANUAL/none leave the order untouched, fatal codes are recorded (preserved),
 * retryable failures never throw, and the whole thing no-ops off the hub.
 */

const R = 'r1';
const B = 'b1';
const O = 'o1';

/** Minimal order double tracking the fiscal mutations the service may make. */
class FakeOrder {
  fiscalized = false;
  fatalCode: string | null = null;
  appliedResult: unknown = null;

  isFiscalized(): boolean {
    return this.fiscalized;
  }
  hasFatalFiscalError(): boolean {
    return this.fatalCode !== null;
  }
  applyFiscalResult(result: unknown): boolean {
    if (this.fiscalized) {
      return false;
    }
    this.appliedResult = result;
    this.fiscalized = true;
    return true;
  }
  markFiscalFatal(code: string): boolean {
    this.fatalCode = code;
    return true;
  }
}

class FakeOrderRepo {
  withOrderLockCalls = 0;
  constructor(private readonly order: FakeOrder | null) {}
  findById(): Promise<FakeOrder | null> {
    return Promise.resolve(this.order);
  }
  withOrderLock(
    _r: string,
    _b: string,
    _o: string,
    fn: (order: FakeOrder) => unknown,
  ): Promise<{ order: FakeOrder; result: unknown } | null> {
    this.withOrderLockCalls += 1;
    if (!this.order) {
      return Promise.resolve(null);
    }
    const result = fn(this.order);
    return Promise.resolve({ order: this.order, result });
  }
}

class FakeFiscalize {
  calls = 0;
  constructor(private readonly behaviour: () => Promise<FiscalizationResult>) {}
  fiscalizeProducts(): Promise<FiscalizationResult> {
    this.calls += 1;
    return this.behaviour();
  }
}

const RESULT: FiscalizationResult = {
  receiptId: 'rc1',
  fiscalReference: 'F1',
  fiscalNumber: 'F1',
  sn: 'SN',
  qr: 'QR',
  issuedAtEpochMs: 1_750_000_000_000,
  totalAmount: 1000,
  changeAmount: 0,
  issuedAt: new Date(1_750_000_000_000),
};

function build(opts: {
  mode: FiscalPrintMode | null;
  order: FakeOrder | null;
  fiscalize: () => Promise<FiscalizationResult>;
  isEdge?: boolean;
}): { service: DineInFiscalizeService; repo: FakeOrderRepo; fiscalize: FakeFiscalize } {
  const repo = new FakeOrderRepo(opts.order);
  const fiscalize = new FakeFiscalize(opts.fiscalize);
  const printMode: FiscalPrintModeReader = { getPrintMode: () => Promise.resolve(opts.mode) };
  const edge = { isEdge: opts.isEdge ?? true } as EdgeConfigService;
  const events = { publishFromAggregate: () => Promise.resolve() } as unknown as DomainEventPublisher;
  const service = new DineInFiscalizeService(
    repo as unknown as OrderRepository,
    printMode,
    fiscalize as unknown as FiscalizeOrderService,
    edge,
    events,
  );
  return { service, repo, fiscalize };
}

describe('DineInFiscalizeService', () => {
  it('AUTO: fiscalizes and applies the result to the order', async () => {
    const order = new FakeOrder();
    const { service, fiscalize } = build({ mode: 'AUTO', order, fiscalize: () => Promise.resolve(RESULT) });
    await service.onOrderPaid(R, B, O);
    expect(fiscalize.calls).toBe(1);
    expect(order.fiscalized).toBe(true);
    expect(order.appliedResult).toMatchObject({ receiptId: 'rc1', fiscalNumber: 'F1', qr: 'QR' });
  });

  it('MANUAL: does not fiscalize; order left PAID + untouched', async () => {
    const order = new FakeOrder();
    const { service, fiscalize } = build({ mode: 'MANUAL', order, fiscalize: () => Promise.resolve(RESULT) });
    await service.onOrderPaid(R, B, O);
    expect(fiscalize.calls).toBe(0);
    expect(order.fiscalized).toBe(false);
    expect(order.fatalCode).toBeNull();
  });

  it('null (no active fiscal config): leaves the fiscal state COMPLETELY UNTOUCHED (never FAILED)', async () => {
    const order = new FakeOrder();
    const { service, fiscalize, repo } = build({
      mode: null,
      order,
      fiscalize: () => Promise.resolve(RESULT),
    });
    await service.onOrderPaid(R, B, O);
    expect(fiscalize.calls).toBe(0);
    expect(order.fiscalized).toBe(false);
    expect(order.fatalCode).toBeNull(); // NOT marked FAILED
    expect(order.appliedResult).toBeNull();
    expect(repo.withOrderLockCalls).toBe(0); // no write at all
  });

  it('AUTO + FatalFiscalError: records markFiscalFatal with the SRC code preserved (incl. 155), never throws', async () => {
    for (const code of ['192', '155']) {
      const order = new FakeOrder();
      const { service } = build({
        mode: 'AUTO',
        order,
        fiscalize: () => Promise.reject(new FatalFiscalError(code, 'x')),
      });
      await expect(service.onOrderPaid(R, B, O)).resolves.toBeUndefined();
      expect(order.fatalCode).toBe(code);
      expect(order.fiscalized).toBe(false);
    }
  });

  it('AUTO + retryable error: never throws, leaves order PAID + PENDING (no mark, no receipt)', async () => {
    const order = new FakeOrder();
    const { service } = build({
      mode: 'AUTO',
      order,
      fiscalize: () => Promise.reject(new Error('socket closed')),
    });
    await expect(service.onOrderPaid(R, B, O)).resolves.toBeUndefined();
    expect(order.fiscalized).toBe(false);
    expect(order.fatalCode).toBeNull();
  });

  it('idempotent: an already-fiscalized order is not re-fiscalized', async () => {
    const order = new FakeOrder();
    order.fiscalized = true;
    const { service, fiscalize } = build({ mode: 'AUTO', order, fiscalize: () => Promise.resolve(RESULT) });
    await service.onOrderPaid(R, B, O);
    expect(fiscalize.calls).toBe(0);
  });

  it('off the hub (cloud): no-op even in AUTO', async () => {
    const order = new FakeOrder();
    const { service, fiscalize } = build({
      mode: 'AUTO',
      order,
      fiscalize: () => Promise.resolve(RESULT),
      isEdge: false,
    });
    await service.onOrderPaid(R, B, O);
    expect(fiscalize.calls).toBe(0);
    expect(order.fiscalized).toBe(false);
  });
});
