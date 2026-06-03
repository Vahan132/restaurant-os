'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  useUsersControllerCreate,
  useUsersControllerUpdate,
} from '@/api/generated/users/users';
import type {
  CreateUserDto,
  RoleResponse,
  UpdateUserDto,
  UserResponse,
} from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { useConfirm } from '@/components/ui/use-confirm';
import { getErrorMessage } from '@/lib/api-error';
import { generateStrongPassword } from '@/lib/users/password';
import { useUsersInvalidation } from '@/lib/users/use-users-data';
import type { AuthUser } from '@/stores/auth';
import { toast } from '@/stores/toast';

type Scope = 'restaurant' | 'org';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function UserFormModal({
  user,
  roles,
  currentUser,
  onClose,
  onShowPassword,
}: {
  user?: UserResponse | null;
  roles: RoleResponse[];
  currentUser: AuthUser | null;
  onClose: () => void;
  onShowPassword: (password: string) => void;
}) {
  const t = useTranslations('users');
  const tc = useTranslations('common');
  const invalidate = useUsersInvalidation();
  const { ask, dialog } = useConfirm();
  const isEdit = !!user;

  const restaurantId = currentUser?.restaurantId ?? null;
  const canScopeRestaurant = restaurantId != null;

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [wasGenerated, setWasGenerated] = useState(false);
  const [roleId, setRoleId] = useState(user?.roleId ?? roles[0]?.id ?? '');
  const [scope, setScope] = useState<Scope>(
    user ? (user.restaurantId ? 'restaurant' : 'org') : canScopeRestaurant ? 'restaurant' : 'org',
  );
  const [errors, setErrors] = useState<{ fullName?: string; email?: string; password?: string }>({});

  const create = useUsersControllerCreate();
  const update = useUsersControllerUpdate();
  const submitting = create.isPending || update.isPending;

  const onGenerate = () => {
    const pw = generateStrongPassword();
    setPassword(pw);
    setWasGenerated(true);
  };

  const validate = () => {
    const next: typeof errors = {};
    if (!fullName.trim()) next.fullName = t('validation.required');
    if (!isEdit) {
      if (!EMAIL_RE.test(email.trim())) next.email = t('validation.email');
      if (password.length < 8) next.password = t('validation.passwordLength');
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const scopedRestaurantId = (s: Scope): string | null =>
    s === 'restaurant' ? restaurantId : null;

  const save = async () => {
    if (!validate()) return;

    // Warn before changing your OWN role (lockout risk).
    if (isEdit && user && currentUser?.id === user.id && roleId !== user.roleId) {
      const ok = await ask({
        title: tc('confirm'),
        message: t('ownRoleWarning'),
        confirmLabel: tc('save'),
        cancelLabel: tc('cancel'),
        danger: true,
      });
      if (!ok) return;
    }

    try {
      if (isEdit && user) {
        // restaurantId null => organization-wide. organizationId is never sent.
        const data = {
          fullName: fullName.trim(),
          roleId,
          restaurantId: scopedRestaurantId(scope),
        } as unknown as UpdateUserDto;
        await update.mutateAsync({ id: user.id, data });
        toast.success(t('toast.updated'));
        await invalidate(user.id);
        onClose();
      } else {
        const rid = scopedRestaurantId(scope);
        const data: CreateUserDto = {
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          roleId,
          ...(rid ? { restaurantId: rid } : {}),
        };
        await create.mutateAsync({ data });
        toast.success(t('toast.created'));
        await invalidate();
        onClose();
        if (wasGenerated) onShowPassword(password);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <Modal
      open
      title={isEdit ? t('editUser') : t('addUser')}
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
        <Field label={t('name')} required error={errors.fullName}>
          <input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
        </Field>

        <Field label={t('email')} required={!isEdit} error={errors.email}>
          <input
            type="email"
            className={inputClass}
            value={email}
            disabled={isEdit}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        {!isEdit && (
          <Field label={t('password')} required error={errors.password}>
            <div className="flex gap-2">
              <input
                className={inputClass}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setWasGenerated(false);
                }}
              />
              <Button variant="secondary" onClick={onGenerate}>
                {t('generate')}
              </Button>
            </div>
          </Field>
        )}

        <Field label={t('role')}>
          <select className={inputClass} value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('scope')}>
          <select
            className={inputClass}
            value={scope}
            onChange={(e) => setScope(e.target.value as Scope)}
          >
            <option value="restaurant" disabled={!canScopeRestaurant}>
              {t('scopeRestaurant')}
            </option>
            <option value="org">{t('scopeOrg')}</option>
          </select>
        </Field>
      </div>
      {dialog}
    </Modal>
  );
}
