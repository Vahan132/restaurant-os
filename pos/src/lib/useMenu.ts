'use client';

import { useQuery } from '@tanstack/react-query';
import {
  menuControllerTree,
  getMenuControllerTreeQueryKey,
} from '@/api/generated/menu/menu';
import type { CategoryResponse, MenuItemDetailResponse } from '@/api/generated/model';
import { useAuthStore } from '@/stores/auth';

/**
 * GET /menu returns "ordered ACTIVE categories with their ACTIVE items + modifiers",
 * but the spec documents no response schema (orval types it `void`). We assert the
 * shape here. Inactive categories/items are already excluded server-side; unavailable
 * items are present but flagged via `availability`.
 */
export interface MenuCategoryWithItems extends CategoryResponse {
  items: MenuItemDetailResponse[];
}

export type MenuTree = MenuCategoryWithItems[];

export function useMenu() {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: getMenuControllerTreeQueryKey(),
    queryFn: ({ signal }) =>
      menuControllerTree(undefined, undefined, signal) as unknown as Promise<MenuTree>,
    enabled: Boolean(accessToken),
    // Menu changes rarely during a shift — cache aggressively for snappy tabs.
    staleTime: 5 * 60 * 1000,
  });
}
