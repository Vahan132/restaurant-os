'use client';

import { keepPreviousData, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import {
  useMissedCallsControllerList,
  getMissedCallsControllerListQueryKey,
} from '@/api/generated/reservations/reservations';
import {
  MissedCallsControllerListStatus,
  type MissedCallResponse,
  type MissedCallsControllerListParams,
} from '@/api/generated/model';
import { normalizeList } from '@/lib/normalize-list';
import { useRealtimeEvent } from '@/lib/realtime/use-realtime-event';

/** Missed-call inbox (default NEW), newest first. */
export function useMissedCalls(status?: MissedCallsControllerListStatus) {
  const params: MissedCallsControllerListParams = status ? { status } : {};
  const query = useMissedCallsControllerList(params, {
    query: { placeholderData: keepPreviousData },
  });
  const calls = useMemo(() => {
    const { items } = normalizeList<MissedCallResponse>(query.data);
    return [...items].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }, [query.data]);
  return { ...query, calls };
}

/** Count of NEW missed calls for the tab badge. */
export function useNewMissedCallCount(): number {
  const query = useMissedCallsControllerList(
    { status: MissedCallsControllerListStatus.NEW },
    { query: { placeholderData: keepPreviousData } },
  );
  return useMemo(
    () => normalizeList<MissedCallResponse>(query.data).items.length,
    [query.data],
  );
}

export function useMissedCallsInvalidation() {
  const qc = useQueryClient();
  return useCallback(
    () =>
      qc.invalidateQueries({
        queryKey: getMissedCallsControllerListQueryKey().slice(0, 1),
      }),
    [qc],
  );
}

/** Live inbox: new calls appear immediately via the A3 realtime client. */
export function useMissedCallsLive(): void {
  const invalidate = useMissedCallsInvalidation();
  useRealtimeEvent('missedcall.new', () => {
    void invalidate();
  });
}
