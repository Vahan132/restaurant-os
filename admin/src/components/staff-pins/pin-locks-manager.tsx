'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/api-error';
import { usePermission } from '@/lib/auth/use-permission';
import { PERMISSIONS } from '@/lib/permissions';
import {
  fetchStaffPin,
  useStaffPinStatus,
  useUnlockStaffPin,
  type StaffPinStatus,
} from '@/lib/staff-pins/pin-status';
import { toast } from '@/stores/toast';

/**
 * PIN-UNLOCK-1 — "Staff PINs": who in the active branch is locked out of POS/KDS
 * after too many wrong PINs, with a one-click Unlock (the PIN stays the same).
 * Available on the cloud and on the local hub (offline too — a hub unlock syncs
 * up when the internet is back).
 */
export function PinLocksManager() {
  const t = useTranslations('staffPins');
  const locale = useLocale();
  const canManage = usePermission(PERMISSIONS.STAFF_PIN_MANAGE, 'restaurant');
  const { data, isLoading, isError } = useStaffPinStatus();
  const unlock = useUnlockStaffPin();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lockedOnly, setLockedOnly] = useState(false);
  // PIN-VIEW-1: revealed PINs (userId -> pin), auto-hidden after 20 s.
  const [shown, setShown] = useState<Record<string, string>>({});
  const [revealingId, setRevealingId] = useState<string | null>(null);

  useEffect(() => {
    if (Object.keys(shown).length === 0) return;
    const h = setTimeout(() => setShown({}), 20_000);
    return () => clearTimeout(h);
  }, [shown]);

  const onReveal = async (row: StaffPinStatus) => {
    if (shown[row.userId]) {
      setShown((s) => {
        const next = { ...s };
        delete next[row.userId];
        return next;
      });
      return;
    }
    setRevealingId(row.userId);
    try {
      const res = await fetchStaffPin(row.userId);
      if (res.pin) {
        const value = res.pin;
        setShown((s) => ({ ...s, [row.userId]: value }));
      } else {
        toast.error(t('pinNotViewable'));
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setRevealingId(null);
    }
  };

  const all = Array.isArray(data) ? data : [];
  const rows = all.filter((r) => !lockedOnly || r.locked);
  const lockedCount = all.filter((r) => r.locked).length;

  const onUnlock = async (row: StaffPinStatus) => {
    setBusyId(row.userId);
    try {
      await unlock.mutateAsync(row.userId);
      toast.success(t('unlocked', { name: row.fullName }));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const fmtTime = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
      : '';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>
          <p className="text-sm text-gray-500">{t('subtitle')}</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={lockedOnly}
            onChange={(e) => setLockedOnly(e.target.checked)}
          />
          {t('lockedOnly', { count: lockedCount })}
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-gray-100" />
            ))}
          </div>
        ) : isError ? (
          <p className="py-10 text-center text-sm text-red-600">{t('loadError')}</p>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">
            {lockedOnly ? t('noneLocked') : t('noStaff')}
          </p>
        ) : (
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 font-medium">{t('staff')}</th>
                <th className="px-4 py-2 font-medium">{t('role')}</th>
                <th className="px-4 py-2 font-medium">{t('status')}</th>
                {canManage && <th className="px-4 py-2 font-medium">{t('currentPin')}</th>}
                <th className="px-4 py-2 font-medium">{t('failedAttempts')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.userId} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-2 font-medium text-gray-900">{row.fullName}</td>
                  <td className="px-4 py-2 text-gray-600">{row.roleName ?? '—'}</td>
                  <td className="px-4 py-2">
                    {row.pinStatus === 'NONE' ? (
                      <Badge tone="gray">{t('noPin')}</Badge>
                    ) : row.pinStatus === 'REVOKED' ? (
                      <Badge tone="gray">{t('revoked')}</Badge>
                    ) : row.locked ? (
                      <Badge tone="red">{t('lockedUntil', { time: fmtTime(row.lockedUntil) })}</Badge>
                    ) : (
                      <Badge tone="green">{t('active')}</Badge>
                    )}
                  </td>
                  {canManage && (
                    <td className="px-4 py-2">
                      {row.pinStatus !== 'ACTIVE' ? (
                        <span className="text-gray-400">—</span>
                      ) : row.pinViewable ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono tracking-widest text-gray-900">
                            {shown[row.userId] ?? '••••••'}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onReveal(row)}
                            disabled={revealingId === row.userId}
                          >
                            {shown[row.userId] ? t('hidePin') : t('showPin')}
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400" title={t('pinNotViewable')}>
                          {t('resetToView')}
                        </span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-2 text-gray-600">
                    {row.pinStatus === 'ACTIVE' ? row.failedAttempts : '—'}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end">
                      {canManage && row.pinStatus === 'ACTIVE' && (row.locked || row.failedAttempts > 0) && (
                        <Button
                          size="sm"
                          variant={row.locked ? 'primary' : 'secondary'}
                          onClick={() => onUnlock(row)}
                          disabled={busyId === row.userId}
                        >
                          {row.locked ? t('unlock') : t('resetAttempts')}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-xs text-gray-400">{t('hint')}</p>
    </div>
  );
}
