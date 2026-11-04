'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { useInventoryCategoriesControllerRemove } from '@/api/generated/inventory-categories/inventory-categories';
import type { InventoryCategoryResponse } from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/use-confirm';
import { Pagination } from '@/components/inventory/shared';
import { CategoryFormModal } from '@/components/inventory/category-form-modal';
import { getErrorMessage } from '@/lib/api-error';
import { usePermission } from '@/lib/auth/use-permission';
import {
  useCategoriesInvalidation,
  useCategoriesList,
} from '@/lib/inventory/use-inventory-data';
import { PERMISSIONS } from '@/lib/permissions';
import { toast } from '@/stores/toast';

const PAGE_SIZE = 20;

export function CategoriesManager() {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');
  const canManage = usePermission(PERMISSIONS.INVENTORY_ITEM_MANAGE);
  const invalidate = useCategoriesInvalidation();
  const { ask, dialog } = useConfirm();

  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryCategoryResponse | null>(null);

  const params = useMemo(() => ({ page, limit: PAGE_SIZE }), [page]);
  const { categories, pagination, isLoading, isFetching, isError } = useCategoriesList(params);
  const hasNext = pagination?.hasNext ?? categories.length === PAGE_SIZE;

  const remove = useInventoryCategoriesControllerRemove();

  const onDelete = async (category: InventoryCategoryResponse) => {
    const ok = await ask({
      title: tc('confirm'),
      message: t('confirmDeleteCategory'),
      confirmLabel: tc('delete'),
      cancelLabel: tc('cancel'),
      danger: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync({ id: category.id });
      toast.success(t('deleted'));
      await invalidate();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{t('categoriesTitle')}</h1>
        {canManage && (
          <Button
            variant="primary"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            + {t('addCategory')}
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-gray-100" />
            ))}
          </div>
        ) : isError ? (
          <p className="py-10 text-center text-sm text-gray-500">{t('loadError')}</p>
        ) : categories.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">{t('noCategories')}</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 font-medium">{t('cName')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id} className="border-b border-gray-100">
                  <td className="px-4 py-2 font-medium text-gray-800">{category.name}</td>
                  <td className="px-4 py-2">
                    {canManage && (
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setEditing(category);
                            setFormOpen(true);
                          }}
                        >
                          {tc('edit')}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => onDelete(category)}>
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
        <CategoryFormModal category={editing} onClose={() => setFormOpen(false)} />
      )}
      {dialog}
    </div>
  );
}
