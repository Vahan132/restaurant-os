'use client';

import { useTranslations } from 'next-intl';
import { useRestaurantControllerProfile } from '@/api/generated/restaurant/restaurant';
import { useAuthMe } from '@/lib/useAuthMe';
import { useAuthStore } from '@/stores/auth';
import { useRealtime } from '@/lib/realtime/RealtimeProvider';
import { LanguageSwitcher } from './LanguageSwitcher';
import { OrderRequestsBell } from '@/components/requests/OrderRequestsBell';

/**
 * POS top bar (workflow-driven shell — NOT an admin sidebar):
 * restaurant name, current user, language switcher, connection dot, logout.
 */
export function TopBar() {
  const t = useTranslations('common');
  const { data: restaurant } = useRestaurantControllerProfile();
  const { data: me } = useAuthMe();
  const clear = useAuthStore((s) => s.clear);
  const { connected, online } = useRealtime();

  const live = connected && online;

  function logout() {
    clear();
    // Hard navigation doesn't get Next's basePath, so prefix it (/res/pos/login).
    window.location.assign(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/login`);
  }

  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b border-gray-200 bg-white px-4 shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`inline-block h-3 w-3 shrink-0 rounded-full ${live ? 'bg-green-500' : 'bg-amber-500'}`}
          title={live ? 'online' : 'reconnecting'}
        />
        <h1 className="truncate text-xl font-bold text-gray-900">
          {restaurant?.name ?? t('appName')}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {me?.user.fullName ? (
          <span className="hidden truncate text-base font-medium text-gray-600 sm:inline">
            {me.user.fullName}
          </span>
        ) : null}
        <OrderRequestsBell />
        <LanguageSwitcher />
        <button
          type="button"
          onClick={logout}
          className="min-h-tap select-none rounded-xl bg-gray-900 px-5 text-base font-semibold text-white active:scale-95"
        >
          {t('signOut')}
        </button>
      </div>
    </header>
  );
}
