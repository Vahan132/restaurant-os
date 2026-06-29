'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import {
  useUsersControllerBlock,
  useUsersControllerUnblock,
} from '@/api/generated/users/users';
import { UserResponseStatus, type UserResponse } from '@/api/generated/model';
import { PasswordRevealModal } from '@/components/users/password-reveal-modal';
import { ResetPasswordModal } from '@/components/users/reset-password-modal';
import { StaffPinModal } from '@/components/users/staff-pin-modal';
import { UserBranchAccessCell } from '@/components/users/user-branch-access-cell';
import { UserFormModal } from '@/components/users/user-form-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/ui/form';
import { useConfirm } from '@/components/ui/use-confirm';
import { getErrorMessage } from '@/lib/api-error';
import { usePermission } from '@/lib/auth/use-permission';
import { PERMISSIONS } from '@/lib/permissions';
import {
  useCurrentUser,
  usePaginatedUsers,
  useRoles,
  useUsersInvalidation,
} from '@/lib/users/use-users-data';
import { toast } from '@/stores/toast';

const PAGE_SIZE = 20;

export function UsersTab() {
  const t = useTranslations('users');
  const tc = useTranslations('common');
  const invalidate = useUsersInvalidation();
  const { ask, dialog } = useConfirm();
  const currentUser = useCurrentUser();
  // Staff PIN management (3B) is branch-scoped: gate on the active branch.
  const canManagePins = usePermission(PERMISSIONS.STAFF_PIN_MANAGE);

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);
  useEffect(() => setPage(1), [debounced]);

  const params = useMemo(
    () => ({ page, limit: PAGE_SIZE, search: debounced || undefined }),
    [page, debounced],
  );
  const { users, pagination, isLoading, isFetching } = usePaginatedUsers(params);
  const { roles } = useRoles();

  const roleName = useMemo(() => {
    const map = new Map(roles.map((r) => [r.id, r.name]));
    return (id: string) => map.get(id) ?? id;
  }, [roles]);

  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserResponse | null>(null);
  const [resetUser, setResetUser] = useState<UserResponse | null>(null);
  const [pinUser, setPinUser] = useState<UserResponse | null>(null);
  const [revealPassword, setRevealPassword] = useState<string | null>(null);

  const block = useUsersControllerBlock();
  const unblock = useUsersControllerUnblock();

  const onBlock = async (user: UserResponse) => {
    if (user.id === currentUser?.id) {
      toast.error(t('cannotBlockSelf'));
      return;
    }
    const ok = await ask({
      title: tc('confirm'),
      message: t('confirmBlock'),
      confirmLabel: t('block'),
      cancelLabel: tc('cancel'),
      danger: true,
    });
    if (!ok) return;
    try {
      await block.mutateAsync({ id: user.id });
      toast.success(t('toast.blocked'));
      await invalidate(user.id);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const onUnblock = async (user: UserResponse) => {
    try {
      await unblock.mutateAsync({ id: user.id });
      toast.success(t('toast.unblocked'));
      await invalidate(user.id);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const hasNext = pagination?.hasNext ?? users.length === PAGE_SIZE;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${inputClass} max-w-xs`}
          placeholder={t('search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="ml-auto">
          <Button
            variant="primary"
            onClick={() => {
              setEditingUser(null);
              setFormOpen(true);
            }}
          >
            + {t('addUser')}
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-gray-100" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">{t('noUsers')}</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 font-medium">{t('name')}</th>
                <th className="px-4 py-2 font-medium">{t('email')}</th>
                <th className="px-4 py-2 font-medium">{t('role')}</th>
                <th className="px-4 py-2 font-medium">{t('scope')}</th>
                <th className="px-4 py-2 font-medium">{t('branchAccessTitle')}</th>
                <th className="px-4 py-2 font-medium">{t('status')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const blocked = user.status === UserResponseStatus.BLOCKED;
                const isSelf = user.id === currentUser?.id;
                return (
                  <tr key={user.id} className="border-b border-gray-100">
                    <td className="px-4 py-2 font-medium text-gray-800">{user.fullName}</td>
                    <td className="px-4 py-2 text-gray-600">{user.email}</td>
                    <td className="px-4 py-2 text-gray-700">{roleName(user.roleId)}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {user.restaurantId ? t('scopeRestaurant') : t('scopeOrg')}
                    </td>
                    <td className="px-4 py-2">
                      <UserBranchAccessCell userId={user.id} />
                    </td>
                    <td className="px-4 py-2">
                      {blocked ? (
                        <Badge tone="red">{t('blocked')}</Badge>
                      ) : (
                        <Badge tone="green">{t('active')}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setEditingUser(user);
                            setFormOpen(true);
                          }}
                        >
                          {tc('edit')}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setResetUser(user)}>
                          {t('resetPassword')}
                        </Button>
                        {canManagePins && (
                          <Button size="sm" variant="ghost" onClick={() => setPinUser(user)}>
                            {t('pin.action')}
                          </Button>
                        )}
                        {blocked ? (
                          <Button size="sm" variant="ghost" onClick={() => onUnblock(user)}>
                            {t('unblock')}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onBlock(user)}
                            disabled={isSelf}
                            title={isSelf ? t('cannotBlockSelf') : undefined}
                          >
                            {t('block')}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">
          {t('page', { page })}
          {isFetching ? ' …' : ''}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            {t('prev')}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasNext}
          >
            {t('next')}
          </Button>
        </div>
      </div>

      {formOpen && (
        <UserFormModal
          user={editingUser}
          roles={roles}
          currentUser={currentUser}
          onClose={() => setFormOpen(false)}
          onShowPassword={(pw) => setRevealPassword(pw)}
        />
      )}
      {resetUser && (
        <ResetPasswordModal
          user={resetUser}
          onClose={() => setResetUser(null)}
          onShowPassword={(pw) => setRevealPassword(pw)}
        />
      )}
      {revealPassword && (
        <PasswordRevealModal
          password={revealPassword}
          onClose={() => setRevealPassword(null)}
        />
      )}
      {pinUser && <StaffPinModal user={pinUser} onClose={() => setPinUser(null)} />}
      {dialog}
    </div>
  );
}
