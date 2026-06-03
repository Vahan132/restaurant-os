'use client';

import { useTranslations } from 'next-intl';

import { inputClass } from '@/components/ui/form';
import type { DateRange, GroupBy, RangePreset } from '@/lib/reports/date-range';

const PRESETS: Exclude<RangePreset, 'custom'>[] = ['today', 'week', 'month'];
const GROUP_BYS: GroupBy[] = ['day', 'week', 'month'];

export function RangeControls({
  preset,
  groupBy,
  range,
  onPreset,
  onCustom,
  onGroupBy,
}: {
  preset: RangePreset;
  groupBy: GroupBy;
  range: DateRange;
  onPreset: (p: RangePreset) => void;
  onCustom: (r: DateRange) => void;
  onGroupBy: (g: GroupBy) => void;
}) {
  const t = useTranslations('reports');

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPreset(p)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              preset === p
                ? 'border-brand bg-brand text-brand-fg'
                : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t(`preset.${p}`)}
          </button>
        ))}
        <span
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            preset === 'custom'
              ? 'border-brand bg-brand text-brand-fg'
              : 'border-gray-300 bg-white text-gray-400'
          }`}
        >
          {t('preset.custom')}
        </span>
      </div>

      <label className="text-xs text-gray-600">
        <span className="mr-1">{t('from')}</span>
        <input
          type="date"
          className={`${inputClass} w-auto`}
          value={range.from}
          max={range.to || undefined}
          onChange={(e) => onCustom({ from: e.target.value, to: range.to })}
        />
      </label>
      <label className="text-xs text-gray-600">
        <span className="mr-1">{t('to')}</span>
        <input
          type="date"
          className={`${inputClass} w-auto`}
          value={range.to}
          min={range.from || undefined}
          onChange={(e) => onCustom({ from: range.from, to: e.target.value })}
        />
      </label>

      <label className="text-xs text-gray-600">
        <span className="mr-1">{t('groupBy')}</span>
        <select
          className={`${inputClass} w-auto`}
          value={groupBy}
          onChange={(e) => onGroupBy(e.target.value as GroupBy)}
        >
          {GROUP_BYS.map((g) => (
            <option key={g} value={g}>
              {t(`groupByOpt.${g}`)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
