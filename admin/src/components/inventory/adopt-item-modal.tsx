'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  AdoptCatalogItemDtoBaseUnit,
  type AdoptCatalogItemDto,
  type CatalogBrowseItemResponse,
  type InventoryCategoryResponse,
} from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { isApiError } from '@/lib/api-error';
import { pickName } from '@/lib/inventory/display-name';
import { useAdoptCatalogItem } from '@/lib/inventory/use-catalog-browse';
import { useInventoryInvalidation } from '@/lib/inventory/use-inventory-data';
import { toast } from '@/stores/toast';

interface AltRow {
  name: string;
  factor: string;
}

const BASE_UNITS = [
  AdoptCatalogItemDtoBaseUnit.GRAM,
  AdoptCatalogItemDtoBaseUnit.MILLILITER,
  AdoptCatalogItemDtoBaseUnit.PIECE,
];

/**
 * Operational-only adopt modal (PLATCAT-ADOPT-2). No name input: adopted items
 * carry no local name and display the live catalog name. Collects base unit
 * (required, no default) + optional inventory category / SKU / alternate units.
 */
export function AdoptItemModal({
  item,
  categories,
  onClose,
  onAdopted,
  onStale,
}: {
  item: CatalogBrowseItemResponse;
  categories: InventoryCategoryResponse[];
  onClose: () => void;
  /** Called after the item is (or already was) in the branch inventory. */
  onAdopted: (catalogItemId: string) => void;
  /** Called when the catalog item is no longer adoptable (archived/removed). */
  onStale: () => void;
}) {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');
  const locale = useLocale();
  const invalidate = useInventoryInvalidation();

  const [baseUnit, setBaseUnit] = useState<string>('');
  const [categoryId, setCategoryId] = useState('');
  const [sku, setSku] = useState('');
  const [alts, setAlts] = useState<AltRow[]>([]);
  const [errors, setErrors] = useState<{ baseUnit?: string; alts?: string }>({});

  const adopt = useAdoptCatalogItem();
  const submitting = adopt.isPending;

  const setAlt = (i: number, patch: Partial<AltRow>) =>
    setAlts((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addAlt = () => setAlts((rows) => [...rows, { name: '', factor: '' }]);
  const removeAlt = (i: number) => setAlts((rows) => rows.filter((_, idx) => idx !== i));

  const validate = (): { ok: boolean; alternateUnits: { name: string; factor: number }[] } => {
    const next: typeof errors = {};
    if (!baseUnit) next.baseUnit = t('adoptValidBaseUnit');

    const filled = alts.filter((r) => r.name.trim() !== '' || r.factor.trim() !== '');
    const parsed: { name: string; factor: number }[] = [];
    for (const row of filled) {
      const factor = Number(row.factor);
      if (!row.name.trim() || !Number.isInteger(factor) || factor < 1) {
        next.alts = t('validFactor');
        break;
      }
      parsed.push({ name: row.name.trim(), factor });
    }
    setErrors(next);
    return { ok: Object.keys(next).length === 0, alternateUnits: parsed };
  };

  const submit = async () => {
    if (submitting) return;
    const { ok, alternateUnits } = validate();
    if (!ok) return;

    const data: AdoptCatalogItemDto = {
      catalogItemId: item.id,
      baseUnit: baseUnit as AdoptCatalogItemDto['baseUnit'],
      categoryId: categoryId || undefined,
      sku: sku.trim() || undefined,
      alternateUnits: alternateUnits.length ? alternateUnits : undefined,
    };

    try {
      await adopt.mutateAsync({ data });
      toast.success(t('adoptSuccess'));
      await invalidate();
      onAdopted(item.id);
    } catch (err) {
      const code = isApiError(err) ? err.code : undefined;
      if (code === 'CATALOG_ITEM_ALREADY_ADOPTED') {
        toast.error(t('adoptAlreadyAdopted'));
        await invalidate();
        onAdopted(item.id);
        return;
      }
      if (code === 'CATALOG_ITEM_NOT_ADOPTABLE' || code === 'CATALOG_ITEM_NOT_FOUND') {
        toast.error(t('adoptNotAdoptable'));
        onStale();
        return;
      }
      toast.error(isApiError(err) ? err.message : tc('error'));
    }
  };

  return (
    <Modal
      open
      title={t('adoptTitle')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" onClick={submit} disabled={submitting || !baseUnit}>
            {t('adoptSubmit')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <div className="text-base font-semibold text-gray-900">
            {pickName(item.name, locale)}
          </div>
          <div className="text-xs text-gray-400">{item.slug}</div>
        </div>

        {/* Operational inputs */}
        <Field label={t('fBaseUnit')} required error={errors.baseUnit}>
          <select
            className={inputClass}
            value={baseUnit}
            onChange={(e) => setBaseUnit(e.target.value)}
            autoFocus
          >
            <option value="" disabled>
              {t('adoptBaseUnitPlaceholder')}
            </option>
            {BASE_UNITS.map((u) => (
              <option key={u} value={u}>
                {t(`baseUnit${u}`)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('fCategory')}>
          <select
            className={inputClass}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">{t('noCategory')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('fSku')}>
          <input className={inputClass} value={sku} onChange={(e) => setSku(e.target.value)} />
        </Field>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">{t('fAlternateUnits')}</span>
            <Button size="sm" variant="secondary" onClick={addAlt}>
              + {t('addAltUnit')}
            </Button>
          </div>
          {alts.map((row, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1">
                <input
                  className={inputClass}
                  placeholder={t('fAltName')}
                  value={row.name}
                  onChange={(e) => setAlt(i, { name: e.target.value })}
                />
              </div>
              <div className="w-32">
                <input
                  type="number"
                  min={1}
                  step={1}
                  className={inputClass}
                  placeholder={t('fAltFactor')}
                  value={row.factor}
                  onChange={(e) => setAlt(i, { factor: e.target.value })}
                />
              </div>
              <Button size="sm" variant="ghost" onClick={() => removeAlt(i)}>
                ×
              </Button>
            </div>
          ))}
          {errors.alts && <p className="text-xs text-red-600">{errors.alts}</p>}
        </div>
      </div>
    </Modal>
  );
}
