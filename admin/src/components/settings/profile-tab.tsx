'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { useRestaurantControllerUpdate } from '@/api/generated/restaurant/restaurant';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { getErrorMessage } from '@/lib/api-error';
import { usePermission } from '@/lib/auth/use-permission';
import { PERMISSIONS } from '@/lib/permissions';
import { useRestaurant } from '@/lib/restaurant/use-restaurant';
import { CURRENCIES, LANGUAGES, TIMEZONES, withValue } from '@/lib/settings/options';
import { useSettingsInvalidation } from '@/lib/settings/use-settings-data';
import { toast } from '@/stores/toast';

export function ProfileTab() {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const canManage = usePermission(PERMISSIONS.SETTINGS_MANAGE);
  const { data: restaurant, isLoading } = useRestaurant();
  const { invalidateProfile } = useSettingsInvalidation();
  const update = useRestaurantControllerUpdate();

  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('');
  const [language, setLanguage] = useState('');
  const [timezone, setTimezone] = useState('');
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!restaurant) return;
    setName(restaurant.name);
    setCurrency(restaurant.currency);
    setLanguage(restaurant.defaultLanguage);
    setTimezone(restaurant.timezone);
  }, [restaurant]);

  const currencyChanged = restaurant ? currency !== restaurant.currency : false;
  const disabled = !canManage;

  const save = async () => {
    if (!name.trim()) {
      setError(t('validation.required'));
      return;
    }
    setError(undefined);
    try {
      await update.mutateAsync({
        data: { name: name.trim(), currency, defaultLanguage: language, timezone },
      });
      await invalidateProfile();
      toast.success(t('toast.profileSaved'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-lg space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-md bg-gray-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-4">
      <Field label={t('name')} required error={error}>
        <input className={inputClass} value={name} disabled={disabled} onChange={(e) => setName(e.target.value)} />
      </Field>

      <Field label={t('currency')}>
        <select className={inputClass} value={currency} disabled={disabled} onChange={(e) => setCurrency(e.target.value)}>
          {withValue(CURRENCIES, currency).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </Field>
      {currencyChanged && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {t('currencyWarning')}
        </p>
      )}

      <Field label={t('language')}>
        <select className={inputClass} value={language} disabled={disabled} onChange={(e) => setLanguage(e.target.value)}>
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>{l.toUpperCase()}</option>
          ))}
        </select>
      </Field>

      <Field label={t('timezone')}>
        <select className={inputClass} value={timezone} disabled={disabled} onChange={(e) => setTimezone(e.target.value)}>
          {withValue(TIMEZONES, timezone).map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </Field>

      {canManage && (
        <Button variant="primary" onClick={save} disabled={update.isPending}>
          {tc('save')}
        </Button>
      )}
    </div>
  );
}
