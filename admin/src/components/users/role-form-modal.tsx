'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  useRolesControllerCreate,
  useRolesControllerUpdate,
} from '@/api/generated/roles/roles';
import type { RoleResponse } from '@/api/generated/model';
import { PermissionMatrix } from '@/components/users/permission-matrix';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { getErrorMessage } from '@/lib/api-error';
import { useRolesInvalidation } from '@/lib/users/use-users-data';
import { toast } from '@/stores/toast';

const CODE_RE = /^[A-Z][A-Z0-9_]*$/;

export function RoleFormModal({
  role,
  onClose,
}: {
  role?: RoleResponse | null;
  onClose: () => void;
}) {
  const t = useTranslations('roles');
  const tc = useTranslations('common');
  const invalidate = useRolesInvalidation();
  const isEdit = !!role;
  // Code is only set at creation: UpdateRoleDto has no `code`, and system roles
  // lock it regardless.
  const codeLocked = isEdit;

  const [name, setName] = useState(role?.name ?? '');
  const [code, setCode] = useState(role?.code ?? '');
  const [permissions, setPermissions] = useState<string[]>(role?.permissions ?? []);
  const [errors, setErrors] = useState<{ name?: string; code?: string }>({});

  const create = useRolesControllerCreate();
  const update = useRolesControllerUpdate();
  const submitting = create.isPending || update.isPending;

  const validate = () => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = t('validation.required');
    if (!isEdit && !CODE_RE.test(code.trim())) next.code = t('validation.code');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    try {
      if (isEdit && role) {
        await update.mutateAsync({ id: role.id, data: { name: name.trim(), permissions } });
        toast.success(t('toast.updated'));
      } else {
        await create.mutateAsync({
          data: { name: name.trim(), code: code.trim(), permissions },
        });
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
      title={isEdit ? t('editRole') : t('createRole')}
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
        <Field label={t('name')} required error={errors.name}>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label={t('code')} required={!isEdit} error={errors.code}>
          <input
            className={inputClass}
            value={code}
            disabled={codeLocked}
            placeholder="UPPER_SNAKE_CASE"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          {!codeLocked && <span className="mt-1 block text-xs text-gray-500">{t('codeHint')}</span>}
          {codeLocked && role?.isSystem && (
            <span className="mt-1 block text-xs text-gray-500">{t('systemRoleTooltip')}</span>
          )}
        </Field>
        <PermissionMatrix value={permissions} onChange={setPermissions} />
      </div>
    </Modal>
  );
}
