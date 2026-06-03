'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

/** Toggles the browser Fullscreen API for the whole document. */
export function FullscreenToggle() {
  const t = useTranslations('topbar');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  async function toggle() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Fullscreen can be blocked (e.g. not a user gesture); ignore quietly.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded-md border border-kiosk-border bg-kiosk-panel px-3 py-2 text-base text-kiosk-text hover:bg-kiosk-border"
    >
      {isFullscreen ? t('exitFullscreen') : t('fullscreen')}
    </button>
  );
}
