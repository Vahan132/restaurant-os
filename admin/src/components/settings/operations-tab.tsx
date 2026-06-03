'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import {
  useRestaurantControllerSetSettings,
  useRestaurantControllerSettings,
} from '@/api/generated/restaurant/restaurant';
import type { RestaurantSettingsResponse, UpdateRestaurantSettingsDto } from '@/api/generated/model';
import {
  OpeningHoursEditor,
  defaultOpeningHours,
  parseOpeningHours,
  type OpeningHour,
} from '@/components/settings/opening-hours-editor';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { Toggle } from '@/components/ui/toggle';
import { getErrorMessage } from '@/lib/api-error';
import { usePermission } from '@/lib/auth/use-permission';
import { PERMISSIONS } from '@/lib/permissions';
import { bpsToPercent, percentToBps, useSettingsInvalidation } from '@/lib/settings/use-settings-data';
import { toast } from '@/stores/toast';

type ToggleKey =
  | 'allowDiscounts'
  | 'requireApprovalForDiscount'
  | 'allowOrderCancellation'
  | 'requireApprovalForCancellation'
  | 'enableReservations'
  | 'enableKds'
  | 'allowManualTableStatus'
  | 'enableQrMenu'
  | 'enableCustomerOrdering';

const TOGGLE_GROUPS: { group: string; keys: ToggleKey[] }[] = [
  { group: 'discounts', keys: ['allowDiscounts', 'requireApprovalForDiscount'] },
  { group: 'cancellations', keys: ['allowOrderCancellation', 'requireApprovalForCancellation'] },
  { group: 'reservations', keys: ['enableReservations'] },
  { group: 'kds', keys: ['enableKds'] },
  { group: 'tables', keys: ['allowManualTableStatus'] },
  { group: 'customer', keys: ['enableQrMenu', 'enableCustomerOrdering'] },
];

export function OperationsTab() {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const canManage = usePermission(PERMISSIONS.SETTINGS_MANAGE);
  const { invalidateSettings } = useSettingsInvalidation();

  const { data, isLoading } = useRestaurantControllerSettings();
  const settings = data as RestaurantSettingsResponse | undefined;
  const setSettings = useRestaurantControllerSetSettings();

  const [serviceFee, setServiceFee] = useState('0');
  const [logoUrl, setLogoUrl] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [receiptFooter, setReceiptFooter] = useState('');
  const [hours, setHours] = useState<OpeningHour[]>(defaultOpeningHours());
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>({
    allowDiscounts: true,
    requireApprovalForDiscount: false,
    allowOrderCancellation: true,
    requireApprovalForCancellation: false,
    enableReservations: true,
    enableKds: true,
    allowManualTableStatus: false,
    enableQrMenu: false,
    enableCustomerOrdering: false,
  });
  const [feeError, setFeeError] = useState<string>();

  useEffect(() => {
    if (!settings) return;
    setServiceFee(bpsToPercent(settings.serviceFeeRateBps));
    setLogoUrl(settings.logoUrl ?? '');
    setPhone(settings.phone ?? '');
    setAddress(settings.address ?? '');
    setReceiptFooter(settings.receiptFooter ?? '');
    setHours(parseOpeningHours(settings.openingHours));
    setToggles({
      allowDiscounts: settings.allowDiscounts,
      requireApprovalForDiscount: settings.requireApprovalForDiscount,
      allowOrderCancellation: settings.allowOrderCancellation,
      requireApprovalForCancellation: settings.requireApprovalForCancellation,
      enableReservations: settings.enableReservations,
      enableKds: settings.enableKds,
      allowManualTableStatus: settings.allowManualTableStatus,
      enableQrMenu: settings.enableQrMenu,
      enableCustomerOrdering: settings.enableCustomerOrdering,
    });
  }, [settings]);

  const disabled = !canManage;

  const save = async () => {
    const bps = percentToBps(serviceFee);
    if (bps === null) {
      setFeeError(t('validation.serviceFee'));
      return;
    }
    if (hours.some((h) => !h.closed && h.open >= h.close)) {
      toast.error(t('validation.openBeforeClose'));
      return;
    }
    setFeeError(undefined);

    // Customer ordering requires the QR menu (backend computes
    // orderingEnabled = enableQrMenu && enableCustomerOrdering). Persist an
    // honest state: if the QR menu is off, ordering is forced off too.
    const effectiveToggles = {
      ...toggles,
      enableCustomerOrdering: toggles.enableQrMenu ? toggles.enableCustomerOrdering : false,
    };

    // NOTE: taxRateBps is intentionally never sent — the platform doesn't
    // handle tax, so we leave it untouched server-side.
    const payload: UpdateRestaurantSettingsDto = {
      serviceFeeRateBps: bps,
      logoUrl: logoUrl.trim() || undefined,
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      receiptFooter: receiptFooter.trim() || undefined,
      openingHours: hours,
      ...effectiveToggles,
    };
    try {
      await setSettings.mutateAsync({ data: payload });
      await invalidateSettings();
      toast.success(t('toast.settingsSaved'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-md bg-gray-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Field label={t('serviceFee')} error={feeError}>
        <input
          inputMode="decimal"
          className={`${inputClass} max-w-[10rem]`}
          value={serviceFee}
          disabled={disabled}
          onChange={(e) => setServiceFee(e.target.value)}
        />
      </Field>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">{t('contact')}</h2>
        <Field label={t('logoUrl')}>
          <input className={inputClass} value={logoUrl} disabled={disabled} onChange={(e) => setLogoUrl(e.target.value)} />
          <span className="mt-1 block text-xs text-gray-500">{t('logoHint')}</span>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('phone')}>
            <input className={inputClass} value={phone} disabled={disabled} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label={t('address')}>
            <input className={inputClass} value={address} disabled={disabled} onChange={(e) => setAddress(e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-900">{t('receipt')}</h2>
        <Field label={t('receiptFooter')}>
          <textarea
            className={inputClass}
            rows={2}
            value={receiptFooter}
            disabled={disabled}
            onChange={(e) => setReceiptFooter(e.target.value)}
          />
        </Field>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-900">{t('openingHours')}</h2>
        <OpeningHoursEditor value={hours} onChange={setHours} disabled={disabled} />
      </section>

      <section className="space-y-4">
        {TOGGLE_GROUPS.map(({ group, keys }) => (
          <div key={group} className="rounded-lg border border-gray-200 p-4">
            <h3 className="mb-1 text-sm font-semibold text-gray-900">{t(`groups.${group}`)}</h3>
            <div className="divide-y divide-gray-100">
              {keys.map((key) => {
                // Customer ordering depends on the QR menu being enabled.
                const lockedByQr = key === 'enableCustomerOrdering' && !toggles.enableQrMenu;
                return (
                  <Toggle
                    key={key}
                    label={t(`toggle.${key}`)}
                    description={lockedByQr ? t('toggle.orderingRequiresQr') : t(`toggle.${key}Desc`)}
                    checked={lockedByQr ? false : toggles[key]}
                    disabled={disabled || lockedByQr}
                    onChange={(v) => setToggles((prev) => ({ ...prev, [key]: v }))}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {canManage && (
        <Button variant="primary" onClick={save} disabled={setSettings.isPending}>
          {tc('save')}
        </Button>
      )}
    </div>
  );
}
