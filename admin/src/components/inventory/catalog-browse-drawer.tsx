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
import { Modal } from '@/components/ui/modal';
import { isApiError } from '@/lib/api-error';
import { pickName } from '@/lib/inventory/display-name';
import { useCatalogBrowse } from '@/lib/inventory/use-catalog-browse';
import {
  useBulkAdopt,
  useCatalogCategories,
  type BulkAdoptRequest,
  type CatalogBrowseItemWithUnit,
} from '@/lib/inventory/use-catalog-bulk';
import { useInventoryInvalidation, useItemsForSelect } from '@/lib/inventory/use-inventory-data';
import { toast } from '@/stores/toast';

const PAGE_SIZE = 50;

/** What the confirm dialog is about to adopt. */
type PendingBulk = { kind: 'selected'; ids: string[] } | { kind: 'all'; count: number };

/**
 * Tenant catalog browse. Lists ACTIVE platform catalog items (search + catalog
 * category filter) and lets the owner adopt them into the branch inventory:
 * one at a time (modal: unit pre-filled from the catalog, optional category /
 * SKU / alternate units) or in bulk — "Adopt selected" for ticked rows, or
 * "Adopt all" for every item matching the current search + category
 * (CATALOG-BULK-ADOPT-1). Bulk adopt uses each item's catalog unit and skips
 * items already in the branch. Rows already adopted render disabled.
 */
