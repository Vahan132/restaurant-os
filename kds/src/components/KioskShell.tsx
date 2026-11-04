'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { useAuthStore } from '@/lib/auth/store';
import { useAuth } from '@/lib/auth/useAuth';
import { useBranchStore } from '@/lib/branch/store';
import { useStationStore } from '@/lib/station/store';
import type { DisplayConnectionStatus } from '@/lib/hub/status';
import { ConnectionBanner, ConnectionIndicator } from './ConnectionBanner';
import { FullscreenToggle } from './FullscreenToggle';
import { LanguageSwitcher } from './LanguageSwitcher';
import { MuteToggle } from './MuteToggle';
import { StaffLogin } from './StaffLogin';

/**
 * Kiosk chrome: a single top strip (station name(s), connection status, user,
 * change account, logout, language, fullscreen) and a disconnect banner. No nav
 * menu.
 *
 * Handover ("Change account") opens the staff picker + 6-digit PIN pad as an
 * overlay rather than signing out: a successful PIN swaps the session in place,
 * so the kiosk keeps its branch/station pin, its socket and its board. Cancel
 * leaves the current cook signed in.
 */
export function KioskShell({
  status,
  children,
}: {
  status: DisplayConnectionStatus;
  children: ReactNode;
}) {
  const t = useTranslations();
  const router = useRouter();
  const { logout } = useAuth();
  const user = useAuthStore((s) => s.user);
  const station = useStationStore((s) => s.station);
  const clearStation = useStationStore((s) => s.clear);
  const branchName = useBranchStore((s) => s.branchName);
  const clearBranch = useBranchStore((s) => s.clear);
  const [switching, setSwitching] = useState(false);

  async function onLogout() {
    await logout();
    router.replace('/login');
  }

  // Re-pinning clears both halves so the setup picker reappears.
  function changePin() {
    clearStation();
    clearBranch();
  }

  const pinned = Boolean(branchName && station);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-kiosk-border bg-kiosk-panel px-6 py-3">
        <div className="flex items-center gap-4">
          {pinned ? (
            <span className="flex items-baseline gap-2">
              <span className="text-kiosk-lg font-bold">{branchName}</span>
              <span className="text-kiosk-muted">·</span>
              <span className="text-kiosk-lg font-bold text-status-sent">
                {t(`station.${station}`)}
              </span>
            </span>
          ) : (
            <span className="text-kiosk-lg font-bold">{t('app.title')}</span>
          )}
          {pinned && (
            <button
              type="button"
              onClick={changePin}
              className="rounded-md border border-kiosk-border px-3 py-1 text-base text-kiosk-muted hover:bg-kiosk-border"
            >
              {t('setup.change')}
            </button>
          )}
          <ConnectionIndicator status={status} />
        </div>

        <div className="flex items-center gap-3">
          {user && <span className="text-base text-kiosk-muted">{user.fullName}</span>}
          <button
            type="button"
            onClick={() => setSwitching(true)}
            className="rounded-md border border-kiosk-border bg-kiosk-panel px-3 py-2 text-base hover:bg-kiosk-border"
          >
            {t('topbar.switchUser')}
          </button>
          <MuteToggle />
          <LanguageSwitcher />
          <FullscreenToggle />
          <button
            type="button"
            onClick={onLogout}
            className="rounded-md border border-kiosk-border bg-kiosk-panel px-3 py-2 text-base hover:bg-kiosk-border"
          >
            {t('topbar.logout')}
          </button>
        </div>
      </header>

      <ConnectionBanner status={status} />

      <main className="flex-1 overflow-auto p-6">{children}</main>

      {switching && (
        <div className="fixed inset-0 z-50 overflow-auto bg-kiosk-bg">
          <StaffLogin
            onSuccess={() => setSwitching(false)}
            onCancel={() => setSwitching(false)}
          />
        </div>
      )}
    </div>
  );
}
