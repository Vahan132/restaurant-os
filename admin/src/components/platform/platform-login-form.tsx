'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { usePlatformAuthControllerLogin } from '@/api/generated/platform-auth/platform-auth';
import type { PlatformTokensResponse } from '@/api/generated/model';
import { getErrorMessage } from '@/lib/api-error';
import { usePlatformAuthStore } from '@/stores/platform-auth';
import { toast } from '@/stores/toast';

export function PlatformLoginForm() {
  const t = useTranslations('platformAuth');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const loginMut = usePlatformAuthControllerLogin();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const tokens = (await loginMut.mutateAsync({
        data: { email, password },
      })) as PlatformTokensResponse;
      usePlatformAuthStore.getState().setAuth({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: tokens.user,
      });
      router.replace('/platform/catalog');
    } catch (error) {
      toast.error(getErrorMessage(error, t('invalidCredentials')));
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="platform-email" className="block text-sm font-medium text-gray-700">
          {t('email')}
        </label>
        <input
          id="platform-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="platform-password" className="block text-sm font-medium text-gray-700">
          {t('password')}
        </label>
        <input
          id="platform-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </div>

      <button
        type="submit"
        disabled={loginMut.isPending}
        className="w-full rounded-md bg-brand px-3 py-2 text-sm font-medium text-brand-fg transition-colors hover:opacity-90 disabled:opacity-60"
      >
        {loginMut.isPending ? t('signingIn') : t('signIn')}
      </button>
    </form>
  );
}
