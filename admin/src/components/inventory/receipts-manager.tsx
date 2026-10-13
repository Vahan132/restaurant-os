'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import type {
  GoodsReceiptResponse,
  GoodsReceiptsControllerListParams,
} from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/ui/form';
import { Pagination, formatDate } from '@/components/inventory/shared';
import { ReceiptFormDrawer } from '@/components/inventory/receipt-form-drawer';
import { ReceiptDetailDrawer } from '@/components/inventory/receipt-detail-drawer';
import { usePermission } from '@/lib/auth/use-permission';
import {
  usePaginatedReceipts,
  useSuppliersList,
} from '@/lib/inventory/use-inventory-data';
import { formatMoney } from '@/lib/money';
import { useRestaurant } from '@/lib/restaurant/use-restaurant';
import { PERMISSIONS } from '@/lib/permissions';

const PAGE_SIZE = 20;

export function ReceiptsManager() {
  const t = useTranslations('inventory');
  const { data: restaurant } = useRestaurant();
  const currency = restaurant?.currency ?? 'USD';
  const canCreate = usePermission(PERMISSIONS.INVENTORY_RECEIPT_CREATE);

  const [supplierId, setSupplierId] = useState('');
  const [receivedFrom, setReceivedFrom] = useState('');
  const [receivedTo, setReceivedTo] = useState('');
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => setPage(1), [supplierId, receivedFrom, receivedTo]);

  const { suppliers } = useSuppliersList();
  const params = useMemo<GoodsReceiptsControllerListParams>(
    () => ({
      page,
      limit: PAGE_SIZE,
      supplierId: supplierId || undefined,
      receivedFrom: receivedFrom || undefined,
      receivedTo: receivedTo || undefined,
    }),
    [page, supplierId, receivedFrom, receivedTo],
  );
  const { receipts, pagination, isLoading, isFetching, isError } =
    usePaginatedReceipts(params);
  const hasNext = pagination?.hasNext ?? receipts.length === PAGE_SIZE;

  const lineCountOf = (r: GoodsReceiptResponse) => r.lines?.length ?? 0;
  const totalOf = (r: GoodsReceiptResponse) =>
    r.lines?.reduce((sum, l) => sum + l.lineTotalCost_amount, 0) ?? 0;
  const supplierName = (id: string | null) =>
    id ? (suppliers.find((s) => s.id === id)?.name ?? '—') : '—';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{t('receiptsTitle')}</h1>
        {canCreate && (
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            + {t('addReceipt')}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          className={`${inputClass} w-auto`}
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
        >
          <option value="">{t('allSuppliers')}</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <span>{t('receivedFrom')}</span>
          <input
            type="date"
            className={`${inputClass} w-auto`}
            value={receivedFrom}
            onChange={(e) => setReceivedFrom(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <span>{t('receivedTo')}</span>
          <input
            type="date"
            className={`${inputClass} w-auto`}
            value={receivedTo}
            onChange={(e) => setReceivedTo(e.target.value)}
          />
        </label>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-gray-100" />
            ))}
          </div>
        ) : isError ? (
          <p className="py-10 text-center text-sm text-gray-500">{t('loadError')}</p>
        ) : receipts.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">{t('noReceipts')}</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 font-medium">{t('colReceivedAt')}</th>
                <th className="px-4 py-2 font-medium">{t('colSupplier')}</th>
                <th className="px-4 py-2 font-medium">{t('colReference')}</th>
                <th className="px-4 py-2 font-medium">{t('colLineCount')}</th>
                <th className="px-4 py-2 font-medium">{t('colTotalCost')}</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((receipt) => (
                <tr
                  key={receipt.id}
                  className="cursor-pointer border-b border-gray-100 hover:bg-gray-50"
                  onClick={() => setDetailId(receipt.id)}
                >
                  <td className="px-4 py-2 text-gray-700">{formatDate(receipt.receivedAt)}</td>
                  <td className="px-4 py-2 text-gray-700">{supplierName(receipt.supplierId)}</td>
                  <td className="px-4 py-2 text-gray-600">{receipt.reference ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-600">{lineCountOf(receipt)}</td>
                  <td className="px-4 py-2 text-gray-700">
                    {formatMoney(totalOf(receipt), currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Pagination
        page={page}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => p + 1)}
        hasNext={hasNext}
        isFetching={isFetching}
      />

      {createOpen && <ReceiptFormDrawer onClose={() => setCreateOpen(false)} />}
      {detailId && (
        <ReceiptDetailDrawer receiptId={detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  );
}
