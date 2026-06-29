'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useInventoryItemsControllerSetConsumptionLocationRoute } from '@/api/generated/inventory-items/inventory-items';
import type {
  InventoryItemResponse,
  SetItemConsumptionLocationDto,
} from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { getErrorMessage } from '@/lib/api-error';
import { useInventoryInvalidation } from '@/lib/inventory/use-inventory-data';
import { useLocations } from '@/lib/inventory/use-locations-data';
import { toast } from '@/stores/toast';

/**
 * Assign where serving this item depletes it from (per branch). An empty
 * selection resets to the branch default (Main Storage). Uses the dedicated
 * PATCH /inventory/items/{id}/consumption-location endpoint (6C).
 */
export function ConsumptionLocationModal({
  item,
  onClose,
}: {
  item: InventoryItemResponse;
  onClose: () => void;
}) {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');
  const invalidate = useInventoryInvalidation();
  const { locations } = useLocations();

  // Empty string => reset to the branch default (Main Storage).
  const [locationId, setLocationId] = useState(item.consumptionLocationId ?? '');

  const mutate = useInventoryItemsControllerSetConsumptionLocationRoute();
  const submitting = mutate.isPending;

  const save = async () => {
    const data: SetItemConsumptionLocationDto = {
      // The generated nullable type is structural; a location id string (or
      // null to reset to default) is what the endpoint accepts.
      locationId: (locationId || null) as SetItemConsumptionLocationDto['locationId'],
    };
    try {
      await mutate.mutateAsync({ id: item.id, data });
      toast.success(t('updated'));
      await invalidate(item.id);
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <Modal
      open
      title={t('consumptionLocationTitle')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" onClick={save} disabled={submitting}>
            {tc('save')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-gray-600">{t('consumptionLocationBody', { item: item.name })}</p>
        <Field label={t('consumptionLocationLabel')}>
          <select
            className={inputClass}
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            autoFocus
          >
            <option value="">{t('consumptionDefaultOption')}</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
        <p className="text-xs text-gray-500">{t('consumptionLocationHint')}</p>
      </div>
    </Modal>
  );
}
