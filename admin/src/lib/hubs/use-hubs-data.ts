'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import {
  useEdgeNodesControllerListNodes,
  getEdgeNodesControllerListNodesQueryKey,
} from '@/api/generated/edge-nodes/edge-nodes';
import type { EdgeNodeResponse } from '@/api/generated/model';
import { normalizeList } from '@/lib/normalize-list';

/** How often the hub list refetches so status/telemetry stay current. */
export const HUBS_REFRESH_MS = 15 * 1000;

/**
 * Restaurant-wide edge-node list (OFF-8), normalized (array or { items }) and
 * polled on an interval so liveness stays fresh without a manual reload. This
 * is a restaurant-level resource — it does not depend on the active branch.
 */
export function useHubs() {
  const query = useEdgeNodesControllerListNodes({
    query: {
      refetchInterval: HUBS_REFRESH_MS,
      refetchOnWindowFocus: true,
    },
  });
  const hubs = useMemo(
    () => normalizeList<EdgeNodeResponse>(query.data).items,
    [query.data],
  );
  return { ...query, hubs };
}

/** Invalidate the hub list after a register / revoke write. */
export function useHubsInvalidation() {
  const qc = useQueryClient();
  return useCallback(
    () =>
      qc.invalidateQueries({
        queryKey: getEdgeNodesControllerListNodesQueryKey(),
      }),
    [qc],
  );
}
