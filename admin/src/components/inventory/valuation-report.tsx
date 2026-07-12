'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import {
  BranchFilter,
  FilterBar,
  FilterSelect,
  useReportScope,
} from '@/components/inventory/inventory-reports-shared';
import { itemDisplayName } from '@/lib/inventory/display-name';
import { useCategoriesList, useItemsForSelect } from '@/lib/inventory/use-inventory-data';
import { useLocations } from '@/lib/inventory/use-locations-data';
import { useValuationReport } from '@/lib/inventory/use-inventory-reports';
import { formatMoney } from '@/lib/money';
import { useRestaurant } from '@/lib/restaurant/use-restaurant';

export function ValuationReport() {
  const t = useTranslations('inventory');
  const locale = useLocale();
  const { data: restaurant } = useRestaurant();
  const currency = restaurant?.currency ?? 'USD';
  const { isOwner, activeBranchId, branchName } = useReportScope();

  const [branchId, setBranchId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [itemId, setItemId] = useState('');

  const { categories } = useCategoriesList();
  const { items } = useItemsForSelect();
  const { locations } = useLocations();

  const locationEnabled = !isOwner || (branchId !== '' && branchId === activeBranchId);
  useEffect(() => {
    if (!locationEnabled && locationId) setLocationId('');
  }, [locationEnabled, locationId]);

  const params = useMemo(
    () => ({
      branchId: branchId || undefined,
      locationId: locationId || undefined,
      categoryId: categoryId || undefined,
      itemId: itemId || undefined,
    }),
    [branchId, locationId, categoryId, itemId],
  );
  const { data: summary, isLoading, isError } = useValuationReport(params);

  const byBranch = summary?.byBranch ?? [];
  const byLocation = summary?.byLocation ?? [];

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
        <FilterSelect label={t('repCategory')} value={categoryId} onChange={setCategoryId}>
          <option value="">{t('allCategories')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label={t('repItem')} value={itemId} onChange={setItemId}>
          <option value="">{t('repAllItems')}</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {itemDisplayName(i, locale)}
            </option>
          ))}
        </FilterSelect>
      </FilterBar>

      {/* Aggregate total */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="text-xs uppercase tracking-wide text-gray-500">
          {isOwner && !branchId ? t('repTotalAllBranches') : t('repTotalValuation')}
        </div>
        <div className="mt-1 text-2xl font-semibold text-gray-900">
          {isLoading ? '…' : formatMoney(summary?.totalValuation_amount ?? 0, currency)}
        </div>
      </div>

      {isError ? (
        <p className="py-10 text-center text-sm text-gray-500">{t('loadError')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Per branch (most useful for Owner/all-branches) */}
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <h3 className="border-b border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700">
              {t('repByBranch')}
            </h3>
            {byBranch.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">{t('repNoData')}</p>
            ) : (
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {byBranch.map((b) => (
                    <tr key={b.branchId} className="border-b border-gray-100">
                      <td className="px-4 py-2 text-gray-800">{branchName(b.branchId)}</td>
                      <td className="px-4 py-2 text-right text-gray-700">
                        {formatMoney(b.valuation_amount, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Per location */}
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <h3 className="border-b border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700">
              {t('repByLocation')}
            </h3>
            {byLocation.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">{t('repNoData')}</p>
            ) : (
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {byLocation.map((l) => (
                    <tr key={`${l.branchId}-${l.locationId}`} className="border-b border-gray-100">
                      <td className="px-4 py-2 text-gray-800">
                        {l.locationName ?? l.locationId}
                        {isOwner && (
                          <span className="ml-2">
                            <Badge tone="gray">{branchName(l.branchId)}</Badge>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-700">
                        {formatMoney(l.valuation_amount, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
