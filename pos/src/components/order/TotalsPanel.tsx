'use client';

import { useTranslations } from 'next-intl';
import type { OrderTotalsResponse } from '@/api/generated/model';
import { useMoney } from '@/lib/useMoney';

/**
 * Totals straight from the backend totals object: subtotal − discount + service
 * fee = total. Service fee shown on its own line. NO tax.
 */
export function TotalsPanel({ totals }: { totals: OrderTotalsResponse }) {
  const t = useTranslations('builder');
  const { format } = useMoney();

  return (
    <dl className="space-y-1.5 text-base">
      <Row label={t('subtotal')} value={format(totals.subtotalAmount)} />
      {totals.discountAmount > 0 ? (
        <Row
          label={t('discount')}
          value={`− ${format(totals.discountAmount)}`}
          className="text-green-700"
        />
      ) : null}
      {totals.serviceFeeAmount > 0 ? (
        <Row label={t('serviceFee')} value={format(totals.serviceFeeAmount)} />
      ) : null}
      <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-2">
        <dt className="text-lg font-bold text-gray-900">{t('total')}</dt>
        <dd className="text-xl font-bold text-gray-900">{format(totals.totalAmount)}</dd>
      </div>
    </dl>
  );
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className={`font-semibold ${className ?? 'text-gray-900'}`}>{value}</dd>
    </div>
  );
}
