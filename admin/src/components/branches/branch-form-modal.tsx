'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  useBranchesControllerCreate,
  useBranchesControllerUpdate,
} from '@/api/generated/branches/branches';
import type {
  BranchResponse,
  CreateBranchDto,
  UpdateBranchDto,
} from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { getErrorMessage } from '@/lib/api-error';
import { useBranchesAdminInvalidation } from '@/lib/branch/use-branches-admin';
import { toast } from '@/stores/toast';

export function BranchFormModal({
  branch,
  onClose,
}: {
  branch?: BranchResponse | null;
  onClose: () => void;
}) {
  const t = useTranslations('branch');
  const tc = useTranslations('common');
  const invalidate = useBranchesAdminInvalidation();
  const isEdit = !!branch;

  const [name, setName] = useState(branch?.name ?? '');
  const [error, setError] = useState<string | undefined>();

  const create = useBranchesControllerCreate();
  const update = useBranchesControllerUpdate();
  const submitting = create.isPending || update.isPending;

  const save = async () => {
    if (!name.trim()) {
      setError(t('validation.nameRequired'));
      return;
    }
    try {
      if (isEdit && branch) {
        const data: UpdateBranchDto = { name: name.trim() };
        await update.mutateAsync({ id: branch.id, data });
        toast.success(t('toast.updated'));
      } else {
        const data: CreateBranchDto = { name: name.trim() };
        await create.mutateAsync({ data });
        toast.success(t('toast.created'));
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
      <div className="space-y-3">
        <Field label={t('branchName')} required error={error}>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </Field>
      </div>
    </Modal>
  );
}
