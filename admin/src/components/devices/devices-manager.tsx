'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import {
  getDevicesControllerListQueryKey,
  useDevicesControllerEnroll,
  useDevicesControllerList,
  useDevicesControllerRevoke,
} from '@/api/generated/devices/devices';
import {
  DeviceResponseStatus,
  DeviceResponseSurface,
  EnrollDeviceDtoSurface,
  type DeviceResponse,
} from '@/api/generated/model';
import { DeviceSecretModal } from '@/components/devices/device-secret-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { useConfirm } from '@/components/ui/use-confirm';
import { getErrorMessage } from '@/lib/api-error';
import { useAdminDevice, saveAdminDevice } from '@/lib/auth/admin-device';
import { normalizeList } from '@/lib/normalize-list';
import { usePermission } from '@/lib/auth/use-permission';
import { PERMISSIONS } from '@/lib/permissions';
import { useActiveBranchStore } from '@/stores/active-branch';
import { useAuthStore } from '@/stores/auth';
import { toast } from '@/stores/toast';

const surfaceTone: Record<string, 'blue' | 'gray' | 'amber'> = {
  ADMIN: 'blue',
  POS: 'gray',
  KDS: 'amber',
};

export function DevicesManager() {
  const t = useTranslations('devices');
  const tc = useTranslations('common');
  const canManage = usePermission(PERMISSIONS.DEVICE_ENROLL);
  const qc = useQueryClient();
  const { ask, dialog } = useConfirm();

  const activeBranchId = useActiveBranchStore((s) => s.activeBranchId);
  const accessibleBranches = useAuthStore((s) => s.accessibleBranches);
  const branchName = useMemo(() => {
    const map = new Map(accessibleBranches.map((b) => [b.id, b.name]));
    return (id: string) => map.get(id) ?? id;
  }, [accessibleBranches]);
  const activeBranchName = activeBranchId ? branchName(activeBranchId) : '';

  const { device: admin, reload: reloadAdminDevice, forget } = useAdminDevice();

  // Scope the device list to the active branch so switching branches (top bar)
  // refetches rather than serving another branch's cached list.
  const { data, isLoading } = useDevicesControllerList({
    query: {
      queryKey: [...getDevicesControllerListQueryKey(), activeBranchId],
      enabled: !!activeBranchId,
    },
  });
  const devices = useMemo(() => normalizeList<DeviceResponse>(data).items, [data]);

  const enroll = useDevicesControllerEnroll();
  const revoke = useDevicesControllerRevoke();

  const [enrollOpen, setEnrollOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [labelError, setLabelError] = useState<string>();
  const [revealSecret, setRevealSecret] = useState<string | null>(null);

  const invalidateList = () =>
    qc.invalidateQueries({ queryKey: getDevicesControllerListQueryKey() });

  const thisDeviceEnrolled = useMemo(
    () =>
      !!admin &&
      devices.some(
        (d) => d.id === admin.deviceId && d.status === DeviceResponseStatus.ACTIVE,
      ),
    [admin, devices],
  );

  const openEnroll = () => {
    setLabel(t('defaultLabel', { branch: activeBranchName }));
    setLabelError(undefined);
    setEnrollOpen(true);
  };

  const submitEnroll = async () => {
    const trimmed = label.trim();
    if (!trimmed) {
      setLabelError(t('validation.labelRequired'));
      return;
    }
    try {
      const result = await enroll.mutateAsync({
        data: { surface: EnrollDeviceDtoSurface.ADMIN, label: trimmed },
      });
      // Persist the secret on THIS machine before revealing it; it is never
      // retrievable from the server again.
      await saveAdminDevice({
        secret: result.secret,
        deviceId: result.device.id,
        label: result.device.label,
        branchId: result.device.branchId,
        enrolledAt: new Date().toISOString(),
      });
      await reloadAdminDevice();
      await invalidateList();
      setEnrollOpen(false);
      setRevealSecret(result.secret);
      toast.success(t('toast.enrolled'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const onRevoke = async (device: DeviceResponse) => {
    const ok = await ask({
      title: tc('confirm'),
      message: t('confirmRevoke', { label: device.label }),
      confirmLabel: t('revoke'),
      cancelLabel: tc('cancel'),
      danger: true,
    });
    if (!ok) return;
    try {
      await revoke.mutateAsync({ id: device.id });
      // If we just revoked this machine's enrolled ADMIN device, forget the
      // local secret so login stops presenting a dead credential.
      if (admin && admin.deviceId === device.id) {
        await forget();
      }
      toast.success(t('toast.revoked'));
      await invalidateList();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const formatSeen = (iso: string | null): string =>
    iso ? new Date(iso).toLocaleString() : t('never');

  if (!canManage) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          {t('restricted')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>
        <Button variant="primary" onClick={openEnroll} disabled={!activeBranchId}>
          + {t('enrollThisDevice')}
        </Button>
      </div>

      <p className="text-sm text-gray-500">{t('subtitle')}</p>

      {activeBranchId ? (
        <p className="text-xs text-gray-500">{t('branchNotice', { branch: activeBranchName })}</p>
      ) : (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          {t('noActiveBranch')}
        </p>
      )}

      {admin && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
          <span className="text-gray-700">
            {thisDeviceEnrolled ? (
              <>
                <Badge tone="green">{t('thisDeviceEnrolled')}</Badge>{' '}
                <span className="text-gray-600">{admin.label}</span>
              </>
            ) : (
              <>
                <Badge tone="amber">{t('thisDeviceStale')}</Badge>{' '}
                <span className="text-gray-600">{t('thisDeviceStaleHint')}</span>
              </>
            )}
          </span>
          <Button size="sm" variant="ghost" onClick={() => void forget()}>
            {t('forgetThisDevice')}
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-gray-100" />
            ))}
          </div>
        ) : devices.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">{t('noDevices')}</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 font-medium">{t('colLabel')}</th>
                <th className="px-4 py-2 font-medium">{t('colSurface')}</th>
                <th className="px-4 py-2 font-medium">{t('colBranch')}</th>
                <th className="px-4 py-2 font-medium">{t('colStatus')}</th>
                <th className="px-4 py-2 font-medium">{t('colLastSeen')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => {
                const revoked = device.status === DeviceResponseStatus.REVOKED;
                const isThis = admin?.deviceId === device.id;
                return (
                  <tr key={device.id} className="border-b border-gray-100 align-top">
                    <td className="px-4 py-2 font-medium text-gray-800">
                      {device.label}
                      {isThis && (
                        <span className="ml-2 align-middle">
                          <Badge tone="blue">{t('thisDeviceTag')}</Badge>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <Badge tone={surfaceTone[device.surface] ?? 'gray'}>
                        {t(`surface.${device.surface}`)}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-gray-600">{branchName(device.branchId)}</td>
                    <td className="px-4 py-2">
                      {revoked ? (
                        <Badge tone="gray">{t('statusRevoked')}</Badge>
                      ) : (
                        <Badge tone="green">{t('statusActive')}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      <div>{formatSeen(device.lastSeenAt)}</div>
                      {device.lastSeenIp && (
                        <div className="text-xs text-gray-400">{device.lastSeenIp}</div>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end">
                        {!revoked && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onRevoke(device)}
                            disabled={revoke.isPending}
                          >
                            {t('revoke')}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {enrollOpen && (
        <Modal
          open
          title={t('enrollTitle')}
          onClose={() => setEnrollOpen(false)}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setEnrollOpen(false)}
                disabled={enroll.isPending}
              >
                {tc('cancel')}
              </Button>
              <Button variant="primary" onClick={submitEnroll} disabled={enroll.isPending}>
                {t('enroll')}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-gray-600">{t('enrollBody', { branch: activeBranchName })}</p>
            <Field label={t('labelField')} required error={labelError}>
              <input
                className={inputClass}
                value={label}
                maxLength={200}
                onChange={(e) => setLabel(e.target.value)}
                autoFocus
              />
            </Field>
            {admin && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {t('reenrollWarning')}
              </p>
            )}
          </div>
        </Modal>
      )}

      {revealSecret && (
        <DeviceSecretModal secret={revealSecret} onClose={() => setRevealSecret(null)} />
      )}
      {dialog}
    </div>
  );
}
