'use client';

import { useQuery } from '@tanstack/react-query';
import {
  tablesControllerFloorPlan,
  getTablesControllerFloorPlanQueryKey,
} from '@/api/generated/tables/tables';
import type { FloorResponse, TableResponse } from '@/api/generated/model';
import { useAuthStore } from '@/stores/auth';

/**
 * GET /tables/floor-plan returns "active floors with their tables", but the
 * OpenAPI spec documents no response schema (orval types it as `void`). We type
 * it here so the home screen + P2 get full type safety.
 */
export interface FloorWithTables extends FloorResponse {
  tables: TableResponse[];
}

export type FloorPlan = FloorWithTables[];

export function useFloorPlan() {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: getTablesControllerFloorPlanQueryKey(),
    queryFn: ({ signal }) =>
      // The endpoint has no documented schema (typed `void` by orval); we know the
      // real shape and assert it here. See FloorWithTables above.
      tablesControllerFloorPlan(undefined, signal) as unknown as Promise<FloorPlan>,
    enabled: Boolean(accessToken),
    staleTime: 15 * 1000,
  });
}
