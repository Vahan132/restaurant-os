'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

/**
 * Shows a freshly-enrolled ADMIN device secret exactly once. The secret has
 * already been written to IndexedDB by the caller; this dialog lets a manager
 * copy it for a backup record. It is never retrievable from the server again.
 */
export function DeviceSecretModal({
  secret,
  onClose,
}: {
  secret: string;
  onClose: () => void;
}) {
  const t = useTranslations('devices');
  const tc = useTranslations('common');
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable; the value is still selectable on screen.
    }
  };

  return (
    <Modal
      open
      title={t('secretTitle')}
      onClose={onClose}
      footer={
        <Button variant="primary" onClick={onClose}>
          {tc('close')}
        </Button>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-amber-700">{t('secretShownOnce')}</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 select-all break-all rounded-md border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-sm">
            {secret}
          </code>
          <Button variant="secondary" onClick={copy}>
            {copied ? t('copied') : t('copy')}
          </Button>
        </div>
        <p className="text-xs text-gray-500">{t('secretStoredHint')}</p>
      </div>
    </Modal>
  );
}
