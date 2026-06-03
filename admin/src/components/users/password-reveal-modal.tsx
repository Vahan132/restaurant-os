'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

/** Shows a generated password exactly once, with a copy-to-clipboard control. */
export function PasswordRevealModal({
  password,
  onClose,
}: {
  password: string;
  onClose: () => void;
}) {
  const t = useTranslations('users');
  const tc = useTranslations('common');
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable; the value is still selectable on screen.
    }
  };

  return (
    <Modal
      open
      title={t('password')}
      onClose={onClose}
      footer={
        <Button variant="primary" onClick={onClose}>
          {tc('close')}
        </Button>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-amber-700">{t('passwordShownOnce')}</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 select-all break-all rounded-md border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-sm">
            {password}
          </code>
          <Button variant="secondary" onClick={copy}>
            {copied ? t('copied') : t('copy')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
