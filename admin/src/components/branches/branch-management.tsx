'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import {
  useBranchesControllerDisable,
  useBranchesControllerMakeDefault,
} from '@/api/generated/branches/branches';
import {
  BranchResponseStatus,
  type BranchResponse,
} from '@/api/generated/model';
import { Can } from '@/components/auth/can';
import { BranchFormModal } from '@/components/branches/branch-form-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/use-confirm';
import { getErrorMessage } from '@/lib/api-error';
import {
  useBranchesAdmin,
  useBranchesAdminInvalidation,
} from '@/lib/branch/use-branches-admin';
import { usePermission } from '@/lib/auth/use-permission';
import { PERMISSIONS } from '@/lib/permissions';
import { toast } from '@/stores/toast';

export function BranchManagement() {
  const t = useTranslations('branch');
  const tc = useTranslations('common');
  const canManage = usePermission(PERMISSIONS.BRANCH_MANAGE, 'restaurant');
  const invalidate = useBranchesAdminInvalidation();
  const { ask, dialog } = useConfirm();

  const { branches, isLoading } = useBranchesAdmin();
  const activeCount = useMemo(
    () => branches.filter((b) => b.status === BranchResponseStatus.ACTIVE).length,
    [branches],
  );

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BranchResponse | null>(null);

  const disable = useBranchesControllerDisable();
  const makeDefault = useBranchesControllerMakeDefault();

  const onMakeDefault = async (branch: BranchResponse) => {
    const ok = await ask({
      title: tc('confirm'),
      message: t('confirmMakeDefault', { name: branch.name }),
      confirmLabel: t('makeDefault'),
      cancelLabel: tc('cancel'),
    });
    if (!ok) return;
    try {
      await makeDefault.mutateAsync({ id: branch.id });
      toast.success(t('toast.madeDefault'));
      await invalidate();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const onDisable = async (branch: BranchResponse) => {
    const ok = await ask({
      title: tc('confirm'),
      message: t('confirmDisable', { name: branch.name }),
      confirmLabel: t('disable'),
      cancelLabel: tc('cancel'),
      danger: true,
    });
    if (!ok) return;
    try {
      await disable.mutateAsync({ id: branch.id });
      toast.success(t('toast.disabled'));
      await invalidate();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>
        <Can permission={PERMISSIONS.BRANCH_MANAGE} scope="restaurant">
          <Button
            variant="primary"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            + {t('addBranch')}
          </Button>
        </Can>
      </div>

      <p className="text-sm text-gray-500">{t('subtitle')}</p>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-gray-100" />
            ))}
          </div>
        ) : branches.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">{t('noBranches')}</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 font-medium">{t('branchName')}</th>
                <th className="px-4 py-2 font-medium">{t('status')}</th>
                <th className="px-4 py-2 font-medium">{t('default')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {branches.map((branch) => {
                const inactive = branch.status === BranchResponseStatus.INACTIVE;
                const isLastActive = !inactive && activeCount <= 1;
                // Backend rule: cannot disable the default or the last active branch.
                const disableBlocked = branch.isDefault || isLastActive || inactive;
                const disableReason = branch.isDefault
                  ? t('cannotDisableDefault')
                  : isLastActive
                    ? t('cannotDisableLast')
                    : undefined;
                return (
                  <tr key={branch.id} className="border-b border-gray-100">
                    <td className="px-4 py-2 font-medium text-gray-800">{branch.name}</td>
                    <td className="px-4 py-2">
                      {inactive ? (
                        <Badge tone="gray">{t('inactive')}</Badge>
                      ) : (
                        <Badge tone="green">{t('active')}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {branch.isDefault ? <Badge tone="blue">{t('default')}</Badge> : null}
                    </td>
                    <td className="px-4 py-2">
                      <Can permission={PERMISSIONS.BRANCH_MANAGE} scope="restaurant">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setEditing(branch);
                              setFormOpen(true);
                            }}
                          >
                            {tc('edit')}
                          </Button>
                          {!branch.isDefault && !inactive && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onMakeDefault(branch)}
                              disabled={makeDefault.isPending}
                            >
                              {t('makeDefault')}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onDisable(branch)}
                            disabled={disableBlocked || disable.isPending}
                            title={disableReason}
                          >
                            {t('disable')}
                          </Button>
                        </div>
                      </Can>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {!canManage && (
        <p className="rounded-md border border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-500">
          {t('readOnly')}
        </p>
      )}

      {formOpen && (
        <BranchFormModal branch={editing} onClose={() => setFormOpen(false)} />
      )}
      {dialog}
    </div>
  );
}
