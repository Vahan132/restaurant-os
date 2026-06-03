'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import {
  useReservationsControllerList,
  useReservationsControllerAvailability,
  getReservationsControllerListQueryKey,
  getReservationsControllerGetQueryKey,
  getReservationsControllerAvailabilityQueryKey,
} from '@/api/generated/reservations/reservations';
import type {
  ReservationResponse,
  ReservationsControllerListParams,
  ReservationsControllerListStatus,
  TableAvailabilityResponse,
} from '@/api/generated/model';
import { normalizeList } from '@/lib/normalize-list';
import { useRealtimeEvent } from '@/lib/realtime/use-realtime-event';

const DAY_LIMIT = 100;

/** Reservations for a calendar day (restaurant tz), normalized + sorted. */
export function useReservationsByDay(
  date: string,
  status?: ReservationsControllerListStatus,
) {
  const params: ReservationsControllerListParams = {
    date,
    limit: DAY_LIMIT,
    ...(status ? { status } : {}),
  };
  const query = useReservationsControllerList(params);
  const reservations = useMemo(() => {
    const { items } = normalizeList<ReservationResponse>(query.data);
    return [...items].sort((a, b) => a.reservedAt.localeCompare(b.reservedAt));
  }, [query.data]);
  return { ...query, reservations };
}

/** Table availability for a [windowStart, windowEnd) window. */
export function useAvailability(windowStart: string, windowEnd: string, enabled: boolean) {
  const query = useReservationsControllerAvailability(
    { windowStart, windowEnd },
    { query: { enabled } },
  );
  const tables = useMemo(
    () => normalizeList<TableAvailabilityResponse>(query.data).items,
    [query.data],
  );
  return { ...query, tables };
}

export function useReservationsInvalidation() {
  const qc = useQueryClient();
  return useCallback(
    async (id?: string) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: getReservationsControllerListQueryKey().slice(0, 1) }),
        qc.invalidateQueries({
          queryKey: getReservationsControllerAvailabilityQueryKey({
            windowStart: '',
            windowEnd: '',
          }).slice(0, 1),
        }),
        id
          ? qc.invalidateQueries({ queryKey: getReservationsControllerGetQueryKey(id) })
          : Promise.resolve(),
      ]);
    },
    [qc],
  );
}

/**
 * Live day list: invalidate reservation queries when the backend broadcasts a
 * "reservation.updated" event (multiple hosts stay in sync). Reuses the A3
 * realtime client.
 */
export function useReservationsLive(): void {
  const invalidate = useReservationsInvalidation();
  useRealtimeEvent('reservation.updated', () => {
    void invalidate();
  });
}
