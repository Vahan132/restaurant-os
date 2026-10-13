'use client';

import { useEffect, useState } from 'react';
import { API_BASE_URL } from '@/lib/env';
import { getDeviceSecret, persistEnrollment } from './store';

export type EdgeAutoEnrollStatus = 'checking' | 'done' | 'manual';

/**
 * EDGE-OFFLINE-UI: on a hub-served device, skip manual enrollment entirely. When
 * active and this device has no secret yet, ask the backend if it is an EDGE hub
 * (GET /edge/info); if so, fetch the hub's baked KDS device secret
 * (GET /edge/device-key) and persist it — the hub "vouches" for every device it
 * serves. On the cloud (or any failure) we fall back to `manual` enrollment.
 */
export function useEdgeAutoEnroll(active: boolean): EdgeAutoEnrollStatus {
  const [status, setStatus] = useState<EdgeAutoEnrollStatus>(active ? 'checking' : 'manual');

  useEffect(() => {
    if (!active) {
      setStatus('manual');
      return;
    }
    if (getDeviceSecret()) {
      setStatus('done');
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const info = await fetch(`${API_BASE_URL}/edge/info`, { cache: 'no-store' }).then((r) =>
          r.ok ? r.json() : null,
        );
        if (!info || info.mode !== 'EDGE') {
          if (!cancelled) setStatus('manual');
          return;
        }
        const key = await fetch(`${API_BASE_URL}/edge/device-key?surface=KDS`, {
          cache: 'no-store',
        }).then((r) => (r.ok ? r.json() : null));
        if (!key || !key.deviceSecret) {
          if (!cancelled) setStatus('manual');
          return;
        }
        await persistEnrollment(key.deviceSecret, 'KDS');
        if (!cancelled) setStatus('done');
      } catch {
        if (!cancelled) setStatus('manual');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active]);

  return status;
}
