'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { useInventoryTransfersControllerCreate } from '@/api/generated/inventory-transfers/inventory-transfers';
import type { CreateTransferDto } from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { getErrorMessage } from '@/lib/api-error';
import { useItemsForSelect, useInventoryInvalidation } from '@/lib/inventory/use-inventory-data';
import {
  useBranchOnHand,
  useLocationsInvalidation,
} from '@/lib/inventory/use-locations-data';
import { formatBaseQty, toBaseQty, unitOptions } from '@/lib/inventory/units';
import { toast } from '@/stores/toast';

export function TransferFormModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');
  const { items } = useItemsForSelect();
  const { locations, byItemLocation } = useBranchOnHand();
  const invalidateInventory = useInventoryInvalidation();
  const invalidateLocations = useLocationsInvalidation();

  const [itemId, setItemId] = useState('');
  const [fromLocationId, setFromLocationId] = useState('');
  const [toLocationId, setToLocationId] = useState('');
  const [unit, setUnit] = useState('');
  const [qty, setQty] = useState('');
  const [errors, setErrors] = useState<{ item?: string; from?: string; to?: string; qty?: string }>(
    {},
  );

  const selectedItem = useMemo(
    () => items.find((i) => i.id === itemId) ?? null,
    [items, itemId],
  );
  const units = useMemo(
    () => (selectedItem ? unitOptions(selectedItem.baseUnit, selectedItem.alternateUnits) : []),
    [selectedItem],
  );
  const effectiveUnit = unit || units[0]?.value || '';

  // Current on-hand at the source (base units), for client-side validation.
  const sourceOnHand = useMemo(() => {
    if (!itemId || !fromLocationId) return null;
    return byItemLocation.get(`${itemId}::${fromLocationId}`)?.quantity ?? 0;
  }, [byItemLocation, itemId, fromLocationId]);

  const requestedBaseQty = useMemo(() => {
    const q = Number(qty);
    if (!selectedItem || !Number.isFinite(q) || q <= 0) return null;
    return toBaseQty(q, effectiveUnit, selectedItem.baseUnit, selectedItem.alternateUnits);
  }, [qty, selectedItem, effectiveUnit]);

  const exceedsAvailable =
    requestedBaseQty != null && sourceOnHand != null && requestedBaseQty > sourceOnHand;

  const create = useInventoryTransfersControllerCreate();
  const submitting = create.isPending;

  const onSelectItem = (id: string) => {
    setItemId(id);
    setUnit('');
  };

  const validate = () => {
    const next: typeof errors = {};
    if (!itemId) next.item = t('selectItem');
    if (!fromLocationId) next.from = t('trSelectFrom');
    if (!toLocationId) next.to = t('trSelectTo');
    if (fromLocationId && toLocationId && fromLocationId === toLocationId)
      next.to = t('trSameLocation');
    const q = Number(qty);
    if (!Number.isFinite(q) || q <= 0) next.qty = t('validName');
    else if (exceedsAvailable) next.qty = t('trExceeds');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    const data: CreateTransferDto = {
      itemId,
      fromLocationId,
      toLocationId,
      unit: effectiveUnit,
      qty: Number(qty),
    };
    try {
      await create.mutateAsync({ data });
      toast.success(t('trCreated'));
      await Promise.all([invalidateInventory(itemId), invalidateLocations()]);
      onClose();
    } catch (err) {
      // Backend blocks over-transfers (can't move stock you don't have).
      toast.error(getErrorMessage(err));
    }
  };

  const sourceLabel =
    sourceOnHand != null && selectedItem
      ? formatBaseQty(sourceOnHand, selectedItem.baseUnit, selectedItem.alternateUnits).base
      : null;

  return (
    <Modal
      open
      title={t('addTransfer')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" onClick={save} disabled={submitting || exceedsAvailable}>
            {t('saveTransfer')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-gray-500">{t('transferIntro')}</p>

        <Field label={t('trItem')} required error={errors.item}>
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
          <Field label={t('trFrom')} required error={errors.from}>
            <select
              className={inputClass}
              value={fromLocationId}
              onChange={(e) => setFromLocationId(e.target.value)}
            >
              <option value="">{t('trSelectFrom')}</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('trTo')} required error={errors.to}>
            <select
              className={inputClass}
              value={toLocationId}
              onChange={(e) => setToLocationId(e.target.value)}
            >
              <option value="">{t('trSelectTo')}</option>
              {locations
                .filter((l) => l.id !== fromLocationId)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('trUnit')}>
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
          <Field label={t('trQty')} required error={errors.qty}>
            <input
              type="number"
              min={1}
              step="1"
              className={inputClass}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </Field>
        </div>

        {sourceLabel != null && (
          <p className={`text-xs ${exceedsAvailable ? 'text-red-600' : 'text-gray-500'}`}>
            {t('trAvailable', { qty: sourceLabel })}
          </p>
        )}
      </div>
    </Modal>
  );
}
