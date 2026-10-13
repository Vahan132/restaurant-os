'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import {
  useAdminConsumerListingControllerPutContact,
  useAdminConsumerListingControllerPutHours,
  useAdminConsumerListingControllerPutListed,
  useAdminConsumerListingControllerPutMenuPublic,
  useAdminConsumerListingControllerPutReservationsPublic,
  useAdminConsumerListingControllerReadBranch,
} from '@/api/generated/admin-consumer-listing/admin-consumer-listing';
import type { OwnerBranchListingResponse } from '@/api/generated/model';
import { ReadinessChecklist } from '@/components/consumer-listing/readiness-checklist';
import {
  defaultPublicHours,
  hasInvalidHours,
  parsePublicHours,
  PublicHoursEditor,
  toHoursDto,
  type HoursRow,
} from '@/components/consumer-listing/public-hours-editor';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { Toggle } from '@/components/ui/toggle';
import { isApiError, getErrorMessage } from '@/lib/api-error';
import { usePermission } from '@/lib/auth/use-permission';
import { useBranchesAdmin } from '@/lib/branch/use-branches-admin';
import { parseCompleteness } from '@/lib/consumer-listing/completeness';
import { useConsumerListingInvalidation } from '@/lib/consumer-listing/use-consumer-listing';
import { PERMISSIONS } from '@/lib/permissions';
import { useActiveBranchStore } from '@/stores/active-branch';
import { toast } from '@/stores/toast';

/** Pull a list of missing-field strings out of an unknown error `details`. */
function missingFromError(details: unknown): string[] {
  if (Array.isArray(details)) return details.filter((d): d is string => typeof d === 'string');
  if (details && typeof details === 'object') {
    const m = (details as { missing?: unknown }).missing;
    if (Array.isArray(m)) return m.filter((d): d is string => typeof d === 'string');
  }
  return [];
}

