'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useEnrollment } from '@/lib/device/useStaffAuth';
import { EndpointConfig } from './EndpointConfig';
import { LanguageSwitcher } from './LanguageSwitcher';

/**
 * Enrollment gate for an UNENROLLED KDS device. A manager signs in once with
 * email + password to bind this screen to the kitchen; the device secret is
 * stored locally (IndexedDB) and the manager session ends immediately. After
 * this, staff sign in by PIN — no manager password on the floor.
 *
 * The connection (cloud / local hub) can be chosen here so an offline-first
 * kiosk is pointed at its hub before it ever talks to the backend.
 */
export function DeviceEnrollment({ onEnrolled }: { onEnrolled: () => void }) {
  const t = useTranslations('enroll');
  const { enroll, loading, error } = useEnrollment();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [label, setLabel] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { ok } = await enroll(email, password, label);
    if (ok) onEnrolled();
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="absolute right-6 top-6">
        <LanguageSwitcher />
      </div>

      <form
        onSubmit={onSubmit}
        className="flex w-full max-w-xl flex-col gap-6 rounded-2xl border border-kiosk-border bg-kiosk-panel p-10"
      >
        <div>
          <h1 className="text-kiosk-xl font-bold">{t('title')}</h1>
          <p className="mt-2 text-kiosk text-kiosk-muted">{t('subtitle')}</p>
        </div>

        <label className="flex flex-col gap-2 text-kiosk text-kiosk-muted">
          {t('deviceLabel')}
          <input
            type="text"
            value={label}
            maxLength={200}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t('deviceLabelPlaceholder')}
            className="rounded-lg border border-kiosk-border bg-kiosk-bg px-5 py-4 text-kiosk-lg text-kiosk-text outline-none focus:border-status-sent"
          />
        </label>

        <label className="flex flex-col gap-2 text-kiosk text-kiosk-muted">
          {t('managerEmail')}
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-kiosk-border bg-kiosk-bg px-5 py-4 text-kiosk-lg text-kiosk-text outline-none focus:border-status-sent"
          />
        </label>

        <label className="flex flex-col gap-2 text-kiosk text-kiosk-muted">
          {t('managerPassword')}
          <input
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-kiosk-border bg-kiosk-bg px-5 py-4 text-kiosk-lg text-kiosk-text outline-none focus:border-status-sent"
          />
        </label>

        {error && (
          <p className="text-kiosk font-semibold text-status-delayed">
            {error.status === 401
              ? t('invalid')
              : error.status === 403
                ? t('forbidden')
                : t('error')}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-status-sent px-6 py-5 text-kiosk-lg font-bold text-white disabled:opacity-60"
        >
          {loading ? t('enrolling') : t('enroll')}
        </button>

        <div className="border-t border-kiosk-border pt-6">
          <EndpointConfig />
        </div>
      </form>
    </div>
  );
}
