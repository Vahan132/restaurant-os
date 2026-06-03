'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { useAvailability } from '@/lib/reservations/use-reservations-data';
import { STATUS_STYLE } from '@/lib/tables/status-style';
import type { TableStatus } from '@/lib/tables/transitions';
import { formatTimeInTz, todayInTz, zonedToUtcISO } from '@/lib/tz';

function toIso(local: string, timeZone: string): string | null {
  // local is "YYYY-MM-DDTHH:mm" from a datetime-local input.
  const [ymd, hm] = local.split('T');
  if (!ymd || !hm) return null;
  return zonedToUtcISO(ymd, hm, timeZone);
}

export function AvailabilityPanel({ timezone }: { timezone: string }) {
  const t = useTranslations('reservations');
  const tt = useTranslations('tables');
  const today = todayInTz(timezone);
  const [startLocal, setStartLocal] = useState(`${today}T18:00`);
  const [endLocal, setEndLocal] = useState(`${today}T22:00`);
  const [applied, setApplied] = useState<{ start: string; end: string } | null>(null);

  const windowStart = applied?.start ?? '';
  const windowEnd = applied?.end ?? '';
  const { tables, isLoading } = useAvailability(windowStart, windowEnd, Boolean(applied));

  const canApply = useMemo(() => {
    const s = toIso(startLocal, timezone);
    const e = toIso(endLocal, timezone);
    return s && e && s < e;
  }, [startLocal, endLocal, timezone]);

  const apply = () => {
    const start = toIso(startLocal, timezone);
    const end = toIso(endLocal, timezone);
    if (start && end && start < end) setApplied({ start, end });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t('windowStart')}>
          <input
            type="datetime-local"
            className={`${inputClass} w-auto`}
            value={startLocal}
            onChange={(e) => setStartLocal(e.target.value)}
          />
        </Field>
        <Field label={t('windowEnd')}>
          <input
            type="datetime-local"
            className={`${inputClass} w-auto`}
            value={endLocal}
            onChange={(e) => setEndLocal(e.target.value)}
          />
        </Field>
        <Button variant="primary" onClick={apply} disabled={!canApply}>
          {t('checkAvailability')}
        </Button>
      </div>

      {!applied ? (
        <p className="py-10 text-center text-sm text-gray-500">{t('checkAvailability')}</p>
      ) : isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tables.map((table) => {
            const style = STATUS_STYLE[table.status as TableStatus];
            return (
              <div key={table.tableId} className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-800">{table.name}</span>
                  <span className={`flex items-center gap-1 text-xs ${style.text}`}>
                    <span className={`h-2 w-2 rounded-sm ${style.swatch}`} />
                    {tt(`status.${table.status}`)}
                  </span>
                </div>
                <div className="mt-2 space-y-1">
                  {table.reservations.length === 0 ? (
                    <p className="text-xs text-gray-400">{t('noBookings')}</p>
                  ) : (
                    table.reservations.map((r) => (
                      <div key={r.reservationId} className="flex items-center justify-between text-xs">
                        <span className="text-gray-700">
                          {formatTimeInTz(r.reservedAt, timezone)} · {r.customerName} ({r.guestCount})
                        </span>
                        <Badge tone="gray">{t(`status.${r.status}`)}</Badge>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
