'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { MenuItemDetailResponse } from '@/api/generated/model';
import { useMoney } from '@/lib/useMoney';
import { QtyStepper } from './QtyStepper';
import {
  collectSelectedOptionIds,
  computeUnitPrice,
  groupBounds,
  isSelectionValid,
  toggleOption,
  type ModifierSelection,
} from '@/lib/modifiers';

interface ModifierSheetProps {
  item: MenuItemDetailResponse;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (args: { quantity: number; selectedOptionIds: string[]; note?: string }) => void;
}

/**
 * Modifier picker sheet. Enforces SINGLE (radio) vs MULTIPLE (checkbox) with
 * min/max + required rules, shows per-option price deltas, live-previews the
 * line price, and disables "Add" until every rule is satisfied.
 */
export function ModifierSheet({ item, busy, onCancel, onConfirm }: ModifierSheetProps) {
  const t = useTranslations('builder');
  const tc = useTranslations('common');
  const { format } = useMoney();

  const groups = useMemo(
    () => [...item.modifierGroups].sort((a, b) => a.sortOrder - b.sortOrder),
    [item.modifierGroups],
  );

  const [selection, setSelection] = useState<ModifierSelection>({});
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');

  const valid = isSelectionValid(groups, selection);
  const unitPrice = computeUnitPrice(item, selection);
  const linePrice = unitPrice * quantity;

  function handleConfirm() {
    if (!valid) return;
    onConfirm({
      quantity,
      selectedOptionIds: collectSelectedOptionIds(selection),
      note: note.trim() || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onCancel}>
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-100 p-5">
          <h2 className="text-2xl font-bold text-gray-900">{item.name}</h2>
          <p className="mt-1 text-base text-gray-500">{format(item.priceAmount)}</p>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {groups.map((group) => {
            const selected = selection[group.id] ?? [];
            const { min, max } = groupBounds(group);
            const rule =
              group.effective.selectionType === 'SINGLE'
                ? group.effective.required
                  ? t('chooseOne')
                  : t('optional')
                : max === Number.POSITIVE_INFINITY
                  ? t('chooseUpTo', { max: '∞' })
                  : t('chooseRange', { min, max });
            return (
              <fieldset key={group.id}>
                <legend className="flex w-full items-center justify-between">
                  <span className="text-lg font-semibold text-gray-900">{group.name}</span>
                  <span className="text-sm font-medium text-gray-400">{rule}</span>
                </legend>
                <div className="mt-2 space-y-2">
                  {[...group.options]
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((opt) => {
                      const checked = selected.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setSelection((s) => toggleOption(group, s, opt.id))}
                          className={`flex min-h-tap w-full select-none items-center justify-between rounded-xl border px-4 py-2 text-left active:scale-[0.99] ${
                            checked ? 'border-gray-900 bg-gray-900/5' : 'border-gray-200 bg-white'
                          }`}
                        >
                          <span className="flex items-center gap-3">
                            <span
                              className={`flex h-6 w-6 items-center justify-center border-2 ${
                                group.effective.selectionType === 'SINGLE' ? 'rounded-full' : 'rounded-md'
                              } ${checked ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300'}`}
                            >
                              {checked ? '✓' : ''}
                            </span>
                            <span className="text-base font-medium text-gray-900">{opt.name}</span>
                          </span>
                          {opt.priceDeltaAmount !== 0 ? (
                            <span className="text-sm font-semibold text-gray-500">
                              +{format(opt.priceDeltaAmount)}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                </div>
              </fieldset>
            );
          })}

          <div>
            <label htmlFor="mod-note" className="mb-1 block text-base font-semibold text-gray-700">
              {t('note')}
            </label>
            <input
              id="mod-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('notePlaceholder')}
              className="h-12 w-full rounded-xl border border-gray-300 px-3 text-base outline-none focus:border-gray-900"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold text-gray-700">{t('quantity')}</span>
            <QtyStepper value={quantity} min={1} onChange={setQuantity} />
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-gray-100 p-5">
          <button
            type="button"
            onClick={onCancel}
            className="h-14 flex-1 select-none rounded-xl border border-gray-300 text-lg font-semibold text-gray-700 active:scale-[0.98]"
          >
            {tc('cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!valid || busy}
            className="h-14 flex-[2] select-none rounded-xl bg-gray-900 text-lg font-bold text-white active:scale-[0.98] disabled:opacity-50"
          >
            {t('addForPrice', { price: format(linePrice) })}
          </button>
        </div>
      </div>
    </div>
  );
}
