'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import {
  BranchFilter,
  FilterBar,
  FilterSelect,
  useReportScope,
} from '@/components/inventory/inventory-reports-shared';
import { Badge } from '@/components/ui/badge';
import { itemDisplayName } from '@/lib/inventory/display-name';
import { useCategoriesList, useItemsForSelect } from '@/lib/inventory/use-inventory-data';
import { useLocations } from '@/lib/inventory/use-locations-data';
import { useLowStockReport } from '@/lib/inventory/use-inventory-reports';
import { BASE_UNIT_ABBR, formatNumber, type BaseUnit } from '@/lib/inventory/units';

export function LowStockReport() {
  const t = useTranslations('inventory');
  const locale = useLocale();
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
  const { rows, isLoading, isError } = useLowStockReport(params);

  // Most-urgent first (largest shortfall below threshold).
  const sorted = useMemo(() => {
    const shortfall = (r: (typeof rows)[number]) =>
      (r.lowStockThresholdBase ?? 0) - r.quantity;
    return [...rows].sort((a, b) => shortfall(b) - shortfall(a));
  }, [rows]);

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

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-gray-100" />
            ))}
          </div>
        ) : isError ? (
          <p className="py-10 text-center text-sm text-gray-500">{t('loadError')}</p>
        ) : sorted.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">{t('repNoLowStock')}</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 font-medium">{t('repItemCol')}</th>
                {isOwner && <th className="px-4 py-2 font-medium">{t('repBranch')}</th>}
                <th className="px-4 py-2 font-medium">{t('repLocation')}</th>
                <th className="px-4 py-2 font-medium">{t('repOnHand')}</th>
                <th className="px-4 py-2 font-medium">{t('repThreshold')}</th>
                <th className="px-4 py-2 font-medium">{t('repShortfall')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const abbr = BASE_UNIT_ABBR[r.baseUnit as BaseUnit] ?? r.baseUnit;
                const threshold = r.lowStockThresholdBase ?? 0;
                const shortfall = Math.max(0, threshold - r.quantity);
                return (
                  <tr key={`${r.itemId}-${r.locationId}`} className="border-b border-gray-100">
                    <td className="px-4 py-2 font-medium text-gray-800">
                      {itemDisplayName(r, locale)}
                      {r.quantity < 0 && (
                        <span className="ml-2">
                          <Badge tone="red">{t('repNegative')}</Badge>
                        </span>
                      )}
                    </td>
                    {isOwner && (
                      <td className="px-4 py-2 text-gray-600">{branchName(r.branchId)}</td>
                    )}
                    <td className="px-4 py-2 text-gray-600">{r.locationName}</td>
                    <td className={`px-4 py-2 ${r.quantity < 0 ? 'text-red-600' : 'text-gray-700'}`}>
                      {formatNumber(r.quantity)} {abbr}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {formatNumber(threshold)} {abbr}
                    </td>
                    <td className="px-4 py-2 font-medium text-amber-700">
                      {shortfall > 0 ? `${formatNumber(shortfall)} ${abbr}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
