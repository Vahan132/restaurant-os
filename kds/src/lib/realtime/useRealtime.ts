'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/auth/store';
import { useBranchStore } from '@/lib/branch/store';
import { useStationStore } from '@/lib/station/store';
import { resolveSocketTarget, useEndpointStore } from '@/lib/endpoint/store';
import { ConnectionStatus, realtimeClient } from './client';

/**
 * Keeps the realtime client connected to the current auth token AND pinned
 * branch:station, aimed at the device's endpoint (cloud or local hub), and
 * tracks connection status. The handshake carries the pin, so the socket only
 * ever connects once a branch + station are chosen; it reconnects automatically
 * when the token (refresh), the pin, or the endpoint changes.
 */
export function useRealtimeConnection(): { status: ConnectionStatus } {
  const accessToken = useAuthStore((s) => s.accessToken);
  const branchId = useBranchStore((s) => s.branchId);
  const station = useStationStore((s) => s.station);
  const target = useEndpointStore((s) => s.target);
  const hubBaseUrl = useEndpointStore((s) => s.hubBaseUrl);
  const [status, setStatus] = useState<ConnectionStatus>(realtimeClient.getStatus());

  useEffect(() => {
    const off = realtimeClient.onStatusChange(setStatus);
    return off;
  }, []);

  useEffect(() => {
    if (accessToken && branchId && station) {
      realtimeClient.connect(
        accessToken,
        { branchId, station },
        resolveSocketTarget({ target, hubBaseUrl }),
      );
    } else {
      realtimeClient.disconnect();
    }
  }, [accessToken, branchId, station, target, hubBaseUrl]);

  return { status };
}
