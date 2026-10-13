'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';

import type { InventoryItemResponse } from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/ui/form';
import { itemDisplayName } from '@/lib/inventory/display-name';
import { useRelatedItems } from '@/lib/inventory/use-recipe-data';
import { BASE_UNIT_ABBR, type BaseUnit } from '@/lib/inventory/units';
import { formatMoney } from '@/lib/money';

/**
 * BRUTTO-1: `baseQty` = BRUTTO (gross, taken from stock — what inventory deducts
 * and food cost uses); `netQty` = NETTO (after cleaning/trimming, what ends up in
 * the dish). E.g. pepper brutto 50 g -> netto 40 g (20% cleaning loss).
 */
export interface RecipeLineState {
  itemId: string;
  baseQty: string;
  netQty: string;
}

/** Brutto from netto using a loss in bps (rounded up so stock is never under-deducted). */
export function bruttoFromNetto(net: number, lossBps: number): number {
  if (lossBps <= 0 || lossBps >= 10000) return net;
  return Math.ceil((net * 10000) / (10000 - lossBps));
}

/** Netto from brutto using a loss in bps. */
export function nettoFromBrutto(gross: number, lossBps: number): number {
  if (lossBps <= 0 || lossBps >= 10000) return gross;
  return Math.round((gross * (10000 - lossBps)) / 10000);
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
  unitCost,
  currency,
}: {
  line: RecipeLineState;
  items: InventoryItemResponse[];
  itemById: Map<string, InventoryItemResponse>;
  disabled: boolean;
  onChange: (patch: Partial<RecipeLineState>) => void;
  onRemove: () => void;
  onSwitch: (counterpartId: string) => void;
  /** Minor units per base unit (current batch cost). */
  unitCost?: (itemId: string) => number;
  currency?: string;
}) {
  const t = useTranslations('inventory');
  const locale = useLocale();
  const { data: related } = useRelatedItems(line.itemId || null);

  const it = line.itemId ? itemById.get(line.itemId) : undefined;
  const unit = it ? (BASE_UNIT_ABBR[it.baseUnit as BaseUnit] ?? it.baseUnit) : '';
  const defaultLossBps = it?.cleaningLossBps ?? 0;

  const gross = Number(line.baseQty);
  const net = line.netQty.trim() === '' ? gross : Number(line.netQty);
  const hasGross = line.baseQty.trim() !== '' && Number.isFinite(gross) && gross > 0;
  const lossPct = hasGross && Number.isFinite(net) ? ((gross - net) / gross) * 100 : 0;
  const netTooBig = hasGross && Number.isFinite(net) && net > gross;
  const lineCost = hasGross && unitCost ? gross * unitCost(line.itemId) : 0;

  /** Typing brutto fills an empty netto from the item's default loss (and vice versa). */
  const onGross = (v: string) => {
    const g = Number(v);
    if (line.netQty.trim() === '' && defaultLossBps > 0 && v.trim() !== '' && g > 0) {
      onChange({ baseQty: v, netQty: String(nettoFromBrutto(g, defaultLossBps)) });
    } else {
      onChange({ baseQty: v });
    }
  };
  const onNet = (v: string) => {
    const n = Number(v);
    if (line.baseQty.trim() === '' && v.trim() !== '' && n > 0) {
      onChange({ netQty: v, baseQty: String(bruttoFromNetto(n, defaultLossBps)) });
    } else {
      onChange({ netQty: v });
    }
  };

  // First relevant counterpart (processed counterpart of a raw, or raw source of a processed).
  const counterpart = useMemo(() => {
    if (!it) return null;
    if (it.kind === 'RAW') {
      const c = related?.processedOutputs?.[0];
      return c
        ? {
            itemId: c.id,
            name: itemDisplayName(c, locale),
            relation: 'HAS_PROCESSED_COUNTERPART' as const,
          }
        : null;
    }
    const c = related?.rawSources?.[0];
    return c
      ? { itemId: c.id, name: itemDisplayName(c, locale), relation: 'HAS_RAW_SOURCE' as const }
      : null;
  }, [related, it, locale]);

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
                {itemDisplayName(i, locale)}
              </option>
            ))}
          </select>
        </div>
        <div className="w-28">
          <span className="mb-0.5 block text-[11px] font-medium text-gray-500">
            {t('rlBrutto')}
          </span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              step="1"
              className={inputClass}
              placeholder={t('rlQty')}
              value={line.baseQty}
              disabled={disabled}
              onChange={(e) => onGross(e.target.value)}
            />
            <span className="text-xs text-gray-500">{unit}</span>
          </div>
        </div>
        <div className="w-28">
          <span className="mb-0.5 block text-[11px] font-medium text-gray-500">{t('rlNetto')}</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              step="1"
              className={`${inputClass} ${netTooBig ? 'border-red-400' : ''}`}
              placeholder={line.baseQty || t('rlQty')}
              value={line.netQty}
              disabled={disabled}
              onChange={(e) => onNet(e.target.value)}
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

      {line.itemId && hasGross && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-1 text-[11px] text-gray-500">
          {netTooBig ? (
            <span className="text-red-600">{t('rlNetTooBig')}</span>
          ) : lossPct > 0 ? (
            <span>
              {t('rlLoss', {
                pct: lossPct.toFixed(lossPct % 1 === 0 ? 0 : 1),
                waste: gross - net,
                unit,
              })}
            </span>
          ) : (
            <span>{t('rlNoLoss')}</span>
          )}
          {defaultLossBps > 0 && (
            <span className="text-gray-400">
              {t('rlDefaultLoss', { pct: defaultLossBps / 100 })}
            </span>
          )}
          {unitCost && currency && (
            <span className="ml-auto text-gray-600">
              {t('rlLineCost', { cost: formatMoney(lineCost, currency) })}
            </span>
          )}
        </div>
      )}

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
