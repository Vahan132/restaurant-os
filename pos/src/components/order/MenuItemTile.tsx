'use client';

import type { MenuItemDetailResponse } from '@/api/generated/model';
import { useMoney } from '@/lib/useMoney';

interface MenuItemTileProps {
  item: MenuItemDetailResponse;
  disabled?: boolean;
  onSelect: (item: MenuItemDetailResponse) => void;
}

/** Large touch tile for a menu item. Unavailable items render greyed + non-tappable. */
export function MenuItemTile({ item, disabled, onSelect }: MenuItemTileProps) {
  const { format } = useMoney();
  const unavailable = item.availability === 'UNAVAILABLE';
  const isDisabled = disabled || unavailable;

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={() => onSelect(item)}
      className={`flex min-h-[96px] select-none flex-col justify-between rounded-2xl border p-3 text-left shadow-sm transition active:scale-95 ${
        isDisabled
          ? 'border-gray-200 bg-gray-100 text-gray-400'
          : 'border-gray-200 bg-white text-gray-900 hover:border-gray-300'
      }`}
    >
      <span className="text-base font-semibold leading-tight">{item.name}</span>
      <span className="mt-2 flex items-center justify-between">
        <span className="text-base font-bold">{format(item.priceAmount)}</span>
        {item.modifierGroups.length > 0 && !unavailable ? (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
            +
          </span>
        ) : null}
      </span>
    </button>
  );
}
