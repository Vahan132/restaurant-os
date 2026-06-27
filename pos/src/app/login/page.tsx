'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useAuthControllerLogin } from '@/api/generated/auth/auth';
import { useAuthStore } from '@/stores/auth';
import type { ApiError } from '@/api/mutator';
import { EndpointSettings } from '@/components/settings/EndpointSettings';

export default function LoginPage() {
  const t = useTranslations('login');
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const login = useAuthControllerLogin();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await login.mutateAsync({ data: { email, password } });
      // Store tokens + user from the login response; /auth/me hydrates permissions
      // once we land on the protected home (via useAuthMe).
      setSession({ accessToken: res.accessToken, refreshToken: res.refreshToken }, res.user);
      router.replace('/');
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr?.message ?? t('error'));
    }
  }

  const submitting = login.isPending;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-100 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
        <p className="mt-2 text-base text-gray-500">{t('subtitle')}</p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="email" className="mb-2 block text-base font-semibold text-gray-700">
              {t('email')}
            </label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('emailPlaceholder')}
              className="h-14 w-full rounded-xl border border-gray-300 px-4 text-lg outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-base font-semibold text-gray-700">
              {t('password')}
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('passwordPlaceholder')}
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
            {submitting ? t('submitting') : t('submit')}
          </button>
        </form>

        {/* Per-device endpoint config — point this terminal at its Local hub
            before signing in (the hub authenticates the login locally). */}
        <div className="mt-6 flex justify-center border-t border-gray-100 pt-5">
          <EndpointSettings variant="text" />
        </div>
      </div>
    </div>
  );
}
