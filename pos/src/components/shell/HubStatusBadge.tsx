'use client';

import { useTranslations } from 'next-intl';
import { useHubStatus } from '@/lib/hub/HubHealthProvider';
import type { HubConnectionState } from '@/lib/hub/useHubHealth';

/**
 * Top-bar indicator for the Local hub connection. Mirrors the simple colored-dot
 * language already used for the cloud socket, adding a short label for the four
 * hub states (synced / offline / reconnecting / unreachable). Renders nothing on
 * Cloud terminals.
 */
const DOT_CLASS: Record<HubConnectionState, string> = {
  idle: 'bg-gray-400',
  connecting: 'bg-gray-400 animate-pulse',
  synced: 'bg-green-500',
  offline: 'bg-amber-500',
  reconnecting: 'bg-amber-500 animate-pulse',
  unreachable: 'bg-red-500',
  mismatch: 'bg-red-500',
};

export function HubStatusBadge() {
  const t = useTranslations('hub');
  const { state, isHub } = useHubStatus();

  if (!isHub || state === 'idle') return null;

  const label = t(state);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-2.5 py-1"
      title={label}
    >
      <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${DOT_CLASS[state]}`} />
      <span className="hidden truncate text-sm font-semibold text-gray-700 sm:inline">
        {label}
      </span>
    </span>
  );
}
