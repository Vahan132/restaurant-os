'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { useBranchesControllerUpdateOrderingConfig } from '@/api/generated/branches/branches';
import { useRestaurantControllerSettings } from '@/api/generated/restaurant/restaurant';
import type {
  BranchResponse,
  RestaurantSettingsResponse,
  UpdateBranchOrderingConfigDto,
} from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { Toggle } from '@/components/ui/toggle';
import { getErrorMessage } from '@/lib/api-error';
import { usePermission } from '@/lib/auth/use-permission';
import { useBranchesAdminInvalidation } from '@/lib/branch/use-branches-admin';
import { PERMISSIONS } from '@/lib/permissions';
import { toast } from '@/stores/toast';

const IDLE_MIN = 30;
const IDLE_MAX = 480;

/**
 * Per-branch ordering-config surface (BRANCH-ORDERING-UI). Wires the otherwise
 * unused `PATCH /branches/{id}/ordering-config` endpoint so owners can enable
 * QR-web ordering. Saved independently from the general branch update.
 *
 * Guards mirror the backend rules so we never POST a state it would reject:
 *  - Ceiling: the whole section is locked unless the restaurant has
 *    `enableCustomerOrdering` on (which itself implies `enableQrMenu`).
 *  - `qrOrderingEnabled ⇒ prepaymentEnabled`: QR-web is prepayment-only, so
 *    enabling QR forces prepayment on and locks it there.
 */
export function BranchOrderingSection({ branch }: { branch: BranchResponse }) {
  const t = useTranslations('branch.ordering');
  const canManage = usePermission(PERMISSIONS.BRANCH_MANAGE, 'restaurant');
  const invalidate = useBranchesAdminInvalidation();

  const { data: settingsData } = useRestaurantControllerSettings();
  const settings = settingsData as RestaurantSettingsResponse | undefined;
  // Restaurant ceiling. The backend forces enableCustomerOrdering back to false
  // whenever enableQrMenu is off, so this single flag is an honest ceiling.
  const ceilingOn = !!settings?.enableCustomerOrdering;

  const update = useBranchesControllerUpdateOrderingConfig();

  const [qrOrdering, setQrOrdering] = useState(branch.orderingConfig.qrOrderingEnabled);
  const [prepayment, setPrepayment] = useState(branch.orderingConfig.prepaymentEnabled);
  const [idle, setIdle] = useState(String(branch.orderingConfig.idleExpiryMinutes));
  const [idleError, setIdleError] = useState<string>();

  // Re-sync when the modal is reused for a different branch.
  useEffect(() => {
    setQrOrdering(branch.orderingConfig.qrOrderingEnabled);
    setPrepayment(branch.orderingConfig.prepaymentEnabled);
    setIdle(String(branch.orderingConfig.idleExpiryMinutes));
    setIdleError(undefined);
  }, [branch]);

  const locked = !canManage || !ceilingOn;
  // QR-web ordering forces prepayment on; reflect that in the control state.
  const effectiveQr = locked ? false : qrOrdering;
  const effectivePrepayment = effectiveQr ? true : locked ? false : prepayment;

  const save = async () => {
    const minutes = Number(idle);
    if (!Number.isInteger(minutes) || minutes < IDLE_MIN || minutes > IDLE_MAX) {
      setIdleError(t('validation.idleRange'));
      return;
    }
    setIdleError(undefined);

    const payload: UpdateBranchOrderingConfigDto = {
      qrOrderingEnabled: effectiveQr,
      prepaymentEnabled: effectivePrepayment,
      // payAtEnd has no built consumer yet — preserve the stored value untouched.
      payAtEndEnabled: branch.orderingConfig.payAtEndEnabled,
      idleExpiryMinutes: minutes,
    };
    try {
      await update.mutateAsync({ id: branch.id, data: payload });
      await invalidate();
      toast.success(t('toast.saved'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <section className="space-y-3 border-t border-gray-200 pt-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{t('title')}</h3>
        <p className="mt-1 text-xs text-gray-500">{t('intro')}</p>
      </div>

      {!ceilingOn && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {t('lockedByRestaurant')}
        </p>
      )}

      <div className="divide-y divide-gray-100">
        <Toggle
          label={t('qrOrdering')}
          description={t('qrOrderingDesc')}
          checked={effectiveQr}
          disabled={locked}
          onChange={(v) => {
            setQrOrdering(v);
            // Enabling QR implies prepayment; keep local state honest too.
            if (v) setPrepayment(true);
          }}
        />
        <Toggle
          label={t('prepayment')}
          description={effectiveQr ? t('prepaymentLockedByQr') : t('prepaymentDesc')}
          checked={effectivePrepayment}
          // Locked on while QR ordering is enabled (backend requires it).
          disabled={locked || effectiveQr}
          onChange={setPrepayment}
        />
        <Toggle
          label={t('payAtEnd')}
          description={t('payAtEndDesc')}
          checked={branch.orderingConfig.payAtEndEnabled}
          disabled
          onChange={() => {}}
        />
      </div>

      <Field label={t('idleExpiry')} error={idleError}>
        <input
          inputMode="numeric"
          className={`${inputClass} max-w-[8rem]`}
          value={idle}
          disabled={locked}
          onChange={(e) => setIdle(e.target.value)}
        />
        <span className="mt-1 block text-xs text-gray-500">{t('idleExpiryHint')}</span>
      </Field>

      {canManage && (
        <Button variant="secondary" onClick={save} disabled={update.isPending}>
          {t('save')}
        </Button>
      )}
    </section>
  );
}
