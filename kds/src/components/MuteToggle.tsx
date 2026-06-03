'use client';

import { useTranslations } from 'next-intl';
import { useSoundStore } from '@/lib/kds/sound';

/** Mute/unmute the new-ticket chime. Persisted in localStorage. */
export function MuteToggle() {
  const t = useTranslations('topbar');
  const muted = useSoundStore((s) => s.muted);
  const toggle = useSoundStore((s) => s.toggleMuted);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={muted}
      title={muted ? t('unmute') : t('mute')}
      className="rounded-md border border-kiosk-border bg-kiosk-panel px-3 py-2 text-base text-kiosk-text hover:bg-kiosk-border"
    >
      {muted ? `🔇 ${t('muted')}` : `🔔 ${t('sound')}`}
    </button>
  );
}
