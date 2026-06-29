'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import type { TransferResponse } from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { Pagination, formatDateTime } from '@/components/inventory/shared';
import { TransferFormModal } from '@/components/inventory/transfer-form-modal';
import { TransferDetailDrawer } from '@/components/inventory/transfer-detail-drawer';
import { usePermission } from '@/lib/auth/use-permission';
import { useItemsForSelect } from '@/lib/inventory/use-inventory-data';
import { useLocations, usePaginatedTransfers } from '@/lib/inventory/use-locations-data';
import { formatNumber } from '@/lib/inventory/units';
import { PERMISSIONS } from '@/lib/permissions';
import { useRestaurant } from '@/lib/restaurant/use-restaurant';

const PAGE_SIZE = 20;

export function TransfersManager() {
  const t = useTranslations('inventory');
  const canCreate = usePermission(PERMISSIONS.INVENTORY_TRANSFER_CREATE);

  const { data: restaurant } = useRestaurant();
  const currency = restaurant?.currency ?? 'USD';
  const { items } = useItemsForSelect();
  const { locations } = useLocations();

  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<TransferResponse | null>(null);

  const params = useMemo(() => ({ page, limit: PAGE_SIZE }), [page]);
  const { transfers, pagination, isLoading, isFetching, isError } =
    usePaginatedTransfers(params);
  const hasNext = pagination?.hasNext ?? transfers.length === PAGE_SIZE;

  const itemName = useMemo(() => {
    const map = new Map(items.map((i) => [i.id, i.name]));
    return (id: string) => map.get(id) ?? id;
  }, [items]);
  const locationName = useMemo(() => {
    const map = new Map(locations.map((l) => [l.id, l.name]));
    return (id: string) => map.get(id) ?? id;
  }, [locations]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{t('transfersTitle')}</h1>
        {canCreate && (
          <Button variant="primary" onClick={() => setFormOpen(true)}>
            + {t('addTransfer')}
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
        ) : transfers.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">{t('noTransfers')}</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 font-medium">{t('movDate')}</th>
                <th className="px-4 py-2 font-medium">{t('trItem')}</th>
                <th className="px-4 py-2 font-medium">{t('trFrom')}</th>
                <th className="px-4 py-2 font-medium">{t('trTo')}</th>
                <th className="px-4 py-2 font-medium">{t('trQty')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {transfers.map((tr) => (
                <tr key={tr.id} className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-600">{formatDateTime(tr.occurredAt)}</td>
                  <td className="px-4 py-2 font-medium text-gray-800">{itemName(tr.itemId)}</td>
                  <td className="px-4 py-2 text-gray-600">{locationName(tr.fromLocationId)}</td>
                  <td className="px-4 py-2 text-gray-600">{locationName(tr.toLocationId)}</td>
                  <td className="px-4 py-2 text-gray-700">{formatNumber(tr.quantity)}</td>
                  <td className="px-4 py-2 text-right">
                    <Button size="sm" variant="secondary" onClick={() => setSelected(tr)}>
                      {t('viewDetail')}
                    </Button>
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

      {formOpen && <TransferFormModal onClose={() => setFormOpen(false)} />}
      {selected && (
        <TransferDetailDrawer
          transfer={selected}
          itemName={itemName(selected.itemId)}
          locationName={locationName}
          currency={currency}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
