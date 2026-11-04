'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { ImportHistory } from '@/components/sales-import/import-history';
import { UploadPanel } from '@/components/sales-import/upload-panel';
import { Badge } from '@/components/ui/badge';
import { usePermission } from '@/lib/auth/use-permission';
import { useBranchContext } from '@/lib/branch/use-branch-context';
import { PERMISSIONS } from '@/lib/permissions';

type Tab = 'upload' | 'history';

export function SalesImportManager() {
  const t = useTranslations('salesImport');
  // SALES_IMPORT_MANAGE is branch-scoped: it gates upload + batch browsing for
  // the active branch (BR-7 §5).
  const canManage = usePermission(PERMISSIONS.SALES_IMPORT_MANAGE, 'branch');
  const { activeBranch } = useBranchContext();
  const [tab, setTab] = useState<Tab>('upload');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'upload', label: t('tabUpload') },
    { key: 'history', label: t('tabHistory') },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>
        <Badge tone="amber">{t('nonFiscalBadge')}</Badge>
      </div>
      <p className="max-w-3xl text-sm text-gray-500">{t('subtitle')}</p>

      {!canManage ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          {t('noPermission')}
        </p>
      ) : !activeBranch ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          {t('noActiveBranch')}
        </p>
      ) : (
        <>
          <p className="text-sm text-gray-500">
            {t('activeBranchNotice', { branch: activeBranch.name })}
          </p>

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

          {tab === 'upload' && <UploadPanel branchName={activeBranch.name} />}
          {tab === 'history' && <ImportHistory />}
        </>
      )}
    </div>
  );
}
