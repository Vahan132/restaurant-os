'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import {
  useBranchMembershipsControllerList,
  useBranchMembershipsControllerUpsert,
  useBranchMembershipsControllerRemove,
  getBranchMembershipsControllerListQueryKey,
} from '@/api/generated/users/users';
import { useBranchesControllerList } from '@/api/generated/branches/branches';
import type {
  BranchMembershipResponse,
  BranchResponse,
  RoleResponse,
} from '@/api/generated/model';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/ui/form';
import { getErrorMessage } from '@/lib/api-error';
import { normalizeList } from '@/lib/normalize-list';
import { toast } from '@/stores/toast';

/** A pending membership (create flow, before the user exists). */
export interface DraftMembership {
  branchId: string;
  roleId: string;
}

interface Row {
  branchId: string;
  roleId: string;
}

/**
 * Per-branch membership editor (BR-7.1). Works in two modes:
 * - Live (edit): pass `userId`; add/remove call the API immediately.
 * - Draft (create): pass `draft` + `onDraftChange`; memberships are collected
 *   in memory and applied by the parent after the user is created.
 * Either way, branch access is the operational grant that lets a user work
 * inside a branch.
 */
export function BranchMembershipsEditor({
  roles,
  userId,
  draft,
  onDraftChange,
}: {
  roles: RoleResponse[];
  userId?: string;
  draft?: DraftMembership[];
  onDraftChange?: (next: DraftMembership[]) => void;
}) {
  const t = useTranslations('users');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const live = !!userId;

  const membershipsQuery = useBranchMembershipsControllerList(userId ?? '', {
    query: { enabled: live },
  });
  const liveMemberships = useMemo(
    () => normalizeList<BranchMembershipResponse>(membershipsQuery.data).items,
    [membershipsQuery.data],
  );

  const branchesQuery = useBranchesControllerList();
  const branches = useMemo(
    () => normalizeList<BranchResponse>(branchesQuery.data).items,
    [branchesQuery.data],
  );

  const upsert = useBranchMembershipsControllerUpsert();
  const remove = useBranchMembershipsControllerRemove();

  const [branchId, setBranchId] = useState('');
  const [roleId, setRoleId] = useState(roles[0]?.id ?? '');

  const branchName = useMemo(() => {
    const map = new Map(branches.map((b) => [b.id, b.name]));
    return (id: string) => map.get(id) ?? id;
  }, [branches]);
  const roleName = useMemo(() => {
    const map = new Map(roles.map((r) => [r.id, r.name]));
    return (id: string) => map.get(id) ?? id;
  }, [roles]);

  const rows: Row[] = live
    ? liveMemberships.map((m) => ({ branchId: m.branchId, roleId: m.roleId }))
    : (draft ?? []).map((d) => ({ branchId: d.branchId, roleId: d.roleId }));

  const assignedIds = useMemo(() => new Set(rows.map((r) => r.branchId)), [rows]);
  const available = branches.filter((b) => !assignedIds.has(b.id));

  const refresh = () =>
    qc.invalidateQueries({
      queryKey: getBranchMembershipsControllerListQueryKey(userId ?? ''),
    });

  const onAdd = async () => {
    if (!branchId || !roleId) return;
    if (live && userId) {
      try {
        await upsert.mutateAsync({ id: userId, data: { branchId, roleId } });
        toast.success(t('toast.membershipAdded'));
        setBranchId('');
        await refresh();
      } catch (err) {
        toast.error(getErrorMessage(err));
      }
    } else {
      onDraftChange?.([...(draft ?? []), { branchId, roleId }]);
      setBranchId('');
    }
  };

  const onRemove = async (row: Row) => {
    if (live && userId) {
      try {
        await remove.mutateAsync({ id: userId, branchId: row.branchId });
        toast.success(t('toast.membershipRemoved'));
        await refresh();
      } catch (err) {
        toast.error(getErrorMessage(err));
      }
    } else {
      onDraftChange?.((draft ?? []).filter((d) => d.branchId !== row.branchId));
    }
  };

  const loading = live && membershipsQuery.isLoading;

  return (
    <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs text-gray-500">{t('branchAccessHint')}</p>

      {loading ? (
        <div className="h-8 animate-pulse rounded-md bg-gray-100" />
      ) : rows.length === 0 ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {t('noBranchAccessWarning')}
        </p>
      ) : (
        <ul className="space-y-1">
          {rows.map((row) => (
            <li
              key={row.branchId}
              className="flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm"
            >
              <span className="min-w-0 truncate font-medium text-gray-800">
                {branchName(row.branchId)}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <Badge tone="blue">{roleName(row.roleId)}</Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onRemove(row)}
                  disabled={remove.isPending}
                >
                  {tc('remove')}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex-1 space-y-1">
          <span className="block text-xs font-medium text-gray-600">{t('branch')}</span>
          <select
            className={inputClass}
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          >
            <option value="">{t('selectBranch')}</option>
            {available.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex-1 space-y-1">
          <span className="block text-xs font-medium text-gray-600">{t('role')}</span>
          <select
            className={inputClass}
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="secondary"
          onClick={onAdd}
          disabled={!branchId || !roleId || upsert.isPending}
        >
          {t('addBranchAccess')}
        </Button>
      </div>
    </div>
  );
}
