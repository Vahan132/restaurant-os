'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { MenuItemDetailResponse } from '@/api/generated/model';
import { useMenu } from '@/lib/useMenu';
import { MenuItemTile } from './MenuItemTile';

interface MenuPaneProps {
  /** Disable all tiles (e.g. while the user lacks ORDER_CREATE). */
  disabled?: boolean;
  onPick: (item: MenuItemDetailResponse) => void;
}

/** Left pane: category tabs + search + item tiles. */
export function MenuPane({ disabled, onPick }: MenuPaneProps) {
  const t = useTranslations('builder');
  const tc = useTranslations('common');
  const { data: menu, isLoading, isError, refetch } = useMenu();

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const categories = useMemo(() => menu ?? [], [menu]);
  const activeId = activeCategoryId ?? categories[0]?.id ?? null;
  const query = search.trim().toLowerCase();

  const itemsToShow = useMemo<MenuItemDetailResponse[]>(() => {
    if (query) {
      return categories.flatMap((c) => c.items).filter((i) => i.name.toLowerCase().includes(query));
    }
    return categories.find((c) => c.id === activeId)?.items ?? [];
  }, [categories, activeId, query]);

  if (isLoading) return <p className="p-4 text-lg text-gray-500">{tc('loading')}</p>;
  if (isError) {
    return (
      <div className="flex flex-col items-start gap-3 p-4">
        <p className="text-lg text-red-600">{t('menuLoadError')}</p>
        <button
          onClick={() => refetch()}
          className="min-h-tap rounded-xl bg-gray-900 px-5 font-semibold text-white active:scale-95"
        >
          {tc('retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 p-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchMenu')}
          className="h-12 w-full rounded-xl border border-gray-300 px-4 text-base outline-none focus:border-gray-900"
        />
      </div>

      {!query ? (
        <div className="flex gap-2 overflow-x-auto border-b border-gray-200 p-3">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveCategoryId(c.id)}
              aria-pressed={c.id === activeId}
              className={`min-h-tap shrink-0 select-none rounded-xl px-4 text-base font-semibold active:scale-95 ${
                c.id === activeId ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 ring-1 ring-gray-300'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto p-3">
        {itemsToShow.length === 0 ? (
          <p className="p-4 text-base text-gray-500">{t('noItems')}</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
            {itemsToShow.map((item) => (
              <MenuItemTile key={item.id} item={item} disabled={disabled} onSelect={onPick} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
