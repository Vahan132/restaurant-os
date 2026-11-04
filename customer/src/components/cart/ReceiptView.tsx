'use client';

import { useTranslations } from 'next-intl';
import { QRCodeSVG } from 'qrcode.react';

import { usePublicQrOrdersControllerReceipt } from '@/api/generated/public/public';
import type { OrderReceiptResponse } from '@/api/generated/model';
import type { ApiError } from '@/api/mutator';
import { formatMoney } from '@/lib/money';

import SessionOrders from './SessionOrders';

interface Props {
  orderId: string;
  qr: string;
  currency: string;
  locale: string;
  onOrderMore: () => void;
}

/**
 * Post-payment receipt + live status (ORDER-2). Polls the receipt endpoint until
 * the order is fiscalised (`fiscalized === true`), then renders the backend's
 * `fiscal.qr` string as a scannable QR code plus the fiscal details. Until then
 * it shows a "receipt processing" state (paid-but-unfiscalised is a recoverable
 * backend state, not an error). Below the receipt, the table's orders are shown
 * live via {@link SessionOrders}.
 *
 * The frontend makes NO fiscal claims of its own — it renders whatever `qr`
 * string the backend returns.
 */
export default function ReceiptView({ orderId, qr, currency, locale, onOrderMore }: Props) {
  const t = useTranslations('receipt');

  const { data, isLoading, isError } = usePublicQrOrdersControllerReceipt<
    OrderReceiptResponse,
    ApiError
  >(orderId, {
    query: {
      // Poll until fiscalisation lands OR a fatal error stops it; then stop.
      refetchInterval: (query) => {
        const d = query.state.data;
        return d?.fiscalized || d?.fiscalStatus === 'FAILED' ? false : 3000;
      },
      refetchIntervalInBackground: true,
    },
  });

  const cur = data?.currency ?? currency;
  const fiscalized = data?.fiscalized === true && data?.fiscal != null;
  // FISCAL-1b: a fatal fiscal stop — show an honest "delayed" state, not an
  // endless spinner. Customer-safe: state only, no error code/internals.
  const fiscalFailed = data?.fiscalStatus === 'FAILED';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-white"
      data-testid="receipt-view"
      data-fiscalized={fiscalized ? 'true' : 'false'}
    >
      <div className="mx-auto w-full max-w-md flex-1 px-6 py-8">
        <div className="flex flex-col items-center text-center">
          <CheckBadge />
          <h1 className="mt-4 text-lg font-semibold text-gray-900">{t('paidTitle')}</h1>
          {data ? (
            <p className="mt-1 text-sm text-gray-500">
              {t('orderNumber', { number: data.orderNumber })} ·{' '}
              <span className="tabular-nums">{formatMoney(data.totalAmount, cur, locale)}</span>
            </p>
          ) : null}
        </div>

        <div className="mt-6 rounded-2xl border border-gray-100 p-5">
          {isError && !data ? (
            <p className="py-10 text-center text-sm text-gray-600">{t('error')}</p>
          ) : isLoading || !data ? (
            <div className="flex flex-col items-center py-10" role="status" aria-live="polite">
              <Spinner />
              <p className="mt-3 text-sm text-gray-500">{t('loading')}</p>
            </div>
          ) : fiscalFailed ? (
            <div
              className="flex flex-col items-center py-10"
              role="status"
              aria-live="polite"
              data-testid="receipt-delayed"
            >
              <ClockBadge />
              <p className="mt-3 text-sm font-medium text-gray-700">{t('delayedTitle')}</p>
              <p className="mt-1 text-center text-xs text-gray-500">{t('delayedBody')}</p>
            </div>
          ) : fiscalized && data.fiscal ? (
            <div className="flex flex-col items-center">
              <div className="rounded-xl bg-white p-3 ring-1 ring-gray-100">
                <QRCodeSVG
                  value={data.fiscal.qr}
                  size={200}
                  level="M"
                  marginSize={1}
                  title={t('qrAlt')}
                  data-testid="receipt-qr"
                />
              </div>
              <dl className="mt-5 w-full space-y-1.5 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">{t('fiscalNumber')}</dt>
                  <dd className="font-medium tabular-nums text-gray-900">
                    {data.fiscal.fiscalNumber}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">{t('total')}</dt>
                  <dd className="font-medium tabular-nums text-gray-900">
                    {formatMoney(data.totalAmount, cur, locale)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">{t('time')}</dt>
                  <dd className="font-medium tabular-nums text-gray-900">
                    {formatDateTime(data.fiscal.fiscalizedAt, locale)}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <div
              className="flex flex-col items-center py-10"
              role="status"
              aria-live="polite"
              data-testid="receipt-processing"
            >
              <Spinner />
              <p className="mt-3 text-sm font-medium text-gray-700">{t('processingTitle')}</p>
              <p className="mt-1 text-center text-xs text-gray-500">{t('processingBody')}</p>
            </div>
          )}
        </div>

        <section className="mt-8">
          <h2 className="mb-2.5 text-sm font-semibold text-gray-900">{t('yourOrders')}</h2>
          <SessionOrders qr={qr} highlightOrderId={orderId} />
        </section>

        <button
          type="button"
          data-testid="order-more"
          onClick={onOrderMore}
          className="mt-8 w-full rounded-xl bg-brand px-4 py-3.5 text-sm font-semibold text-white"
        >
          {t('orderMore')}
        </button>
      </div>
    </div>
  );
}

/** Format an ISO timestamp for display; fall back to the raw string. */
function formatDateTime(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

function ClockBadge() {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    </div>
  );
}

function Spinner() {
  return (
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-brand-accent" />
  );
}

function CheckBadge() {
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </div>
  );
}
