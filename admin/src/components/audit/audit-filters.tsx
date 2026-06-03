'use client';

import { useTranslations } from 'next-intl';

import { inputClass } from '@/components/ui/form';
import { KNOWN_ACTIONS } from '@/lib/audit/actions';
import type { AuditPreset } from '@/lib/audit/use-audit-data';
import { humanize } from '@/lib/audit/diff';

export interface AuditFilterValues {
  preset: AuditPreset;
  fromYmd: string;
  toYmd: string;
  action: string;
  entityType: string;
  entityId: string;
  actorFilter: string;
}

const PRESETS: AuditPreset[] = ['today', '7d', '30d'];

export function AuditFilters({
  values,
  onChange,
}: {
  values: AuditFilterValues;
  onChange: (patch: Partial<AuditFilterValues>) => void;
}) {
  const t = useTranslations('audit');
  const actionLabel = (code: string) =>
    t.has(`actionLabel.${code}`) ? t(`actionLabel.${code}`) : humanize(code);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChange({ preset: p })}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                values.preset === p
                  ? 'border-brand bg-brand text-brand-fg'
                  : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t(`preset.${p}`)}
            </button>
          ))}
          <span
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              values.preset === 'custom'
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
            value={values.fromYmd}
            max={values.toYmd || undefined}
            onChange={(e) => onChange({ preset: 'custom', fromYmd: e.target.value })}
          />
        </label>
        <label className="text-xs text-gray-600">
          <span className="mr-1">{t('to')}</span>
          <input
            type="date"
            className={`${inputClass} w-auto`}
            value={values.toYmd}
            min={values.fromYmd || undefined}
            onChange={(e) => onChange({ preset: 'custom', toYmd: e.target.value })}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-gray-600">
          <span className="mr-1 block">{t('action')}</span>
          <select
            className={`${inputClass} w-auto`}
            value={values.action}
            onChange={(e) => onChange({ action: e.target.value })}
          >
            <option value="">{t('action')}: —</option>
            {KNOWN_ACTIONS.map((code) => (
              <option key={code} value={code}>
                {actionLabel(code)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-600">
          <span className="mr-1 block">{t('entityType')}</span>
          <input
            className={`${inputClass} w-auto`}
            value={values.entityType}
            onChange={(e) => onChange({ entityType: e.target.value })}
          />
        </label>
        <label className="text-xs text-gray-600">
          <span className="mr-1 block">{t('entityId')}</span>
          <input
            className={`${inputClass} w-auto`}
            value={values.entityId}
            onChange={(e) => onChange({ entityId: e.target.value })}
          />
        </label>
        <label className="text-xs text-gray-600">
          <span className="mr-1 block">{t('actorFilter')}</span>
          <input
            className={`${inputClass} w-auto`}
            value={values.actorFilter}
            onChange={(e) => onChange({ actorFilter: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
}
