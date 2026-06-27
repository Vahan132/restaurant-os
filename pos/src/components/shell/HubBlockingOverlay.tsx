'use client';

import { useTranslations } from 'next-intl';
import { useHubStatus } from '@/lib/hub/HubHealthProvider';
import { EndpointSettings } from '@/components/settings/EndpointSettings';

/**
 * Full-screen blocking state shown when a hub-targeted terminal can't operate:
 *  - unreachable  the hub gave no response after retries
 *  - mismatch     the hub serves the wrong branch / isn't an edge hub
 *
 * A POS can't take orders without its hub (and we deliberately do NOT fall back
 * to the cloud for a hub-managed branch — two writers would diverge), so this is
 * a hard block with a Retry and a route to fix the device endpoint.
 */
export function HubBlockingOverlay() {
  const t = useTranslations('hub');
  const { state, isHub, isBlocking, retry } = useHubStatus();

  if (!isHub || !isBlocking) return null;

  const isMismatch = state === 'mismatch';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/80 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
          <span className="inline-block h-3.5 w-3.5 rounded-full bg-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          {isMismatch ? t('mismatchTitle') : t('unreachableTitle')}
        </h1>
        <p className="mt-2 text-base text-gray-500">
          {isMismatch ? t('mismatchBody') : t('unreachableBody')}
        </p>

        <button
          type="button"
          onClick={retry}
          className="mt-6 h-14 w-full select-none rounded-xl bg-gray-900 text-lg font-bold text-white active:scale-[0.98]"
        >
          {t('retry')}
        </button>

        <div className="mt-4 flex justify-center">
          <EndpointSettings variant="text" />
        </div>
      </div>
    </div>
  );
}
