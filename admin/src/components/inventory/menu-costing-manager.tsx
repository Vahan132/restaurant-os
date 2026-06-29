'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { useItemsControllerList } from '@/api/generated/menu-items/menu-items';
import type { ItemsControllerListParams, MenuItemResponse } from '@/api/generated/model';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/ui/form';
import { Toggle } from '@/components/ui/toggle';
import { Pagination } from '@/components/inventory/shared';
import { useRecipesList } from '@/lib/inventory/use-recipe-data';
import { normalizeList } from '@/lib/normalize-list';
import { formatMoney } from '@/lib/money';
import { useRestaurant } from '@/lib/restaurant/use-restaurant';

const PAGE_SIZE = 20;
/** Rows at/below this margin % are flagged + matched by the low-margin filter. */
const LOW_MARGIN_PCT = 50;

type HasRecipe = 'any' | 'yes' | 'no';

export function MenuCostingManager() {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');
  const { data: restaurant } = useRestaurant();
  const currency = restaurant?.currency ?? 'USD';

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [hasRecipe, setHasRecipe] = useState<HasRecipe>('any');
  const [lowMargin, setLowMargin] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);
  useEffect(() => setPage(1), [debounced, hasRecipe, lowMargin]);

  const params = useMemo<ItemsControllerListParams>(
    () => ({ page, limit: PAGE_SIZE, search: debounced || undefined }),
    [page, debounced],
  );
  const itemsQuery = useItemsControllerList(params);
  const { items, pagination } = useMemo(
    () => normalizeList<MenuItemResponse>(itemsQuery.data),
    [itemsQuery.data],
  );

  // Recipe estimate map (menuItemId -> estimatedUnitCost).
  const { recipes } = useRecipesList({ limit: 100 });
  const costByItem = useMemo(() => {
    const m = new Map<string, number | null>();
    // RecipeListItemResponse no longer carries the cost estimate; track recipe
    // existence here (cost/margin require the full recipe and are shown there).
    for (const r of recipes) m.set(r.menuItemId, null);
    return m;
  }, [recipes]);

  const rows = useMemo(
    () =>
      items.map((item) => {
        const hasRec = costByItem.has(item.id);
        const cost = hasRec ? (costByItem.get(item.id) ?? null) : null;
        const price = item.priceAmount;
        const hasPrice = price > 0;
        const margin = cost != null && hasPrice ? price - cost : null;
        const marginPct = margin != null && price > 0 ? (margin / price) * 100 : null;
        return { item, hasRec, cost, price, hasPrice, margin, marginPct };
      }),
    [items, costByItem],
  );

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (hasRecipe === 'yes' && !r.hasRec) return false;
        if (hasRecipe === 'no' && r.hasRec) return false;
        if (lowMargin && !(r.marginPct != null && r.marginPct < LOW_MARGIN_PCT)) return false;
        return true;
      }),
    [rows, hasRecipe, lowMargin],
  );

  const hasNext = pagination?.hasNext ?? items.length === PAGE_SIZE;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">{t('costingTitle')}</h1>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${inputClass} max-w-xs`}
          placeholder={t('costingSearch')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={`${inputClass} w-auto`}
          value={hasRecipe}
          onChange={(e) => setHasRecipe(e.target.value as HasRecipe)}
        >
          <option value="any">
            {t('filterHasRecipe')}: {t('hasRecipeAny')}
          </option>
          <option value="yes">
            {t('filterHasRecipe')}: {tc('yes')}
          </option>
          <option value="no">
            {t('filterHasRecipe')}: {tc('no')}
          </option>
        </select>
        <div className="w-44">
          <Toggle label={t('filterLowMargin')} checked={lowMargin} onChange={setLowMargin} />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {itemsQuery.isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-gray-100" />
            ))}
          </div>
        ) : itemsQuery.isError ? (
          <p className="py-10 text-center text-sm text-gray-500">{t('loadError')}</p>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">{t('noCostingRows')}</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 font-medium">{t('colDish')}</th>
                <th className="px-4 py-2 font-medium">{t('colEstCost')}</th>
                <th className="px-4 py-2 font-medium">{t('colSellPrice')}</th>
                <th className="px-4 py-2 font-medium">{t('colMargin')}</th>
                <th className="px-4 py-2 font-medium">{t('colFlags')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.item.id} className="border-b border-gray-100">
                  <td className="px-4 py-2 font-medium text-gray-800">{r.item.name}</td>
                  <td className="px-4 py-2 text-gray-700">
                    {r.cost != null ? formatMoney(r.cost, currency) : '—'}
                  </td>
                  <td className="px-4 py-2 text-gray-700">
                    {r.hasPrice ? formatMoney(r.price, currency) : '—'}
                  </td>
                  <td className="px-4 py-2 text-gray-700">
                    {r.margin != null ? (
                      <span className={r.margin < 0 ? 'text-red-600' : ''}>
                        {formatMoney(r.margin, currency)}
                        {r.marginPct != null && (
                          <span className="text-gray-400"> ({r.marginPct.toFixed(1)}%)</span>
                        )}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {!r.hasRec && <Badge tone="amber">{t('noRecipeFlag')}</Badge>}
                      {!r.hasPrice && <Badge tone="red">{t('noPriceFlag')}</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link href={`/menu?itemId=${r.item.id}&tab=recipe`}>
                      <Button size="sm" variant="secondary">
                        {t('openEditor')}
                      </Button>
                    </Link>
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
        isFetching={itemsQuery.isFetching}
      />
    </div>
  );
}
