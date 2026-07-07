'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import type { RegisterEdgeNodeResponse } from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

/**
 * Shows a freshly-registered hub's node token exactly once, with copy controls
 * and pairing instructions. The token is never retrievable again, so the modal
 * makes that explicit and offers a ready-to-paste env line.
 */
export function HubTokenModal({
  result,
  onClose,
}: {
  result: RegisterEdgeNodeResponse;
  onClose: () => void;
}) {
  const t = useTranslations('hubs');
  const [copied, setCopied] = useState<'token' | 'env' | null>(null);

  const envLine = `EDGE_NODE_TOKEN=${result.token}`;

  const copy = async (value: string, which: 'token' | 'env') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard may be unavailable; the value is still selectable on screen.
    }
  };

  return (
    <Modal
      open
      title={t('tokenTitle', { name: result.name })}
      onClose={onClose}
      footer={
        <Button variant="primary" onClick={onClose}>
          {t('tokenDone')}
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {t('tokenShownOnce')}
        </p>

        <div className="space-y-1">
          <span className="block text-sm font-medium text-gray-700">
            {t('tokenLabel')}
          </span>
          <div className="flex items-center gap-2">
            <code className="flex-1 select-all break-all rounded-md border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-sm">
              {result.token}
            </code>
            <Button variant="secondary" onClick={() => copy(result.token, 'token')}>
              {copied === 'token' ? t('copied') : t('copy')}
            </Button>
          </div>
        </div>

        <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-3">
          <span className="block text-sm font-medium text-gray-700">
            {t('pairingTitle')}
          </span>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-600">
            <li>{t('pairingStep1')}</li>
            <li>{t('pairingStep2')}</li>
            <li>{t('pairingStep3')}</li>
          </ol>
          <div className="flex items-center gap-2 pt-1">
            <code className="flex-1 select-all break-all rounded-md border border-gray-300 bg-white px-3 py-2 font-mono text-xs">
              {envLine}
            </code>
            <Button variant="secondary" size="sm" onClick={() => copy(envLine, 'env')}>
              {copied === 'env' ? t('copied') : t('copy')}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
