'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo } from 'react';
import {
  getProcessesControllerListQueryKey,
  getProcessesControllerListQueryOptions,
  processesControllerRun,
} from '@/api/generated/inventory-processes/inventory-processes';
import {
  getStockControllerStockQueryKey,
  getStockControllerStockQueryOptions,
} from '@/api/generated/inventory-stock/inventory-stock';
import type {
  ProcessResponse,
  ProcessRunResponse,
  RunProcessDto,
  StockRowResponse,
} from '@/api/generated/model';
import type { NormalizedError } from '@/api/mutator';
import { useToast } from '@/components/Toast';
import { branchHeaders } from './branchRequest';

/**
 * Page size for the kitchen's process/stock reads. A branch's catalog of
 * prep/production processes (and its stock rows) sits well under the spec's
 * max of 100; deeper pagination is out of scope for the kitchen surface.
 */
const PAGE = { limit: 100 } as const;

/**
 * Branch-scoped query keys. We extend the generated keys with the pinned branch
 * id so a re-pin reads/caches separately and never shows another location's
 * processes or stock — mirroring `ticketsQueryKey`.
 */
export function processesQueryKey(branchId: string) {
  return [...getProcessesControllerListQueryKey(PAGE), branchId] as const;
}
export function stockQueryKey(branchId: string) {
  return [...getStockControllerStockQueryKey(PAGE), branchId] as const;
}

/** Resolved stock figures for one item, indexed by `itemId`. */
export interface StockInfo {
  name: string;
  onHandBase: number;
  lowStock: boolean;
  baseUnit: StockRowResponse['baseUnit'];
}
export type StockIndex = Map<string, StockInfo>;

export interface ProcessesData {
  processes: ProcessResponse[];
  stockIndex: StockIndex;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Reads the pinned branch's prep/production processes plus current stock, both
 * carrying `X-Branch-Id`. Stock rows are indexed by item id so the UI can show
 * each input/output's name, on-hand, and low-stock flag (the chef sees the stock
 * effect before/after a run). Routing to cloud-vs-edge is the mutator's job, so
 * these reads work offline against the hub with no extra code.
 */
export function useProcessesData(branchId: string): ProcessesData {
  const headers = useMemo(() => branchHeaders(branchId), [branchId]);

  const processesQ = useQuery({
    ...getProcessesControllerListQueryOptions(PAGE, {
      query: { staleTime: 10_000, queryKey: processesQueryKey(branchId) },
      request: { headers },
    }),
  });

  const stockQ = useQuery({
    ...getStockControllerStockQueryOptions(PAGE, {
      query: { staleTime: 10_000, queryKey: stockQueryKey(branchId) },
      request: { headers },
    }),
  });

  const stockIndex = useMemo<StockIndex>(() => {
    const map: StockIndex = new Map();
    for (const row of stockQ.data ?? []) {
      map.set(row.itemId, {
        name: row.name,
        onHandBase: row.onHandBase,
        lowStock: row.lowStock,
        baseUnit: row.baseUnit,
      });
    }
    return map;
  }, [stockQ.data]);

  // Only ACTIVE definitions are runnable from the kitchen.
  const processes = useMemo(
    () => (processesQ.data ?? []).filter((p) => p.status === 'ACTIVE'),
    [processesQ.data],
  );

  return {
    processes,
    stockIndex,
    isLoading: processesQ.isLoading || stockQ.isLoading,
    isError: processesQ.isError,
  };
}

/**
 * Runs a process for the pinned branch. The mutation carries `X-Branch-Id`, then
 * invalidates this branch's process + stock caches so the consumed inputs and
 * produced output are reflected. The backend reports `wentNegative` when a run
 * drove an input below zero — we surface it (never block the run on stock, for
 * parity with serve). Errors surface as a normalized toast.
 */
export function useProcessRun(branchId: string) {
  const queryClient = useQueryClient();
  const t = useTranslations('processes');
  const toast = useToast();

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: processesQueryKey(branchId) });
    queryClient.invalidateQueries({ queryKey: stockQueryKey(branchId) });
  }, [queryClient, branchId]);

  const mutation = useMutation({
    mutationFn: (vars: { id: string; data: RunProcessDto }) =>
      processesControllerRun(vars.id, vars.data, { headers: branchHeaders(branchId) }),
    onSuccess: (result: ProcessRunResponse) => {
      refresh();
      if (result.wentNegative) {
        toast.push(t('ranNegative'), 'info');
      } else {
        toast.push(t('ranOk'), 'info');
      }
    },
    onError: (err: unknown) => {
      const e = err as NormalizedError;
      toast.push(e?.message || t('runError'));
    },
  });

  const { mutate } = mutation;
  const run = useCallback(
    (id: string, multiplier: number) => mutate({ id, data: { multiplier } }),
    [mutate],
  );

  return {
    run,
    pendingId: mutation.isPending ? mutation.variables?.id : undefined,
  };
}

export type ProcessRunActions = ReturnType<typeof useProcessRun>;
