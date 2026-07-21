import { EdgeConfigService } from '../../../../shared/edge/edge-config.service';
import { FiscalPrintModeReader } from '../../../fiscal-config/application/ports/fiscal-print-mode.reader';
import { OrderRepository } from '../../domain/repositories/order.repository';
import {
  DineInFiscalizeService,
  FiscalizeAttemptOutcome,
} from '../services/dine-in-fiscalize.service';
import { FiscalizeOrderManuallyUseCase } from './fiscalize-order-manually.usecase';

/**
 * FISCAL-EDGE-4 — manual fiscalize command state machine. Verifies the accepted
 * transitions (PENDING/FAILED → fiscalize, already → idempotent, non-fiscal →
 * clean reject, retryable → 503) and hub-only gating, all without a device.
 */

const R = 'r1';
const B = 'b1';
const O = 'o1';

class FakeOrder {
  paymentStatus = 'PAID';
  fiscalized = false;
  fatalCode: string | null = null;
  isFiscalized(): boolean {
    return this.fiscalized;
  }
}

function build(opts: {
  order: FakeOrder | null;
  mode: 'AUTO' | 'MANUAL' | null;
  isEdge?: boolean;
  attempt?: (order: FakeOrder) => FiscalizeAttemptOutcome;
}): { uc: FiscalizeOrderManuallyUseCase; attemptCalls: () => number } {
  let calls = 0;
  const repo = {
    findById: () => Promise.resolve(opts.order),
  } as unknown as OrderRepository;
  const printMode: FiscalPrintModeReader = { getPrintMode: () => Promise.resolve(opts.mode) };
  const edge = { isEdge: opts.isEdge ?? true } as EdgeConfigService;
  const fiscalize = {
    attempt: (_r: string, _b: string, _o: string, order: FakeOrder) => {
      calls += 1;
      const outcome = opts.attempt ? opts.attempt(order) : ({ status: 'FISCALIZED' } as const);
      return Promise.resolve(outcome);
    },
  } as unknown as DineInFiscalizeService;
  const uc = new FiscalizeOrderManuallyUseCase(repo, printMode, edge, fiscalize);
  return { uc, attemptCalls: () => calls };
}

const input = { restaurantId: R, branchId: B, orderId: O };

describe('FiscalizeOrderManuallyUseCase', () => {
  it('rejects off the hub (FISCALIZE_HUB_ONLY)', async () => {
    const { uc } = build({ order: new FakeOrder(), mode: 'MANUAL', isEdge: false });
    await expect(uc.execute(input)).rejects.toMatchObject({ response: { code: 'FISCALIZE_HUB_ONLY' } });
  });

  it('404 when the order is not found', async () => {
    const { uc } = build({ order: null, mode: 'MANUAL' });
    await expect(uc.execute(input)).rejects.toMatchObject({ response: { code: 'ORDER_NOT_FOUND' } });
  });

  it('409 when the order is not paid', async () => {
    const order = new FakeOrder();
    order.paymentStatus = 'UNPAID';
    const { uc } = build({ order, mode: 'MANUAL' });
    await expect(uc.execute(input)).rejects.toMatchObject({ response: { code: 'ORDER_NOT_PAID' } });
  });

  it('idempotent: an already-fiscalized order returns without re-fiscalizing', async () => {
    const order = new FakeOrder();
    order.fiscalized = true;
    const { uc, attemptCalls } = build({ order, mode: 'MANUAL' });
    const result = await uc.execute(input);
    expect(result).toBe(order);
    expect(attemptCalls()).toBe(0);
  });

  it('rejects a non-fiscal branch cleanly (FISCAL_NOT_CONFIGURED), never fiscalizes', async () => {
    const { uc, attemptCalls } = build({ order: new FakeOrder(), mode: null });
    await expect(uc.execute(input)).rejects.toMatchObject({
      response: { code: 'FISCAL_NOT_CONFIGURED' },
    });
    expect(attemptCalls()).toBe(0);
  });

  it('MANUAL + PENDING → fiscalizes (attempt invoked, returns order)', async () => {
    const order = new FakeOrder();
    const { uc, attemptCalls } = build({
      order,
      mode: 'MANUAL',
      attempt: (o) => {
        o.fiscalized = true;
        return { status: 'FISCALIZED' };
      },
    });
    const result = await uc.execute(input);
    expect(attemptCalls()).toBe(1);
    expect(result).toBe(order);
    expect(order.fiscalized).toBe(true);
  });

  it('retry from FAILED is allowed (fatal recorded, not yet fiscalized)', async () => {
    const order = new FakeOrder();
    order.fatalCode = '155'; // previously FAILED
    const { uc, attemptCalls } = build({
      order,
      mode: 'MANUAL',
      attempt: (o) => {
        o.fiscalized = true;
        o.fatalCode = null;
        return { status: 'FISCALIZED' };
      },
    });
    await uc.execute(input);
    expect(attemptCalls()).toBe(1);
    expect(order.fiscalized).toBe(true);
  });

  it('RETRYABLE outcome → 503 FISCAL_DEVICE_UNAVAILABLE (stays pending)', async () => {
    const { uc } = build({
      order: new FakeOrder(),
      mode: 'MANUAL',
      attempt: () => ({ status: 'RETRYABLE', message: 'socket closed' }),
    });
    await expect(uc.execute(input)).rejects.toMatchObject({
      response: { code: 'FISCAL_DEVICE_UNAVAILABLE' },
    });
  });

  it('FATAL outcome → does NOT throw; returns the order (fiscalStatus FAILED)', async () => {
    const order = new FakeOrder();
    const { uc } = build({
      order,
      mode: 'MANUAL',
      attempt: (o) => {
        o.fatalCode = '192';
        return { status: 'FATAL', code: '192' };
      },
    });
    const result = await uc.execute(input);
    expect(result).toBe(order);
    expect(order.fatalCode).toBe('192');
  });
});
