'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { usePlatformAuthControllerLogout } from '@/api/generated/platform-auth/platform-auth';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { Button } from '@/components/ui/button';
import { usePlatformAuthStore } from '@/stores/platform-auth';

const NAV = [
  { key: 'catalog', href: '/platform/catalog' },
  { key: 'fiscalConfig', href: '/platform/fiscal-config' },
];

/** Minimal platform-admin chrome: header + nav + language + logout. */
export function PlatformShell({ children }: { children: ReactNode }) {
  const t = useTranslations('platform');
  const pathname = usePathname();
  const router = useRouter();
  const email = usePlatformAuthStore((s) => s.user?.email);
  const refreshToken = usePlatformAuthStore((s) => s.refreshToken);
  const logoutMut = usePlatformAuthControllerLogout();

  const onLogout = async () => {
    try {
      await logoutMut.mutateAsync({ data: { refreshToken: refreshToken ?? '' } });
    } catch {
      // best-effort; clear locally regardless
    }
    usePlatformAuthStore.getState().clear();
    router.replace('/platform/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="text-base font-semibold text-gray-900">{t('title')}</span>
          <nav className="flex gap-4 text-sm">
            {NAV.map((n) => (
              <Link
                key={n.key}
                href={n.href}
                className={
                  pathname.startsWith(n.href)
                    ? 'font-medium text-brand'
                    : 'text-gray-600 hover:text-gray-900'
                }
              >
                {t(n.key)}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {email && <span className="text-sm text-gray-500">{email}</span>}
          <LanguageSwitcher />
          <Button size="sm" variant="secondary" onClick={onLogout} disabled={logoutMut.isPending}>
            {t('logout')}
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>
    </div>
  );
}
