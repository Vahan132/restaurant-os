'use client';

import { useQueryClient } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import {
  getModifierGroupsControllerGetQueryKey,
  getModifierGroupsControllerListQueryKey,
  useModifierGroupsControllerGet,
  useModifierGroupsControllerList,
} from '@/api/generated/menu-modifier-groups/menu-modifier-groups';
import type {
  ModifierGroupResponse,
  ModifierGroupsControllerListParams,
} from '@/api/generated/model';

import { normalizeList, type PageInfo } from './use-paginated-items';

/**
 * Reusable modifier-group library list. The endpoint is paginated, so at
 * runtime the mutator unwraps it to `{ items, pagination }` while the generated
 * type says `ModifierGroupResponse[]`; we normalize both shapes here instead of
 * touching generated files.
 */
export function useModifierGroupList(params: ModifierGroupsControllerListParams) {
  const query = useModifierGroupsControllerList(params, {
    query: { placeholderData: keepPreviousData },
  });
  const { groups, pagination } = useMemo(() => {
    const { items, pagination } = normalizeList<ModifierGroupResponse>(query.data);
    return { groups: items, pagination };
  }, [query.data]);
  return { ...query, groups, pagination };
}

/** Single library group with its options (sorted by sortOrder). */
export function useModifierGroup(id: string | null) {
  return useModifierGroupsControllerGet(id ?? '', {
    query: { enabled: !!id },
  });
}

export type { PageInfo };

/** Cache invalidation for modifier-group library writes. */
export function useModifierGroupsInvalidation() {
  const qc = useQueryClient();

  // Match every library list regardless of filter/page params (prefix match).
  const invalidateGroups = useCallback(
    () =>
      qc.invalidateQueries({
        queryKey: getModifierGroupsControllerListQueryKey().slice(0, 1),
      }),
    [qc],
  );

  const invalidateGroup = useCallback(
    (id: string) =>
      qc.invalidateQueries({ queryKey: getModifierGroupsControllerGetQueryKey(id) }),
    [qc],
  );

  const invalidateAll = useCallback(
    async (id?: string) => {
      await Promise.all([
        invalidateGroups(),
        id ? invalidateGroup(id) : Promise.resolve(),
      ]);
    },
    [invalidateGroups, invalidateGroup],
  );

  return { invalidateGroups, invalidateGroup, invalidateAll };
}
