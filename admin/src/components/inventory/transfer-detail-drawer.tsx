'use client';

import { useTranslations } from 'next-intl';

import type { TransferResponse } from '@/api/generated/model';
import { Drawer } from '@/components/ui/drawer';
import { formatDateTime } from '@/components/inventory/shared';
import { formatNumber } from '@/lib/inventory/units';
import { formatMoney } from '@/lib/money';

/** Read-only transfer detail: header + the cost layers that moved (moved slice). */
export function TransferDetailDrawer({
  transfer,
  itemName,
  locationName,
  currency,
  onClose,
}: {
  transfer: TransferResponse;
  itemName: string;
  locationName: (id: string) => string;
  currency: string;
  onClose: () => void;
}) {
  const t = useTranslations('inventory');

  return (
    <Drawer open title={t('transferDetailTitle')} onClose={onClose}>
      <div className="space-y-5">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-gray-500">{t('trItem')}</dt>
          <dd className="font-medium text-gray-800">{itemName}</dd>
          <dt className="text-gray-500">{t('trFrom')}</dt>
          <dd className="text-gray-800">{locationName(transfer.fromLocationId)}</dd>
          <dt className="text-gray-500">{t('trTo')}</dt>
          <dd className="text-gray-800">{locationName(transfer.toLocationId)}</dd>
          <dt className="text-gray-500">{t('trQty')}</dt>
          <dd className="text-gray-800">{formatNumber(transfer.quantity)}</dd>
          <dt className="text-gray-500">{t('movDate')}</dt>
          <dd className="text-gray-800">{formatDateTime(transfer.occurredAt)}</dd>
        </dl>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700">{t('trSlicesTitle')}</h3>
          <p className="text-xs text-gray-500">{t('trSlicesHint')}</p>
          {transfer.slices.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">{t('trNoSlices')}</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-3 py-2 font-medium">{t('trSliceQty')}</th>
                  <th className="px-3 py-2 font-medium">{t('trSliceCost')}</th>
                  <th className="px-3 py-2 font-medium">{t('trSliceLayer')}</th>
                </tr>
              </thead>
              <tbody>
                {transfer.slices.map((slice, i) => (
                  <tr key={slice.destinationLayerId ?? i} className="border-b border-gray-100">
                    <td className="px-3 py-2 text-gray-700">{formatNumber(slice.baseQty)}</td>
                    <td className="px-3 py-2 text-gray-700">
                      {formatMoney(slice.cost_amount, currency)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">
                      {(slice.sourceLayerId ?? '—').slice(0, 8)} →{' '}
                      {slice.destinationLayerId.slice(0, 8)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Drawer>
  );
}
