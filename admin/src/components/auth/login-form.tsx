'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import type { ApiError } from '@/api/mutator';
import { getAdminDeviceSecret } from '@/lib/auth/admin-device';
import { login } from '@/lib/auth/auth-service';
import { getErrorMessage, isApiError } from '@/lib/api-error';
import { toast } from '@/stores/toast';

/**
 * Heuristic: did login fail because this admin/manager needs an enrolled ADMIN
 * device (3A anchoring)? The backend rejects with 403 and a device-anchoring
 * code; we surface enrollment guidance rather than an "invalid credentials"
 * toast. Owner logins are exempt server-side, so they never hit this path.
 */
function isDeviceRequiredError(error: unknown): error is ApiError {
  if (!isApiError(error)) return false;
  if (error.status === 403) return true;
  return /device|anchor/i.test(`${error.code} ${error.message}`);
}

export function LoginForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deviceBlocked, setDeviceBlocked] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setDeviceBlocked(false);
    try {
      // Send this machine's enrolled ADMIN device secret when present (3A).
      const deviceSecret = (await getAdminDeviceSecret()) ?? undefined;
      await login(email, password, deviceSecret);
      router.replace('/');
    } catch (error) {
      if (isDeviceRequiredError(error)) {
        setDeviceBlocked(true);
      } else {
        toast.error(getErrorMessage(error, t('invalidCredentials')));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          {t('email')}
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          {t('password')}
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </div>

      {deviceBlocked && (
        <div
          role="alert"
          className="space-y-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
        >
          <p className="font-medium">{t('deviceBlockedTitle')}</p>
          <p>{t('deviceBlockedBody')}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-brand px-3 py-2 text-sm font-medium text-brand-fg transition-colors hover:opacity-90 disabled:opacity-60"
      >
        {submitting ? t('signingIn') : t('signIn')}
      </button>
    </form>
  );
}
