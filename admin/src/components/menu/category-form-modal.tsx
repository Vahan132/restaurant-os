'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import {
  useCategoriesControllerCreate,
  useCategoriesControllerUpdate,
} from '@/api/generated/menu-categories/menu-categories';
import type { CategoryResponse } from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { getErrorMessage } from '@/lib/api-error';
import { useMenuInvalidation } from '@/lib/menu/use-menu-invalidation';
import { toast } from '@/stores/toast';

export function CategoryFormModal({
  open,
  category,
  nextDisplayOrder,
  onClose,
}: {
  open: boolean;
  /** When provided -> edit mode; otherwise create. */
  category?: CategoryResponse | null;
  nextDisplayOrder: number;
  onClose: () => void;
}) {
  const t = useTranslations('menu');
  const tc = useTranslations('common');
  const { invalidateCategories, invalidateMenuTree } = useMenuInvalidation();
  const isEdit = !!category;

  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [error, setError] = useState<string | undefined>();

  const create = useCategoriesControllerCreate();
  const update = useCategoriesControllerUpdate();
  const submitting = create.isPending || update.isPending;

  const afterSave = async (msg: string) => {
    await Promise.all([invalidateCategories(), invalidateMenuTree()]);
    toast.success(msg);
    onClose();
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t('validation.required'));
      return;
    }
    setError(undefined);
    try {
      if (isEdit && category) {
        await update.mutateAsync({
          id: category.id,
          data: { name: name.trim(), description: description.trim() || undefined },
        });
        await afterSave(t('toast.categoryUpdated'));
      } else {
        await create.mutateAsync({
          data: {
            name: name.trim(),
            description: description.trim() || undefined,
            displayOrder: nextDisplayOrder,
          },
        });
        await afterSave(t('toast.categoryCreated'));
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      title={isEdit ? t('editCategory') : t('addCategory')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" onClick={onSubmit} disabled={submitting}>
            {isEdit ? tc('save') : tc('create')}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label={t('categoryName')} required error={error}>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </Field>
        <Field label={t('description')}>
          <textarea
            className={inputClass}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <button type="submit" className="hidden" aria-hidden />
      </form>
    </Modal>
  );
}
