'use client';

import { useQueryClient } from '@tanstack/react-query';

import { getReportsControllerGetDashboardQueryKey } from '@/api/generated/reports/reports';
import { useRealtimeEvent } from '@/lib/realtime/use-realtime-event';

/**
 * Keeps the dashboard live: invalidate the dashboard query when orders change
 * or become ready, so today's figures refresh through service. Reuses the A3
 * realtime client.
 */
export function useDashboardLive(): void {
  const qc = useQueryClient();
  const invalidate = () =>
    void qc.invalidateQueries({ queryKey: getReportsControllerGetDashboardQueryKey() });

  useRealtimeEvent('order.updated', invalidate);
  useRealtimeEvent('order.ready', invalidate);
}