export function BranchPanel() {
  const t = useTranslations('consumerListing');
  const tc = useTranslations('common');
  const canSettings = usePermission(PERMISSIONS.SETTINGS_MANAGE);
  const canReservations = usePermission(PERMISSIONS.RESERVATION_MANAGE);
  const { invalidateBranch } = useConsumerListingInvalidation();

  const { branches, isLoading: branchesLoading } = useBranchesAdmin();
  const activeBranchId = useActiveBranchStore((s) => s.activeBranchId);

  const [branchId, setBranchId] = useState<string>('');
  useEffect(() => {
    if (branchId) return;
    const fallback = activeBranchId ?? branches[0]?.id ?? '';
    if (fallback) setBranchId(fallback);
  }, [activeBranchId, branches, branchId]);

  const { data, isLoading } = useAdminConsumerListingControllerReadBranch(branchId, {
    query: { enabled: !!branchId },
  });
  const branch = data as OwnerBranchListingResponse | undefined;

  // --- Contact form -----------------------------------------------------
  const putContact = useAdminConsumerListingControllerPutContact();
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');

  // --- Hours form -------------------------------------------------------
  const putHours = useAdminConsumerListingControllerPutHours();
  const [hours, setHours] = useState<HoursRow[]>(defaultPublicHours());

  // --- Toggles ----------------------------------------------------------
  const putMenuPublic = useAdminConsumerListingControllerPutMenuPublic();
  const putReservationsPublic = useAdminConsumerListingControllerPutReservationsPublic();
  const putListed = useAdminConsumerListingControllerPutListed();
  const [listedError, setListedError] = useState<string[]>([]);

  useEffect(() => {
    if (!branch) return;
    setPhone(branch.publicPhone ?? '');
    setAddress(branch.address ?? '');
    setCity(branch.city ?? '');
    setHours(parsePublicHours(branch.weeklyHours));
    setListedError([]);
  }, [branch]);

  const completeness = useMemo(
    () => parseCompleteness(branch?.completeness),
    [branch?.completeness],
  );

  const saveContact = async () => {
    try {
      await putContact.mutateAsync({
        branchId,
        data: {
          publicPhone: phone.trim() === '' ? null : phone.trim(),
          address: address.trim() === '' ? null : address.trim(),
          city: city.trim() === '' ? null : city.trim(),
        },
      });
      await invalidateBranch(branchId);
      toast.success(t('toast.contactSaved'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const saveHours = async () => {
    if (hasInvalidHours(hours)) {
      toast.error(t('hours.invalid'));
      return;
    }
    try {
      await putHours.mutateAsync({ branchId, data: { rows: toHoursDto(hours) } });
      await invalidateBranch(branchId);
      toast.success(t('toast.hoursSaved'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const onToggleMenu = async (value: boolean) => {
    try {
      await putMenuPublic.mutateAsync({ branchId, data: { value } });
      await invalidateBranch(branchId);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const onToggleReservations = async (value: boolean) => {
    try {
      await putReservationsPublic.mutateAsync({ branchId, data: { value } });
      await invalidateBranch(branchId);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const onToggleListed = async (value: boolean) => {
    setListedError([]);
    try {
      await putListed.mutateAsync({ branchId, data: { value } });
      await invalidateBranch(branchId);
    } catch (err) {
      // Backstop: the gate can still reject even when the local checklist looks
      // complete. Surface the server's missing fields inline.
      if (isApiError(err) && err.code === 'RESTAURANT_PROFILE_INCOMPLETE') {
        setListedError(missingFromError(err.details));
      }
      toast.error(getErrorMessage(err));
    }
  };

  if (branchesLoading) {
    return <div className="h-24 animate-pulse rounded-lg bg-gray-100" />;
  }
  if (branches.length === 0) {
    return <p className="text-sm text-gray-500">{t('branch.noBranches')}</p>;
  }

  return (
    <div className="space-y-5">
      <Field label={t('branch.select')}>
        <select
          className={`${inputClass} max-w-xs`}
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </Field>

      {isLoading || !branch ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : (
        <>
          <section className="space-y-3 rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-900">{t('branch.contactTitle')}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label={t('branch.phone')}>
                <input
                  className={inputClass}
                  value={phone}
                  disabled={!canSettings}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Field>
              <Field label={t('branch.address')}>
                <input
                  className={inputClass}
                  value={address}
                  disabled={!canSettings}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </Field>
              <Field label={t('branch.city')}>
                <input
                  className={inputClass}
                  value={city}
                  disabled={!canSettings}
                  onChange={(e) => setCity(e.target.value)}
                />
              </Field>
            </div>
            {canSettings && (
              <Button variant="primary" onClick={saveContact} disabled={putContact.isPending}>
                {tc('save')}
              </Button>
            )}
          </section>

          <section className="space-y-3 rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-900">{t('branch.hoursTitle')}</h2>
            <PublicHoursEditor value={hours} onChange={setHours} disabled={!canSettings} />
            {canSettings && (
              <Button variant="primary" onClick={saveHours} disabled={putHours.isPending}>
                {tc('save')}
              </Button>
            )}
          </section>

          <section className="space-y-3 rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-900">{t('branch.visibilityTitle')}</h2>
            <div className="divide-y divide-gray-100">
              <Toggle
                label={t('branch.menuPublic')}
                description={t('branch.menuPublicDesc')}
                checked={branch.menuPublic}
                disabled={!canSettings || putMenuPublic.isPending}
                onChange={onToggleMenu}
              />
              <Toggle
                label={t('branch.reservationsPublic')}
                description={
                  canReservations
                    ? t('branch.reservationsPublicDesc')
                    : t('branch.reservationsReason')
                }
                checked={branch.reservationsPublic}
                disabled={!canReservations || putReservationsPublic.isPending}
                onChange={onToggleReservations}
              />
            </div>

            <div className="rounded-md border border-gray-200 p-3">
              <ReadinessChecklist completeness={branch.completeness} />
              <div className="mt-3">
                <Toggle
                  label={t('branch.listed')}
                  description={t('branch.listedDesc')}
                  checked={branch.listedInConsumerApp}
                  disabled={
                    !canSettings || !completeness.isComplete || putListed.isPending
                  }
                  onChange={onToggleListed}
                />
                {!completeness.isComplete && (
                  <p className="mt-1 text-xs text-amber-700">{t('branch.listedBlocked')}</p>
                )}
                {listedError.length > 0 && (
                  <p className="mt-1 text-xs text-red-600">
                    {t('branch.listedServerBlocked', { fields: listedError.join(', ') })}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2 text-sm">
              <span className="font-medium text-gray-700">{t('branch.effectiveListed')}:</span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  branch.effectiveListed
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {branch.effectiveListed ? t('branch.live') : t('branch.notLive')}
              </span>
              {branch.consumerListingSuppressed && (
                <span className="text-xs text-amber-700">{t('branch.suppressedHint')}</span>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
