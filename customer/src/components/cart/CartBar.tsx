'use client';

import { useTranslations } from 'next-intl';

import { formatMoney } from '@/lib/money';

import { useCart } from './CartProvider';

interface Props {
  currency: string;
  locale: string;
  onOpen: () => void;
}

/** Sticky bottom bar showing item count + running total. Hidden when empty. */
export default function CartBar({ currency, locale, onOpen }: Props) {
  const t = useTranslations('cart');
  const { count, subtotal } = useCart();

  if (count === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3">
      <button
        type="button"
        onClick={onOpen}
        className="mx-auto flex w-full max-w-2xl items-center justify-between rounded-2xl bg-brand px-4 py-3.5 text-white shadow-lg"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-white/20 px-1.5 text-xs tabular-nums">
            {count}
          </span>
          {t('viewOrder')}
        </span>
        <span className="text-sm font-semibold tabular-nums">
          {formatMoney(subtotal, currency, locale)}
        </span>
      </button>
    </div>
  );
}
