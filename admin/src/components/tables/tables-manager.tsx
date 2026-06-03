'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { FloorPlanView } from '@/components/tables/floor-plan-view';
import { ManageView } from '@/components/tables/manage-view';

type Tab = 'floorPlan' | 'manage';

export function TablesManager() {
  const t = useTranslations('tables');
  const [tab, setTab] = useState<Tab>('floorPlan');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'floorPlan', label: t('floorPlan') },
    { key: 'manage', label: t('manage') },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>

      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((tabItem) => (
          <button
            key={tabItem.key}
            type="button"
            onClick={() => setTab(tabItem.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === tabItem.key
                ? 'border-brand text-brand'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      {tab === 'floorPlan' ? <FloorPlanView /> : <ManageView />}
    </div>
  );
}
