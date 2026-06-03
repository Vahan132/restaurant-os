'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import {
  useBranchesControllerDeactivate,
  useBranchesControllerList,
} from '@/api/generated/restaurant-branches/restaurant-branches';
import { BranchResponseStatus, type BranchResponse } from '@/api/generated/model';
import { BranchFormModal } from '@/components/settings/branch-form-modal';
import { Can } from '@/components/auth/can';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/use-confirm';
import { getErrorMessage } from '@/lib/api-error';
import { normalizeList } from '@/lib/normalize-list';
import { PERMISSIONS } from '@/lib/permissions';
import { useSettingsInvalidation } from '@/lib/settings/use-settings-data';
import { toast } from '@/stores/toast';

export function BranchesTab() {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const { invalidateBranches } = useSettingsInvalidation();
  const { ask, dialog } = useConfirm();

  const { data, isLoading } = useBranchesControllerList();
  const branches = useMemo(() => normalizeList<BranchResponse>(data).items, [data]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BranchResponse | null>(null);
  const deactivate = useBranchesControllerDeactivate();

  const onDeactivate = async (branch: BranchResponse) => {
    const ok = await ask({
      title: tc('confirm'),
      message: t('confirmDeactivate'),
      confirmLabel: t('deactivate'),
      cancelLabel: tc('cancel'),
      danger: true,
    });
    if (!ok) return;
    try {
      await deactivate.mutateAsync({ id: branch.id });
      toast.success(t('toast.branchDeactivated'));
      await invalidateBranches();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-end">
        <Can permission={PERMISSIONS.SETTINGS_MANAGE}>
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
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {branches.map((branch) => {
                const inactive = branch.status === BranchResponseStatus.INACTIVE;
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
                      <Can permission={PERMISSIONS.SETTINGS_MANAGE}>
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
                          {!inactive && (
                            <Button size="sm" variant="ghost" onClick={() => onDeactivate(branch)}>
                              {t('deactivate')}
                            </Button>
                          )}
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

      {formOpen && <BranchFormModal branch={editing} onClose={() => setFormOpen(false)} />}
      {dialog}
    </div>
  );
}
