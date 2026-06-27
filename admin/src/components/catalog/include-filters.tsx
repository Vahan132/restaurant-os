'use client';

import { useTranslations } from 'next-intl';

export type SectionKey = 'menu' | 'inventory' | 'recipes' | 'processes';
export type IncludeState = Record<SectionKey, boolean>;

export const ALL_INCLUDED: IncludeState = {
  menu: true,
  inventory: true,
  recipes: true,
  processes: true,
};

const SECTIONS: SectionKey[] = ['menu', 'inventory', 'recipes', 'processes'];

/** Checkbox group for catalog include filters (menu / inventory / recipes / processes). */
export function IncludeFilters({
  value,
  onChange,
}: {
  value: IncludeState;
  onChange: (next: IncludeState) => void;
}) {
  const t = useTranslations('catalog');
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-gray-700">{t('include')}</legend>
      <div className="flex flex-wrap gap-4">
        {SECTIONS.map((key) => (
          <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={value[key]}
              onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
            />
            {t(`section_${key}`)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Selected sections as a string array (or `undefined` when all are selected,
 * which the export/clone endpoints treat as "everything"). The values match the
 * generated include-item enums (menu | inventory | recipes | processes).
 */
export function toIncludeArray(value: IncludeState): SectionKey[] | undefined {
  const selected = SECTIONS.filter((k) => value[k]);
  return selected.length === SECTIONS.length ? undefined : selected;
}
