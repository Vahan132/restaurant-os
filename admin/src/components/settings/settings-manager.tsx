'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { OperationsTab } from '@/components/settings/operations-tab';
import { PaymentsTab } from '@/components/settings/payments-tab';
import { FiscalTab } from '@/components/settings/fiscal-tab';
import { ProfileTab } from '@/components/settings/profile-tab';
import { SecurityTab } from '@/components/settings/security-tab';
import { Can } from '@/components/auth/can';
import { useEdgeMode } from '@/lib/edge/use-edge-mode';
import { PERMISSIONS } from '@/lib/permissions';

// Branch management moved to its own screen (/branches, gated BRANCH_MANAGE).
type Tab = 'profile' | 'operations' | 'payments' | 'fiscal' | 'security';

export function SettingsManager() {
  const t = useTranslations('settings');
  const { isEdge } = useEdgeMode();
  const [selected, setTab] = useState<Tab>('profile');

  const allTabs: { key: Tab; label: string }[] = [
    { key: 'profile', label: t('profileTab') },
    { key: 'operations', label: t('operationsTab') },
    { key: 'payments', label: t('paymentsTab') },
    { key: 'fiscal', label: t('fiscalTab') },
    { key: 'security', label: t('securityTab') },
  ];
  // HDM-EDGE-1: on the local hub only the HDM tab is available (the hub talks to
  // the device; everything else is cloud-only).
  const tabs = isEdge ? allTabs.filter((x) => x.key === 'fiscal') : allTabs;
  const tab: Tab = isEdge ? 'fiscal' : selected;

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
      {tab === 'payments' && <PaymentsTab />}
      {tab === 'fiscal' && <FiscalTab />}
      {tab === 'security' && <SecurityTab />}
    </div>
  );
}
