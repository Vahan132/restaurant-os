'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  useInventoryItemsControllerCreate,
  useInventoryItemsControllerUpdate,
} from '@/api/generated/inventory-items/inventory-items';
import {
  CreateInventoryItemDtoBaseUnit,
  CreateInventoryItemDtoKind,
  type CreateInventoryItemDto,
  type InventoryCategoryResponse,
  type InventoryItemResponse,
  type UpdateInventoryItemDto,
} from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { Toggle } from '@/components/ui/toggle';
import { getErrorMessage } from '@/lib/api-error';
import { useInventoryInvalidation } from '@/lib/inventory/use-inventory-data';
import { toast } from '@/stores/toast';

interface AltRow {
  name: string;
  factor: string;
}

const BASE_UNITS = [
  CreateInventoryItemDtoBaseUnit.GRAM,
  CreateInventoryItemDtoBaseUnit.MILLILITER,
  CreateInventoryItemDtoBaseUnit.PIECE,
];

export function ItemFormModal({
  item,
  categories,
  onClose,
}: {
  item?: InventoryItemResponse | null;
  categories: InventoryCategoryResponse[];
  onClose: () => void;
}) {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');
  const invalidate = useInventoryInvalidation();
  const isEdit = !!item;

  const [name, setName] = useState(item?.name ?? '');
  const [sku, setSku] = useState(item?.sku ?? '');
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? '');
  const [kind, setKind] = useState<string>(item?.kind ?? CreateInventoryItemDtoKind.RAW);
  const [baseUnit, setBaseUnit] = useState<string>(
    item?.baseUnit ?? CreateInventoryItemDtoBaseUnit.GRAM,
  );
  const [trackExpiry, setTrackExpiry] = useState(item?.trackExpiry ?? false);
  const [threshold, setThreshold] = useState(
    item?.lowStockThresholdBase != null ? String(item.lowStockThresholdBase) : '',
  );
  const [alts, setAlts] = useState<AltRow[]>(
    item?.alternateUnits?.map((u) => ({ name: u.name, factor: String(u.conversionFactor) })) ?? [],
  );
  const [errors, setErrors] = useState<{ name?: string; alts?: string }>({});

  const create = useInventoryItemsControllerCreate();
  const update = useInventoryItemsControllerUpdate();
  const submitting = create.isPending || update.isPending;

  const setAlt = (i: number, patch: Partial<AltRow>) =>
    setAlts((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addAlt = () => setAlts((rows) => [...rows, { name: '', factor: '' }]);
  const removeAlt = (i: number) => setAlts((rows) => rows.filter((_, idx) => idx !== i));

  const validate = (): {
    ok: boolean;
    alternateUnits: { name: string; conversionFactor: number }[];
  } => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = t('validName');

    const filled = alts.filter((r) => r.name.trim() !== '' || r.factor.trim() !== '');
    const parsed: { name: string; conversionFactor: number }[] = [];
    for (const row of filled) {
      const factor = Number(row.factor);
      if (!row.name.trim() || !Number.isInteger(factor) || factor < 1) {
        next.alts = t('validFactor');
        break;
      }
      parsed.push({ name: row.name.trim(), conversionFactor: factor });
    }
    setErrors(next);
    return { ok: Object.keys(next).length === 0, alternateUnits: parsed };
  };

  const save = async () => {
    const { ok, alternateUnits } = validate();
    if (!ok) return;

    const thresholdNum = threshold.trim() === '' ? undefined : Number(threshold);

    try {
      if (isEdit && item) {
        const data: UpdateInventoryItemDto = {
          name: name.trim(),
          sku: sku.trim() || undefined,
          categoryId: categoryId || undefined,
          kind: kind as UpdateInventoryItemDto['kind'],
          baseUnit: baseUnit as UpdateInventoryItemDto['baseUnit'],
          trackExpiry,
          lowStockThresholdBase: thresholdNum,
          alternateUnits,
        };
        await update.mutateAsync({ id: item.id, data });
        toast.success(t('updated'));
        await invalidate(item.id);
      } else {
        const data: CreateInventoryItemDto = {
          name: name.trim(),
          sku: sku.trim() || undefined,
          categoryId: categoryId || undefined,
          kind: kind as CreateInventoryItemDto['kind'],
          baseUnit: baseUnit as CreateInventoryItemDto['baseUnit'],
          trackExpiry,
          lowStockThresholdBase: thresholdNum,
          alternateUnits,
        };
        await create.mutateAsync({ data });
        toast.success(t('created'));
        await invalidate();
      }
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <Modal
      open
      title={isEdit ? t('editItem') : t('addItem')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" onClick={save} disabled={submitting}>
            {isEdit ? tc('save') : tc('create')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label={t('fName')} required error={errors.name}>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </Field>

        <Field label={t('fSku')}>
          <input className={inputClass} value={sku} onChange={(e) => setSku(e.target.value)} />
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

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('fKind')}>
            <select
              className={inputClass}
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value={CreateInventoryItemDtoKind.RAW}>{t('kindRaw')}</option>
              <option value={CreateInventoryItemDtoKind.PROCESSED}>{t('kindProcessed')}</option>
            </select>
          </Field>

          <Field label={t('fBaseUnit')}>
            <select
              className={inputClass}
              value={baseUnit}
              onChange={(e) => setBaseUnit(e.target.value)}
            >
              {BASE_UNITS.map((u) => (
                <option key={u} value={u}>
                  {t(`baseUnit${u}`)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label={t('fThreshold')}>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
          />
        </Field>

        <Toggle
          label={t('fTrackExpiry')}
          description={t('fTrackExpiryDesc')}
          checked={trackExpiry}
          onChange={setTrackExpiry}
        />

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
