'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';

export function CancelReasonModal({
  onClose,
  onConfirm,
  pending,
}: {
  onClose: () => void;
  onConfirm: (reason: string) => void;
  pending: boolean;
}) {
  const t = useTranslations('reservations');
  const tc = useTranslations('common');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();

  const submit = () => {
    if (!reason.trim()) {
      setError(t('validation.required'));
      return;
    }
    onConfirm(reason.trim());
  };

  return (
    <Modal
      open
      title={t('cancel')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {tc('close')}
          </Button>
          <Button variant="danger" onClick={submit} disabled={pending}>
            {t('cancel')}
          </Button>
        </>
      }
    >
      <Field label={t('cancelReason')} required error={error}>
        <textarea
          className={inputClass}
          rows={3}
          value={reason}
          placeholder={t('cancelReasonPlaceholder')}
          onChange={(e) => setReason(e.target.value)}
          autoFocus
        />
      </Field>
    </Modal>
  );
}
