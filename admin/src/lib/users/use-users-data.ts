'use client';

import { keepPreviousData, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import {
  useUsersControllerList,
  getUsersControllerListQueryKey,
  getUsersControllerGetQueryKey,
} from '@/api/generated/users/users';
import {
  useRolesControllerList,
  useRolesControllerPermissions,
  getRolesControllerListQueryKey,
} from '@/api/generated/roles/roles';
import type {
  PermissionsResponse,
  RoleResponse,
  UserResponse,
  UsersControllerListParams,
} from '@/api/generated/model';
import { normalizeList } from '@/lib/normalize-list';
import { useAuthStore } from '@/stores/auth';

/** Paginated users list, normalized (handles array or { items, pagination }). */
export function usePaginatedUsers(params: UsersControllerListParams) {
  const query = useUsersControllerList(params, {
    query: { placeholderData: keepPreviousData },
  });
  const { items, pagination } = useMemo(
    () => normalizeList<UserResponse>(query.data),
    [query.data],
  );
  return { ...query, users: items, pagination };
}

/** Roles list, normalized + sorted (system roles first, then by name). */
export function useRoles() {
  const query = useRolesControllerList();
  const roles = useMemo(() => {
    const { items } = normalizeList<RoleResponse>(query.data);
    return [...items].sort((a, b) => {
      if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [query.data]);
  return { ...query, roles };
}

/** Permission catalog (GET /permissions). */
export function usePermissionsCatalog() {
  const query = useRolesControllerPermissions();
  const permissions = useMemo(
    () => (query.data as PermissionsResponse | undefined)?.permissions ?? [],
    [query.data],
  );
  return { ...query, permissions };
}

export function useUsersInvalidation() {
  const qc = useQueryClient();
  return useCallback(
    async (userId?: string) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: getUsersControllerListQueryKey().slice(0, 1) }),
        userId
          ? qc.invalidateQueries({ queryKey: getUsersControllerGetQueryKey(userId) })
          : Promise.resolve(),
      ]);
    },
    [qc],
  );
}

export function useRolesInvalidation() {
  const qc = useQueryClient();
  return useCallback(
    () => qc.invalidateQueries({ queryKey: getRolesControllerListQueryKey() }),
    [qc],
  );
}

/** The currently authenticated user (for self-safety guards). */
export function useCurrentUser() {
  return useAuthStore((s) => s.user);
}
