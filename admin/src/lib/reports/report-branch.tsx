'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { useReportsControllerGetBranches } from '@/api/generated/reports/reports';
import type { ReportBranchResponse } from '@/api/generated/model';
import { normalizeList } from '@/lib/normalize-list';

/**
 * BR-REPORTS-1: branch filter for the sales / profit reports.
 *
 * The API decides which branches the caller may report on (`GET /reports/branches`):
 * the owner gets every branch, other staff only the branches where they hold
 * reports:view. `''` means "all of those branches" (a roll-up); a branch id
 * narrows every report on the page to that branch.
 */
export type ReportBranch = ReportBranchResponse;

export function useReportBranches(enabled = true) {
  const q = useReportsControllerGetBranches({ query: { enabled, staleTime: 60_000 } });
  return { ...q, branches: normalizeList<ReportBranch>(q.data).items };
}

const KEY = 'reports-branch-v1';

/** Selected report branch ('' = all), remembered per viewer; dropped if no longer allowed. */
export function useReportBranchSelection(branches: ReportBranch[], loaded: boolean) {
  const [branchId, setState] = useState('');
  useEffect(() => {
    try {
      setState(window.localStorage.getItem(KEY) ?? '');
    } catch {
      /* per-viewer convenience only */
    }
  }, []);
  useEffect(() => {
    if (loaded && branchId && !branches.some((b) => b.id === branchId)) setState('');
  }, [loaded, branches, branchId]);
  const setBranchId = (id: string) => {
    setState(id);
    try {
      window.localStorage.setItem(KEY, id);
    } catch {
      /* ignore */
    }
  };
  return { branchId, setBranchId };
}

const Ctx = createContext<string>('');

export function ReportBranchProvider({
  branchId,
  children,
}: {
  branchId: string;
  children: ReactNode;
}) {
  return <Ctx.Provider value={branchId}>{children}</Ctx.Provider>;
}

/** The report branch filter as a query param value (undefined = all allowed branches). */
export function useReportBranchId(): string | undefined {
  return useContext(Ctx) || undefined;
}
