'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useEdgeNodesControllerCreate } from '@/api/generated/edge-nodes/edge-nodes';
import type {
  RegisterEdgeNodeDto,
  RegisterEdgeNodeResponse,
} from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { getErrorMessage } from '@/lib/api-error';
import { useBranchContext } from '@/lib/branch/use-branch-context';
import { toast } from '@/stores/toast';

/**
 * Register a new hub: pick a branch + name, POST /edge-nodes. On success the
 * one-time token is handed back to the parent via `onRegistered` so it can be
 * shown once in the token modal.
 */
export function RegisterHubModal({
  onRegistered,
  onClose,
}: {
  onRegistered: (result: RegisterEdgeNodeResponse) => void;
  onClose: () => void;
}) {
  const t = useTranslations('hubs');
  const tc = useTranslations('common');
  const { accessibleBranches, activeBranchId } = useBranchContext();

  const [branchId, setBranchId] = useState(
    activeBranchId ?? accessibleBranches[0]?.id ?? '',
  );
  const [name, setName] = useState('');
  const [error, setError] = useState<string | undefined>();

  const create = useEdgeNodesControllerCreate();

  const save = async () => {
    if (!branchId) {
      setError(t('validation.branchRequired'));
      return;
    }
    if (!name.trim()) {
      setError(t('validation.nameRequired'));
      return;
    }
    setError(undefined);
    try {
      const data: RegisterEdgeNodeDto = { branchId, name: name.trim() };
      const result = await create.mutateAsync({ data });
      toast.success(t('toast.registered'));
      onRegistered(result);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <Modal
      open
      title={t('registerTitle')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={create.isPending}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" onClick={save} disabled={create.isPending}>
            {t('register')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label={t('branch')} required>
          <select
            className={inputClass}
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          >
            {accessibleBranches.length === 0 && <option value="">—</option>}
            {accessibleBranches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('hubName')} required error={error}>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('hubNamePlaceholder')}
            autoFocus
          />
        </Field>
      </div>
    </Modal>
  );
}
