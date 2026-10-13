'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

import { useBranchMembershipsControllerList } from '@/api/generated/users/users';
import type { BranchMembershipResponse } from '@/api/generated/model';
import { Badge } from '@/components/ui/badge';
import { normalizeList } from '@/lib/normalize-list';

/**
 * Shows a user's current per-branch access in the Users list (BR-7.1). Flags
 * users with no membership — they can't operate in any branch.
 */
export function UserBranchAccessCell({ userId }: { userId: string }) {
  const t = useTranslations('users');
  const query = useBranchMembershipsControllerList(userId);
  const items = useMemo(
    () => normalizeList<BranchMembershipResponse>(query.data).items,
    [query.data],
  );

  if (query.isLoading) return <span className="text-xs text-gray-400">…</span>;
  if (items.length === 0) return <Badge tone="amber">{t('noBranchAccess')}</Badge>;

  const names = items.map((m) => m.branchName ?? m.branchId);
  const shown = names.slice(0, 2).join(', ');
  const extra = names.length > 2 ? ` +${names.length - 2}` : '';
  return (
    <span className="text-xs text-gray-700" title={names.join(', ')}>
      {shown}
      {extra}
    </span>
  );
}
