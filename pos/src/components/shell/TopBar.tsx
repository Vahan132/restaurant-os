'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { getAuthControllerMeQueryKey } from '@/api/generated/auth/auth';
import { useRestaurantControllerProfile } from '@/api/generated/restaurant/restaurant';
import { useAuthMe } from '@/lib/useAuthMe';
import { useAuthStore } from '@/stores/auth';
import { useRealtime } from '@/lib/realtime/RealtimeProvider';
import { useHubStatus } from '@/lib/hub/HubHealthProvider';
import { LanguageSwitcher } from './LanguageSwitcher';
import { HubStatusBadge } from './HubStatusBadge';
import { OrderRequestsBell } from '@/components/requests/OrderRequestsBell';
import { BranchMenu } from '@/components/branch/BranchMenu';
import { EndpointSettings } from '@/components/settings/EndpointSettings';
import { StaffPickerLogin } from '@/components/auth/StaffPickerLogin';
import { Can, PERMISSIONS } from '@/lib/permissions';

/**
 * POS top bar (workflow-driven shell — NOT an admin sidebar):
 * restaurant name, current user, language switcher, connection dot, change
 * account, logout.
 *
 * Handover ("Change account") opens the staff picker + 6-digit PIN pad as an
 * overlay rather than signing out, so the terminal keeps its branch and the
 * waiter stays on the screen they were on. The incoming user's effective
 * permissions come from GET /auth/me, which is cached, so that entry is REMOVED
 * on a successful swap rather than just invalidated: invalidation keeps serving
 * the outgoing user's payload until the refetch lands, which on an offline-
 * capable terminal may be never. Everything else is invalidated so the new
 * user's menu, orders and tables refetch.
 */
export function TopBar() {
  const t = useTranslations('common');
  const { data: restaurant } = useRestaurantControllerProfile();
  const { data: me } = useAuthMe();
  const clear = useAuthStore((s) => s.clear);
  const { connected, online } = useRealtime();
  const { isHub } = useHubStatus();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  const live = connected && online;

  function onSwitched() {
    setSwitching(false);
    queryClient.removeQueries({ queryKey: getAuthControllerMeQueryKey() });
    void queryClient.invalidateQueries();
  }

  function logout() {
    clear();
    // Hard navigation doesn't get Next's basePath, so prefix it (/res/pos/login).
    window.location.assign(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/login`);
  }

  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b border-gray-200 bg-white px-4 shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        {isHub ? (
          <HubStatusBadge />
        ) : (
          <span
            className={`inline-block h-3 w-3 shrink-0 rounded-full ${live ? 'bg-green-500' : 'bg-amber-500'}`}
            title={live ? 'online' : 'reconnecting'}
          />
        )}
        <h1 className="truncate text-xl font-bold text-gray-900">
          {restaurant?.name ?? t('appName')}
        </h1>
        <BranchMenu />
      </div>

      <div className="flex items-center gap-3">
        {me?.user.fullName ? (
          <span className="hidden truncate text-base font-medium text-gray-600 sm:inline">
            {me.user.fullName}
          </span>
        ) : null}
        <OrderRequestsBell />
        <Can perform={PERMISSIONS.REPORTS_SHIFT_VIEW}>
          <button
            type="button"
            onClick={() => router.push('/reports')}
            className="min-h-tap select-none rounded-xl border border-gray-300 bg-white px-5 text-base font-semibold text-gray-700 active:scale-95"
          >
            {t('shiftReport')}
          </button>
        </Can>
        <EndpointSettings />
        <LanguageSwitcher />
        <button
          type="button"
          onClick={() => setSwitching(true)}
          className="min-h-tap select-none rounded-xl border border-gray-300 bg-white px-5 text-base font-semibold text-gray-700 active:scale-95"
        >
          {t('switchUser')}
        </button>
        <button
          type="button"
          onClick={logout}
          className="min-h-tap select-none rounded-xl bg-gray-900 px-5 text-base font-semibold text-white active:scale-95"
        >
          {t('signOut')}
        </button>
      </div>

      {switching && (
        <div className="fixed inset-0 z-50 overflow-auto bg-gray-100">
          <StaffPickerLogin onSwitched={onSwitched} onCancel={() => setSwitching(false)} />
        </div>
      )}
    </header>
  );
}
