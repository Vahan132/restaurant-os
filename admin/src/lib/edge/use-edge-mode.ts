'use client';

import { useQuery } from '@tanstack/react-query';

import { edgeControllerInfo, getEdgeControllerInfoQueryKey } from '@/api/generated/edge/edge';

/**
 * Edge-awareness for the admin shell. The hub exposes a PUBLIC `GET /edge/info`
 * reporting its mode and the single branch it serves. When the admin is served
 * by (or pointed at) a hub, `isEdge` is true and `branchId` is that branch — the
 * shell then LOCKS to this branch and shows only the operational-only surface
 * (see EDGE_ALLOWED_NAV_KEYS). On the cloud, mode is CLOUD and nothing changes.
 *
 * `/edge/info` is public and constant for a session, so it is fetched once and
 * never refetched; any failure (e.g. an older backend) simply means "not edge".
 */
export interface EdgeMode {
  loaded: boolean;
  isEdge: boolean;
  branchId: string | null;
  restaurantId: string | null;
}

interface EdgeInfoShape {
  mode?: string;
  branchId?: string | null;
  restaurantId?: string | null;
}

export function useEdgeMode(): EdgeMode {
  const { data, isSuccess } = useQuery({
    queryKey: getEdgeControllerInfoQueryKey(),
    queryFn: ({ signal }) => edgeControllerInfo(undefined, signal),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const info = data as EdgeInfoShape | undefined;
  return {
    loaded: isSuccess,
    isEdge: info?.mode === 'EDGE',
    branchId: info?.branchId ?? null,
    restaurantId: info?.restaurantId ?? null,
  };
}
