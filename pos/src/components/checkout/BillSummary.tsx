'use client';

import { useTranslations } from 'next-intl';
import type { OrderResponse, OrderResponsePaymentStatus } from '@/api/generated/model';
import { useMoney } from '@/lib/useMoney';
import { visibleItems } from '@/lib/orders';
import { activePayments, remainingBalance } from '@/lib/payments';

const STATUS_BADGE: Record<OrderResponsePaymentStatus, string> = {
  UNPAID: 'bg-red-100 text-red-700',
  PARTIALLY_PAID: 'bg-amber-100 text-amber-700',
  PAID: 'bg-green-100 text-green-700',
};

interface BillSummaryProps {
  order: OrderResponse;
  canPay: boolean;
  voiding?: boolean;
  onVoid: (paymentId: string) => void;
  /** Holds payment:void (IIKO-PERM-1). */
  canVoid: boolean;
}

/** Left pane: itemized bill, totals (no tax), paid / remaining / status, payments. */
export function BillSummary({ order, canVoid, voiding, onVoid }: BillSummaryProps) {
  const t = useTranslations('pay');
  const tBuilder = useTranslations('builder');
  const tMethod = useTranslations('pay.method');
  const tStatus = useTranslations('pay.status');
  const { format } = useMoney();

  const items = visibleItems(order);
  const payments = activePayments(order);
  const remaining = remainingBalance(order);
  const totals = order.totals;

  return (
    <div className="space-y-4">
      <section className="space-y-1">
        {items.map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-3 text-base">
            <div className="min-w-0">
              <p className="font-medium text-gray-900">
                {item.quantity}× {item.nameSnapshot}
              </p>
              {item.modifiers.length > 0 ? (
                <p className="text-sm text-gray-500">
                  {item.modifiers.map((m) => m.nameSnapshot).join(', ')}
                </p>
              ) : null}
            </div>
            <span className="font-semibold text-gray-900">{format(item.lineTotalAmount)}</span>
          </div>
        ))}
      </section>

      <section className="space-y-1.5 border-t border-gray-200 pt-3 text-base">
        <Row label={tBuilder('subtotal')} value={format(totals.subtotalAmount)} />
        {totals.discountAmount > 0 ? (
          <Row
            label={tBuilder('discount')}
            value={`− ${format(totals.discountAmount)}`}
            className="text-green-700"
          />
        ) : null}
        {totals.serviceFeeAmount > 0 ? (
          <Row label={tBuilder('serviceFee')} value={format(totals.serviceFeeAmount)} />
        ) : null}
        <div className="flex items-center justify-between border-t border-gray-200 pt-1.5">
          <span className="text-lg font-bold text-gray-900">{tBuilder('total')}</span>
          <span className="text-xl font-bold text-gray-900">{format(totals.totalAmount)}</span>
        </div>
      </section>

      <section className="space-y-1.5 rounded-xl bg-gray-50 p-4 text-base">
        <Row label={t('paid')} value={format(order.paidAmount)} />
        <div className="flex items-center justify-between">
          <span className="font-semibold text-gray-700">{t('remaining')}</span>
          <span className="text-lg font-bold text-gray-900">{format(remaining)}</span>
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="text-gray-500">{t('paymentStatus')}</span>
          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold uppercase ${STATUS_BADGE[order.paymentStatus]}`}
          >
            {tStatus(order.paymentStatus)}
          </span>
        </div>
      </section>

      {payments.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-base font-semibold text-gray-700">{t('payments')}</h3>
          {payments.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-3"
            >
              <div>
                <span className="text-base font-semibold text-gray-900">{tMethod(p.method)}</span>
                <span className="ml-2 text-base text-gray-600">{format(p.amount)}</span>
              </div>
              {canVoid ? (
                <button
                  type="button"
                  onClick={() => onVoid(p.id)}
                  disabled={voiding}
                  className="min-h-tap select-none rounded-lg border border-red-200 px-4 text-sm font-semibold text-red-600 active:scale-95 disabled:opacity-50"
                >
                  {t('void')}
                </button>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={`font-semibold ${className ?? 'text-gray-900'}`}>{value}</span>
    </div>
  );
}
