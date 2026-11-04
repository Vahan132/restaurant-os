'use client';

import { keepPreviousData, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import {
  useReservationDevicesControllerList,
  getReservationDevicesControllerListQueryKey,
} from '@/api/generated/reservations/reservations';
import type { CallDeviceResponse } from '@/api/generated/model';
import { normalizeList } from '@/lib/normalize-list';

/** Paired companion devices, newest first. */
export function useDevices() {
  const query = useReservationDevicesControllerList({
    query: { placeholderData: keepPreviousData },
  });
  const devices = useMemo(() => {
    const { items } = normalizeList<CallDeviceResponse>(query.data);
    return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [query.data]);
  return { ...query, devices };
}

export function useDevicesInvalidation() {
  const qc = useQueryClient();
  return useCallback(
    () =>
      qc.invalidateQueries({
        queryKey: getReservationDevicesControllerListQueryKey().slice(0, 1),
      }),
    [qc],
  );
}
