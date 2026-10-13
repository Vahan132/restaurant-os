'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  useInventorySuppliersControllerCreate,
  useInventorySuppliersControllerUpdate,
} from '@/api/generated/inventory-suppliers/inventory-suppliers';
import type {
  CreateSupplierDto,
  SupplierResponse,
  UpdateSupplierDto,
} from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { getErrorMessage } from '@/lib/api-error';
import { useSuppliersInvalidation } from '@/lib/inventory/use-inventory-data';
import { toast } from '@/stores/toast';

export function SupplierFormModal({
  supplier,
  onClose,
}: {
  supplier?: SupplierResponse | null;
  onClose: () => void;
}) {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');
  const invalidate = useSuppliersInvalidation();
  const isEdit = !!supplier;

  const [name, setName] = useState(supplier?.name ?? '');
  const [contact, setContact] = useState(supplier?.contact ?? '');
  const [note, setNote] = useState(supplier?.note ?? '');
  const [error, setError] = useState<string | undefined>();

  const create = useInventorySuppliersControllerCreate();
  const update = useInventorySuppliersControllerUpdate();
  const submitting = create.isPending || update.isPending;

  const save = async () => {
    if (!name.trim()) {
      setError(t('validName'));
      return;
    }
    try {
      if (isEdit && supplier) {
        const data: UpdateSupplierDto = {
          name: name.trim(),
          contact: contact.trim() || undefined,
          note: note.trim() || undefined,
        };
        await update.mutateAsync({ id: supplier.id, data });
        toast.success(t('updated'));
      } else {
        const data: CreateSupplierDto = {
          name: name.trim(),
          contact: contact.trim() || undefined,
          note: note.trim() || undefined,
        };
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
      title={isEdit ? t('editSupplier') : t('addSupplier')}
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
        <Field label={t('sName')} required error={error}>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </Field>
        <Field label={t('sContact')}>
          <input
            className={inputClass}
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />
        </Field>
        <Field label={t('sNote')}>
          <textarea
            className={inputClass}
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}
