'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  useBranchesControllerCreate,
  useBranchesControllerUpdate,
} from '@/api/generated/restaurant-branches/restaurant-branches';
import type { BranchResponse } from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { getErrorMessage } from '@/lib/api-error';
import { useSettingsInvalidation } from '@/lib/settings/use-settings-data';
import { toast } from '@/stores/toast';

export function BranchFormModal({
  branch,
  onClose,
}: {
  branch?: BranchResponse | null;
  onClose: () => void;
}) {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const { invalidateBranches } = useSettingsInvalidation();
  const isEdit = !!branch;

  const [name, setName] = useState(branch?.name ?? '');
  const [error, setError] = useState<string>();

  const create = useBranchesControllerCreate();
  const update = useBranchesControllerUpdate();
  const submitting = create.isPending || update.isPending;

  const save = async () => {
    if (!name.trim()) {
      setError(t('validation.required'));
      return;
    }
    setError(undefined);
    try {
      if (isEdit && branch) {
        await update.mutateAsync({ id: branch.id, data: { name: name.trim() } });
        toast.success(t('toast.branchUpdated'));
      } else {
        await create.mutateAsync({ data: { name: name.trim() } });
        toast.success(t('toast.branchCreated'));
      }
      await invalidateBranches();
      onClose();
    } catch (err) {
      // Plan limit (or other) errors surface clearly.
      toast.error(getErrorMessage(err, t('branchLimit')));
    }
  };

  return (
    <Modal
      open
      title={isEdit ? t('editBranch') : t('addBranch')}
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
      <Field label={t('branchName')} required error={error}>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
    </Modal>
  );
}
