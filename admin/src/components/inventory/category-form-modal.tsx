'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  useInventoryCategoriesControllerCreate,
  useInventoryCategoriesControllerUpdate,
} from '@/api/generated/inventory-categories/inventory-categories';
import type {
  CreateInventoryCategoryDto,
  InventoryCategoryResponse,
  UpdateInventoryCategoryDto,
} from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { getErrorMessage } from '@/lib/api-error';
import { useCategoriesInvalidation } from '@/lib/inventory/use-inventory-data';
import { toast } from '@/stores/toast';

export function CategoryFormModal({
  category,
  onClose,
}: {
  category?: InventoryCategoryResponse | null;
  onClose: () => void;
}) {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');
  const invalidate = useCategoriesInvalidation();
  const isEdit = !!category;

  const [name, setName] = useState(category?.name ?? '');
  const [error, setError] = useState<string | undefined>();

  const create = useInventoryCategoriesControllerCreate();
  const update = useInventoryCategoriesControllerUpdate();
  const submitting = create.isPending || update.isPending;

  const save = async () => {
    if (!name.trim()) {
      setError(t('validName'));
      return;
    }
    try {
      if (isEdit && category) {
        const data: UpdateInventoryCategoryDto = { name: name.trim() };
        await update.mutateAsync({ id: category.id, data });
        toast.success(t('updated'));
      } else {
        const data: CreateInventoryCategoryDto = { name: name.trim() };
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
      title={isEdit ? t('editCategory') : t('addCategory')}
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
      <Field label={t('cName')} required error={error}>
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </Field>
    </Modal>
  );
}
