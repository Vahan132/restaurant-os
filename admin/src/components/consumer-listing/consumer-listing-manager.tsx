'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { BranchPanel } from '@/components/consumer-listing/branch-panel';
import { RestaurantPanel } from '@/components/consumer-listing/restaurant-panel';
import { useAnyPermission } from '@/lib/auth/use-permission';
import { PERMISSIONS } from '@/lib/permissions';

type Tab = 'restaurant' | 'branch';

export function ConsumerListingManager() {
  const t = useTranslations('consumerListing');
  const [tab, setTab] = useState<Tab>('restaurant');

  // The screen is read-only-visible to anyone who can reach it; edit controls
  // are individually gated. Mirror the settings screen's read-only hint.
  const canView = useAnyPermission(
    [PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.RESERVATION_MANAGE],
    'branch',
  );

  const tabs: { key: Tab; label: string }[] = [
    { key: 'restaurant', label: t('tabs.restaurant') },
    { key: 'branch', label: t('tabs.branch') },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('subtitle')}</p>
      </div>

      {!canView && (
        <p className="rounded-md border border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-500">
          {t('readOnly')}
        </p>
      )}

      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === item.key
                ? 'border-brand text-brand'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'restaurant' ? <RestaurantPanel /> : <BranchPanel />}
    </div>
  );
}
