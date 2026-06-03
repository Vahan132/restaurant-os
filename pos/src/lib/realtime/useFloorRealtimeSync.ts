'use client';

import { useRealtimeEvent } from './useRealtimeEvent';
import { useFloorDataInvalidator } from '@/lib/useActiveOrders';

/**
 * Keeps the table-select home fresh: invalidates the floor-plan + active-orders
 * caches whenever a table status or order changes server-side, so tiles and their
 * order summaries update live.
 */
export function useFloorRealtimeSync(): void {
  const invalidate = useFloorDataInvalidator();

  useRealtimeEvent('table.status_changed', () => invalidate());
  useRealtimeEvent('order.updated', () => invalidate());
  useRealtimeEvent('order.closed', () => invalidate());
}
