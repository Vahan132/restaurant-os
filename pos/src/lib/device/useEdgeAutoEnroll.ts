'use client';

import { useEffect, useState } from 'react';
import { resolveApiBaseUrl } from '@/stores/endpoint';
import { getDeviceSecret, setDeviceSecret } from '@/lib/device/deviceSecretStore';

export type EdgeAutoEnrollStatus = 'checking' | 'done' | 'manual';

/**
 * EDGE-OFFLINE-UI: on a hub-served terminal, skip manual enrollment. When active
 * and this terminal has no secret, ask the backend if it is an EDGE hub
 * (GET /edge/info); if so, adopt the hub's baked POS device secret
 * (GET /edge/device-key) — the hub "vouches" for the devices it serves. On the
 * cloud (or any failure) fall back to `manual` enrollment.
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
        const base = resolveApiBaseUrl();
        const info = await fetch(`${base}/edge/info`, { cache: 'no-store' }).then((r) =>
          r.ok ? r.json() : null,
        );
        if (!info || info.mode !== 'EDGE') {
          if (!cancelled) setStatus('manual');
          return;
        }
        const key = await fetch(`${base}/edge/device-key?surface=POS`, { cache: 'no-store' }).then(
          (r) => (r.ok ? r.json() : null),
        );
        if (!key || !key.deviceSecret) {
          if (!cancelled) setStatus('manual');
          return;
        }
        await setDeviceSecret(key.deviceSecret);
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
