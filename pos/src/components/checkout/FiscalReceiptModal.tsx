'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useOrdersControllerFiscalReceipt } from '@/api/generated/orders/orders';

interface FiscalReceiptModalProps {
  orderId: string;
  onDone: () => void;
}

/**
 * Reprint overlay for an already-fiscalized order. Re-renders the STORED fiscal
 * block (GET /orders/:id/fiscal-receipt) — no device call. Reuses the same
 * print pipeline as Receipt.tsx: the `.receipt-print` block is the only thing
 * `window.print()` shows (see globals.css), `.no-print` hides on-screen chrome.
 * The SRC `qr` is a fixed-format string; with no QR lib in the app it's rendered
 * as the raw payload the receipt/printer encodes.
 */
export function FiscalReceiptModal({ orderId, onDone }: FiscalReceiptModalProps) {
  const t = useTranslations('fiscal');
  const tc = useTranslations('common');
  const locale = useLocale();

  const { data: fiscal, isLoading, isError } = useOrdersControllerFiscalReceipt(orderId, {
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
        {isLoading ? (
          <div className="p-8 text-center text-lg text-gray-500">{tc('loading')}</div>
        ) : isError || !fiscal ? (
          <div className="flex flex-col gap-4 p-8">
            <p className="text-center text-lg text-red-600">{t('loadError')}</p>
            <button
              type="button"
              onClick={onDone}
              className="h-14 w-full select-none rounded-xl border border-gray-300 text-lg font-semibold text-gray-700 active:scale-[0.98]"
            >
              {t('done')}
            </button>
          </div>
        ) : (
          <>
            <div className="receipt-print overflow-y-auto p-6 font-mono text-sm text-gray-900">
              <div className="text-center">
                <p className="text-base font-bold">{t('receiptTitle')}</p>
                <p>#{fiscal.orderNumber}</p>
              </div>

              <div className="my-3 border-t border-dashed border-gray-400" />

              <div className="space-y-0.5">
                <Line label={t('fiscalNumber')} value={fiscal.fiscalNumber} />
                <Line label={t('receiptId')} value={fiscal.receiptId} />
                <Line label={t('issuedAt')} value={fmtDate(fiscal.fiscalizedAt)} />
              </div>

              <div className="my-3 border-t border-dashed border-gray-400" />

              <div className="text-center">
                <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">{t('qrHint')}</p>
                <p className="break-all text-xs" data-testid="fiscal-qr">
                  {fiscal.qr}
                </p>
              </div>
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
    <div className="flex justify-between gap-3">
      <span className="shrink-0">{label}</span>
      <span className="break-all text-right">{value}</span>
    </div>
  );
}
