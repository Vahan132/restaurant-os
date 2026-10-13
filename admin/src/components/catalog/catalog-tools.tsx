'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { ClonePanel } from '@/components/catalog/clone-panel';
import { ExportPanel } from '@/components/catalog/export-panel';
import { ImportPanel } from '@/components/catalog/import-panel';
import { useAnyPermission } from '@/lib/auth/use-permission';
import { useBranchContext } from '@/lib/branch/use-branch-context';
import { PERMISSIONS } from '@/lib/permissions';

type Tab = 'export' | 'import' | 'clone';

const CATALOG_PERMS = [
  PERMISSIONS.MENU_MANAGE,
  PERMISSIONS.INVENTORY_ITEM_MANAGE,
  PERMISSIONS.INVENTORY_RECIPE_MANAGE,
  PERMISSIONS.INVENTORY_PROCESS_MANAGE,
];

export function CatalogTools() {
  const t = useTranslations('catalog');
  // Catalog permissions are evaluated at the ACTIVE branch (BR-7 §5).
  const allowed = useAnyPermission(CATALOG_PERMS, 'branch');
  const { activeBranch } = useBranchContext();
  const [tab, setTab] = useState<Tab>('export');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'export', label: t('tabExport') },
    { key: 'import', label: t('tabImport') },
    { key: 'clone', label: t('tabClone') },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>

      {!allowed ? (
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

          {tab === 'export' && (
            <ExportPanel branchId={activeBranch.id} branchName={activeBranch.name} />
          )}
          {tab === 'import' && (
            <ImportPanel branchId={activeBranch.id} branchName={activeBranch.name} />
          )}
          {tab === 'clone' && (
            <ClonePanel branchId={activeBranch.id} branchName={activeBranch.name} />
          )}
        </>
      )}
    </div>
  );
}
