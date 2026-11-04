'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  useInventoryLocationsControllerCreate,
  useInventoryLocationsControllerUpdate,
} from '@/api/generated/inventory-locations/inventory-locations';
import type {
  CreateInventoryLocationDto,
  InventoryLocationResponse,
  UpdateInventoryLocationDto,
} from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { getErrorMessage } from '@/lib/api-error';
import { useLocationsInvalidation } from '@/lib/inventory/use-locations-data';
import { toast } from '@/stores/toast';

/** Create a new custom location, or rename an existing custom one. */
export function LocationFormModal({
  location,
  onClose,
}: {
  location?: InventoryLocationResponse | null;
  onClose: () => void;
}) {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');
  const invalidate = useLocationsInvalidation();
  const isEdit = !!location;

  const [name, setName] = useState(location?.name ?? '');
  const [error, setError] = useState<string | undefined>();

  const create = useInventoryLocationsControllerCreate();
  const update = useInventoryLocationsControllerUpdate();
  const submitting = create.isPending || update.isPending;

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('validName'));
      return;
    }
    setError(undefined);
    try {
      if (isEdit && location) {
        const data: UpdateInventoryLocationDto = { name: trimmed };
        await update.mutateAsync({ id: location.id, data });
        toast.success(t('updated'));
      } else {
        const data: CreateInventoryLocationDto = { name: trimmed };
        await create.mutateAsync({ data });
        toast.success(t('created'));
      }
      await invalidate();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <Modal
      open
      title={isEdit ? t('renameLocation') : t('createLocation')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" onClick={save} disabled={submitting}>
            {t('saveLocation')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label={t('locName')} required error={error}>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('locNamePlaceholder')}
            autoFocus
          />
        </Field>
        <p className="text-xs text-gray-500">{t('locCustomHint')}</p>
      </div>
    </Modal>
  );
}
