'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

import type { InventoryItemResponse } from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/ui/form';
import { useRelatedItems } from '@/lib/inventory/use-recipe-data';
import { BASE_UNIT_ABBR, type BaseUnit } from '@/lib/inventory/units';

export interface RecipeLineState {
  itemId: string;
  baseQty: string;
}

/**
 * One recipe ingredient row. Fetches the item's raw↔processed counterparts and
 * surfaces a non-blocking inline notice with a one-click "switch" affordance.
 */
export function RecipeLineRow({
  line,
  items,
  itemById,
  disabled,
  onChange,
  onRemove,
  onSwitch,
}: {
  line: RecipeLineState;
  items: InventoryItemResponse[];
  itemById: Map<string, InventoryItemResponse>;
  disabled: boolean;
  onChange: (patch: Partial<RecipeLineState>) => void;
  onRemove: () => void;
  onSwitch: (counterpartId: string) => void;
}) {
  const t = useTranslations('inventory');
  const { data: related } = useRelatedItems(line.itemId || null);

  const it = line.itemId ? itemById.get(line.itemId) : undefined;
  const unit = it ? (BASE_UNIT_ABBR[it.baseUnit as BaseUnit] ?? it.baseUnit) : '';

  // First relevant counterpart (processed counterpart of a raw, or raw source of a processed).
  const counterpart = useMemo(() => {
    if (!it) return null;
    if (it.kind === 'RAW') {
      const c = related?.processedOutputs?.[0];
      return c
        ? { itemId: c.id, name: c.name, relation: 'HAS_PROCESSED_COUNTERPART' as const }
        : null;
    }
    const c = related?.rawSources?.[0];
    return c ? { itemId: c.id, name: c.name, relation: 'HAS_RAW_SOURCE' as const } : null;
  }, [related, it]);

  return (
    <div className="space-y-1">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <select
            className={inputClass}
            value={line.itemId}
            disabled={disabled}
            onChange={(e) => onChange({ itemId: e.target.value })}
          >
            <option value="">{t('selectInvItem')}</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </div>
        <div className="w-40">
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              step="any"
              className={inputClass}
              placeholder={t('rlQty')}
              value={line.baseQty}
              disabled={disabled}
              onChange={(e) => onChange({ baseQty: e.target.value })}
            />
            <span className="text-xs text-gray-500">{unit}</span>
          </div>
        </div>
        {!disabled && (
          <Button size="sm" variant="ghost" onClick={onRemove}>
            ×
          </Button>
        )}
      </div>

      {counterpart && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
          <span>
            {counterpart.relation === 'HAS_PROCESSED_COUNTERPART'
              ? t('rawProcessedWarn')
              : t('rawSourceWarn')}
          </span>
          {!disabled && (
            <button
              type="button"
              className="ml-auto shrink-0 font-medium underline hover:no-underline"
              onClick={() => onSwitch(counterpart.itemId)}
            >
              {t('switchTo', { name: counterpart.name })}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
