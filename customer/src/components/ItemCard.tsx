'use client';

import { useTranslations } from 'next-intl';

import { formatMoney } from '@/lib/money';

import ItemImage from './ItemImage';

interface Item {
  id: string;
  name: string;
  description: string | null;
  priceAmount: number;
  imageUrl: string | null;
  available: boolean;
}

interface Props {
  item: Item;
  currency: string;
  locale: string;
  onOpen: (id: string) => void;
}

export default function ItemCard({ item, currency, locale, onOpen }: Props) {
  const t = useTranslations('menu');
  const unavailable = !item.available;

  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      className={
        'flex w-full items-stretch gap-3 rounded-xl border border-gray-100 bg-white p-2.5 text-left transition-shadow hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/40 ' +
        (unavailable ? 'opacity-60' : '')
      }
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-gray-900">{item.name}</h3>
          {unavailable ? (
            <span className="shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-600">
              {t('unavailableBadge')}
            </span>
          ) : null}
        </div>
        {item.description ? (
          <p className="mt-1 line-clamp-2 text-xs text-gray-500">{item.description}</p>
        ) : null}
        <p className="mt-2 text-sm font-semibold text-gray-900">
          {formatMoney(item.priceAmount, currency, locale)}
        </p>
      </div>
      <ItemImage
        src={item.imageUrl}
        alt={item.name}
        className={
          'h-20 w-20 shrink-0 rounded-lg object-cover ' + (unavailable ? 'grayscale' : '')
        }
      />
    </button>
  );
}
