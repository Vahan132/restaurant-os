'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import type { MenuItemResponse } from '@/api/generated/model';
import { CategoriesPanel } from '@/components/menu/categories-panel';
import { ItemEditorDrawer } from '@/components/menu/item-editor-drawer';
import { ItemsList } from '@/components/menu/items-list';
import { useCategories } from '@/lib/menu/use-categories';
import { useRestaurant } from '@/lib/restaurant/use-restaurant';

export function MenuManager() {
  const t = useTranslations('menu');
  const { data: restaurant } = useRestaurant();
  const currency = restaurant?.currency ?? 'USD';

  const { categories } = useCategories({ includeInactive: true });

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<{
    open: boolean;
    itemId: string | null;
    tab: 'details' | 'recipe';
  }>({
    open: false,
    itemId: null,
    tab: 'details',
  });

  // Auto-select the first category once loaded.
  useEffect(() => {
    if (!selectedCategoryId && categories.length > 0) {
      setSelectedCategoryId(categories[0]!.id);
    }
  }, [categories, selectedCategoryId]);

  // Deep-link support (e.g. from Menu Costing): /menu?itemId=<id>&tab=recipe
  // opens that item's editor directly. Read once on mount, client-side, to
  // avoid needing a Suspense boundary around useSearchParams.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const itemId = sp.get('itemId');
    if (itemId) {
      setDrawer({
        open: true,
        itemId,
        tab: sp.get('tab') === 'recipe' ? 'recipe' : 'details',
      });
    }
  }, []);

  const openEditor = (item: MenuItemResponse | null) =>
    setDrawer({ open: true, itemId: item?.id ?? null, tab: 'details' });
  const closeEditor = () => setDrawer({ open: false, itemId: null, tab: 'details' });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>

      <div className="flex h-[calc(100vh-9rem)] overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="w-72 shrink-0 border-r border-gray-200">
          <CategoriesPanel selectedId={selectedCategoryId} onSelect={setSelectedCategoryId} />
        </div>
        <div className="min-w-0 flex-1">
          {selectedCategoryId ? (
            <ItemsList categoryId={selectedCategoryId} onEditItem={openEditor} />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-sm text-gray-500">
              {t('selectCategory')}
            </div>
          )}
        </div>
      </div>

      {drawer.open && (
        <ItemEditorDrawer
          key={drawer.itemId ?? 'new'}
          itemId={drawer.itemId}
          categoryId={selectedCategoryId}
          categories={categories}
          currency={currency}
          initialTab={drawer.tab}
          onClose={closeEditor}
        />
      )}
    </div>
  );
}
