'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { useAdjustmentsControllerCreate } from '@/api/generated/inventory-adjustments/inventory-adjustments';
import {
  CreateAdjustmentDtoDirection,
  CreateAdjustmentDtoReason,
  type CreateAdjustmentDto,
} from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { getErrorMessage } from '@/lib/api-error';
import {
  useInventoryInvalidation,
  useItemsForSelect,
} from '@/lib/inventory/use-inventory-data';
import { unitOptions } from '@/lib/inventory/units';
import { toast } from '@/stores/toast';

const REASONS = [
  CreateAdjustmentDtoReason.OPENING_BALANCE,
  CreateAdjustmentDtoReason.STOCK_COUNT,
  CreateAdjustmentDtoReason.CORRECTION,
];

export function AdjustmentFormModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');
  const invalidate = useInventoryInvalidation();
  const { items } = useItemsForSelect();

  const [itemId, setItemId] = useState('');
  const [direction, setDirection] = useState<string>(CreateAdjustmentDtoDirection.IN);
  const [unit, setUnit] = useState('');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState<string>(CreateAdjustmentDtoReason.OPENING_BALANCE);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<{ item?: string; qty?: string }>({});

  const selectedItem = useMemo(
    () => items.find((i) => i.id === itemId) ?? null,
    [items, itemId],
  );
  const units = useMemo(
    () =>
      selectedItem ? unitOptions(selectedItem.baseUnit, selectedItem.alternateUnits) : [],
    [selectedItem],
  );

  // Default the unit to the item's base unit whenever the item changes.
  const effectiveUnit = unit || units[0]?.value || '';

  const create = useAdjustmentsControllerCreate();
  const submitting = create.isPending;

  const onSelectItem = (id: string) => {
    setItemId(id);
    setUnit('');
  };

  const validate = () => {
    const next: typeof errors = {};
    if (!itemId) next.item = t('selectItem');
    const q = Number(qty);
    if (!Number.isFinite(q) || q <= 0) next.qty = t('validName');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    const data: CreateAdjustmentDto = {
      itemId,
      direction: direction as CreateAdjustmentDto['direction'],
      unit: effectiveUnit,
      qty: Number(qty),
      reason: reason as CreateAdjustmentDto['reason'],
      note: note.trim() || undefined,
    };
    try {
      const result = await create.mutateAsync({ data });
      toast.success(t('created'));
      // OUT adjustments that drive stock below zero still succeed; warn softly.
      if (result?.wentNegative) {
        toast.error(t('wentNegative', { item: selectedItem?.name ?? '' }));
      }
      await invalidate(itemId);
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <Modal
      open
      title={t('addAdjustment')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" onClick={save} disabled={submitting}>
            {t('saveAdjustment')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label={t('aItem')} required error={errors.item}>
          <select
            className={inputClass}
            value={itemId}
            onChange={(e) => onSelectItem(e.target.value)}
            autoFocus
          >
            <option value="">{t('selectItem')}</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('aDirection')}>
            <select
              className={inputClass}
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
            >
              <option value={CreateAdjustmentDtoDirection.IN}>{t('dirIN')}</option>
              <option value={CreateAdjustmentDtoDirection.OUT}>{t('dirOUT')}</option>
            </select>
          </Field>

          <Field label={t('aUnit')}>
            <select
              className={inputClass}
              value={effectiveUnit}
              onChange={(e) => setUnit(e.target.value)}
              disabled={!selectedItem}
            >
              {units.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label={t('aQty')} required error={errors.qty}>
          <input
            type="number"
            min={0}
            step="any"
            className={inputClass}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </Field>

        <Field label={t('aReason')}>
          <select
            className={inputClass}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {t(`reason${r}`)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('aNote')}>
          <textarea
            className={inputClass}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}
