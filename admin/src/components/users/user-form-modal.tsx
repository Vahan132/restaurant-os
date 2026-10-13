'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  useUsersControllerCreate,
  useUsersControllerUpdate,
  useBranchMembershipsControllerUpsert,
} from '@/api/generated/users/users';
import type {
  CreateUserDto,
  RoleResponse,
  UpdateUserDto,
  UserResponse,
} from '@/api/generated/model';
import {
  BranchMembershipsEditor,
  type DraftMembership,
} from '@/components/users/branch-memberships-editor';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { useConfirm } from '@/components/ui/use-confirm';
import { getErrorMessage } from '@/lib/api-error';
import { generateStrongPassword } from '@/lib/users/password';
import { useRoleLabel } from '@/lib/users/role-label';
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
  const roleLabel = useRoleLabel();
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

  // Branch access (BR-7.1): the operational grant. Collected as a draft on
  // create (applied after the user exists) and managed live on edit.
  const [draftMemberships, setDraftMemberships] = useState<DraftMembership[]>([]);

  const create = useUsersControllerCreate();
  const update = useUsersControllerUpdate();
  const upsertMembership = useBranchMembershipsControllerUpsert();
  const submitting = create.isPending || update.isPending || upsertMembership.isPending;

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
        // restaurantId null => organization-wide. Branch memberships are managed
        // live by the editor below.
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
        const created = await create.mutateAsync({ data });
        // Apply the chosen branch memberships now that the user exists.
        for (const m of draftMemberships) {
          await upsertMembership.mutateAsync({ id: created.id, data: m });
        }
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

        <div className="space-y-2 rounded-md border border-gray-200 p-3">
          <p className="text-sm font-medium text-gray-800">{t('restaurantRoleTitle')}</p>
          <p className="text-xs text-gray-500">{t('restaurantRoleHint')}</p>
          <Field label={t('role')}>
            <select className={inputClass} value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {roleLabel(r)}
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

        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-800">{t('branchAccessTitle')}</p>
          {isEdit && user ? (
            <BranchMembershipsEditor userId={user.id} roles={roles} />
          ) : (
            <BranchMembershipsEditor
              roles={roles}
              draft={draftMemberships}
              onDraftChange={setDraftMemberships}
            />
          )}
        </div>
      </div>
      {dialog}
    </Modal>
  );
}
