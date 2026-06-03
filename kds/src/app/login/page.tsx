'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/useAuth';
import { useAuthStore } from '@/lib/auth/store';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function LoginPage() {
  const t = useTranslations('login');
  const router = useRouter();
  const { login, loading, error } = useAuth();
  const isAuthed = useAuthStore((s) => Boolean(s.accessToken));
  const hydrated = useAuthStore((s) => s.hydrated);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // If already signed in, leave the login screen.
  useEffect(() => {
    if (hydrated && isAuthed) router.replace('/');
  }, [hydrated, isAuthed, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await login(email, password);
    if (ok) router.replace('/');
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center px-6">
      <div className="absolute right-6 top-6">
        <LanguageSwitcher />
      </div>

      <form
        onSubmit={onSubmit}
        className="flex w-full max-w-xl flex-col gap-6 rounded-2xl border border-kiosk-border bg-kiosk-panel p-10"
      >
        <h1 className="text-kiosk-xl font-bold">{t('title')}</h1>

        <label className="flex flex-col gap-2 text-kiosk text-kiosk-muted">
          {t('email')}
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
          {t('password')}
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
            {error.status === 401 ? t('invalid') : t('error')}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-status-sent px-6 py-5 text-kiosk-lg font-bold text-white disabled:opacity-60"
        >
          {loading ? t('signingIn') : t('signIn')}
        </button>
      </form>
    </div>
  );
}
