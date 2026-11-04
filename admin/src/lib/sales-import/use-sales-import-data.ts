'use client';

import { useMemo } from 'react';

import {
  useSalesImportControllerByItem,
  useSalesImportControllerByPaymentMethod,
  useSalesImportControllerList,
  useSalesImportControllerSummary,
  useSalesImportControllerTimeseries,
} from '@/api/generated/sales-import/sales-import';
import type {
  ImportBatchResponse,
  ImportedItemRowResponse,
  ImportedPaymentMethodResponse,
  ImportedSalesSummaryResponse,
  ImportedTimeSeriesBucketResponse,
} from '@/api/generated/model';
import { normalizeList } from '@/lib/normalize-list';
import type { GroupBy } from '@/lib/reports/date-range';
import { useReportBranchId } from '@/lib/reports/report-branch';

const enabledFor = (from: string, to: string) => Boolean(from && to);

/** Past import batches for the active branch (newest first). */
export function useImportBatches(enabled = true) {
  const q = useSalesImportControllerList({ query: { enabled } });
  const batches = useMemo(() => normalizeList<ImportBatchResponse>(q.data).items, [q.data]);
  return { ...q, batches };
}

export function useImportedSummary(from: string, to: string, enabled = true) {
  const branchId = useReportBranchId();
  const q = useSalesImportControllerSummary(
    { from, to, branchId },
    { query: { enabled: enabled && enabledFor(from, to) } },
  );
  return { ...q, summary: q.data as ImportedSalesSummaryResponse | undefined };
}

export function useImportedTimeSeries(from: string, to: string, groupBy: GroupBy, enabled = true) {
  const branchId = useReportBranchId();
  const q = useSalesImportControllerTimeseries(
    { from, to, groupBy, branchId },
    { query: { enabled: enabled && enabledFor(from, to) } },
  );
  const buckets = useMemo(
    () => normalizeList<ImportedTimeSeriesBucketResponse>(q.data).items,
    [q.data],
  );
  return { ...q, buckets };
}

export function useImportedByItem(from: string, to: string, enabled = true) {
  const branchId = useReportBranchId();
  const q = useSalesImportControllerByItem(
    { from, to, branchId },
    { query: { enabled: enabled && enabledFor(from, to) } },
  );
  const rows = useMemo(() => normalizeList<ImportedItemRowResponse>(q.data).items, [q.data]);
  return { ...q, rows };
}

export function useImportedByPaymentMethod(from: string, to: string, enabled = true) {
  const branchId = useReportBranchId();
  const q = useSalesImportControllerByPaymentMethod(
    { from, to, branchId },
    { query: { enabled: enabled && enabledFor(from, to) } },
  );
  const rows = useMemo(() => normalizeList<ImportedPaymentMethodResponse>(q.data).items, [q.data]);
  return { ...q, rows };
}
