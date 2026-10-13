'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import {
  useItemsControllerAvailability,
  useItemsControllerRemove,
  useItemsControllerStatus,
} from '@/api/generated/menu-items/menu-items';
import {
  MenuItemResponseAvailability,
  MenuItemResponseStatus,
  SetItemAvailabilityDtoAvailability,
  SetItemStatusDtoStatus,
  type ItemsControllerListParams,
  type ItemsControllerListAvailability,
  type ItemsControllerListStatus,
  type MenuItemResponse,
} from '@/api/generated/model';
import { Can } from '@/components/auth/can';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/ui/form';
import { useConfirm } from '@/components/ui/use-confirm';
import { getErrorMessage } from '@/lib/api-error';
import { useMenuInvalidation } from '@/lib/menu/use-menu-invalidation';
import { usePaginatedItems } from '@/lib/menu/use-paginated-items';
import { formatMoney } from '@/lib/money';
import { PERMISSIONS } from '@/lib/permissions';
import { useRestaurant } from '@/lib/restaurant/use-restaurant';
import { toast } from '@/stores/toast';

const PAGE_SIZE = 20;

export function ItemsList({
  categoryId,
  onEditItem,
}: {
  categoryId: string;
  onEditItem: (item: MenuItemResponse | null) => void;
}) {
  const t = useTranslations('menu');
  const tc = useTranslations('common');
  const { data: restaurant } = useRestaurant();
  const currency = restaurant?.currency ?? 'USD';
  const { invalidateItems, invalidateItem, invalidateMenuTree } = useMenuInvalidation();
  const { ask, dialog } = useConfirm();

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState<ItemsControllerListStatus | ''>('');
  const [availability, setAvailability] = useState<ItemsControllerListAvailability | ''>('');
  const [page, setPage] = useState(1);

  // Debounce the search box and reset to page 1 on any filter change.
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);
  useEffect(() => setPage(1), [categoryId, debounced, status, availability]);

  const params = useMemo<ItemsControllerListParams>(
    () => ({
      categoryId,
      page,
      limit: PAGE_SIZE,
      q: debounced || undefined,
      status: status || undefined,
      availability: availability || undefined,
    }),
    [categoryId, page, debounced, status, availability],
  );

  const { items, pagination, isLoading, isFetching } = usePaginatedItems(params, !!categoryId);

  const setItemAvailability = useItemsControllerAvailability();
  const setItemStatus = useItemsControllerStatus();
  const remove = useItemsControllerRemove();

  const refresh = (id?: string) =>
    Promise.all([invalidateItems(), invalidateMenuTree(), id ? invalidateItem(id) : null]);

  const toggleAvailability = async (item: MenuItemResponse) => {
    const nextAvailability =
      item.availability === MenuItemResponseAvailability.AVAILABLE
        ? SetItemAvailabilityDtoAvailability.UNAVAILABLE
        : SetItemAvailabilityDtoAvailability.AVAILABLE;
    try {
      await setItemAvailability.mutateAsync({
        id: item.id,
        data: { availability: nextAvailability },
      });
      await refresh(item.id);
      toast.success(t('toast.availabilityUpdated'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const toggleStatus = async (item: MenuItemResponse) => {
    const nextStatus =
      item.status === MenuItemResponseStatus.ACTIVE
        ? SetItemStatusDtoStatus.INACTIVE
        : SetItemStatusDtoStatus.ACTIVE;
    try {
      await setItemStatus.mutateAsync({ id: item.id, data: { status: nextStatus } });
      await refresh(item.id);
      toast.success(t('toast.statusUpdated'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const onDelete = async (item: MenuItemResponse) => {
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
      await refresh();
      toast.success(t('toast.itemDeleted'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const hasNext = pagination?.hasNext ?? items.length === PAGE_SIZE;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-4 py-3">
        <input
          className={`${inputClass} max-w-xs`}
          placeholder={t('search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={`${inputClass} w-auto`}
          value={status}
          onChange={(e) => setStatus(e.target.value as ItemsControllerListStatus | '')}
          aria-label={t('filterStatus')}
        >
          <option value="">{t('filterStatus')}: {tc('all')}</option>
          <option value={MenuItemResponseStatus.ACTIVE}>{t('active')}</option>
          <option value={MenuItemResponseStatus.INACTIVE}>{t('inactive')}</option>
        </select>
        <select
          className={`${inputClass} w-auto`}
          value={availability}
          onChange={(e) =>
            setAvailability(e.target.value as ItemsControllerListAvailability | '')
          }
          aria-label={t('filterAvailability')}
        >
          <option value="">{t('filterAvailability')}: {tc('all')}</option>
          <option value={MenuItemResponseAvailability.AVAILABLE}>{t('available')}</option>
          <option value={MenuItemResponseAvailability.UNAVAILABLE}>{t('unavailable')}</option>
        </select>
        <div className="ml-auto">
          <Can permission={PERMISSIONS.MENU_MANAGE}>
            <Button variant="primary" onClick={() => onEditItem(null)}>
              + {t('addItem')}
            </Button>
          </Can>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-md bg-gray-100" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">{t('noItems')}</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-3 font-medium">{t('itemName')}</th>
                <th className="py-2 pr-3 font-medium">{t('price')}</th>
                <th className="py-2 pr-3 font-medium">{t('prepStation')}</th>
                <th className="py-2 pr-3 font-medium">{t('status')}</th>
                <th className="py-2 pr-3 font-medium">{t('availability')}</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="py-2 pr-3 font-medium text-gray-800">{item.name}</td>
                  <td className="py-2 pr-3 tabular-nums text-gray-700">
                    {formatMoney(item.priceAmount, currency)}
                  </td>
                  <td className="py-2 pr-3 text-gray-600">
                    {t(`station.${item.preparationStation}`)}
                  </td>
                  <td className="py-2 pr-3">
                    {item.status === MenuItemResponseStatus.ACTIVE ? (
                      <Badge tone="green">{t('active')}</Badge>
                    ) : (
                      <Badge tone="gray">{t('inactive')}</Badge>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    {item.availability === MenuItemResponseAvailability.AVAILABLE ? (
                      <Badge tone="blue">{t('available')}</Badge>
                    ) : (
                      <Badge tone="amber">{t('unavailable')}</Badge>
                    )}
                  </td>
                  <td className="py-2">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="secondary" onClick={() => onEditItem(item)}>
                        {tc('edit')}
                      </Button>
                      {/* Stop-list toggle has its own right (iiko F_EM). */}
                      <Can permission={PERMISSIONS.MENU_STOP_LIST}>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleAvailability(item)}
                        >
                          {item.availability === MenuItemResponseAvailability.AVAILABLE
                            ? t('unavailable')
                            : t('available')}
                        </Button>
                      </Can>
                      <Can permission={PERMISSIONS.MENU_MANAGE}>
                        <Button size="sm" variant="ghost" onClick={() => toggleStatus(item)}>
                          {item.status === MenuItemResponseStatus.ACTIVE
                            ? t('deactivate')
                            : t('activate')}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => onDelete(item)}>
                          {tc('delete')}
                        </Button>
                      </Can>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-gray-200 px-4 py-2 text-sm">
        <span className="text-gray-500">
          {t('page', { page })}
          {isFetching ? ' …' : ''}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            {t('prev')}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasNext}
          >
            {t('next')}
          </Button>
        </div>
      </div>

      {dialog}
    </div>
  );
}
