'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  useCategoriesControllerRemove,
  useCategoriesControllerReorderCategories,
  useCategoriesControllerStatus,
} from '@/api/generated/menu-categories/menu-categories';
import { CategoryResponseStatus, type CategoryResponse } from '@/api/generated/model';
import { Can } from '@/components/auth/can';
import { CategoryFormModal } from '@/components/menu/category-form-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/use-confirm';
import { getErrorMessage } from '@/lib/api-error';
import { useCategories } from '@/lib/menu/use-categories';
import { useMenuInvalidation } from '@/lib/menu/use-menu-invalidation';
import { PERMISSIONS } from '@/lib/permissions';
import { toast } from '@/stores/toast';

export function CategoriesPanel({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations('menu');
  const tc = useTranslations('common');
  const { invalidateCategories, invalidateMenuTree } = useMenuInvalidation();
  const { ask, dialog } = useConfirm();

  const { categories, isLoading } = useCategories({ includeInactive: true });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryResponse | null>(null);

  const reorder = useCategoriesControllerReorderCategories();
  const setStatus = useCategoriesControllerStatus();
  const remove = useCategoriesControllerRemove();

  const refresh = () => Promise.all([invalidateCategories(), invalidateMenuTree()]);

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= categories.length) return;
    const next = [...categories];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(target, 0, moved);
    try {
      await reorder.mutateAsync({
        data: { order: next.map((c, idx) => ({ id: c.id, displayOrder: idx })) },
      });
      await invalidateCategories();
      toast.success(t('reorderSaved'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const toggleStatus = async (c: CategoryResponse) => {
    const status =
      c.status === CategoryResponseStatus.ACTIVE
        ? CategoryResponseStatus.INACTIVE
        : CategoryResponseStatus.ACTIVE;
    try {
      await setStatus.mutateAsync({ id: c.id, data: { status } });
      await refresh();
      toast.success(t('toast.statusUpdated'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const onDelete = async (c: CategoryResponse) => {
    const ok = await ask({
      title: tc('confirm'),
      message: t('confirmDeleteCategory'),
      confirmLabel: tc('delete'),
      cancelLabel: tc('cancel'),
      danger: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync({ id: c.id });
      await refresh();
      toast.success(t('toast.categoryDeleted'));
    } catch (err) {
      // Backend rejects deleting a category that still has items.
      toast.error(getErrorMessage(err, t('categoryHasItems')));
    }
  };

  const nextDisplayOrder =
    categories.length > 0 ? Math.max(...categories.map((c) => c.displayOrder)) + 1 : 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">{t('categories')}</h2>
        <Can permission={PERMISSIONS.MENU_MANAGE}>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            + {t('addCategory')}
          </Button>
        </Can>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <ul className="space-y-2 p-2">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="h-9 animate-pulse rounded-md bg-gray-100" />
            ))}
          </ul>
        ) : categories.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">{t('noCategories')}</p>
        ) : (
          <ul className="space-y-1">
            {categories.map((c, index) => {
              const inactive = c.status === CategoryResponseStatus.INACTIVE;
              const active = c.id === selectedId;
              return (
                <li
                  key={c.id}
                  className={`group rounded-md border px-2 py-1.5 ${
                    active ? 'border-brand bg-brand/5' : 'border-transparent hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSelect(c.id)}
                      className={`flex-1 truncate text-left text-sm ${
                        inactive ? 'text-gray-400' : 'text-gray-800'
                      }`}
                    >
                      {c.name}
                    </button>
                    {inactive && <Badge tone="gray">{t('inactive')}</Badge>}
                  </div>

                  <Can permission={PERMISSIONS.MENU_MANAGE}>
                    <div className="mt-1 flex flex-wrap items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => move(index, -1)}
                        disabled={index === 0 || reorder.isPending}
                        aria-label={t('moveUp')}
                      >
                        ↑
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => move(index, 1)}
                        disabled={index === categories.length - 1 || reorder.isPending}
                        aria-label={t('moveDown')}
                      >
                        ↓
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(c);
                          setFormOpen(true);
                        }}
                      >
                        {tc('edit')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleStatus(c)}>
                        {inactive ? t('activate') : t('deactivate')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onDelete(c)}>
                        {tc('delete')}
                      </Button>
                    </div>
                  </Can>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {formOpen && (
        <CategoryFormModal
          open={formOpen}
          category={editing}
          nextDisplayOrder={nextDisplayOrder}
          onClose={() => setFormOpen(false)}
        />
      )}
      {dialog}
    </div>
  );
}
