'use client';

import { useQueryClient } from '@tanstack/react-query';

import { getFloorsControllerListQueryKey } from '@/api/generated/floors/floors';
import {
  getTablesControllerFloorPlanQueryKey,
  getTablesControllerListQueryKey,
} from '@/api/generated/tables/tables';

import { useRealtimeEvent } from './use-realtime-event';

/**
 * Keeps the floor plan live: when the backend broadcasts a table status change,
 * invalidate the floor-plan / floors / tables queries so the UI refetches.
 *
 * POS and KDS will add their own equivalents (subscribing to order/ticket
 * events) using the same useRealtimeEvent primitive.
 */
export function useFloorPlanLive(): void {
  const qc = useQueryClient();

  useRealtimeEvent('table.status_changed', () => {
    void qc.invalidateQueries({ queryKey: getTablesControllerFloorPlanQueryKey() });
    void qc.invalidateQueries({ queryKey: getTablesControllerListQueryKey().slice(0, 1) });
    void qc.invalidateQueries({ queryKey: getFloorsControllerListQueryKey() });
  });
}
