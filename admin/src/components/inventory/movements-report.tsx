'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

// Import the runtime enum from its generated source file (not the barrel) so
// values resolve even if the model index is momentarily stale on disk.
import { InventoryReportsControllerGetMovementsType } from '@/api/generated/model/inventoryReportsControllerGetMovementsType';
import type { StockMovementResponse } from '@/api/generated/model';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pagination, formatDateTime } from '@/components/inventory/shared';
import {
  BranchFilter,
  FilterBar,
  FilterDate,
  FilterSelect,
  useReportScope,
} from '@/components/inventory/inventory-reports-shared';
import { useItemsForSelect } from '@/lib/inventory/use-inventory-data';
import { useLocations } from '@/lib/inventory/use-locations-data';
import { useMovementsReport } from '@/lib/inventory/use-inventory-reports';
import { BASE_UNIT_ABBR, formatNumber, type BaseUnit } from '@/lib/inventory/units';
import { formatMoney } from '@/lib/money';
import { useRestaurant } from '@/lib/restaurant/use-restaurant';

const PAGE_SIZE = 25;
const TYPES = Object.values(InventoryReportsControllerGetMovementsType);

/** + in (green) for IN-style types, - out (red) for OUT-style. */
function isOut(type: string): boolean {
  return type.endsWith('_OUT');
}

export function MovementsReport() {
  const t = useTranslations('inventory');
  const { data: restaurant } = useRestaurant();
  const currency = restaurant?.currency ?? 'USD';
  const { isOwner, activeBranchId } = useReportScope();

  const [branchId, setBranchId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [itemId, setItemId] = useState('');
  const [type, setType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const { items } = useItemsForSelect();
  const { locations } = useLocations();
  const itemName = (id: string) => items.find((i) => i.id === id)?.name ?? id;
  const itemUnit = (id: string) => {
    const u = items.find((i) => i.id === id)?.baseUnit;
    return u ? (BASE_UNIT_ABBR[u as BaseUnit] ?? u) : '';
  };
  const locationName = (id: string) => locations.find((l) => l.id === id)?.name ?? id;

  const locationEnabled = !isOwner || (branchId !== '' && branchId === activeBranchId);
  useEffect(() => {
    if (!locationEnabled && locationId) setLocationId('');
  }, [locationEnabled, locationId]);
  useEffect(() => setPage(1), [branchId, locationId, itemId, type, from, to]);

  const params = useMemo(
    () => ({
      branchId: branchId || undefined,
      locationId: locationId || undefined,
      itemId: itemId || undefined,
      type: (type || undefined) as
        | InventoryReportsControllerGetMovementsType
        | undefined,
      from: from || undefined,
      to: to || undefined,
      page,
      limit: PAGE_SIZE,
    }),
    [branchId, locationId, itemId, type, from, to, page],
  );
  const { movements, pagination, isLoading, isFetching, isError } =
    useMovementsReport(params);
  const hasNext = pagination?.hasNext ?? movements.length === PAGE_SIZE;

  const typeLabel = (code: string) =>
    t.has(`movType${code}`) ? t(`movType${code}`) : code;

  const resetFilters = () => {
    setBranchId('');
    setLocationId('');
    setItemId('');
    setType('');
    setFrom('');
    setTo('');
  };

  return (
    <div className="space-y-4">
      <FilterBar>
        {isOwner && <BranchFilter value={branchId} onChange={setBranchId} />}
        <FilterSelect
          label={t('repLocation')}
          value={locationId}
          onChange={setLocationId}
          disabled={!locationEnabled}
        >
          <option value="">{t('repAllLocations')}</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label={t('repItem')} value={itemId} onChange={setItemId}>
          <option value="">{t('repAllItems')}</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label={t('repType')} value={type} onChange={setType}>
          <option value="">{t('repAllTypes')}</option>
          {TYPES.map((code) => (
            <option key={code} value={code}>
              {typeLabel(code)}
            </option>
          ))}
        </FilterSelect>
        <FilterDate label={t('repFrom')} value={from} onChange={setFrom} max={to || undefined} />
        <FilterDate label={t('repTo')} value={to} onChange={setTo} min={from || undefined} />
        <div className="ml-auto self-end pb-1">
          <Button size="sm" variant="ghost" onClick={resetFilters}>
            {t('repReset')}
          </Button>
        </div>
      </FilterBar>

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
          <p className="py-10 text-center text-sm text-gray-500">{t('repNoMovements')}</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 font-medium">{t('movDate')}</th>
                <th className="px-4 py-2 font-medium">{t('repType')}</th>
                <th className="px-4 py-2 font-medium">{t('repItemCol')}</th>
                <th className="px-4 py-2 font-medium">{t('repLocation')}</th>
                <th className="px-4 py-2 font-medium">{t('repQty')}</th>
                <th className="px-4 py-2 font-medium">{t('repValue')}</th>
                <th className="px-4 py-2 font-medium">{t('colReasonOnly')}</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((mov: StockMovementResponse) => {
                const out = isOut(mov.type);
                return (
                  <tr key={mov.id} className="border-b border-gray-100">
                    <td className="px-4 py-2 text-gray-600">{formatDateTime(mov.occurredAt)}</td>
                    <td className="px-4 py-2">
                      <Badge tone={out ? 'red' : 'green'}>{typeLabel(mov.type)}</Badge>
                    </td>
                    <td className="px-4 py-2 font-medium text-gray-800">{itemName(mov.itemId)}</td>
                    <td className="px-4 py-2 text-gray-600">{locationName(mov.locationId)}</td>
                    <td className={`px-4 py-2 ${mov.baseQty < 0 ? 'text-red-600' : 'text-gray-700'}`}>
                      {mov.baseQty > 0 ? '+' : ''}
                      {formatNumber(mov.baseQty)} {itemUnit(mov.itemId)}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {formatMoney(mov.costAmount, currency)}
                    </td>
                    <td className="px-4 py-2 text-gray-500">{mov.reason ?? '—'}</td>
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
    </div>
  );
}
