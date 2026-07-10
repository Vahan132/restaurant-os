'use client';

import { useTranslations } from 'next-intl';
import type { OrderResponse, TableResponse } from '@/api/generated/model';
import { STATUS_TILE } from './statusColors';
import { useMoney } from '@/lib/useMoney';
import { orderItemCount } from '@/lib/orders';

interface TableTileProps {
  table: TableResponse;
  /** Open order currently on this table (for the OCCUPIED summary overlay). */
  order?: OrderResponse;
  busy?: boolean;
  onSelect: (table: TableResponse) => void;
}

/** Large, color-coded touch tile. OCCUPIED tiles overlay an order summary. */
export function TableTile({ table, order, busy, onSelect }: TableTileProps) {
  const t = useTranslations();
  const { format } = useMoney();

  return (
    <button
      type="button"
      // Only block taps while an action is in flight. DISABLED tables stay tappable
      // so the home can surface an info toast.
      disabled={busy}
      onClick={() => onSelect(table)}
      aria-busy={busy}
      className={`relative flex min-h-[124px] select-none flex-col items-center justify-center gap-1 rounded-2xl p-4 text-white shadow-md transition active:scale-95 disabled:opacity-70 ${STATUS_TILE[table.status]}`}
    >
      {order?.fiscalStatus === 'FAILED' ? (
        <span
          data-testid="table-fiscal-error"
          title={t('builder.fiscalError')}
          className="absolute right-2 top-2 h-3 w-3 rounded-full bg-red-500 ring-2 ring-white"
        />
      ) : null}
      <span className="text-2xl font-bold leading-none">{table.name}</span>
      <span className="text-sm font-medium opacity-90">
        {t('home.seats', { count: table.seatCapacity })}
      </span>

      {order ? (
        <span className="mt-1 flex flex-col items-center gap-0.5 rounded-lg bg-black/25 px-2 py-1 text-center">
          <span className="text-sm font-bold leading-none">
            {t('home.orderNo', { number: order.orderNumber })}
          </span>
          <span className="text-xs font-medium opacity-90">
            {t('home.items', { count: orderItemCount(order) })} · {format(order.totals.totalAmount)}
          </span>
        </span>
      ) : (
        <span className="mt-1 rounded-full bg-black/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide">
          {t(`table.status.${table.status}`)}
        </span>
      )}

      {busy ? (
        <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/30">
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-white border-t-transparent" />
        </span>
      ) : null}
    </button>
  );
}
