'use client';

import { useTranslations } from 'next-intl';

import { inputClass } from '@/components/ui/form';
import {
  CANONICAL_FIELDS,
  type ColumnMapping as ColumnMappingType,
} from '@/lib/sales-import/canonical';

/**
 * Column-mapping step shown when a file's headers don't match the canonical
 * schema. Each canonical field gets a dropdown of the file's columns; required
 * fields must be assigned before the upload can proceed.
 */
export function ColumnMapping({
  headers,
  mapping,
  onChange,
}: {
  headers: string[];
  mapping: ColumnMappingType;
  onChange: (next: ColumnMappingType) => void;
}) {
  const t = useTranslations('salesImport');

  const setField = (key: string, value: string) => {
    onChange({ ...mapping, [key]: value === '' ? null : Number(value) });
  };

  return (
    <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div>
        <h2 className="text-sm font-semibold text-amber-900">{t('mapping.title')}</h2>
        <p className="text-xs text-amber-800">{t('mapping.hint')}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {CANONICAL_FIELDS.map((field) => (
          <label key={field.key} className="space-y-1">
            <span className="block text-xs font-medium text-gray-700">
              {t(`field.${field.key}`)}
              {field.required && <span className="text-red-500"> *</span>}
            </span>
            <select
              className={inputClass}
              value={mapping[field.key] ?? ''}
              onChange={(e) => setField(field.key, e.target.value)}
            >
              <option value="">{field.required ? t('mapping.select') : t('mapping.none')}</option>
              {headers.map((h, i) => (
                <option key={i} value={i}>
                  {h || t('mapping.columnN', { n: i + 1 })}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </div>
  );
}
