'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import {
  CatalogBrowseItemResponseStatus,
  type CatalogBrowseControllerListParams,
  type CatalogBrowseItemResponse,
  type InventoryCategoryResponse,
} from '@/api/generated/model';
import { AdoptItemModal } from '@/components/inventory/adopt-item-modal';
import { Pagination } from '@/components/inventory/shared';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { inputClass } from '@/components/ui/form';
import { pickName } from '@/lib/inventory/display-name';
import { useCatalogBrowse } from '@/lib/inventory/use-catalog-browse';
import { useItemsForSelect } from '@/lib/inventory/use-inventory-data';

const PAGE_SIZE = 20;

/**
 * Tenant catalog browse (search-only v1). Lists ACTIVE platform catalog items and
 * lets the owner adopt one into the branch inventory. Rows already adopted in the
 * branch (matched via the inventory list's `catalogItemId`) render disabled.
 *
 * NOTE: no category filter in v1 — tenants can't reach the platform taxonomy route
 * and deriving categories from a paged list is incomplete.
 * TODO(v2): add the catalog-category filter once a tenant-safe facet exists.
 */
export function CatalogBrowseDrawer({
  categories,
  onClose,
}: {
  categories: InventoryCategoryResponse[];
  onClose: () => void;
}) {
  const t = useTranslations('inventory');
  const locale = useLocale();

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [adopting, setAdopting] = useState<CatalogBrowseItemResponse | null>(null);
  const [justAdopted, setJustAdopted] = useState<Set<string>>(new Set());

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);
  useEffect(() => setPage(1), [debounced]);

  const params = useMemo<CatalogBrowseControllerListParams>(
    () => ({ page, limit: PAGE_SIZE, search: debounced || undefined }),
    [page, debounced],
  );
  const { items, pagination, isLoading, isFetching, isError, refetch } = useCatalogBrowse(params);

  // Adopted-set: catalogItemId values already present in the branch inventory.
  const { items: inventoryItems } = useItemsForSelect();
  const adoptedSet = useMemo(() => {
    const s = new Set<string>();
    for (const it of inventoryItems) if (it.catalogItemId) s.add(it.catalogItemId);
    return s;
  }, [inventoryItems]);
  const isAdopted = (id: string) => adoptedSet.has(id) || justAdopted.has(id);

  const rows = items.filter((i) => i.status === CatalogBrowseItemResponseStatus.ACTIVE);
  const hasNext = pagination?.hasNext ?? rows.length === PAGE_SIZE;

  const categoryLabel = (item: CatalogBrowseItemResponse) =>
    item.category ? pickName(item.category.name, locale) : '—';

  return (
    <Drawer open title={t('browseTitle')} onClose={onClose}>
      <div className="space-y-4">
        <input
          className={inputClass}
          placeholder={t('browseSearch')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-md bg-gray-100" />
            ))}
          </div>
        ) : isError ? (
          <p className="py-8 text-center text-sm text-gray-500">{t('loadError')}</p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">{t('browseEmpty')}</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((item) => {
              const adopted = isAdopted(item.id);
              return (
                <li
                  key={item.id}
                  className="rounded-lg border border-gray-200 bg-white p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {pickName(item.name, locale)}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500">
                        {categoryLabel(item)}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {adopted ? (
                        <Button size="sm" variant="secondary" disabled>
                          {t('inYourInventory')}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => setAdopting(item)}
                        >
                          {t('adopt')}
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <Pagination
          page={page}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => p + 1)}
          hasNext={hasNext}
          isFetching={isFetching}
        />
      </div>

      {adopting && (
        <AdoptItemModal
          item={adopting}
          categories={categories}
          onClose={() => setAdopting(null)}
          onAdopted={(catalogItemId) => {
            setJustAdopted((prev) => new Set(prev).add(catalogItemId));
            setAdopting(null);
          }}
          onStale={() => {
            void refetch();
            setAdopting(null);
          }}
        />
      )}
    </Drawer>
  );
}
