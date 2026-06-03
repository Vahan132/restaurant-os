'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { RolesTab } from '@/components/users/roles-tab';
import { UsersTab } from '@/components/users/users-tab';
import { usePermission } from '@/lib/auth/use-permission';
import { PERMISSIONS } from '@/lib/permissions';

type Tab = 'users' | 'roles';

export function UsersManager() {
  const t = useTranslations('users');
  const canUsers = usePermission(PERMISSIONS.USER_MANAGE);
  const canRoles = usePermission(PERMISSIONS.ROLE_MANAGE);

  const available: { key: Tab; label: string }[] = [
    ...(canUsers ? [{ key: 'users' as const, label: t('usersTab') }] : []),
    ...(canRoles ? [{ key: 'roles' as const, label: t('rolesTab') }] : []),
  ];

  const [tab, setTab] = useState<Tab>(available[0]?.key ?? 'users');
  const activeTab = available.some((a) => a.key === tab) ? tab : available[0]?.key;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>

      {available.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          {t('accessRestricted')}
        </p>
      ) : (
        <>
          <div className="flex gap-1 border-b border-gray-200">
            {available.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === item.key
                    ? 'border-brand text-brand'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {activeTab === 'users' && canUsers ? <UsersTab /> : null}
          {activeTab === 'roles' && canRoles ? <RolesTab /> : null}
        </>
      )}
    </div>
  );
}
