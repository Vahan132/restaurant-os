'use client';

import { useTranslations } from 'next-intl';

import { inputClass } from '@/components/ui/form';
import { Toggle } from '@/components/ui/toggle';

export interface OpeningHour {
  day: number;
  open: string;
  close: string;
  closed: boolean;
}

/** Default schedule (day 0 = Monday … 6 = Sunday). */
export function defaultOpeningHours(): OpeningHour[] {
  return Array.from({ length: 7 }, (_, day) => ({
    day,
    open: '09:00',
    close: '22:00',
    closed: false,
  }));
}

/** Coerce the loosely-typed settings.openingHours into editable rows. */
export function parseOpeningHours(raw: unknown): OpeningHour[] {
  const defaults = defaultOpeningHours();
  if (!Array.isArray(raw)) return defaults;
  const byDay = new Map<number, OpeningHour>();
  for (const entry of raw as Partial<OpeningHour>[]) {
    if (typeof entry?.day !== 'number') continue;
    byDay.set(entry.day, {
      day: entry.day,
      open: entry.open ?? '09:00',
      close: entry.close ?? '22:00',
      closed: entry.closed ?? false,
    });
  }
  return defaults.map((d) => byDay.get(d.day) ?? d);
}

export function OpeningHoursEditor({
  value,
  onChange,
  disabled,
}: {
  value: OpeningHour[];
  onChange: (next: OpeningHour[]) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('settings');
  const td = useTranslations('settings.days');

  const update = (day: number, patch: Partial<OpeningHour>) =>
    onChange(value.map((row) => (row.day === day ? { ...row, ...patch } : row)));

  return (
    <div className="space-y-1">
      {value.map((row) => {
        const invalid = !row.closed && row.open >= row.close;
        return (
          <div key={row.day} className="flex flex-wrap items-center gap-3 py-1">
            <span className="w-28 shrink-0 text-sm text-gray-700">{td(String(row.day))}</span>
            <div className="w-28">
              <Toggle
                label={t('closed')}
                checked={row.closed}
                disabled={disabled}
                onChange={(closed) => update(row.day, { closed })}
              />
            </div>
            {!row.closed && (
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  className={`${inputClass} w-auto`}
                  value={row.open}
                  disabled={disabled}
                  onChange={(e) => update(row.day, { open: e.target.value })}
                  aria-label={t('open')}
                />
                <span className="text-gray-400">–</span>
                <input
                  type="time"
                  className={`${inputClass} w-auto`}
                  value={row.close}
                  disabled={disabled}
                  onChange={(e) => update(row.day, { close: e.target.value })}
                  aria-label={t('close')}
                />
                {invalid && <span className="text-xs text-red-600">{t('validation.openBeforeClose')}</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
