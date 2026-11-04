'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';

import {
  useAdminConsumerListingControllerPatchRestaurant,
  useAdminConsumerListingControllerReadRestaurant,
} from '@/api/generated/admin-consumer-listing/admin-consumer-listing';
import type { OwnerRestaurantListingResponse } from '@/api/generated/model';
import { AttributesSelector } from '@/components/consumer-listing/attributes-selector';
import {
  EMPTY_I18N,
  fromI18nDraft,
  I18nTextEditor,
  toI18nDraft,
  type I18nDraft,
} from '@/components/consumer-listing/i18n-text-editor';
import { PhotosEditor } from '@/components/consumer-listing/photos-editor';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { getErrorMessage } from '@/lib/api-error';
import { usePermission } from '@/lib/auth/use-permission';
import { useConsumerListingInvalidation } from '@/lib/consumer-listing/use-consumer-listing';
import { PERMISSIONS } from '@/lib/permissions';
import { toast } from '@/stores/toast';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border border-gray-200 p-4">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

export function RestaurantPanel() {
  const t = useTranslations('consumerListing');
  const tc = useTranslations('common');
  // Brand config is restaurant-wide; resolve the capability at restaurant scope.
  const canManage = usePermission(PERMISSIONS.SETTINGS_MANAGE, 'restaurant');
  const { invalidateRestaurant } = useConsumerListingInvalidation();

  const { data, isLoading } = useAdminConsumerListingControllerReadRestaurant();
  const restaurant = data as OwnerRestaurantListingResponse | undefined;
  const patch = useAdminConsumerListingControllerPatchRestaurant();

  const [about, setAbout] = useState<I18nDraft>(EMPTY_I18N);
  const [website, setWebsite] = useState('');

  useEffect(() => {
    if (!restaurant) return;
    setAbout(toI18nDraft(restaurant.about));
    setWebsite(restaurant.website ?? '');
  }, [restaurant]);

  const disabled = !canManage;

  const saveProfile = async () => {
    try {
      await patch.mutateAsync({
        data: {
          about: fromI18nDraft(about),
          website: website.trim() === '' ? null : website.trim(),
        },
      });
      await invalidateRestaurant();
      toast.success(t('toast.profileSaved'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    );
  }

  if (!restaurant) {
    return <p className="text-sm text-gray-500">{tc('error')}</p>;
  }

  return (
    <div className="space-y-5">
      {restaurant.consumerListingSuppressed && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t('suppressionBanner')}
        </div>
      )}

      <Section title={t('about.title')}>
        <Field label={t('about.label')}>
          <I18nTextEditor value={about} onChange={setAbout} disabled={disabled} multiline />
        </Field>
        <Field label={t('about.website')}>
          <input
            className={inputClass}
            value={website}
            disabled={disabled}
            placeholder="https://"
            onChange={(e) => setWebsite(e.target.value)}
          />
        </Field>
        {canManage && (
          <Button variant="primary" onClick={saveProfile} disabled={patch.isPending}>
            {tc('save')}
          </Button>
        )}
      </Section>

      <Section title={t('photos.title')}>
        <PhotosEditor photos={restaurant.photos} disabled={disabled} />
      </Section>

      <Section title={t('attributes.title')}>
        <p className="text-xs text-gray-500">{t('attributes.hint')}</p>
        <AttributesSelector
          selectedIds={restaurant.attributeValueIds}
          disabled={disabled}
        />
      </Section>
    </div>
  );
}
