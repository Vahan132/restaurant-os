'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  useFloorsControllerCreate,
  useFloorsControllerUpdate,
} from '@/api/generated/floors/floors';
import type { FloorResponse } from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { getErrorMessage } from '@/lib/api-error';
import { useTablesInvalidation } from '@/lib/tables/use-tables-data';
import { toast } from '@/stores/toast';

export function FloorFormModal({
  open,
  floor,
  nextDisplayOrder,
  onClose,
}: {
  open: boolean;
  floor?: FloorResponse | null;
  nextDisplayOrder: number;
  onClose: () => void;
}) {
  const t = useTranslations('tables');
  const tc = useTranslations('common');
  const invalidate = useTablesInvalidation();
  const isEdit = !!floor;

  const [name, setName] = useState(floor?.name ?? '');
  const [description, setDescription] = useState(floor?.description ?? '');
  const [error, setError] = useState<string>();

  const create = useFloorsControllerCreate();
  const update = useFloorsControllerUpdate();
  const submitting = create.isPending || update.isPending;

  const submit = async () => {
    if (!name.trim()) {
      setError(t('validation.required'));
      return;
    }
    setError(undefined);
    try {
      if (isEdit && floor) {
        await update.mutateAsync({
          id: floor.id,
          data: { name: name.trim(), description: description.trim() || undefined },
        });
        toast.success(t('toast.floorUpdated'));
      } else {
        await create.mutateAsync({
          data: {
            name: name.trim(),
            description: description.trim() || undefined,
            displayOrder: nextDisplayOrder,
          },
        });
        toast.success(t('toast.floorCreated'));
      }
      await invalidate();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      title={isEdit ? t('editFloor') : t('addFloor')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" onClick={submit} disabled={submitting}>
            {isEdit ? tc('save') : tc('create')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label={t('floorName')} required error={error}>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label={t('description')}>
          <textarea
            className={inputClass}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}
