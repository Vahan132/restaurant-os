'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useRolesControllerRemove } from '@/api/generated/roles/roles';
import type { RoleResponse } from '@/api/generated/model';
import { RoleFormModal } from '@/components/users/role-form-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/use-confirm';
import { getErrorMessage } from '@/lib/api-error';
import { useRoles, useRolesInvalidation } from '@/lib/users/use-users-data';
import { toast } from '@/stores/toast';

export function RolesTab() {
  const t = useTranslations('roles');
  const tc = useTranslations('common');
  const invalidate = useRolesInvalidation();
  const { ask, dialog } = useConfirm();
  const { roles, isLoading } = useRoles();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RoleResponse | null>(null);
  const remove = useRolesControllerRemove();

  const onDelete = async (role: RoleResponse) => {
    const ok = await ask({
      title: tc('confirm'),
      message: t('confirmDeleteRole'),
      confirmLabel: tc('delete'),
      cancelLabel: tc('cancel'),
      danger: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync({ id: role.id });
      toast.success(t('toast.deleted'));
      await invalidate();
    } catch (err) {
      // Backend rejects deleting a role still assigned to users.
      toast.error(getErrorMessage(err, t('roleInUse')));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button
          variant="primary"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          + {t('addRole')}
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-gray-100" />
            ))}
          </div>
        ) : roles.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">{t('noRoles')}</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 font-medium">{t('name')}</th>
                <th className="px-4 py-2 font-medium">{t('code')}</th>
                <th className="px-4 py-2 font-medium">{t('permissions')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id} className="border-b border-gray-100">
                  <td className="px-4 py-2 font-medium text-gray-800">
                    <span className="flex items-center gap-2">
                      {role.name}
                      {role.isSystem && <Badge tone="blue">{t('system')}</Badge>}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-600">{role.code}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {t('permissionCount', { count: role.permissions.length })}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditing(role);
                          setFormOpen(true);
                        }}
                      >
                        {tc('edit')}
                      </Button>
                      {role.isSystem ? (
                        <Button size="sm" variant="ghost" disabled title={t('systemRoleTooltip')}>
                          {tc('delete')}
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => onDelete(role)}>
                          {tc('delete')}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {formOpen && <RoleFormModal role={editing} onClose={() => setFormOpen(false)} />}
      {dialog}
    </div>
  );
}
