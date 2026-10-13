'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { OrderResponse } from '@/api/generated/model';
import { Can, PERMISSIONS } from '@/lib/permissions';
import { useFiscal } from '@/lib/useFiscal';
import { isDeviceSyncCode } from '@/lib/fiscal';
import { FiscalReceiptModal } from './FiscalReceiptModal';

/**
 * Status-driven fiscal control for a paid order. Purely reacts to
 * `order.fiscalStatus` — it never needs to know AUTO vs MANUAL mode:
 *   - null    -> render nothing (non-fiscal branch)
 *   - PENDING -> Fiscalize
 *   - FAILED  -> reason (155/156 = device-needs-sync, visually distinct) + Retry
 *   - OK      -> Reprint (re-render the stored fiscal block, no device call)
 *
 * Gated on PAYMENT_PROCESS, mirroring the payment column.
 */
export function FiscalControl({ order }: { order: OrderResponse }) {
  const status = order.fiscalStatus ?? null;

  // Nothing to show on a non-fiscal branch. Return before the permission gate so
  // there's no empty card for those orders.
  if (status == null) return null;

  return (
    <Can perform={PERMISSIONS.FISCAL_RECEIPT_PRINT}>
      <FiscalControlInner order={order} />
    </Can>
  );
}

function FiscalControlInner({ order }: { order: OrderResponse }) {
  const t = useTranslations('fiscal');
  const status = order.fiscalStatus;
  const { fiscalize, fiscalizing } = useFiscal(order.id);
  const [showReceipt, setShowReceipt] = useState(false);

  return (
    <div
      data-testid="fiscal-control"
      data-fiscal-status={status ?? ''}
      className="space-y-3 rounded-2xl bg-white p-4 shadow-sm"
    >
      <h2 className="text-lg font-bold text-gray-900">{t('title')}</h2>

      {status === 'PENDING' ? (
        <button
          type="button"
          data-testid="fiscalize"
          onClick={() => fiscalize()}
          disabled={fiscalizing}
          className="h-14 w-full select-none rounded-xl bg-gray-900 text-lg font-bold text-white active:scale-[0.98] disabled:opacity-50"
        >
          {fiscalizing ? t('fiscalizing') : t('fiscalize')}
        </button>
      ) : null}

      {status === 'FAILED' ? (
        <>
          {isDeviceSyncCode(order.fiscalError) ? (
            <div
              data-testid="fiscal-device-sync"
              className="rounded-xl bg-amber-50 p-3 text-amber-800 ring-1 ring-amber-200"
            >
              <p className="text-base font-semibold">{t('deviceSyncTitle')}</p>
              <p className="mt-0.5 text-sm">{t('deviceSyncBody')}</p>
            </div>
          ) : (
            <div
              data-testid="fiscal-fatal"
              className="rounded-xl bg-red-50 p-3 text-red-800 ring-1 ring-red-200"
            >
              <p className="text-base font-semibold">{t('fatalTitle')}</p>
              <p className="mt-0.5 text-sm">{t('fatalBody', { code: order.fiscalError ?? '—' })}</p>
            </div>
          )}
          <button
            type="button"
            data-testid="fiscal-retry"
            onClick={() => fiscalize()}
            disabled={fiscalizing}
            className="h-14 w-full select-none rounded-xl bg-gray-900 text-lg font-bold text-white active:scale-[0.98] disabled:opacity-50"
          >
            {fiscalizing ? t('fiscalizing') : t('retry')}
          </button>
        </>
      ) : null}

      {status === 'OK' ? (
        <button
          type="button"
          data-testid="fiscal-reprint"
          onClick={() => setShowReceipt(true)}
          className="h-14 w-full select-none rounded-xl bg-white text-lg font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200 active:scale-[0.98]"
        >
          {t('reprint')}
        </button>
      ) : null}

      {showReceipt ? (
        <FiscalReceiptModal orderId={order.id} onDone={() => setShowReceipt(false)} />
      ) : null}
    </div>
  );
}
