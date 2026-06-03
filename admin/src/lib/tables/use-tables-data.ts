'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { useFloorsControllerList, getFloorsControllerListQueryKey } from '@/api/generated/floors/floors';
import {
  useTablesControllerList,
  getTablesControllerListQueryKey,
  getTablesControllerFloorPlanQueryKey,
} from '@/api/generated/tables/tables';
import { useRestaurantControllerSettings } from '@/api/generated/restaurant/restaurant';
import type {
  FloorResponse,
  FloorsControllerListParams,
  RestaurantSettingsResponse,
  TableResponse,
} from '@/api/generated/model';
import { FloorResponseStatus } from '@/api/generated/model';
import { normalizeList } from '@/lib/normalize-list';

/** Floors list (optionally including inactive), normalized + sorted. */
export function useFloors(includeInactive = false) {
  const params: FloorsControllerListParams | undefined = includeInactive
    ? { includeInactive: 'true' }
    : undefined;
  const query = useFloorsControllerList(params);
  const floors = useMemo(() => {
    const { items } = normalizeList<FloorResponse>(query.data);
    return [...items].sort((a, b) => a.displayOrder - b.displayOrder);
  }, [query.data]);
  return { ...query, floors };
}

/** Tables list (optionally filtered by floor), normalized. */
export function useTables(floorId?: string) {
  const query = useTablesControllerList(floorId ? { floorId } : undefined);
  const tables = useMemo(
    () => normalizeList<TableResponse>(query.data).items,
    [query.data],
  );
  return { ...query, tables };
}

/** Restaurant settings (for the allowManualTableStatus toggle). */
export function useRestaurantSettings() {
  const query = useRestaurantControllerSettings();
  return {
    ...query,
    settings: query.data as RestaurantSettingsResponse | undefined,
  };
}

/** Centralized invalidation for any table/floor mutation. */
export function useTablesInvalidation() {
  const qc = useQueryClient();
  return useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: getFloorsControllerListQueryKey() }),
      qc.invalidateQueries({ queryKey: getTablesControllerListQueryKey().slice(0, 1) }),
      qc.invalidateQueries({ queryKey: getTablesControllerFloorPlanQueryKey() }),
    ]);
  }, [qc]);
}

export const ACTIVE_FLOOR = FloorResponseStatus.ACTIVE;
