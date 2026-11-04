'use client';

import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { EDGE_ALLOWED_NAV_KEYS, NAV_ITEMS } from '@/components/shell/nav-config';
import { useBranchContext } from '@/lib/branch/use-branch-context';
import { useEdgeMode } from '@/lib/edge/use-edge-mode';
import { useActiveBranchStore } from '@/stores/active-branch';

/** Route prefixes hidden in edge mode -> bounced to the dashboard. */
const EDGE_BLOCKED_PREFIXES = NAV_ITEMS.filter(
  (i) => !EDGE_ALLOWED_NAV_KEYS.has(i.key),
)
  .flatMap((i) => [i.href, ...(i.children?.map((c) => c.href) ?? [])])
  .filter((h) => h !== '/');

/**
 * Edge-mode shell adornment: when the admin talks to a hub it (1) locks the
 * active branch to the hub's branch, (2) bounces any cloud-only route back to
 * the dashboard, and (3) shows the offline banner. Renders nothing on the cloud.
 */
export function EdgeBanner() {
  const t = useTranslations('edge');
  const { isEdge, branchId } = useEdgeMode();
  const { activeBranch } = useBranchContext();
  const setActiveBranch = useActiveBranchStore((s) => s.setActiveBranch);
  const pathname = usePathname();
  const router = useRouter();

  // (1) Lock the active branch to the hub's single branch.
  useEffect(() => {
    if (isEdge && branchId && useActiveBranchStore.getState().activeBranchId !== branchId) {
      setActiveBranch(branchId);
    }
  }, [isEdge, branchId, setActiveBranch]);

  // (2) Defense in depth: bounce cloud-only routes to the dashboard.
  useEffect(() => {
    if (!isEdge) return;
    const blocked = EDGE_BLOCKED_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    );
    if (blocked) router.replace('/');
  }, [isEdge, pathname, router]);

  if (!isEdge) return null;

  const branch = activeBranch?.name;
  return (
    <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900">
      <span aria-hidden>●</span>
      <span>{branch ? t('offlineBanner', { branch }) : t('offlineBannerNoBranch')}</span>
    </div>
  );
}
