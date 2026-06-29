'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import {
  useRestaurantControllerSetSettings,
  useRestaurantControllerSettings,
} from '@/api/generated/restaurant/restaurant';
import type { RestaurantSettingsResponse } from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { getErrorMessage } from '@/lib/api-error';
import { usePermission } from '@/lib/auth/use-permission';
import { PERMISSIONS } from '@/lib/permissions';
import { useSettingsInvalidation } from '@/lib/settings/use-settings-data';
import { toast } from '@/stores/toast';

/**
 * Device-anchored admin login control (3A). When OFF (default), admin/manager
 * email logins must come from an enrolled ADMIN-surface device; the Owner is
 * always exempt (break-glass). When ON, admin/manager can log in from any
 * device. Restaurant-wide setting, gated to SETTINGS_MANAGE (Owner/admin).
 */
export function SecurityTab() {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const canManage = usePermission(PERMISSIONS.SETTINGS_MANAGE, 'restaurant');
  const { invalidateSettings } = useSettingsInvalidation();

  const { data, isLoading } = useRestaurantControllerSettings();
  const settings = data as RestaurantSettingsResponse | undefined;
  const setSettings = useRestaurantControllerSetSettings();

  const [allowUnanchored, setAllowUnanchored] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setAllowUnanchored(settings.allowUnanchoredAdminLogin);
  }, [settings]);

  const save = async () => {
    try {
      await setSettings.mutateAsync({
        data: { allowUnanchoredAdminLogin: allowUnanchored },
      });
      await invalidateSettings();
      toast.success(t('toast.settingsSaved'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-3">
        {[0, 1].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-md bg-gray-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <section className="space-y-2 rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-900">{t('security.adminLoginTitle')}</h2>
        <Toggle
          label={t('security.allowUnanchoredAdminLogin')}
          description={t('security.allowUnanchoredAdminLoginDesc')}
          checked={allowUnanchored}
          disabled={!canManage}
          onChange={setAllowUnanchored}
        />
        <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
          {allowUnanchored ? t('security.explainOn') : t('security.explainOff')}
        </p>
      </section>

      {canManage && (
        <Button variant="primary" onClick={save} disabled={setSettings.isPending}>
          {tc('save')}
        </Button>
      )}
    </div>
  );
}
