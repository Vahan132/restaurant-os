'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useAuthControllerLogin } from '@/api/generated/auth/auth';
import { useDevicesControllerEnroll } from '@/api/generated/devices/devices';
import { EnrollDeviceDtoSurface } from '@/api/generated/model';
import { useAuthStore } from '@/stores/auth';
import { useDeviceSecret } from '@/lib/device/useDeviceSecret';
import { useEdgeAutoEnroll } from '@/lib/device/useEdgeAutoEnroll';
import type { ApiError } from '@/api/mutator';
import { EndpointSettings } from '@/components/settings/EndpointSettings';

/**
 * Device-enrollment gate — the outermost gate on this terminal.
 *
 *  - While the IndexedDB secret is still loading → a brief loading frame (no flash).
 *  - No secret → this terminal isn't enrolled: show the enroll screen and render
 *    NOTHING else (not even /login), so an unenrolled terminal can't reach the app.
 *  - Has a secret → passthrough to the normal auth/branch flow (staff-picker login).
 *
 * Enrollment uses a TEMPORARY manager session purely to authorize the enroll call;
 * the backend returns the device secret ONCE, we persist it, then end that session.
 */
export function DeviceEnrollmentGate({ children }: { children: ReactNode }) {
  const t = useTranslations('enroll');
  const { hydrated, enrolled } = useDeviceSecret();

  // EDGE-OFFLINE-UI: on a hub, adopt the hub's baked device (no enrollment). The
  // hook no-ops on the cloud, so cloud terminals still enroll manually.
  const autoEnroll = useEdgeAutoEnroll(hydrated && !enrolled);

  if (!hydrated) {
    return <EnrollFullScreen>{t('loading')}</EnrollFullScreen>;
  }

  if (!enrolled) {
    // Only show manual enrollment once we know this is NOT a hub (or the hub has
    // no baked device); while adopting the hub device, show the loading frame.
    if (autoEnroll === 'manual') {
      return <EnrollDeviceScreen />;
    }
    return <EnrollFullScreen>{t('loading')}</EnrollFullScreen>;
  }

  return <>{children}</>;
}

function EnrollDeviceScreen() {
  const t = useTranslations('enroll');
  const { enroll } = useDeviceSecret();
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clear);

  const managerLogin = useAuthControllerLogin();
  const enrollDevice = useDevicesControllerEnroll();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submitting = managerLogin.isPending || enrollDevice.isPending;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setError(t('errorLabelRequired'));
      return;
    }

    try {
      // 1) Temporary manager session — authorizes the enroll call only.
      const session = await managerLogin.mutateAsync({ data: { email, password } });
      setSession(
        { accessToken: session.accessToken, refreshToken: session.refreshToken },
        session.user,
      );

      // 2) Enroll THIS device for the POS surface; secret is returned once.
      const result = await enrollDevice.mutateAsync({
        data: { surface: EnrollDeviceDtoSurface.POS, label: trimmedLabel },
      });

      // 3) End the manager session, then persist the secret. Order matters: drop
      //    the elevated session BEFORE the device flips to "enrolled", so the gate
      //    never briefly shows the app under the manager's identity.
      clearSession();
      await enroll(result.secret);
      // The gate now sees an enrolled, unauthenticated terminal → staff-picker login.
    } catch (err) {
      clearSession();
      setError(mapEnrollError(err, t));
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-100 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
        <p className="mt-2 text-base text-gray-500">{t('subtitle')}</p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="device-label" className="mb-2 block text-base font-semibold text-gray-700">
              {t('deviceLabel')}
            </label>
            <input
              id="device-label"
              type="text"
              required
              maxLength={200}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t('deviceLabelPlaceholder')}
              className="h-14 w-full rounded-xl border border-gray-300 px-4 text-lg outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
            />
          </div>

          <div className="border-t border-gray-100 pt-5">
            <p className="mb-3 text-sm font-medium text-gray-500">{t('managerHint')}</p>
            <label htmlFor="manager-email" className="mb-2 block text-base font-semibold text-gray-700">
              {t('managerEmail')}
            </label>
            <input
              id="manager-email"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('managerEmailPlaceholder')}
              className="h-14 w-full rounded-xl border border-gray-300 px-4 text-lg outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
            />
          </div>

          <div>
            <label htmlFor="manager-password" className="mb-2 block text-base font-semibold text-gray-700">
              {t('managerPassword')}
            </label>
            <input
              id="manager-password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('managerPasswordPlaceholder')}
              className="h-14 w-full rounded-xl border border-gray-300 px-4 text-lg outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
            />
          </div>

          {error ? (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-base font-medium text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="h-16 w-full select-none rounded-xl bg-gray-900 text-xl font-bold text-white transition active:scale-[0.98] disabled:opacity-60"
          >
            {submitting ? t('enrolling') : t('enroll')}
          </button>
        </form>

        {/* Point this terminal at its Local hub before enrolling, if applicable. */}
        <div className="mt-6 flex justify-center border-t border-gray-100 pt-5">
          <EndpointSettings variant="text" />
        </div>
      </div>
    </div>
  );
}

/**
 * Map an enroll/login failure to a clear message. The backend distinguishes
 * "wrong surface", "no capability" (403), and bad manager credentials (401).
 */
function mapEnrollError(err: unknown, t: (key: string) => string): string {
  const apiErr = err as ApiError | undefined;
  if (apiErr?.status === 401) return t('errorBadCredentials');
  if (apiErr?.status === 403) return apiErr.message || t('errorNoCapability');
  return apiErr?.message || t('error');
}

function EnrollFullScreen({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-gray-100 p-6 text-lg text-gray-500">
      {children}
    </div>
  );
}
