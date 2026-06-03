'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { SplitEvenResponse } from '@/api/generated/model';
import { useMoney } from '@/lib/useMoney';

interface SplitEvenControlProps {
  result: SplitEvenResponse | null;
  splitting?: boolean;
  onSplit: (parts: number) => void;
  onClear: () => void;
  /** Prefill the payment amount with a tapped share (minor units). */
  onPickShare: (amountMinor: number) => void;
}

/**
 * Even-split calculator. Stateless guide: computes equal shares (summing exactly
 * to the total) and lets the cashier tap a share to prefill the payment amount.
 */
export function SplitEvenControl({
  result,
  splitting,
  onSplit,
  onClear,
  onPickShare,
}: SplitEvenControlProps) {
  const t = useTranslations('pay');
  const { format } = useMoney();
  const [parts, setParts] = useState(2);

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label htmlFor="split-parts" className="mb-1 block text-base font-semibold text-gray-700">
            {t('splitParts')}
          </label>
          <input
            id="split-parts"
            type="number"
            inputMode="numeric"
            min={2}
            value={parts}
            onChange={(e) => setParts(Math.max(2, Math.floor(Number(e.target.value) || 2)))}
            className="h-14 w-full rounded-xl border border-gray-300 px-4 text-lg outline-none focus:border-gray-900"
          />
        </div>
        <button
          type="button"
          onClick={() => onSplit(parts)}
          disabled={splitting || parts < 2}
          className="h-14 select-none rounded-xl bg-gray-900 px-5 text-base font-bold text-white active:scale-95 disabled:opacity-50"
        >
          {t('splitEven')}
        </button>
      </div>

      {result ? (
        <div className="space-y-2 rounded-xl bg-gray-50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-600">
              {t('shares', { count: result.parts })}
            </span>
            <button type="button" onClick={onClear} className="text-sm font-semibold text-blue-600">
              {t('clear')}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {result.shares.map((share, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onPickShare(share)}
                className="min-h-tap select-none rounded-xl border border-gray-200 bg-white px-2 text-base font-bold text-gray-900 active:scale-95"
              >
                {format(share)}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400">{t('splitHint')}</p>
        </div>
      ) : null}
    </div>
  );
}
