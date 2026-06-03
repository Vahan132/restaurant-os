'use client';

import { useTranslations } from 'next-intl';
import type { ConnectionStatus } from '@/lib/realtime/client';

/** Prominent banner shown whenever the realtime socket is not connected. */
export function ConnectionBanner({ status }: { status: ConnectionStatus }) {
  const t = useTranslations('connection');
  if (status === 'connected') return null;

  return (
    <div
      role="status"
      className="w-full bg-status-delayed px-6 py-3 text-center text-kiosk-lg font-semibold text-white"
    >
      {status === 'connecting' ? t('connecting') : t('disconnected')}
    </div>
  );
}

/** Small inline dot + label for the top strip. */
export function ConnectionIndicator({ status }: { status: ConnectionStatus }) {
  const t = useTranslations('connection');
  const color =
    status === 'connected'
      ? 'bg-status-ready'
      : status === 'connecting'
        ? 'bg-status-preparing'
        : 'bg-status-delayed';
  return (
    <span className="flex items-center gap-2 text-base text-kiosk-muted">
      <span className={`inline-block h-3 w-3 rounded-full ${color}`} />
      {t(status)}
    </span>
  );
}
