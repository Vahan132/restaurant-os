import { useMemo } from 'react';
import { usePublicDiscoveryControllerDetail } from '@/api/generated/discovery/discovery';
import { usePublicStorefrontControllerBranchMenu } from '@/api/generated/public/public';
import type { PublicMenuResponse } from '@/api/generated/model';
import { parseMenuUrl } from '@/lib/menu-url';

/**
 * useBranchMenu — everything the native menu surface needs, keyed by `branchId`.
 *
 * Bridges the two worlds (see src/lib/menu-url.ts): it reads the branch's discovery
 * detail (cached from the detail screen), derives `restaurantSlug`/`branchSlug` from
 * `detail.menuUrl`, then fetches the branch-explicit public menu. The menu query stays
 * disabled until the slugs resolve, so there is never a request with dangling params.
 *
 * Read-only. ORDER-4 (app ordering) can build cart state ON TOP of `menu` without
 * changing this hook.
 */
export function useBranchMenu(branchId: string) {
  const detailQuery = usePublicDiscoveryControllerDetail(branchId);
  const detail = detailQuery.data;

  const slugs = useMemo(() => parseMenuUrl(detail?.menuUrl), [detail?.menuUrl]);

  // menuPublic === false ⇒ menuUrl is null ⇒ slugs is null ⇒ query stays disabled.
  const menuQuery = usePublicStorefrontControllerBranchMenu(
    slugs?.restaurantSlug,
    slugs?.branchSlug,
    { query: { enabled: !!slugs } },
  );

  const menu: PublicMenuResponse | undefined = menuQuery.data;

  return {
    /** Branch detail (name, logo, weeklyHours…) — reused from the detail screen cache. */
    detail,
    /** The branch's public menu tree, once loaded. */
    menu,
    categories: menu?.categories ?? [],
    /** True while either the detail or (enabled) menu request is in flight. */
    isPending: detailQuery.isPending || (!!slugs && menuQuery.isPending),
    isError: detailQuery.isError || menuQuery.isError,
    /** True when the branch simply has no public menu (menuPublic === false). */
    menuUnavailable: !detailQuery.isPending && !detailQuery.isError && !slugs,
    refetch: () => {
      void detailQuery.refetch();
      if (slugs) void menuQuery.refetch();
    },
  };
}
