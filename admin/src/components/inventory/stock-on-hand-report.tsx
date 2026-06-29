'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import type { StockOnHandRowResponse } from '@/api/generated/model';
import { Badge } from '@/components/ui/badge';
import { LowStockBadge } from '@/components/inventory/shared';
import {
  BranchFilter,
  FilterBar,
  FilterSelect,
  useReportScope,
} from '@/components/inventory/inventory-reports-shared';
import { useCategoriesList, useItemsForSelect } from '@/lib/inventory/use-inventory-data';
import { useLocations } from '@/lib/inventory/use-locations-data';
import { useStockOnHandReport } from '@/lib/inventory/use-inventory-reports';
import { formatBaseQty } from '@/lib/inventory/units';
import { formatMoney } from '@/lib/money';
import { useRestaurant } from '@/lib/restaurant/use-restaurant';

// Generous single fetch so per-location/branch roll-ups reflect the full scope.
const FETCH_LIMIT = 500;

export function StockOnHandReport() {
  const t = useTranslations('inventory');
  const { data: restaurant } = useRestaurant();
  const currency = restaurant?.currency ?? 'USD';
  const { isOwner, activeBranchId, branchName } = useReportScope();

  const [branchId, setBranchId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [itemId, setItemId] = useState('');
  const [lowStock, setLowStock] = useState(false);

  const { categories } = useCategoriesList();
  const { items } = useItemsForSelect();
  const { locations } = useLocations();

  // Location options come from the active branch's shelves, so the location
  // filter is only meaningful while viewing the active branch.
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
      lowStock: lowStock ? ('true' as const) : undefined,
      limit: FETCH_LIMIT,
    }),
    [branchId, locationId, categoryId, itemId, lowStock],
  );
  const { rows, isLoading, isError } = useStockOnHandReport(params);

  // Group rows: branch -> location -> rows, for legible roll-ups.
  const grouped = useMemo(() => {
    const byBranch = new Map<string, Map<string, StockOnHandRowResponse[]>>();
    for (const r of rows) {
      let locs = byBranch.get(r.branchId);
      if (!locs) {
        locs = new Map();
        byBranch.set(r.branchId, locs);
      }
      const arr = locs.get(r.locationId);
      if (arr) arr.push(r);
      else locs.set(r.locationId, [r]);
    }
    return byBranch;
  }, [rows]);

  const grandTotal = useMemo(
    () => rows.reduce((s, r) => s + r.valuation_amount, 0),
    [rows],
  );

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
              {i.name}
            </option>
          ))}
        </FilterSelect>
        <label className="flex items-center gap-2 self-end pb-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={lowStock}
            onChange={(e) => setLowStock(e.target.checked)}
          />
          {t('repLowStockOnly')}
        </label>
        <div className="ml-auto self-end pb-1 text-sm">
          <span className="text-gray-500">{t('repGrandTotal')}: </span>
          <span className="font-semibold text-gray-900">{formatMoney(grandTotal, currency)}</span>
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
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">{t('repNoStock')}</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 font-medium">{t('repItemCol')}</th>
                <th className="px-4 py-2 font-medium">{t('repOnHand')}</th>
                <th className="px-4 py-2 text-right font-medium">{t('repValue')}</th>
              </tr>
            </thead>
            <tbody>
              {[...grouped.entries()].map(([bId, locs]) => {
                const branchTotal = [...locs.values()]
                  .flat()
                  .reduce((s, r) => s + r.valuation_amount, 0);
                return (
                  <BranchGroup
                    key={bId}
                    showBranch={isOwner}
                    branchLabel={branchName(bId)}
                    branchTotal={branchTotal}
                    locs={locs}
                    currency={currency}
                    t={t}
                  />
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function BranchGroup({
  showBranch,
  branchLabel,
  branchTotal,
  locs,
  currency,
  t,
}: {
  showBranch: boolean;
  branchLabel: string;
  branchTotal: number;
  locs: Map<string, StockOnHandRowResponse[]>;
  currency: string;
  t: (k: string) => string;
}) {
  return (
    <>
      {showBranch && (
        <tr className="bg-gray-100/70">
          <td className="px-4 py-2 font-semibold text-gray-800" colSpan={2}>
            {branchLabel}
          </td>
          <td className="px-4 py-2 text-right font-semibold text-gray-900">
            {formatMoney(branchTotal, currency)}
          </td>
        </tr>
      )}
      {[...locs.entries()].map(([locId, items]) => {
        const locTotal = items.reduce((s, r) => s + r.valuation_amount, 0);
        const locName = items[0]?.locationName ?? locId;
        return (
          <LocationGroup
            key={locId}
            locName={locName}
            locTotal={locTotal}
            items={items}
            currency={currency}
            t={t}
          />
        );
      })}
    </>
  );
}

function LocationGroup({
  locName,
  locTotal,
  items,
  currency,
  t,
}: {
  locName: string;
  locTotal: number;
  items: StockOnHandRowResponse[];
  currency: string;
  t: (k: string) => string;
}) {
  return (
    <>
      <tr className="border-t border-gray-200 bg-gray-50">
        <td className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
          {locName}
        </td>
        <td className="px-4 py-1.5" />
        <td className="px-4 py-1.5 text-right text-xs font-medium text-gray-600">
          {t('repSubtotal')}: {formatMoney(locTotal, currency)}
        </td>
      </tr>
      {items.map((r) => {
        const qty = formatBaseQty(r.quantity, r.baseUnit, []);
        return (
          <tr key={`${r.itemId}-${r.locationId}`} className="border-b border-gray-100">
            <td className="px-4 py-2 pl-6 text-gray-800">
              {r.itemName}
              {r.lowStock && (
                <span className="ml-2">
                  <LowStockBadge />
                </span>
              )}
              {r.quantity < 0 && (
                <span className="ml-2">
                  <Badge tone="red">{t('repNegative')}</Badge>
                </span>
              )}
            </td>
            <td className={`px-4 py-2 ${r.quantity < 0 ? 'text-red-600' : 'text-gray-700'}`}>
              {qty.base}
            </td>
            <td className="px-4 py-2 text-right text-gray-700">
              {formatMoney(r.valuation_amount, currency)}
            </td>
          </tr>
        );
      })}
    </>
  );
}
