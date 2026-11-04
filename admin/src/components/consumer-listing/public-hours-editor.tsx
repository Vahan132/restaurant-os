'use client';

import { useTranslations } from 'next-intl';

import type { OwnerPublicHoursResponse, PublicHoursRowDto } from '@/api/generated/model';
import { inputClass } from '@/components/ui/form';
import { Toggle } from '@/components/ui/toggle';

/** Editable weekly row. dayOfWeek 0=Mon … 6=Sun (matches the backend). */
export interface HoursRow {
  dayOfWeek: number;
  isClosed: boolean;
  opensAt: string;
  closesAt: string;
}

export function defaultPublicHours(): HoursRow[] {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    isClosed: false,
    opensAt: '09:00',
    closesAt: '22:00',
  }));
}

/** Coerce the (loosely-typed) weeklyHours into 7 ordered, editable rows. */
export function parsePublicHours(raw: unknown): HoursRow[] {
  const defaults = defaultPublicHours();
  if (!Array.isArray(raw)) return defaults;
  const byDay = new Map<number, HoursRow>();
  for (const entry of raw as Partial<OwnerPublicHoursResponse>[]) {
    if (typeof entry?.dayOfWeek !== 'number') continue;
    byDay.set(entry.dayOfWeek, {
      dayOfWeek: entry.dayOfWeek,
      isClosed: entry.isClosed ?? false,
      opensAt: entry.opensAt ?? '09:00',
      closesAt: entry.closesAt ?? '22:00',
    });
  }
  return defaults.map((d) => byDay.get(d.dayOfWeek) ?? d);
}

/** Build the API payload rows. Open days carry HH:mm; closed days null them. */
export function toHoursDto(rows: HoursRow[]): PublicHoursRowDto[] {
  return rows.map((r) =>
    r.isClosed
      ? { dayOfWeek: r.dayOfWeek, isClosed: true, opensAt: null, closesAt: null }
      : {
          dayOfWeek: r.dayOfWeek,
          isClosed: false,
          opensAt: r.opensAt,
          closesAt: r.closesAt,
        },
  );
}

/** True when an open day is missing one of its times. */
export function hasInvalidHours(rows: HoursRow[]): boolean {
  return rows.some((r) => !r.isClosed && (!r.opensAt || !r.closesAt));
}

/** A span where close ≤ open is a legitimate cross-midnight shift, not an error. */
function isCrossMidnight(r: HoursRow): boolean {
  return !r.isClosed && !!r.opensAt && !!r.closesAt && r.closesAt <= r.opensAt;
}

export function PublicHoursEditor({
  value,
  onChange,
  disabled,
}: {
  value: HoursRow[];
  onChange: (next: HoursRow[]) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('consumerListing');
  const td = useTranslations('settings.days');

  const update = (dayOfWeek: number, patch: Partial<HoursRow>) =>
    onChange(value.map((row) => (row.dayOfWeek === dayOfWeek ? { ...row, ...patch } : row)));

  const anyCrossMidnight = value.some(isCrossMidnight);

  return (
    <div className="space-y-1">
      {value.map((row) => (
        <div key={row.dayOfWeek} className="flex flex-wrap items-center gap-3 py-1">
          <span className="w-24 shrink-0 text-sm text-gray-700">
            {td(String(row.dayOfWeek))}
          </span>
          <div className="w-24">
            <Toggle
              label={t('hours.closed')}
              checked={row.isClosed}
              disabled={disabled}
              onChange={(isClosed) => update(row.dayOfWeek, { isClosed })}
            />
          </div>
          {!row.isClosed && (
            <div className="flex items-center gap-2">
              <input
                type="time"
                className={`${inputClass} w-auto`}
                value={row.opensAt}
                disabled={disabled}
                onChange={(e) => update(row.dayOfWeek, { opensAt: e.target.value })}
                aria-label={t('hours.opensAt')}
              />
              <span className="text-gray-400">–</span>
              <input
                type="time"
                className={`${inputClass} w-auto`}
                value={row.closesAt}
                disabled={disabled}
                onChange={(e) => update(row.dayOfWeek, { closesAt: e.target.value })}
                aria-label={t('hours.closesAt')}
              />
              {isCrossMidnight(row) && (
                <span className="text-xs text-gray-500">{t('hours.overnight')}</span>
              )}
            </div>
          )}
        </div>
      ))}
      {anyCrossMidnight && (
        <p className="pt-1 text-xs text-gray-500">{t('hours.overnightNote')}</p>
      )}
    </div>
  );
}
