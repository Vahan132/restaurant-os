'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  useStaffPinsControllerCreate,
  useStaffPinsControllerReset,
  useStaffPinsControllerRevoke,
} from '@/api/generated/staff-pins/staff-pins';
import type { UserResponse } from '@/api/generated/model';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { getErrorMessage } from '@/lib/api-error';
import { toast } from '@/stores/toast';

interface IssuedPin {
  pin: string;
  mustRotate: boolean;
}

/**
 * Per-staff PIN management (3B). Issues a PIN on create/reset and reveals it
 * exactly once (never re-fetchable). Revoke takes effect immediately. The PIN is
 * the floor credential combined with an enrolled POS/KDS device secret.
 */
export function StaffPinModal({
  user,
  onClose,
}: {
  user: UserResponse;
  onClose: () => void;
}) {
  const t = useTranslations('users');
  const tc = useTranslations('common');
  const [issued, setIssued] = useState<IssuedPin | null>(null);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const [copied, setCopied] = useState(false);

  const create = useStaffPinsControllerCreate();
  const reset = useStaffPinsControllerReset();
  const revoke = useStaffPinsControllerRevoke();
  const busy = create.isPending || reset.isPending || revoke.isPending;

  const issue = async (kind: 'create' | 'reset') => {
    try {
      const mutation = kind === 'create' ? create : reset;
      const result = await mutation.mutateAsync({ userId: user.id });
      setIssued({ pin: result.pin, mustRotate: result.mustRotate });
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const onRevoke = async () => {
    try {
      await revoke.mutateAsync({ userId: user.id });
      toast.success(t('pin.toast.revoked'));
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const copy = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.pin);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable; the value is still selectable on screen.
    }
  };

  // --- Reveal state: a PIN was just issued, show it once -------------------
  if (issued) {
    return (
      <Modal
        open
        title={t('pin.title', { name: user.fullName })}
        onClose={onClose}
        footer={
          <Button variant="primary" onClick={onClose}>
            {tc('close')}
          </Button>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-amber-700">{t('pin.shownOnce')}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 select-all break-all rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-center font-mono text-lg tracking-widest">
              {issued.pin}
            </code>
            <Button variant="secondary" onClick={copy}>
              {copied ? t('copied') : t('copy')}
            </Button>
          </div>
          {issued.mustRotate && (
            <p className="flex items-center gap-2 text-xs text-gray-600">
              <Badge tone="amber">{t('pin.mustRotate')}</Badge>
              {t('pin.mustRotateHint')}
            </p>
          )}
        </div>
      </Modal>
    );
  }

  // --- Confirm revoke ------------------------------------------------------
  if (confirmingRevoke) {
    return (
      <Modal
        open
        title={t('pin.title', { name: user.fullName })}
        onClose={() => setConfirmingRevoke(false)}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setConfirmingRevoke(false)}
              disabled={busy}
            >
              {tc('cancel')}
            </Button>
            <Button variant="danger" onClick={onRevoke} disabled={busy}>
              {t('pin.revoke')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">{t('pin.confirmRevoke', { name: user.fullName })}</p>
      </Modal>
    );
  }

  // --- Action menu ---------------------------------------------------------
  return (
    <Modal
      open
      title={t('pin.title', { name: user.fullName })}
      onClose={onClose}
      footer={
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          {tc('close')}
        </Button>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-gray-600">{t('pin.intro')}</p>
        <div className="space-y-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => issue('create')}
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            <span className="block font-medium text-gray-800">{t('pin.create')}</span>
            <span className="block text-xs text-gray-500">{t('pin.createDesc')}</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => issue('reset')}
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            <span className="block font-medium text-gray-800">{t('pin.reset')}</span>
            <span className="block text-xs text-gray-500">{t('pin.resetDesc')}</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmingRevoke(true)}
            className="w-full rounded-md border border-red-200 px-3 py-2 text-left text-sm hover:bg-red-50 disabled:opacity-50"
          >
            <span className="block font-medium text-red-700">{t('pin.revoke')}</span>
            <span className="block text-xs text-gray-500">{t('pin.revokeDesc')}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
