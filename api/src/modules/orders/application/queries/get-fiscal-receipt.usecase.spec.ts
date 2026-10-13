import { OrderRepository } from '../../domain/repositories/order.repository';
import { GetFiscalReceiptUseCase } from './get-fiscal-receipt.usecase';

/**
 * FISCAL-EDGE-4 — reprint (option b). The stored fiscal data is returned for an
 * already-fiscalized order (no device call); a not-yet-fiscalized order is a 409.
 */

const R = 'r1';
const B = 'b1';
const O = 'o1';

/** Fake supporting the fields toOrderReceiptView reads. */
class FakeOrder {
  id = O;
  orderNumber = 42;
  status = 'CLOSED';
  paymentStatus = 'PAID';
  currency = 'AMD';
  totalAmount = 100000;
  constructor(
    private readonly fiscalized: boolean,
    readonly fiscalReceiptId: string | null = null,
    readonly fiscalNumber: string | null = null,
    readonly fiscalQr: string | null = null,
    readonly fiscalizedAt: Date | null = null,
  ) {}
  isFiscalized(): boolean {
    return this.fiscalized;
  }
  fiscalStatus(): 'OK' | 'PENDING' | 'FAILED' | null {
    return this.fiscalized ? 'OK' : 'PENDING';
  }
}

function ucFor(order: FakeOrder | null): GetFiscalReceiptUseCase {
  const repo = { findById: () => Promise.resolve(order) } as unknown as OrderRepository;
  return new GetFiscalReceiptUseCase(repo);
}

const input = { restaurantId: R, branchId: B, orderId: O };

describe('GetFiscalReceiptUseCase', () => {
  it('404 when the order is not found', async () => {
    await expect(ucFor(null).execute(input)).rejects.toMatchObject({
      response: { code: 'ORDER_NOT_FOUND' },
    });
  });

  it('409 ORDER_NOT_FISCALIZED when the order has no receipt yet', async () => {
    await expect(ucFor(new FakeOrder(false)).execute(input)).rejects.toMatchObject({
      response: { code: 'ORDER_NOT_FISCALIZED' },
    });
  });

  it('returns the stored fiscal block for an already-fiscalized order (no device call)', async () => {
    const at = new Date('2026-07-20T12:00:00.000Z');
    const order = new FakeOrder(true, 'rc1', 'F-77', 'QRDATA', at);
    const view = await ucFor(order).execute(input);
    expect(view).toMatchObject({
      orderId: O,
      orderNumber: 42,
      currency: 'AMD',
      totalAmount: 100000,
      fiscal: {
        receiptId: 'rc1',
        fiscalNumber: 'F-77',
        qr: 'QRDATA',
        fiscalizedAt: '2026-07-20T12:00:00.000Z',
      },
    });
  });
});
