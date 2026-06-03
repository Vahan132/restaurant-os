'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useFloorPlan } from '@/lib/useFloorPlan';
import { useActiveOrders } from '@/lib/useActiveOrders';

interface MoveTableSheetProps {
  /** The order's current table (excluded from the list). */
  currentTableId?: string | null;
  busy?: boolean;
  onPick: (tableId: string) => void;
  onClose: () => void;
}

/**
 * Pick a target table to move the order to. Lists AVAILABLE tables only,
 * excluding the current table and any table that already has an open order.
 */
export function MoveTableSheet({ currentTableId, busy, onPick, onClose }: MoveTableSheetProps) {
  const t = useTranslations('actions');
  const tc = useTranslations('common');
  const { data: floors } = useFloorPlan();
  const { ordersByTableId } = useActiveOrders();

  const targets = useMemo(() => {
    return (floors ?? []).map((floor) => ({
      floor,
      tables: floor.tables.filter(
        (tbl) =>
          tbl.id !== currentTableId &&
          tbl.status === 'AVAILABLE' &&
          !ordersByTableId.has(tbl.id),
      ),
    }));
  }, [floors, currentTableId, ordersByTableId]);

  const hasAny = targets.some((g) => g.tables.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <h2 className="text-2xl font-bold text-gray-900">{t('moveTable')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-300 text-xl active:scale-95"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {!hasAny ? (
            <p className="p-4 text-base text-gray-500">{t('noTables')}</p>
          ) : (
            targets.map(({ floor, tables }) =>
              tables.length === 0 ? null : (
                <section key={floor.id}>
                  <h3 className="mb-2 text-base font-semibold text-gray-600">{floor.name}</h3>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-3">
                    {tables.map((tbl) => (
                      <button
                        key={tbl.id}
                        type="button"
                        disabled={busy}
                        onClick={() => onPick(tbl.id)}
                        className="min-h-[72px] select-none rounded-xl border border-gray-200 bg-white p-3 text-lg font-bold text-gray-900 shadow-sm active:scale-95 disabled:opacity-50"
                      >
                        {tbl.name}
                      </button>
                    ))}
                  </div>
                </section>
              ),
            )
          )}
        </div>

        <div className="border-t border-gray-100 p-5">
          <button
            type="button"
            onClick={onClose}
            className="h-14 w-full select-none rounded-xl border border-gray-300 text-lg font-semibold text-gray-700 active:scale-[0.98]"
          >
            {tc('cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
