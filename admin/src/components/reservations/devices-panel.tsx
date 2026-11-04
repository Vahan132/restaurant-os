'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  useReservationDevicesControllerRegister,
  useReservationDevicesControllerRevoke,
} from '@/api/generated/reservations/reservations';
import type { RegisterCallDeviceResponse } from '@/api/generated/model';
import { Can } from '@/components/auth/can';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { useConfirm } from '@/components/ui/use-confirm';
import { getErrorMessage } from '@/lib/api-error';
import { useDevices, useDevicesInvalidation } from '@/lib/reservations/use-devices-data';
import { PERMISSIONS } from '@/lib/permissions';
import { toast } from '@/stores/toast';

function formatSeen(value: string | null | undefined, neverLabel: string): string {
  if (!value) return neverLabel;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/** Two-phase modal: enter a name → create → reveal the one-time token. */
function DeviceAddModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations('reservations');
  const tc = useTranslations('common');
  const invalidate = useDevicesInvalidation();

  const [name, setName] = useState('');
  const [created, setCreated] = useState<RegisterCallDeviceResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const create = useReservationDevicesControllerRegister();

  const submit = async () => {
    if (!name.trim()) {
      setError(t('validation.required'));
      return;
    }
    try {
      const res = await create.mutateAsync({ data: { name: name.trim() } });
      setCreated(res ?? null);
      toast.success(t('toast.deviceAdded'));
      await invalidate();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const copy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.token);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  if (created) {
    return (
      <Modal
        open
        title={t('devTokenTitle')}
        onClose={onClose}
        footer={
          <Button variant="primary" onClick={onClose}>
            {t('devDone')}
          </Button>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600">{t('devTokenInstructions')}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded-md bg-gray-100 px-3 py-2 text-xs text-gray-800">
              {created.token}
            </code>
            <Button variant="secondary" onClick={copy}>
              {copied ? t('copied') : t('copy')}
            </Button>
          </div>
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {t('devTokenWarning')}
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      title={t('addDevice')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={create.isPending}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" onClick={submit} disabled={create.isPending}>
            {tc('create')}
          </Button>
        </>
      }
    >
      <Field label={t('devName')} required error={error}>
        <input
          className={inputClass}
          value={name}
          placeholder={t('devNamePlaceholder')}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </Field>
    </Modal>
  );
}

export function DevicesPanel() {
  const t = useTranslations('reservations');
  const tc = useTranslations('common');
  const { devices, isLoading, isError } = useDevices();
  const invalidate = useDevicesInvalidation();
  const { ask, dialog } = useConfirm();

  const [addOpen, setAddOpen] = useState(false);
  const revoke = useReservationDevicesControllerRevoke();

  const onRevoke = async (id: string) => {
    const ok = await ask({
      title: tc('confirm'),
      message: t('confirmRevoke'),
      confirmLabel: t('revoke'),
      cancelLabel: tc('cancel'),
      danger: true,
    });
    if (!ok) return;
    try {
      await revoke.mutateAsync({ id });
      toast.success(t('toast.deviceRevoked'));
      await invalidate();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Can permission={PERMISSIONS.RESERVATION_MANAGE}>
          <Button variant="primary" onClick={() => setAddOpen(true)}>
            + {t('addDevice')}
          </Button>
        </Can>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-gray-100" />
            ))}
          </div>
        ) : isError ? (
          <p className="py-10 text-center text-sm text-gray-500">{tc('error')}</p>
        ) : devices.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">{t('noDevices')}</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 font-medium">{t('devName')}</th>
                <th className="px-4 py-2 font-medium">{t('devLastSeen')}</th>
                <th className="px-4 py-2 font-medium">{t('devStatus')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id} className="border-b border-gray-100">
                  <td className="px-4 py-2 font-medium text-gray-800">{d.name}</td>
                  <td className="px-4 py-2 text-gray-600">{formatSeen(d.lastSeenAt, t('devNever'))}</td>
                  <td className="px-4 py-2">
                    <Badge tone={d.status === 'ACTIVE' ? 'green' : 'gray'}>
                      {d.status === 'ACTIVE' ? t('devStatusACTIVE') : t('devStatusREVOKED')}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {d.status === 'ACTIVE' && (
                      <Can permission={PERMISSIONS.RESERVATION_MANAGE}>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={revoke.isPending}
                          onClick={() => void onRevoke(d.id)}
                        >
                          {t('revoke')}
                        </Button>
                      </Can>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {addOpen && <DeviceAddModal onClose={() => setAddOpen(false)} />}
      {dialog}
    </div>
  );
}
