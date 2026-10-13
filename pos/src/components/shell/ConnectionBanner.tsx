'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useAuthStore } from '@/stores/auth';
import { useRealtime } from '@/lib/realtime/RealtimeProvider';
import { useHubStatus } from '@/lib/hub/HubHealthProvider';

/**
 * Non-blocking top banner for degraded connectivity.
 *
 *  - Cloud terminals: shown when the realtime socket or network is down.
 *  - Hub terminals: "Reconnecting to hub" during a blip, and an informational
 *    "operating locally" note when the hub is up but its internet/cloud is down
 *    (orders still work — the hub is the writer). The hard-down states
 *    (unreachable / mismatch) are handled by the blocking overlay instead.
 */
export function ConnectionBanner() {
  const t = useTranslations('connection');
  const tHub = useTranslations('hub');
  const accessToken = useAuthStore((s) => s.accessToken);
  const { connected, online } = useRealtime();
  const { isHub, state } = useHubStatus();

  // Only meaningful once signed in (the socket connects with the user's token).
  if (!accessToken) return null;

  if (isHub) {
    if (state === 'reconnecting') {
      return <Banner tone="amber">{tHub('reconnectingBanner')}</Banner>;
    }
    if (state === 'offline') {
      return <Banner tone="neutral">{tHub('offlineBanner')}</Banner>;
    }
    return null;
  }

  const isDown = !online || !connected;
  if (!isDown) return null;
  return <Banner tone="amber">{t('offline')}</Banner>;
}

function Banner({ tone, children }: { tone: 'amber' | 'neutral'; children: ReactNode }) {
  const toneClass =
    tone === 'amber'
      ? 'bg-amber-500 text-amber-950'
      : 'bg-gray-800 text-white';
  const dotClass = tone === 'amber' ? 'bg-amber-950' : 'bg-white';
  return (
    <div
      className={`fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 px-4 py-2 text-center text-sm font-semibold shadow ${toneClass}`}
    >
      <span className={`inline-block h-2 w-2 animate-pulse rounded-full ${dotClass}`} />
      {children}
    </div>
  );
}
