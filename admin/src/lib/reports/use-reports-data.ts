'use client';

import { useMemo } from 'react';

import {
  useReportsControllerGetByItem,
  useReportsControllerGetByPaymentMethod,
  useReportsControllerGetByTable,
  useReportsControllerGetByWaiter,
  useReportsControllerGetCancellations,
  useReportsControllerGetDiscounts,
  useReportsControllerGetSummary,
  useReportsControllerGetTimeSeries,
} from '@/api/generated/reports/reports';
import type {
  CancellationsResponse,
  DiscountsResponse,
  ItemRowResponse,
  PaymentMethodResponse,
  SalesSummaryResponse,
  TableRowResponse,
  TimeSeriesBucketResponse,
  WaiterRowResponse,
} from '@/api/generated/model';
import { normalizeList } from '@/lib/normalize-list';
import type { GroupBy } from '@/lib/reports/date-range';

const enabledFor = (from: string, to: string) => Boolean(from && to);

export function useSummary(from: string, to: string) {
  const q = useReportsControllerGetSummary(
    { from, to },
    { query: { enabled: enabledFor(from, to) } },
  );
  return { ...q, summary: q.data as SalesSummaryResponse | undefined };
}

export function useTimeSeries(from: string, to: string, groupBy: GroupBy) {
  const q = useReportsControllerGetTimeSeries(
    { from, to, groupBy },
    { query: { enabled: enabledFor(from, to) } },
  );
  const buckets = useMemo(
    () => normalizeList<TimeSeriesBucketResponse>(q.data).items,
    [q.data],
  );
  return { ...q, buckets };
}

export function useByPaymentMethod(from: string, to: string) {
  const q = useReportsControllerGetByPaymentMethod(
    { from, to },
    { query: { enabled: enabledFor(from, to) } },
  );
  const rows = useMemo(() => normalizeList<PaymentMethodResponse>(q.data).items, [q.data]);
  return { ...q, rows };
}

export function useByWaiter(from: string, to: string) {
  const q = useReportsControllerGetByWaiter(
    { from, to },
    { query: { enabled: enabledFor(from, to) } },
  );
  const rows = useMemo(() => normalizeList<WaiterRowResponse>(q.data).items, [q.data]);
  return { ...q, rows };
}

export function useByTable(from: string, to: string) {
  const q = useReportsControllerGetByTable(
    { from, to },
    { query: { enabled: enabledFor(from, to) } },
  );
  const rows = useMemo(() => normalizeList<TableRowResponse>(q.data).items, [q.data]);
  return { ...q, rows };
}

export function useByItem(from: string, to: string) {
  const q = useReportsControllerGetByItem(
    { from, to },
    { query: { enabled: enabledFor(from, to) } },
  );
  const rows = useMemo(() => normalizeList<ItemRowResponse>(q.data).items, [q.data]);
  return { ...q, rows };
}

export function useDiscounts(from: string, to: string) {
  const q = useReportsControllerGetDiscounts(
    { from, to },
    { query: { enabled: enabledFor(from, to) } },
  );
  return { ...q, discounts: q.data as DiscountsResponse | undefined };
}

export function useCancellations(from: string, to: string) {
  const q = useReportsControllerGetCancellations(
    { from, to },
    { query: { enabled: enabledFor(from, to) } },
  );
  return { ...q, cancellations: q.data as CancellationsResponse | undefined };
}
