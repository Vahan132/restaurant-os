'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useUsersControllerSetPassword } from '@/api/generated/users/users';
import type { UserResponse } from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { getErrorMessage } from '@/lib/api-error';
import { generateStrongPassword } from '@/lib/users/password';
import { toast } from '@/stores/toast';

export function ResetPasswordModal({
  user,
  onClose,
  onShowPassword,
}: {
  user: UserResponse;
  onClose: () => void;
  onShowPassword: (password: string) => void;
}) {
  const t = useTranslations('users');
  const tc = useTranslations('common');
  const [password, setPassword] = useState('');
  const [wasGenerated, setWasGenerated] = useState(false);
  const [error, setError] = useState<string>();

  const setPasswordMut = useUsersControllerSetPassword();

  const onGenerate = () => {
    setPassword(generateStrongPassword());
    setWasGenerated(true);
  };

  const submit = async () => {
    if (password.length < 8) {
      setError(t('validation.passwordLength'));
      return;
    }
    setError(undefined);
    try {
      await setPasswordMut.mutateAsync({ id: user.id, data: { newPassword: password } });
      toast.success(t('toast.passwordReset'));
      onClose();
      if (wasGenerated) onShowPassword(password);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <Modal
      open
      title={t('resetPassword')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={setPasswordMut.isPending}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" onClick={submit} disabled={setPasswordMut.isPending}>
            {tc('save')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-gray-600">{user.fullName}</p>
        <Field label={t('newPassword')} required error={error}>
          <div className="flex gap-2">
            <input
              className={inputClass}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setWasGenerated(false);
              }}
              autoFocus
            />
            <Button variant="secondary" onClick={onGenerate}>
              {t('generate')}
            </Button>
          </div>
        </Field>
      </div>
    </Modal>
  );
}
