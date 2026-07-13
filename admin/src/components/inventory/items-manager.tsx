'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import { useInventoryItemsControllerRemove } from '@/api/generated/inventory-items/inventory-items';
import {
  InventoryItemResponseKind,
  type InventoryItemResponse,
  type InventoryItemsControllerListParams,
} from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/ui/form';
import { useConfirm } from '@/components/ui/use-confirm';
import { CatalogBrowseDrawer } from '@/components/inventory/catalog-browse-drawer';
import { ConsumptionLocationModal } from '@/components/inventory/consumption-location-modal';
import { ItemFormModal } from '@/components/inventory/item-form-modal';
import { KindBadge, Pagination } from '@/components/inventory/shared';
import { getErrorMessage } from '@/lib/api-error';
import { usePermission } from '@/lib/auth/use-permission';
import { itemDisplayName } from '@/lib/inventory/display-name';
import {
  useCategoriesList,
  useInventoryInvalidation,
  usePaginatedItems,
} from '@/lib/inventory/use-inventory-data';
import { PERMISSIONS } from '@/lib/permissions';
import { BASE_UNIT_ABBR, formatNumber, type BaseUnit } from '@/lib/inventory/units';
import { toast } from '@/stores/toast';

const PAGE_SIZE = 20;

export function ItemsManager() {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');
  const locale = useLocale();
  const canManage = usePermission(PERMISSIONS.INVENTORY_ITEM_MANAGE);
  const invalidate = useInventoryInvalidation();
  const { ask, dialog } = useConfirm();

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [kind, setKind] = useState('');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItemResponse | null>(null);
  const [consumptionItem, setConsumptionItem] = useState<InventoryItemResponse | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);
  useEffect(() => setPage(1), [debounced, categoryId, kind]);

  const { categories } = useCategoriesList();
  const categoryName = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c.name]));
    return (id: string | null) => (id ? (map.get(id) ?? t('uncategorized')) : t('uncategorized'));
  }, [categories, t]);
  const params = useMemo<InventoryItemsControllerListParams>(
    () => ({
      page,
      limit: PAGE_SIZE,
      search: debounced || undefined,
      categoryId: categoryId || undefined,
      kind: (kind as InventoryItemsControllerListParams['kind']) || undefined,
    }),
    [page, debounced, categoryId, kind],
  );
  const { items, pagination, isLoading, isFetching, isError } = usePaginatedItems(params);
  const hasNext = pagination?.hasNext ?? items.length === PAGE_SIZE;

  const remove = useInventoryItemsControllerRemove();

  const onDelete = async (item: InventoryItemResponse) => {
    const ok = await ask({
      title: tc('confirm'),
      message: t('confirmDeleteItem'),
      confirmLabel: tc('delete'),
      cancelLabel: tc('cancel'),
      danger: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync({ id: item.id });
      toast.success(t('deleted'));
      await invalidate(item.id);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (item: InventoryItemResponse) => {
    setEditing(item);
    setFormOpen(true);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">{t('itemsTitle')}</h1>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${inputClass} max-w-xs`}
          placeholder={t('itemsSearch')}
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
          <option value={InventoryItemResponseKind.RAW}>{t('kindRaw')}</option>
          <option value={InventoryItemResponseKind.PROCESSED}>{t('kindProcessed')}</option>
        </select>
        {canManage && (
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" onClick={() => setBrowseOpen(true)}>
              {t('browseCatalog')}
            </Button>
            <Button variant="primary" onClick={openCreate}>
              + {t('addItem')}
            </Button>
          </div>
        )}
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
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">{t('noItems')}</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 font-medium">{t('colName')}</th>
                <th className="px-4 py-2 font-medium">{t('colKind')}</th>
                <th className="px-4 py-2 font-medium">{t('colBaseUnit')}</th>
                <th className="px-4 py-2 font-medium">{t('colCategory')}</th>
                <th className="px-4 py-2 font-medium">{t('colTrackExpiry')}</th>
                <th className="px-4 py-2 font-medium">{t('colThreshold')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="px-4 py-2 font-medium text-gray-800">
                    {itemDisplayName(item, locale)}
                    {item.sku && <span className="ml-2 text-xs text-gray-400">{item.sku}</span>}
                  </td>
                  <td className="px-4 py-2">
                    <KindBadge kind={item.kind} />
                  </td>
                  <td className="px-4 py-2 text-gray-600">
                    {BASE_UNIT_ABBR[item.baseUnit as BaseUnit] ?? item.baseUnit}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{categoryName(item.categoryId)}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {item.trackExpiry ? tc('yes') : tc('no')}
                  </td>
                  <td className="px-4 py-2 text-gray-600">
                    {item.lowStockThresholdBase == null
                      ? '—'
                      : `${formatNumber(item.lowStockThresholdBase)} ${
                          BASE_UNIT_ABBR[item.baseUnit as BaseUnit] ?? item.baseUnit
                        }`}
                  </td>
                  <td className="px-4 py-2">
                    {canManage && (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="secondary" onClick={() => openEdit(item)}>
                          {tc('edit')}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setConsumptionItem(item)}
                          title={t('consumptionLocationTitle')}
                        >
                          {t('consumptionLocationAction')}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => onDelete(item)}>
                          {tc('delete')}
                        </Button>
                      </div>
                    )}
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

      {formOpen && (
        <ItemFormModal
          item={editing}
          categories={categories}
          onClose={() => setFormOpen(false)}
        />
      )}
      {consumptionItem && (
        <ConsumptionLocationModal
          item={consumptionItem}
          onClose={() => setConsumptionItem(null)}
        />
      )}
      {browseOpen && (
        <CatalogBrowseDrawer categories={categories} onClose={() => setBrowseOpen(false)} />
      )}
      {dialog}
    </div>
  );
}
