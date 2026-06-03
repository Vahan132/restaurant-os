'use client';

import { useTranslations } from 'next-intl';

import type { TableStatus } from '@/lib/tables/transitions';
import { STATUS_STYLE } from '@/lib/tables/status-style';
import { useAvailability } from '@/lib/reservations/use-reservations-data';

/**
 * Reusable table picker driven by GET /reservations/availability for a given
 * [windowStart, windowEnd) window. Tables that already have an overlapping
 * reservation in the window are flagged (still selectable) and each table's
 * current live status is shown.
 */
export function TableAvailabilityPicker({
  windowStart,
  windowEnd,
  value,
  onChange,
  excludeReservationId,
}: {
  windowStart: string;
  windowEnd: string;
  value: string;
  onChange: (tableId: string) => void;
  excludeReservationId?: string;
}) {
  const t = useTranslations('reservations');
  const tt = useTranslations('tables');
  const enabled = Boolean(windowStart && windowEnd);
  const { tables, isLoading } = useAvailability(windowStart, windowEnd, enabled);

  if (!enabled) {
    return <p className="text-xs text-gray-500">{t('validation.time')}</p>;
  }
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-9 animate-pulse rounded-md bg-gray-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-gray-200 p-2">
      <label className="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-gray-50">
        <input
          type="radio"
          name="table-pick"
          checked={value === ''}
          onChange={() => onChange('')}
        />
        <span className="text-sm text-gray-700">{t('unassigned')}</span>
      </label>
      {tables.map((table) => {
        const overlaps = table.reservations.filter(
          (r) => r.reservationId !== excludeReservationId,
        );
        const style = STATUS_STYLE[table.status as TableStatus];
        return (
          <label
            key={table.tableId}
            className="flex cursor-pointer items-start gap-2 rounded-md p-2 hover:bg-gray-50"
          >
            <input
              type="radio"
              name="table-pick"
              className="mt-1"
              checked={value === table.tableId}
              onChange={() => onChange(table.tableId)}
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-800">{table.name}</span>
                <span className={`flex items-center gap-1 text-xs ${style.text}`}>
                  <span className={`h-2 w-2 rounded-sm ${style.swatch}`} />
                  {tt(`status.${table.status}`)}
                </span>
              </span>
              {overlaps.length > 0 && (
                <span className="block text-xs text-amber-600">⚠ {t('overlapWarning')}</span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}
