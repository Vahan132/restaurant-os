'use client';

import { keepPreviousData, useQueries, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import {
  useInventoryLocationsControllerList,
  inventoryLocationsControllerOnHand,
  getInventoryLocationsControllerListQueryKey,
  getInventoryLocationsControllerOnHandQueryKey,
} from '@/api/generated/inventory-locations/inventory-locations';
import {
  useInventoryTransfersControllerList,
  useInventoryTransfersControllerGet,
  getInventoryTransfersControllerListQueryKey,
} from '@/api/generated/inventory-transfers/inventory-transfers';
import type {
  InventoryLocationResponse,
  OnHandRowResponse,
  TransferResponse,
  InventoryTransfersControllerListParams,
} from '@/api/generated/model';
import { normalizeList } from '@/lib/normalize-list';

export const MAIN_STORAGE = 'MAIN_STORAGE';

export function useLocations() {
  const query = useInventoryLocationsControllerList({
    query: { placeholderData: keepPreviousData },
  });
  const { items } = useMemo(
    () => normalizeList<InventoryLocationResponse>(query.data),
    [query.data],
  );
  return { ...query, locations: items };
}

export function useDefaultLocation() {
  const { locations } = useLocations();
  return useMemo(
    () =>
      locations.find((l) => l.isDefault) ??
      locations.find((l) => l.systemType === MAIN_STORAGE) ??
      null,
    [locations],
  );
}

function onHandRowsOf(data: unknown): OnHandRowResponse[] {
  return normalizeList<OnHandRowResponse>(data).items;
}

export function useBranchOnHand() {
  const { locations, isLoading: locLoading } = useLocations();

  const results = useQueries({
    queries: locations.map((loc) => ({
      queryKey: getInventoryLocationsControllerOnHandQueryKey(loc.id),
      queryFn: () => inventoryLocationsControllerOnHand(loc.id),
      placeholderData: keepPreviousData,
    })),
  });

  const rows = useMemo<OnHandRowResponse[]>(
    () => results.flatMap((r) => onHandRowsOf(r.data)),
    [results],
  );

  const byItemLocation = useMemo(() => {
    const map = new Map<string, OnHandRowResponse>();
    for (const row of rows) map.set(`${row.itemId}::${row.locationId}`, row);
    return map;
  }, [rows]);

  const isLoading = locLoading || results.some((r) => r.isLoading);
  const isFetching = results.some((r) => r.isFetching);
  const isError = results.some((r) => r.isError);

  return { rows, byItemLocation, locations, isLoading, isFetching, isError };
}

export function useOnHandFor(
  byItemLocation: Map<string, OnHandRowResponse>,
  itemId: string,
  locationId: string,
): number | null {
  return itemId && locationId
    ? (byItemLocation.get(`${itemId}::${locationId}`)?.quantity ?? null)
    : null;
}

export function useNegativeWorklist() {
  const { rows, locations, isLoading, isFetching, isError } = useBranchOnHand();
  const negatives = useMemo(
    () =>
      rows
        .filter((r) => r.quantity < 0)
        .sort((a, b) => a.quantity - b.quantity),
    [rows],
  );
  return { negatives, locations, isLoading, isFetching, isError };
}

export function usePaginatedTransfers(params: InventoryTransfersControllerListParams) {
  const query = useInventoryTransfersControllerList(params, {
    query: { placeholderData: keepPreviousData },
  });
  const { items, pagination } = useMemo(
    () => normalizeList<TransferResponse>(query.data),
    [query.data],
  );
  return { ...query, transfers: items, pagination };
}

export function useTransfer(transferId: string | null) {
  return useInventoryTransfersControllerGet(transferId ?? '', {
    query: { enabled: !!transferId },
  });
}

export function useLocationsInvalidation() {
  const qc = useQueryClient();
  return useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({
        queryKey: getInventoryLocationsControllerListQueryKey(),
      }),
      qc.invalidateQueries({
        predicate: (q) => {
          const root = q.queryKey[0];
          return (
            typeof root === 'string' &&
            root.startsWith('/inventory/locations/') &&
            root.endsWith('/on-hand')
          );
        },
      }),
      qc.invalidateQueries({
        queryKey: getInventoryTransfersControllerListQueryKey().slice(0, 1),
      }),
    ]);
  }, [qc]);
}