export function CatalogBrowseDrawer({
  categories,
  onClose,
}: {
  categories: InventoryCategoryResponse[];
  onClose: () => void;
}) {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');
  const locale = useLocale();
  const invalidate = useInventoryInvalidation();

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [catalogCategoryId, setCatalogCategoryId] = useState('');
  const [page, setPage] = useState(1);
  const [adopting, setAdopting] = useState<CatalogBrowseItemResponse | null>(null);
  const [justAdopted, setJustAdopted] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCategoryId, setBulkCategoryId] = useState('');
  const [pending, setPending] = useState<PendingBulk | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);
  useEffect(() => setPage(1), [debounced, catalogCategoryId]);

  const params = useMemo<CatalogBrowseControllerListParams>(
    () => ({
      page,
      limit: PAGE_SIZE,
      search: debounced || undefined,
      categoryId: catalogCategoryId || undefined,
    }),
    [page, debounced, catalogCategoryId],
  );
  const { items, pagination, isLoading, isFetching, isError, refetch } = useCatalogBrowse(params);
  const catalogCategories = useCatalogCategories();
  const bulkAdopt = useBulkAdopt();

  // Adopted-set: catalogItemId values already present in the branch inventory.
  const { items: inventoryItems } = useItemsForSelect();
  const adoptedSet = useMemo(() => {
    const s = new Set<string>();
    for (const it of inventoryItems) if (it.catalogItemId) s.add(it.catalogItemId);
    return s;
  }, [inventoryItems]);
  const isAdopted = (id: string) => adoptedSet.has(id) || justAdopted.has(id);

  const rows = items.filter(
    (i) => i.status === CatalogBrowseItemResponseStatus.ACTIVE,
  ) as CatalogBrowseItemWithUnit[];
  const hasNext = pagination?.hasNext ?? rows.length === PAGE_SIZE;
  const totalMatching = pagination?.total;

  const selectableOnPage = rows.filter((r) => !isAdopted(r.id)).map((r) => r.id);
  const allOnPageSelected =
    selectableOnPage.length > 0 && selectableOnPage.every((id) => selected.has(id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const togglePage = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) selectableOnPage.forEach((id) => next.delete(id));
      else selectableOnPage.forEach((id) => next.add(id));
      return next;
    });

  const categoryLabel = (item: CatalogBrowseItemResponse) =>
    item.category ? pickName(item.category.name, locale) : '—';
  const unitLabel = (u?: string) => (u ? t(`unitShort${u}`) : '');

  const runBulk = async () => {
    if (!pending || bulkAdopt.isPending) return;
    const body: BulkAdoptRequest =
      pending.kind === 'selected'
        ? { catalogItemIds: pending.ids }
        : {
            all: true,
            search: debounced || undefined,
            catalogCategoryId: catalogCategoryId || undefined,
          };
    if (bulkCategoryId) body.categoryId = bulkCategoryId;
    try {
      const res = await bulkAdopt.mutateAsync(body);
      toast.success(
        t('bulkAdoptDone', { adopted: res.adopted, skipped: res.skipped + res.unavailable }),
      );
      if (pending.kind === 'selected') {
        setJustAdopted((prev) => {
          const next = new Set(prev);
          pending.ids.forEach((id) => next.add(id));
          return next;
        });
      }
      setSelected(new Set());
      setPending(null);
      await invalidate();
      void refetch();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : tc('error'));
    }
  };

  return (
    <Drawer open title={t('browseTitle')} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className={inputClass}
            placeholder={t('browseSearch')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <select
            className={`${inputClass} sm:max-w-[45%]`}
            value={catalogCategoryId}
            onChange={(e) => setCatalogCategoryId(e.target.value)}
            aria-label={t('browseCategory')}
          >
            <option value="">{t('browseAllCategories')}</option>
            {(catalogCategories.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {pickName(c.name, locale)}
              </option>
            ))}
          </select>
        </div>

        {/* Bulk bar */}
        <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={allOnPageSelected}
                disabled={selectableOnPage.length === 0}
                onChange={togglePage}
              />
              {t('bulkSelectPage')}
            </label>
            <span className="text-xs text-gray-500">
              {t('bulkSelectedCount', { count: selected.size })}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className={`${inputClass} w-auto`}
              value={bulkCategoryId}
              onChange={(e) => setBulkCategoryId(e.target.value)}
              aria-label={t('bulkIntoCategory')}
            >
              <option value="">{t('bulkIntoCategory')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="primary"
              disabled={selected.size === 0 || bulkAdopt.isPending}
              onClick={() => setPending({ kind: 'selected', ids: [...selected] })}
            >
              {t('bulkAdoptSelected', { count: selected.size })}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={rows.length === 0 || bulkAdopt.isPending}
              onClick={() => setPending({ kind: 'all', count: totalMatching ?? rows.length })}
            >
              {typeof totalMatching === 'number'
                ? t('bulkAdoptAllCount', { count: totalMatching })
                : t('bulkAdoptAll')}
            </Button>
          </div>
        </div>

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
                <li key={item.id} className="rounded-lg border border-gray-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <label className="flex min-w-0 cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={adopted || selected.has(item.id)}
                        disabled={adopted}
                        onChange={() => toggle(item.id)}
                      />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {pickName(item.name, locale)}
                          </span>
                          {item.baseUnit && (
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">
                              {unitLabel(item.baseUnit)}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-xs text-gray-500">
                          {categoryLabel(item)}
                        </span>
                      </span>
                    </label>
                    <div className="shrink-0">
                      {adopted ? (
                        <Button size="sm" variant="secondary" disabled>
                          {t('inYourInventory')}
                        </Button>
                      ) : (
                        <Button size="sm" variant="primary" onClick={() => setAdopting(item)}>
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
            setSelected((prev) => {
              const next = new Set(prev);
              next.delete(catalogItemId);
              return next;
            });
            setAdopting(null);
          }}
          onStale={() => {
            void refetch();
            setAdopting(null);
          }}
        />
      )}

      {pending && (
        <Modal
          open
          title={t('bulkConfirmTitle')}
          onClose={() => (bulkAdopt.isPending ? undefined : setPending(null))}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setPending(null)}
                disabled={bulkAdopt.isPending}
              >
                {tc('cancel')}
              </Button>
              <Button variant="primary" onClick={runBulk} disabled={bulkAdopt.isPending}>
                {bulkAdopt.isPending ? t('bulkAdopting') : t('adoptSubmit')}
              </Button>
            </>
          }
        >
          <p className="text-sm text-gray-700">
            {pending.kind === 'selected'
              ? t('bulkConfirmSelected', { count: pending.ids.length })
              : t('bulkConfirmAll', { count: pending.count })}
          </p>
          <p className="mt-2 text-xs text-gray-500">{t('bulkConfirmNote')}</p>
        </Modal>
      )}
    </Drawer>
  );
}
