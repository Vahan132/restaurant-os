'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { normalizeBaseUrl, useEndpointStore, type ApiTarget } from '@/stores/endpoint';

/**
 * Per-device endpoint configuration: point this terminal at the Cloud (default)
 * or a Local hub on the LAN. Device-level, persisted (see `@/stores/endpoint`),
 * and intentionally does NOT sign the user out — the hub accepts the existing
 * cloud-issued token (OFF-5). Switching targets clears cached data so menu /
 * tables / orders reload from the new backend; the mutator, realtime socket and
 * hub-health probe all re-resolve automatically off the store change.
 *
 * Rendered both in the top bar (gear) and on the login screen (text), so a fresh
 * terminal can be pointed at its hub before anyone signs in.
 */
export function EndpointSettings({ variant = 'gear' }: { variant?: 'gear' | 'text' }) {
  const t = useTranslations('hub');
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === 'gear' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('openSettings')}
          title={t('openSettings')}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-600 active:scale-95"
        >
          <GearIcon />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 text-base font-semibold text-gray-500 underline-offset-2 hover:underline"
        >
          <GearIcon />
          {t('openSettings')}
        </button>
      )}

      {open ? <EndpointDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function EndpointDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations('hub');
  const tc = useTranslations('common');
  const queryClient = useQueryClient();

  const currentTarget = useEndpointStore((s) => s.target);
  const currentHubUrl = useEndpointStore((s) => s.hubBaseUrl);
  const setCloud = useEndpointStore((s) => s.setCloud);
  const setHub = useEndpointStore((s) => s.setHub);

  const [target, setTarget] = useState<ApiTarget>(currentTarget);
  const [url, setUrl] = useState(currentHubUrl ?? '');
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);

    if (target === 'hub') {
      const normalized = normalizeBaseUrl(url);
      if (!normalized) {
        setError(t('invalidUrl'));
        return;
      }
      const changed = currentTarget !== 'hub' || currentHubUrl !== normalized;
      setHub(normalized);
      if (changed) queryClient.clear();
    } else {
      const changed = currentTarget !== 'cloud';
      setCloud();
      if (changed) queryClient.clear();
    }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-gray-900">{t('settingsTitle')}</h2>
        <p className="mt-2 text-base text-gray-500">{t('settingsSubtitle')}</p>

        <div className="mt-5 space-y-3">
          <TargetOption
            checked={target === 'cloud'}
            onSelect={() => setTarget('cloud')}
            title={t('targetCloud')}
            hint={t('targetCloudHint')}
          />
          <TargetOption
            checked={target === 'hub'}
            onSelect={() => setTarget('hub')}
            title={t('targetHub')}
            hint={t('targetHubHint')}
          />
        </div>

        {target === 'hub' ? (
          <div className="mt-4">
            <label htmlFor="hub-url" className="mb-2 block text-base font-semibold text-gray-700">
              {t('hubUrlLabel')}
            </label>
            <input
              id="hub-url"
              type="url"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t('hubUrlPlaceholder')}
              className="h-14 w-full rounded-xl border border-gray-300 px-4 text-lg outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
            />
            <p className="mt-2 text-sm text-gray-500">{t('hubUrlHint')}</p>
          </div>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-base font-medium text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-14 flex-1 select-none rounded-xl border border-gray-300 text-lg font-semibold text-gray-700 active:scale-[0.98]"
          >
            {tc('cancel')}
          </button>
          <button
            type="button"
            onClick={save}
            className="h-14 flex-1 select-none rounded-xl bg-gray-900 text-lg font-bold text-white active:scale-[0.98]"
          >
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}

function TargetOption({
  checked,
  onSelect,
  title,
  hint,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left active:scale-[0.99] ${
        checked ? 'border-gray-900 bg-gray-50' : 'border-gray-300 bg-white'
      }`}
    >
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
          checked ? 'border-gray-900' : 'border-gray-400'
        }`}
      >
        {checked ? <span className="h-2.5 w-2.5 rounded-full bg-gray-900" /> : null}
      </span>
      <span className="min-w-0">
        <span className="block text-lg font-semibold text-gray-900">{title}</span>
        <span className="block text-sm text-gray-500">{hint}</span>
      </span>
    </button>
  );
}

function GearIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
