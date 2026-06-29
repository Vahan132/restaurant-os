'use client';

import { useTranslations } from 'next-intl';

import { Drawer } from '@/components/ui/drawer';
import { formatDate } from '@/components/inventory/shared';
import { useItemsForSelect, useReceipt, useSuppliersList } from '@/lib/inventory/use-inventory-data';
import { formatNumber } from '@/lib/inventory/units';
import { formatMoney } from '@/lib/money';
import { useRestaurant } from '@/lib/restaurant/use-restaurant';

export function ReceiptDetailDrawer({
  receiptId,
  onClose,
}: {
  receiptId: string;
  onClose: () => void;
}) {
  const t = useTranslations('inventory');
  const { data: restaurant } = useRestaurant();
  const currency = restaurant?.currency ?? 'USD';
  const { data: receipt, isLoading } = useReceipt(receiptId);
  const { items } = useItemsForSelect();
  const { suppliers } = useSuppliersList();
  const itemName = (id: string) => items.find((i) => i.id === id)?.name ?? id;
  const supplierName = (id: string | null) =>
    id ? (suppliers.find((s) => s.id === id)?.name ?? '—') : '—';
  const total = receipt ? receipt.lines.reduce((sum, l) => sum + l.lineTotalCost_amount, 0) : 0;

  return (
    <Drawer open title={t('receiptTitle')} onClose={onClose}>
      {isLoading || !receipt ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-9 animate-pulse rounded-md bg-gray-100" />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-gray-500">{t('rSupplier')}</dt>
            <dd className="text-gray-800">{supplierName(receipt.supplierId)}</dd>
            <dt className="text-gray-500">{t('rReference')}</dt>
            <dd className="text-gray-800">{receipt.reference ?? '—'}</dd>
            <dt className="text-gray-500">{t('rReceivedAt')}</dt>
            <dd className="text-gray-800">{formatDate(receipt.receivedAt)}</dd>
            <dt className="text-gray-500">{t('colTotalCost')}</dt>
            <dd className="font-medium text-gray-900">
              {formatMoney(total, currency)}
            </dd>
            {receipt.note && (
              <>
                <dt className="text-gray-500">{t('rNote')}</dt>
                <dd className="text-gray-800">{receipt.note}</dd>
              </>
            )}
          </dl>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-700">{t('rLines')}</h3>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-3 font-medium">{t('rItem')}</th>
                  <th className="py-2 pr-3 font-medium">{t('rQty')}</th>
                  <th className="py-2 pr-3 font-medium">{t('rLineTotal')}</th>
                  <th className="py-2 pr-3 font-medium">{t('layerUnitCost')}</th>
                  <th className="py-2 font-medium">{t('rExpiry')}</th>
                </tr>
              </thead>
              <tbody>
                {receipt.lines.map((line) => (
                  <tr key={line.id} className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-medium text-gray-800">{itemName(line.itemId)}</td>
                    <td className="py-2 pr-3 text-gray-700">
                      {formatNumber(line.enteredQty)} {line.enteredUnit}
                    </td>
                    <td className="py-2 pr-3 text-gray-700">
                      {formatMoney(line.lineTotalCost_amount, currency)}
                    </td>
                    <td className="py-2 pr-3 text-gray-600">
                      {line.baseQty > 0 ? formatMoney(line.lineTotalCost_amount / line.baseQty, currency) : '—'}
                    </td>
                    <td className="py-2 text-gray-600">{formatDate(line.expiryDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Drawer>
  );
}
