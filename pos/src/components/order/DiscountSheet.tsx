'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ApplyDiscountDtoType, OrderResponse } from '@/api/generated/model';
import { useMoney } from '@/lib/useMoney';

interface DiscountSheetProps {
  order: OrderResponse;
  busy?: boolean;
  onApply: (args: { type: ApplyDiscountDtoType; value: number }) => void;
  onRemove: () => void;
  onClose: () => void;
}

/**
 * Discount sheet. PERCENT entered as % → sent as basis points; FIXED entered in
 * major currency units → sent as minor units. Previews the computed discount and
 * new total (backend recomputes authoritatively on apply).
 */
export function DiscountSheet({ order, busy, onApply, onRemove, onClose }: DiscountSheetProps) {
  const t = useTranslations('actions');
  const tc = useTranslations('common');
  const { format, toMinor } = useMoney();

  const [type, setType] = useState<ApplyDiscountDtoType>('PERCENT');
  const [valueStr, setValueStr] = useState('');

  const subtotal = order.totals.subtotalAmount;
  const serviceFee = order.totals.serviceFeeAmount;
  const num = Number(valueStr);
  const validNumber = Number.isFinite(num) && num > 0;

  let sendValue = 0;
  let previewDiscount = 0;
  let valid = false;
  if (type === 'PERCENT') {
    valid = validNumber && num <= 100;
    sendValue = Math.round(num * 100); // % → bps
    previewDiscount = Math.round((subtotal * num) / 100);
  } else {
    const minor = toMinor(num);
    valid = validNumber && minor > 0;
    sendValue = minor;
    previewDiscount = Math.min(minor, subtotal);
  }
  const newTotal = Math.max(0, subtotal - previewDiscount) + serviceFee;

  const hasDiscount = Boolean(order.discountType);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-gray-900">{t('discount')}</h2>

        <div className="mt-4 flex gap-2">
          {(['PERCENT', 'FIXED'] as const).map((tp) => (
            <button
              key={tp}
              type="button"
              onClick={() => setType(tp)}
              aria-pressed={type === tp}
              className={`min-h-tap flex-1 select-none rounded-xl text-base font-semibold active:scale-95 ${
                type === tp ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 ring-1 ring-gray-300'
              }`}
            >
              {tp === 'PERCENT' ? t('typePercent') : t('typeFixed')}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <label htmlFor="disc-value" className="mb-1 block text-base font-semibold text-gray-700">
            {type === 'PERCENT' ? t('percentLabel') : t('amountLabel')}
          </label>
          <input
            id="disc-value"
            type="number"
            inputMode="decimal"
            min={0}
            step={type === 'PERCENT' ? 1 : 'any'}
            value={valueStr}
            onChange={(e) => setValueStr(e.target.value)}
            placeholder={type === 'PERCENT' ? '10' : '0'}
            className="h-14 w-full rounded-xl border border-gray-300 px-4 text-lg outline-none focus:border-gray-900"
          />
        </div>

        <div className="mt-4 space-y-1 rounded-xl bg-gray-50 p-4 text-base">
          <div className="flex justify-between text-gray-600">
            <span>{t('discountPreview')}</span>
            <span className="font-semibold text-green-700">− {format(previewDiscount)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-1 text-gray-900">
            <span className="font-semibold">{t('newTotal')}</span>
            <span className="text-lg font-bold">{format(newTotal)}</span>
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-14 flex-1 select-none rounded-xl border border-gray-300 text-lg font-semibold text-gray-700 active:scale-[0.98]"
          >
            {tc('cancel')}
          </button>
          <button
            type="button"
            onClick={() => onApply({ type, value: sendValue })}
            disabled={!valid || busy}
            className="h-14 flex-[2] select-none rounded-xl bg-gray-900 text-lg font-bold text-white active:scale-[0.98] disabled:opacity-50"
          >
            {t('applyDiscount')}
          </button>
        </div>

        {hasDiscount ? (
          <button
            type="button"
            onClick={onRemove}
            disabled={busy}
            className="mt-3 h-12 w-full select-none rounded-xl border border-red-200 text-base font-semibold text-red-600 active:scale-[0.98] disabled:opacity-50"
          >
            {t('removeDiscount')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
