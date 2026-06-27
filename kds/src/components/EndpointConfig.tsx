'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useEndpointStore } from '@/lib/endpoint/store';

/**
 * Device-level endpoint chooser shown on the setup screen: talk to the Cloud
 * API (default) or to a Local hub on the venue LAN. The choice persists per
 * device. When Local hub is picked the hub's base URL must be entered; both REST
 * and the realtime socket then point at the hub.
 */
export function EndpointConfig() {
  const t = useTranslations('endpoint');
  const target = useEndpointStore((s) => s.target);
  const hubBaseUrl = useEndpointStore((s) => s.hubBaseUrl);
  const setCloud = useEndpointStore((s) => s.setCloud);
  const setLocalHub = useEndpointStore((s) => s.setLocalHub);

  const [url, setUrl] = useState(hubBaseUrl ?? '');

  // Keep the field in sync if the persisted value loads/changes underneath us.
  useEffect(() => {
    setUrl(hubBaseUrl ?? '');
  }, [hubBaseUrl]);

  const isHub = target === 'LOCAL_HUB';

  function commitHub() {
    const trimmed = url.trim();
    if (trimmed) setLocalHub(trimmed);
  }

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-4">
      <span className="text-kiosk text-kiosk-muted">{t('label')}</span>

      <div className="flex flex-wrap justify-center gap-4">
        <Choice active={!isHub} onClick={setCloud}>
          {t('cloud')}
        </Choice>
        <Choice
          active={isHub}
          onClick={() => {
            if (url.trim()) setLocalHub(url);
            else setLocalHub('');
          }}
        >
          {t('localHub')}
        </Choice>
      </div>

      {isHub && (
        <label className="flex w-full flex-col items-center gap-2">
          <span className="text-base text-kiosk-muted">{t('hubUrlLabel')}</span>
          <input
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={commitHub}
            placeholder={t('hubUrlPlaceholder')}
            className="w-full rounded-lg border-2 border-kiosk-border bg-kiosk-panel px-4 py-3 text-center text-kiosk text-kiosk-text outline-none focus:border-status-sent"
          />
          <span className="text-sm text-kiosk-muted">{t('hubUrlHint')}</span>
        </label>
      )}
    </div>
  );
}

function Choice({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-20 w-48 rounded-xl border-4 px-4 text-kiosk font-bold transition-colors ${
        active
          ? 'border-status-sent bg-status-sent/20 text-kiosk-text'
          : 'border-kiosk-border bg-kiosk-panel text-kiosk-muted hover:border-kiosk-muted'
      }`}
    >
      {children}
    </button>
  );
}
