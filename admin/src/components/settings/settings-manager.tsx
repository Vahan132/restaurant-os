'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { OperationsTab } from '@/components/settings/operations-tab';
import { ProfileTab } from '@/components/settings/profile-tab';
import { SecurityTab } from '@/components/settings/security-tab';
import { Can } from '@/components/auth/can';
import { PERMISSIONS } from '@/lib/permissions';

// Branch management moved to its own screen (/branches, gated BRANCH_MANAGE).
type Tab = 'profile' | 'operations' | 'security';

export function SettingsManager() {
  const t = useTranslations('settings');
  const [tab, setTab] = useState<Tab>('profile');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'profile', label: t('profileTab') },
    { key: 'operations', label: t('operationsTab') },
    { key: 'security', label: t('securityTab') },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>

      <Can permission={PERMISSIONS.SETTINGS_MANAGE} scope="restaurant" fallback={
        <p className="rounded-md border border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-500">
          {t('readOnly')}
        </p>
      }>
        <span className="sr-only" />
      </Can>

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

      {tab === 'profile' && <ProfileTab />}
      {tab === 'operations' && <OperationsTab />}
      {tab === 'security' && <SecurityTab />}
    </div>
  );
}
