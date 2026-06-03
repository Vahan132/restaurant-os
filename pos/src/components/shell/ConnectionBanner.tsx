'use client';

import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/stores/auth';
import { useRealtime } from '@/lib/realtime/RealtimeProvider';

/**
 * Non-blocking banner shown when the realtime socket or network is down.
 * (Full offline mode is future work — this just surfaces the state.)
 */
export function ConnectionBanner() {
  const t = useTranslations('connection');
  const accessToken = useAuthStore((s) => s.accessToken);
  const { connected, online } = useRealtime();

  // Only meaningful once signed in (the socket connects with the user's token).
  if (!accessToken) return null;

  const isDown = !online || !connected;
  if (!isDown) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-amber-950 shadow">
      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-950" />
      {t('offline')}
    </div>
  );
}
