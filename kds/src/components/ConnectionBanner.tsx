'use client';

import { useTranslations } from 'next-intl';
import {
  connectionMessageKey,
  connectionTone,
  showConnectionBanner,
  type DisplayConnectionStatus,
} from '@/lib/hub/status';

const TONE_BG: Record<ReturnType<typeof connectionTone>, string> = {
  ok: 'bg-status-ready',
  warn: 'bg-status-preparing',
  bad: 'bg-status-delayed',
};

const TONE_DOT = TONE_BG;

/** Prominent banner shown for disruptive connection states (cloud or hub). */
export function ConnectionBanner({ status }: { status: DisplayConnectionStatus }) {
  const t = useTranslations('connection');
  if (!showConnectionBanner(status)) return null;

  return (
    <div
      role="status"
      className={`w-full px-6 py-3 text-center text-kiosk-lg font-semibold text-white ${TONE_BG[connectionTone(status)]}`}
    >
      {t(connectionMessageKey(status))}
    </div>
  );
}

/** Small inline dot + label for the top strip. */
export function ConnectionIndicator({ status }: { status: DisplayConnectionStatus }) {
  const t = useTranslations('connection');
  return (
    <span className="flex items-center gap-2 text-base text-kiosk-muted">
      <span
        className={`inline-block h-3 w-3 rounded-full ${TONE_DOT[connectionTone(status)]}`}
      />
      {t(connectionMessageKey(status))}
    </span>
  );
}
