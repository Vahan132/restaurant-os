'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/useAuth';

/** Shown to an authenticated user who lacks KDS_ACCESS. No path to the board. */
export function NoKitchenAccess() {
  const t = useTranslations('access');
  const { logout } = useAuth();
  const router = useRouter();

  async function onLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6 px-8 text-center">
      <h1 className="text-kiosk-xl font-bold text-status-delayed">{t('noAccessTitle')}</h1>
      <p className="max-w-2xl text-kiosk-lg text-kiosk-muted">{t('noAccessBody')}</p>
      <button
        type="button"
        onClick={onLogout}
        className="rounded-lg bg-kiosk-panel px-8 py-4 text-kiosk-lg font-semibold hover:bg-kiosk-border"
      >
        {t('logout')}
      </button>
    </div>
  );
}
