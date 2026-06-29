'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { useAdjustmentsControllerCount } from '@/api/generated/inventory-adjustments/inventory-adjustments';
import type { SetCountedOnHandDto } from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { getErrorMessage } from '@/lib/api-error';
import { useInventoryInvalidation, useItemsForSelect } from '@/lib/inventory/use-inventory-data';
import {
  useBranchOnHand,
  useLocationsInvalidation,
} from '@/lib/inventory/use-locations-data';
import { formatBaseQty, formatNumber, toBaseQty, unitOptions } from '@/lib/inventory/units';
import { toast } from '@/stores/toast';

interface Prefill {
  itemId: string;
  locationId: string;
}

/**
 * Correction adjustment: set the ACTUAL counted on-hand for an (item, location).
 * Shows before/after and requires a confirm step before writing the
 * signed-difference adjustment. Fixes both wrong negatives and surpluses.
 */
export function CountCorrectionModal({
  prefill,
  onClose,
}: {
  prefill?: Prefill | null;
  onClose: () => void;
}) {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');
  const invalidateInventory = useInventoryInvalidation();
  const invalidateLocations = useLocationsInvalidation();
  const { items } = useItemsForSelect();
  const { locations, byItemLocation } = useBranchOnHand();

  const [itemId, setItemId] = useState(prefill?.itemId ?? '');
  const [locationId, setLocationId] = useState(prefill?.locationId ?? '');
  const [unit, setUnit] = useState('');
  const [countedQty, setCountedQty] = useState('');
  const [reason, setReason] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [errors, setErrors] = useState<{ item?: string; location?: string; qty?: string }>({});

  const selectedItem = useMemo(
    () => items.find((i) => i.id === itemId) ?? null,
    [items, itemId],
  );
  const units = useMemo(
    () => (selectedItem ? unitOptions(selectedItem.baseUnit, selectedItem.alternateUnits) : []),
    [selectedItem],
  );
  const effectiveUnit = unit || units[0]?.value || '';

  const beforeBase = useMemo(() => {
    if (!itemId || !locationId) return null;
    return byItemLocation.get(`${itemId}::${locationId}`)?.quantity ?? 0;
  }, [byItemLocation, itemId, locationId]);

  const afterBase = useMemo(() => {
    const q = Number(countedQty);
    if (!selectedItem || !Number.isFinite(q) || q < 0) return null;
    return toBaseQty(q, effectiveUnit, selectedItem.baseUnit, selectedItem.alternateUnits);
  }, [countedQty, selectedItem, effectiveUnit]);

  const deltaBase =
    beforeBase != null && afterBase != null ? afterBase - beforeBase : null;

  const count = useAdjustmentsControllerCount();
  const submitting = count.isPending;

  const onSelectItem = (id: string) => {
    setItemId(id);
    setUnit('');
  };

  const validate = () => {
    const next: typeof errors = {};
    if (!itemId) next.item = t('selectItem');
    if (!locationId) next.location = t('ccSelectLocation');
    const q = Number(countedQty);
    if (!Number.isFinite(q) || q < 0) next.qty = t('ccInvalidCount');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const toReview = () => {
    if (validate()) setReviewing(true);
  };

  const apply = async () => {
    const data: SetCountedOnHandDto = {
      itemId,
      locationId,
      unit: effectiveUnit,
      countedQty: Number(countedQty),
      reason: reason.trim() || undefined,
    };
    try {
      const result = await count.mutateAsync({ data });
      const abbr = selectedItem?.baseUnit ?? '';
      toast.success(
        t('ccApplied', {
          delta: `${result.deltaBaseQty >= 0 ? '+' : ''}${formatNumber(result.deltaBaseQty)} ${abbr}`,
        }),
      );
      if (result.uncosted) toast.error(t('ccUncosted'));
      if (result.lowStockRaised) toast.info(t('ccLowStockRaised'));
      await Promise.all([invalidateInventory(itemId), invalidateLocations()]);
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const baseUnit = selectedItem?.baseUnit ?? '';
  const alts = selectedItem?.alternateUnits ?? [];
  const fmt = (base: number) => formatBaseQty(base, baseUnit, alts).base;

  return (
    <Modal
      open
      title={t('ccTitle')}
      onClose={onClose}
      footer={
        reviewing ? (
          <>
            <Button variant="secondary" onClick={() => setReviewing(false)} disabled={submitting}>
              {tc('cancel')}
            </Button>
            <Button variant="primary" onClick={apply} disabled={submitting}>
              {t('ccApply')}
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              {tc('cancel')}
            </Button>
            <Button variant="primary" onClick={toReview}>
              {t('ccReview')}
            </Button>
          </>
        )
      }
    >
      {reviewing ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">{t('ccConfirmBody')}</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
            <dt className="text-gray-500">{t('ccItem')}</dt>
            <dd className="font-medium text-gray-800">{selectedItem?.name}</dd>
            <dt className="text-gray-500">{t('ccLocation')}</dt>
            <dd className="text-gray-800">
              {locations.find((l) => l.id === locationId)?.name ?? locationId}
            </dd>
            <dt className="text-gray-500">{t('ccBefore')}</dt>
            <dd className="text-gray-800">{beforeBase != null ? fmt(beforeBase) : '—'}</dd>
            <dt className="text-gray-500">{t('ccAfter')}</dt>
            <dd className="text-gray-800">{afterBase != null ? fmt(afterBase) : '—'}</dd>
            <dt className="text-gray-500">{t('ccDelta')}</dt>
            <dd
              className={`font-medium ${
                deltaBase == null
                  ? 'text-gray-800'
                  : deltaBase > 0
                    ? 'text-green-700'
                    : deltaBase < 0
                      ? 'text-red-700'
                      : 'text-gray-800'
              }`}
            >
              {deltaBase == null
                ? '—'
                : `${deltaBase >= 0 ? '+' : ''}${fmt(deltaBase).replace(/^-/, '')}`}
            </dd>
          </dl>
          {reason.trim() && (
            <p className="text-xs text-gray-500">{t('ccReasonLabel')}: {reason.trim()}</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">{t('ccIntro')}</p>

          <Field label={t('ccItem')} required error={errors.item}>
            <select
              className={inputClass}
              value={itemId}
              onChange={(e) => onSelectItem(e.target.value)}
              disabled={!!prefill}
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
            <Field label={t('ccLocation')} required error={errors.location}>
              <select
                className={inputClass}
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                disabled={!!prefill}
              >
                <option value="">{t('ccSelectLocation')}</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('ccUnit')}>
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

          {beforeBase != null && (
            <p className="text-xs text-gray-500">{t('ccCurrent', { qty: fmt(beforeBase) })}</p>
          )}

          <Field label={t('ccCountedQty')} required error={errors.qty}>
            <input
              type="number"
              min={0}
              step="any"
              className={inputClass}
              value={countedQty}
              onChange={(e) => setCountedQty(e.target.value)}
            />
          </Field>

          <Field label={t('ccReasonField')}>
            <textarea
              className={inputClass}
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
        </div>
      )}
    </Modal>
  );
}
