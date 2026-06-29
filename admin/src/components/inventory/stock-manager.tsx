'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import {
  StockControllerStockKind,
  type StockControllerStockParams,
  type StockRowResponse,
} from '@/api/generated/model';
import { Toggle } from '@/components/ui/toggle';
import { inputClass } from '@/components/ui/form';
import {
  KindBadge,
  LowStockBadge,
  Pagination,
  formatDate,
} from '@/components/inventory/shared';
import { StockDetailDrawer } from '@/components/inventory/stock-detail-drawer';
import { useCategoriesList, usePaginatedStock } from '@/lib/inventory/use-inventory-data';
import { formatBaseQty } from '@/lib/inventory/units';
import { formatMoney } from '@/lib/money';
import { useRestaurant } from '@/lib/restaurant/use-restaurant';

const PAGE_SIZE = 20;

export function StockManager() {
  const t = useTranslations('inventory');
  const { data: restaurant } = useRestaurant();
  const currency = restaurant?.currency ?? 'USD';

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [kind, setKind] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const [expiringBefore, setExpiringBefore] = useState('');
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<StockRowResponse | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);
  useEffect(() => setPage(1), [debounced, categoryId, kind, lowStock, expiringBefore]);

  const { categories } = useCategoriesList();
  const categoryName = useMemo(() => {
    const m = new Map(categories.map((c) => [c.id, c.name]));
    return (id: string | null) => (id ? (m.get(id) ?? '') : '');
  }, [categories]);

  const params = useMemo<StockControllerStockParams>(
    () => ({
      page,
      limit: PAGE_SIZE,
      search: debounced || undefined,
      categoryId: categoryId || undefined,
      kind: (kind as StockControllerStockParams['kind']) || undefined,
      lowStock: lowStock ? 'true' : undefined,
      expiringBefore: expiringBefore || undefined,
    }),
    [page, debounced, categoryId, kind, lowStock, expiringBefore],
  );

  const { rows, pagination, isLoading, isFetching, isError } = usePaginatedStock(params);
  const hasNext = pagination?.hasNext ?? rows.length === PAGE_SIZE;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">{t('stockTitle')}</h1>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${inputClass} max-w-xs`}
          placeholder={t('stockSearch')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={`${inputClass} w-auto`}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">{t('allCategories')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className={`${inputClass} w-auto`}
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="">{t('allKinds')}</option>
          <option value={StockControllerStockKind.RAW}>{t('kindRaw')}</option>
          <option value={StockControllerStockKind.PROCESSED}>{t('kindProcessed')}</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <span>{t('filterExpiringBefore')}</span>
          <input
            type="date"
            className={`${inputClass} w-auto`}
            value={expiringBefore}
            onChange={(e) => setExpiringBefore(e.target.value)}
          />
        </label>
        <div className="w-44">
          <Toggle label={t('filterLowStock')} checked={lowStock} onChange={setLowStock} />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-gray-100" />
            ))}
          </div>
        ) : isError ? (
          <p className="py-10 text-center text-sm text-gray-500">{t('loadError')}</p>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">{t('noStock')}</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 font-medium">{t('colItem')}</th>
                <th className="px-4 py-2 font-medium">{t('colKind')}</th>
                <th className="px-4 py-2 font-medium">{t('colOnHand')}</th>
                <th className="px-4 py-2 font-medium">{t('colValuation')}</th>
                <th className="px-4 py-2 font-medium">{t('colExpiry')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const qty = formatBaseQty(row.onHandBase, row.baseUnit, []);
                return (
                  <tr
                    key={row.itemId}
                    className="cursor-pointer border-b border-gray-100 hover:bg-gray-50"
                    onClick={() => setSelected(row)}
                  >
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">{row.name}</span>
                        {row.lowStock && <LowStockBadge />}
                      </div>
                      {categoryName(row.categoryId) && (
                        <span className="text-xs text-gray-400">{categoryName(row.categoryId)}</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <KindBadge kind={row.kind} />
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      <span>{qty.base}</span>
                      {qty.alt && <span className="ml-1 text-gray-400">({qty.alt})</span>}
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      {formatMoney(row.valuation_amount, currency)}
                    </td>
                    <td className="px-4 py-2 text-gray-600">{formatDate(row.earliestExpiry)}</td>
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

      {selected && (
        <StockDetailDrawer
          itemId={selected.itemId}
          itemName={selected.name}
          baseUnit={selected.baseUnit}
          alternateUnits={[]}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
