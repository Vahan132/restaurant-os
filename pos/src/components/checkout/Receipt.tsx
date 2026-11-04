'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useOrdersControllerReceipt } from '@/api/generated/orders/orders';
import { useMoney } from '@/lib/useMoney';

interface ReceiptProps {
  orderId: string;
  onDone: () => void;
}

/**
 * Printable receipt overlay. Renders GET /orders/:id/receipt. NO tax line.
 * "Print" uses window.print(); print-only CSS (see globals.css) shows only the
 * `.receipt-print` block and hides on-screen chrome (`.no-print`).
 */
export function Receipt({ orderId, onDone }: ReceiptProps) {
  const t = useTranslations('receipt');
  const tc = useTranslations('common');
  const tMethod = useTranslations('pay.method');
  const locale = useLocale();
  const { format } = useMoney();

  const { data: receipt, isLoading } = useOrdersControllerReceipt(orderId, {
    query: { enabled: Boolean(orderId) },
  });

  function fmtDate(value?: string | null) {
    if (!value) return '';
    try {
      return new Date(value).toLocaleString(locale);
    } catch {
      return value;
    }
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-sm flex-col rounded-2xl bg-white shadow-xl">
        {isLoading || !receipt ? (
          <div className="p-8 text-center text-lg text-gray-500">{tc('loading')}</div>
        ) : (
          <>
            <div className="receipt-print overflow-y-auto p-6 font-mono text-sm text-gray-900">
              <div className="text-center">
                <p className="text-base font-bold">{receipt.restaurantName}</p>
                {receipt.address ? <p>{receipt.address}</p> : null}
                {receipt.phone ? <p>{receipt.phone}</p> : null}
              </div>

              <div className="my-3 border-t border-dashed border-gray-400" />

              <div className="space-y-0.5">
                <Line label={t('orderNumber')} value={`#${receipt.orderNumber}`} />
                {receipt.tableName ? <Line label={t('table')} value={receipt.tableName} /> : null}
                {receipt.servedByName ? (
                  <Line label={t('servedBy')} value={receipt.servedByName} />
                ) : null}
                <Line label={t('date')} value={fmtDate(receipt.closedAt ?? receipt.createdAt)} />
              </div>

              <div className="my-3 border-t border-dashed border-gray-400" />

              <div className="space-y-1">
                {receipt.items.map((item, i) => (
                  <div key={i}>
                    <div className="flex justify-between">
                      <span>
                        {item.qty}× {item.name}
                      </span>
                      <span>{format(item.lineTotal)}</span>
                    </div>
                    {item.modifiers.map((m, j) => (
                      <div key={j} className="pl-4 text-xs text-gray-600">
                        + {m.name}
                        {m.priceDelta ? ` (${format(m.priceDelta)})` : ''}
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div className="my-3 border-t border-dashed border-gray-400" />

              <div className="space-y-0.5">
                <Line label={t('subtotal')} value={format(receipt.subtotalAmount)} />
                {receipt.discountAmount > 0 ? (
                  <Line label={t('discount')} value={`− ${format(receipt.discountAmount)}`} />
                ) : null}
                {receipt.serviceFeeAmount > 0 ? (
                  <Line label={t('serviceFee')} value={format(receipt.serviceFeeAmount)} />
                ) : null}
                <div className="flex justify-between border-t border-gray-300 pt-1 text-base font-bold">
                  <span>{t('total')}</span>
                  <span>{format(receipt.totalAmount)}</span>
                </div>
              </div>

              {receipt.payments.length > 0 ? (
                <>
                  <div className="my-3 border-t border-dashed border-gray-400" />
                  <div className="space-y-0.5">
                    {receipt.payments.map((p, i) => (
                      <div key={i}>
                        <Line label={tMethod(p.method)} value={format(p.amount)} />
                        {p.method === 'CASH' && p.tenderedAmount != null ? (
                          <>
                            <Line label={t('cashReceived')} value={format(p.tenderedAmount)} />
                            <Line label={t('change')} value={format(p.changeAmount)} />
                          </>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </>
              ) : null}

              {receipt.footer ? (
                <>
                  <div className="my-3 border-t border-dashed border-gray-400" />
                  <p className="whitespace-pre-line text-center text-xs text-gray-600">
                    {receipt.footer}
                  </p>
                </>
              ) : null}
            </div>

            <div className="no-print flex gap-3 border-t border-gray-200 p-4">
              <button
                type="button"
                onClick={onDone}
                className="h-14 flex-1 select-none rounded-xl border border-gray-300 text-lg font-semibold text-gray-700 active:scale-[0.98]"
              >
                {t('done')}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="h-14 flex-1 select-none rounded-xl bg-gray-900 text-lg font-bold text-white active:scale-[0.98]"
              >
                {t('print')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
