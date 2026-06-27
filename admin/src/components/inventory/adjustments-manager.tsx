'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import type { StockMovementResponse } from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AdjustmentFormModal } from '@/components/inventory/adjustment-form-modal';
import { Pagination, formatDateTime } from '@/components/inventory/shared';
import { usePermission } from '@/lib/auth/use-permission';
import { usePaginatedAdjustments } from '@/lib/inventory/use-inventory-data';
import { formatNumber } from '@/lib/inventory/units';
import { PERMISSIONS } from '@/lib/permissions';

const PAGE_SIZE = 20;

export function AdjustmentsManager() {
  const t = useTranslations('inventory');
  const canCreate = usePermission(PERMISSIONS.INVENTORY_ADJUSTMENT_CREATE);

  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);

  const params = useMemo(() => ({ page, limit: PAGE_SIZE }), [page]);
  const { movements, pagination, isLoading, isFetching, isError } =
    usePaginatedAdjustments(params);
  const hasNext = pagination?.hasNext ?? movements.length === PAGE_SIZE;

  const directionOf = (mov: StockMovementResponse) =>
    mov.direction ?? (mov.qtyBase < 0 ? 'OUT' : 'IN');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{t('adjustmentsTitle')}</h1>
        {canCreate && (
          <Button variant="primary" onClick={() => setFormOpen(true)}>
            + {t('addAdjustment')}
          </Button>
        )}
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
        ) : movements.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">{t('noAdjustments')}</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 font-medium">{t('movDate')}</th>
                <th className="px-4 py-2 font-medium">{t('colItem')}</th>
                <th className="px-4 py-2 font-medium">{t('colDirection')}</th>
                <th className="px-4 py-2 font-medium">{t('colQty')}</th>
                <th className="px-4 py-2 font-medium">{t('colReasonOnly')}</th>
                <th className="px-4 py-2 font-medium">{t('colNote')}</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((mov) => {
                const dir = directionOf(mov);
                return (
                  <tr key={mov.id} className="border-b border-gray-100">
                    <td className="px-4 py-2 text-gray-600">{formatDateTime(mov.occurredAt)}</td>
                    <td className="px-4 py-2 font-medium text-gray-800">
                      {mov.itemName ?? mov.itemId}
                    </td>
                    <td className="px-4 py-2">
                      <Badge tone={dir === 'OUT' ? 'red' : 'green'}>
                        {dir === 'OUT' ? t('dirOUT') : t('dirIN')}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      {formatNumber(Math.abs(mov.qtyBase))}
                    </td>
                    <td className="px-4 py-2 text-gray-600">{mov.reason ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-600">{mov.note ?? '—'}</td>
                  </tr>
                );
              })}
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

      {formOpen && <AdjustmentFormModal onClose={() => setFormOpen(false)} />}
    </div>
  );
}
