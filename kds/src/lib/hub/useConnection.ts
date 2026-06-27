'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/auth/store';
import { useBranchStore } from '@/lib/branch/store';
import {
  isHubTarget,
  resolveEdgeInfoUrl,
  useEndpointStore,
} from '@/lib/endpoint/store';
import { useRealtimeConnection } from '@/lib/realtime/useRealtime';
import { hubMonitor, type HubHealth } from './monitor';
import { deriveDisplayStatus, type DisplayConnectionStatus } from './status';

/**
 * Single source of truth for what the kiosk chrome shows. Drives the realtime
 * socket (via {@link useRealtimeConnection}), runs the hub health probe when the
 * device is hub-managed, and folds both into one display status.
 */
export function useConnection(): { status: DisplayConnectionStatus } {
  const { status: socketStatus } = useRealtimeConnection();

  const target = useEndpointStore((s) => s.target);
  const hubBaseUrl = useEndpointStore((s) => s.hubBaseUrl);
  const accessToken = useAuthStore((s) => s.accessToken);
  const branchId = useBranchStore((s) => s.branchId);

  const [health, setHealth] = useState<HubHealth>(hubMonitor.getHealth());

  useEffect(() => hubMonitor.onChange(setHealth), []);

  const hubConfigured = isHubTarget({ target, hubBaseUrl });

  useEffect(() => {
    const edgeInfoUrl = resolveEdgeInfoUrl({ target, hubBaseUrl });
    if (edgeInfoUrl && branchId && accessToken) {
      hubMonitor.start(edgeInfoUrl, branchId, accessToken);
    } else {
      hubMonitor.stop();
    }
  }, [target, hubBaseUrl, branchId, accessToken]);

  const status = deriveDisplayStatus(target, hubConfigured, socketStatus, health);
  return { status };
}
