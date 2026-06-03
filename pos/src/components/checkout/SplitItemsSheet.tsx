'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import type { OrderResponse } from '@/api/generated/model';
import { useMoney } from '@/lib/useMoney';
import { visibleItems } from '@/lib/orders';

interface SplitItemsSheetProps {
  order: OrderResponse;
  splitting?: boolean;
  /** Moves the selected items to a new linked check; resolves with it (or null). */
  onMove: (itemIds: string[]) => Promise<OrderResponse | null>;
  onClose: () => void;
}

/** Select line items and move them to a new linked check (ORDER_EDIT). */
export function SplitItemsSheet({ order, splitting, onMove, onClose }: SplitItemsSheetProps) {
  const t = useTranslations('pay');
  const tc = useTranslations('common');
  const router = useRouter();
  const { format } = useMoney();

  const items = visibleItems(order);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newCheck, setNewCheck] = useState<OrderResponse | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function move() {
    if (selected.size === 0) return;
    const created = await onMove([...selected]);
    if (created) setNewCheck(created);
  }

  // After a successful split, offer to open the new check or stay.
  if (newCheck) {
    return (
      <Overlay onClose={onClose}>
        <h2 className="text-2xl font-bold text-gray-900">{t('splitDoneTitle')}</h2>
        <p className="mt-2 text-base text-gray-600">
          {t('newCheckCreated', { number: newCheck.orderNumber })}
        </p>
        <p className="mt-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t('bothChecksNote')}
        </p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-14 flex-1 select-none rounded-xl border border-gray-300 text-lg font-semibold text-gray-700 active:scale-[0.98]"
          >
            {t('stayHere')}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/orders/${newCheck.id}/checkout`)}
            className="h-14 flex-1 select-none rounded-xl bg-gray-900 text-lg font-bold text-white active:scale-[0.98]"
          >
            {t('openNewCheck')}
          </button>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay onClose={onClose}>
      <h2 className="text-2xl font-bold text-gray-900">{t('splitItems')}</h2>
      <p className="mt-1 text-sm text-gray-500">{t('splitItemsHint')}</p>

      <div className="mt-4 max-h-[50vh] space-y-2 overflow-y-auto">
        {items.map((item) => {
          const checked = selected.has(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggle(item.id)}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left active:scale-[0.99] ${
                checked ? 'border-gray-900 bg-gray-900/5' : 'border-gray-200 bg-white'
              }`}
            >
              <span className="flex items-center gap-3">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-md border-2 ${
                    checked ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300'
                  }`}
                >
                  {checked ? '✓' : ''}
                </span>
                <span className="text-base font-medium text-gray-900">
                  {item.quantity}× {item.nameSnapshot}
                </span>
              </span>
              <span className="text-base font-semibold text-gray-700">
                {format(item.lineTotalAmount)}
              </span>
            </button>
          );
        })}
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
          onClick={move}
          disabled={selected.size === 0 || splitting}
          className="h-14 flex-[2] select-none rounded-xl bg-gray-900 text-lg font-bold text-white active:scale-[0.98] disabled:opacity-50"
        >
          {t('moveToNewCheck')}
        </button>
      </div>
    </Overlay>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
