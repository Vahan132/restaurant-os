'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import type { PublicMenuItemResponse } from '@/api/generated/model';
import { buildCartLine, unitPrice, type CartLine } from '@/lib/cart';
import { formatDelta, formatMoney } from '@/lib/money';

import ModifierPicker from './cart/ModifierPicker';
import QuantityStepper from './cart/QuantityStepper';
import { useModifierSelection } from './cart/useModifierSelection';
import ItemImage from './ItemImage';

interface Props {
  item: PublicMenuItemResponse | null;
  currency: string;
  locale: string;
  orderingAvailable: boolean;
  onAddToCart: (line: CartLine) => void;
  onClose: () => void;
}

export default function ItemDetailSheet({ item, ...rest }: Props) {
  if (!item) return null;
  return <SheetInner item={item} {...rest} />;
}

function SheetInner({
  item,
  currency,
  locale,
  orderingAvailable,
  onAddToCart,
  onClose,
}: Props & { item: PublicMenuItemResponse }) {
  const t = useTranslations();
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const { selections, toggle, isSelected, allValid, selectedModifiers } = useModifierSelection(
    item.modifierGroups,
  );

  const canOrder = orderingAvailable && item.available;
  const livePrice = unitPrice(item.priceAmount, selectedModifiers) * quantity;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  function handleAdd() {
    if (!canOrder || !allValid) return;
    onAddToCart(buildCartLine(item, selectedModifiers, quantity, note));
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={item.name}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-t-2xl bg-white shadow-xl animate-[slideUp_.2s_ease-out]">
        <div className="sticky top-0 flex justify-center rounded-t-2xl bg-white pt-3">
          <span className="h-1.5 w-10 rounded-full bg-gray-300" />
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="absolute right-3 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto">
          <ItemImage src={item.imageUrl} alt={item.name} eager className="mt-2 h-56 w-full object-cover" />

          <div className="px-4 pb-4 pt-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900">{item.name}</h2>
              <span className="shrink-0 text-base font-semibold text-gray-900">
                {formatMoney(item.priceAmount, currency, locale)}
              </span>
            </div>
            {!item.available ? (
              <span className="mt-2 inline-block rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-600">
                {t('menu.unavailableBadge')}
              </span>
            ) : null}
            {item.description ? (
              <p className="mt-3 text-sm leading-relaxed text-gray-600">{item.description}</p>
            ) : null}

            {item.modifierGroups.length > 0 ? (
              <div className="mt-5">
                {canOrder ? (
                  <ModifierPicker
                    groups={item.modifierGroups}
                    selections={selections}
                    isSelected={isSelected}
                    onToggle={toggle}
                    currency={currency}
                    locale={locale}
                  />
                ) : (
                  <ReadOnlyModifiers item={item} currency={currency} locale={locale} />
                )}
              </div>
            ) : null}

            {canOrder ? (
              <div className="mt-5">
                <label htmlFor="item-note" className="mb-1 block text-sm font-semibold text-gray-900">
                  {t('item.noteLabel')}
                </label>
                <textarea
                  id="item-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder={t('item.notePlaceholder')}
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-accent focus:outline-none"
                />
              </div>
            ) : null}
          </div>
        </div>

        {canOrder ? (
          <div className="flex items-center gap-3 border-t border-gray-100 px-4 py-3">
            <QuantityStepper value={quantity} onChange={setQuantity} ariaLabel={t('item.quantity')} />
            <button
              type="button"
              onClick={handleAdd}
              disabled={!allValid}
              className="flex flex-1 items-center justify-between gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
            >
              <span>{t('item.addToOrder')}</span>
              <span className="tabular-nums">{formatMoney(livePrice, currency, locale)}</span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ReadOnlyModifiers({
  item,
  currency,
  locale,
}: {
  item: PublicMenuItemResponse;
  currency: string;
  locale: string;
}) {
  const t = useTranslations('item');
  return (
    <div className="space-y-5">
      {item.modifierGroups.map((group) => (
        <section key={group.id}>
          <div className="flex items-baseline gap-2">
            <h3 className="text-sm font-semibold text-gray-900">{group.name}</h3>
            <span className="text-[11px] text-gray-400">
              {group.required ? `${t('required')} · ` : ''}
              {group.selectionType === 'SINGLE' ? t('pickOne') : t('pickMany')}
            </span>
          </div>
          <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-100">
            {group.options.map((opt) => (
              <li key={opt.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="text-gray-700">{opt.name}</span>
                {opt.priceDeltaAmount !== 0 ? (
                  <span className="text-xs font-medium text-gray-500">
                    {formatDelta(opt.priceDeltaAmount, currency, locale)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
