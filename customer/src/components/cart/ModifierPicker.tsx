'use client';

import { useTranslations } from 'next-intl';

import type { PublicModifierGroupResponse } from '@/api/generated/model';
import { formatDelta } from '@/lib/money';

import { isGroupValid, maxFor, minFor, type Selections } from './useModifierSelection';

interface Props {
  groups: PublicModifierGroupResponse[];
  selections: Selections;
  isSelected: (groupId: string, optionId: string) => boolean;
  onToggle: (group: PublicModifierGroupResponse, optionId: string) => void;
  currency: string;
  locale: string;
}

export default function ModifierPicker({
  groups,
  selections,
  isSelected,
  onToggle,
  currency,
  locale,
}: Props) {
  const t = useTranslations('item');

  return (
    <div className="space-y-5">
      {groups.map((group) => {
        const selected = selections[group.id] ?? [];
        const valid = isGroupValid(group, selected);
        const max = maxFor(group);
        const atMax = group.selectionType === 'MULTIPLE' && selected.length >= max;
        const hint =
          group.selectionType === 'SINGLE'
            ? group.required
              ? t('pickOne')
              : t('pickOneOptional')
            : max === Infinity
              ? t('pickManyMin', { min: minFor(group) })
              : t('pickManyRange', { min: minFor(group), max });

        return (
          <fieldset key={group.id}>
            <legend className="flex w-full items-baseline justify-between">
              <span className="text-sm font-semibold text-gray-900">{group.name}</span>
              <span
                className={
                  'text-[11px] ' + (valid ? 'text-gray-400' : 'font-medium text-brand-accent')
                }
              >
                {group.required ? `${t('required')} · ` : ''}
                {hint}
              </span>
            </legend>
            <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-100">
              {group.options.map((opt) => {
                const checked = isSelected(group.id, opt.id);
                const disabled = !checked && atMax;
                return (
                  <li key={opt.id}>
                    <label
                      className={
                        'flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm ' +
                        (disabled ? 'cursor-not-allowed opacity-40' : '')
                      }
                    >
                      <input
                        type={group.selectionType === 'SINGLE' ? 'radio' : 'checkbox'}
                        name={group.id}
                        checked={checked}
                        disabled={disabled}
                        onChange={() => onToggle(group, opt.id)}
                        className="h-4 w-4 accent-brand-accent"
                      />
                      <span className="flex-1 text-gray-700">{opt.name}</span>
                      {opt.priceDeltaAmount !== 0 ? (
                        <span className="text-xs font-medium text-gray-500">
                          {formatDelta(opt.priceDeltaAmount, currency, locale)}
                        </span>
                      ) : null}
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        );
      })}
    </div>
  );
}
