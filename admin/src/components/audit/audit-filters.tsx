'use client';

import { keepPreviousData } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

import { useUsersControllerList } from '@/api/generated/users/users';
// Import the runtime enum objects directly from their generated source files
// (not via the model barrel) so the values resolve even if the barrel index is
// momentarily stale on disk.
import { AuditControllerListAction } from '@/api/generated/model/auditControllerListAction';
import { AuditControllerListRole } from '@/api/generated/model/auditControllerListRole';
import type { UserResponse } from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/ui/form';
import { usePermission } from '@/lib/auth/use-permission';
import { humanize } from '@/lib/audit/diff';
import type { AuditPreset } from '@/lib/audit/use-audit-data';
import { useBranchContext } from '@/lib/branch/use-branch-context';
import { normalizeList } from '@/lib/normalize-list';
import { PERMISSIONS } from '@/lib/permissions';

export interface AuditFilterValues {
  preset: AuditPreset;
  fromYmd: string;
  toYmd: string;
  /** Action-type filter (empty = all). */
  action: '' | AuditControllerListAction;
  /** Actor role-code filter (empty = all). */
  role: '' | AuditControllerListRole;
  /** Branch filter (empty = all permitted branches). */
  branchId: string;
  /** Employee (actor) filter (empty = all). */
  actorId: string;
  entityType: string;
  entityId: string;
}

const PRESETS: AuditPreset[] = ['today', '7d', '30d'];
const ACTIONS = Object.values(AuditControllerListAction);
const ROLES = Object.values(AuditControllerListRole);

export function AuditFilters({
  values,
  onChange,
  onReset,
}: {
  values: AuditFilterValues;
  onChange: (patch: Partial<AuditFilterValues>) => void;
  onReset: () => void;
}) {
  const t = useTranslations('audit');

  // Branch options follow the caller's permitted scope (BR-1): only branches
  // the user can actually see are offered.
  const { accessibleBranches } = useBranchContext();

  // Employee options come from the user directory, gated on USER_MANAGE so we
  // never fire a request the caller isn't allowed to make.
  const canListUsers = usePermission(PERMISSIONS.USER_MANAGE, 'restaurant');
  const usersQuery = useUsersControllerList(
    { page: 1, limit: 100 },
    { query: { enabled: canListUsers, placeholderData: keepPreviousData } },
  );
  const employees = useMemo(
    () => normalizeList<UserResponse>(usersQuery.data).items,
    [usersQuery.data],
  );

  const actionLabel = (code: string) =>
    t.has(`actionLabel.${code}`) ? t(`actionLabel.${code}`) : humanize(code);
  const roleLabel = (code: string) =>
    t.has(`roleLabel.${code}`) ? t(`roleLabel.${code}`) : humanize(code);

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3">
      {/* Row 1 — date range */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChange({ preset: p })}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                values.preset === p
                  ? 'border-brand bg-brand text-brand-fg'
                  : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t(`preset.${p}`)}
            </button>
          ))}
          <span
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              values.preset === 'custom'
                ? 'border-brand bg-brand text-brand-fg'
                : 'border-gray-300 bg-white text-gray-400'
            }`}
          >
            {t('preset.custom')}
          </span>
        </div>

        <label className="text-xs text-gray-600">
          <span className="mr-1">{t('from')}</span>
          <input
            type="date"
            className={`${inputClass} w-auto`}
            value={values.fromYmd}
            max={values.toYmd || undefined}
            onChange={(e) => onChange({ preset: 'custom', fromYmd: e.target.value })}
          />
        </label>
        <label className="text-xs text-gray-600">
          <span className="mr-1">{t('to')}</span>
          <input
            type="date"
            className={`${inputClass} w-auto`}
            value={values.toYmd}
            min={values.fromYmd || undefined}
            onChange={(e) => onChange({ preset: 'custom', toYmd: e.target.value })}
          />
        </label>
      </div>

      {/* Row 2 — employee, branch, role, action */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-gray-600">
          <span className="mr-1 block">{t('employee')}</span>
          <select
            className={`${inputClass} w-auto`}
            value={values.actorId}
            disabled={!canListUsers}
            onChange={(e) => onChange({ actorId: e.target.value })}
          >
            <option value="">{t('allEmployees')}</option>
            {employees.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-gray-600">
          <span className="mr-1 block">{t('branch')}</span>
          <select
            className={`${inputClass} w-auto`}
            value={values.branchId}
            onChange={(e) => onChange({ branchId: e.target.value })}
          >
            <option value="">{t('allBranches')}</option>
            {accessibleBranches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-gray-600">
          <span className="mr-1 block">{t('role')}</span>
          <select
            className={`${inputClass} w-auto`}
            value={values.role}
            onChange={(e) =>
              onChange({ role: e.target.value as AuditFilterValues['role'] })
            }
          >
            <option value="">{t('allRoles')}</option>
            {ROLES.map((code) => (
              <option key={code} value={code}>
                {roleLabel(code)}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-gray-600">
          <span className="mr-1 block">{t('action')}</span>
          <select
            className={`${inputClass} w-auto`}
            value={values.action}
            onChange={(e) =>
              onChange({ action: e.target.value as AuditFilterValues['action'] })
            }
          >
            <option value="">{t('allActions')}</option>
            {ACTIONS.map((code) => (
              <option key={code} value={code}>
                {actionLabel(code)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Row 3 — entity narrowing + reset */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-gray-600">
          <span className="mr-1 block">{t('entityType')}</span>
          <input
            className={`${inputClass} w-auto`}
            value={values.entityType}
            onChange={(e) => onChange({ entityType: e.target.value })}
          />
        </label>
        <label className="text-xs text-gray-600">
          <span className="mr-1 block">{t('entityId')}</span>
          <input
            className={`${inputClass} w-auto`}
            value={values.entityId}
            onChange={(e) => onChange({ entityId: e.target.value })}
          />
        </label>
        <div className="ml-auto">
          <Button size="sm" variant="ghost" onClick={onReset}>
            {t('reset')}
          </Button>
        </div>
      </div>
    </div>
  );
}
