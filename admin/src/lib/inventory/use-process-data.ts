'use client';

import { keepPreviousData, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import {
  useProcessesControllerList,
  useProcessesControllerGet,
  getProcessesControllerListQueryKey,
  getProcessesControllerGetQueryKey,
} from '@/api/generated/inventory-processes/inventory-processes';
import {
  useProcessRunsControllerList,
  useProcessRunsControllerGet,
  getProcessRunsControllerListQueryKey,
} from '@/api/generated/inventory-process-runs/inventory-process-runs';
import type {
  ProcessResponse,
  ProcessRunResponse,
  ProcessesControllerListParams,
  ProcessRunsControllerListParams,
} from '@/api/generated/model';
import { normalizeList } from '@/lib/normalize-list';
import { usePaginatedStock } from '@/lib/inventory/use-inventory-data';

/**
 * Current unit cost (minor currency units per base unit) per item, derived from
 * the stock view's valuation / on-hand. Used only for the informational batch
 * and run cost previews — the authoritative cost is computed by the backend on
 * run (FIFO/FEFO). Returns 0 for items with no on-hand stock.
 */
export function useUnitCostMap() {
  const { rows, isLoading } = usePaginatedStock({ limit: 100 });
  const unitCost = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      map.set(r.itemId, r.onHandBase > 0 ? r.valuation_amount / r.onHandBase : 0);
    }
    return (itemId: string) => map.get(itemId) ?? 0;
  }, [rows]);
  return { unitCost, isLoading };
}

/** Paginated process definitions (filter: search). */
export function usePaginatedProcesses(params: ProcessesControllerListParams) {
  const query = useProcessesControllerList(params, {
    query: { placeholderData: keepPreviousData },
  });
  const { items, pagination } = useMemo(
    () => normalizeList<ProcessResponse>(query.data),
    [query.data],
  );
  return { ...query, processes: items, pagination };
}

/** All processes for selects (runs filter). */
export function useProcessesForSelect() {
  const query = useProcessesControllerList(
    { limit: 100 },
    { query: { placeholderData: keepPreviousData } },
  );
  const { items } = useMemo(
    () => normalizeList<ProcessResponse>(query.data),
    [query.data],
  );
  return { ...query, processes: items };
}

/** Single process with inputs + outputs. */
export function useProcess(processId: string | null) {
  return useProcessesControllerGet(processId ?? '', {
    query: { enabled: !!processId },
  });
}

/** Paginated production runs (filter: processId + date range). */
export function usePaginatedRuns(params: ProcessRunsControllerListParams) {
  const query = useProcessRunsControllerList(params, {
    query: { placeholderData: keepPreviousData },
  });
  const { items, pagination } = useMemo(
    () => normalizeList<ProcessRunResponse>(query.data),
    [query.data],
  );
  return { ...query, runs: items, pagination };
}

/** Single run with cost breakdown + consumed/produced movements. */
export function useRun(runId: string | null) {
  return useProcessRunsControllerGet(runId ?? '', {
    query: { enabled: !!runId },
  });
}

/** Invalidate process-definition caches after a create/update/delete. */
export function useProcessesInvalidation() {
  const qc = useQueryClient();
  return useCallback(
    async (processId?: string) => {
      await Promise.all([
        qc.invalidateQueries({
          queryKey: getProcessesControllerListQueryKey().slice(0, 1),
        }),
        processId
          ? qc.invalidateQueries({
              queryKey: getProcessesControllerGetQueryKey(processId),
            })
          : Promise.resolve(),
      ]);
    },
    [qc],
  );
}

/** Invalidate run-history caches after a production run. */
export function useRunsInvalidation() {
  const qc = useQueryClient();
  return useCallback(
    () =>
      qc.invalidateQueries({
        queryKey: getProcessRunsControllerListQueryKey().slice(0, 1),
      }),
    [qc],
  );
}
