'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/useAuth';
import { useBranchStore } from '@/lib/branch/store';
import { useStationStore } from '@/lib/station/store';

/**
 * Shown to an authenticated user who lacks KDS_ACCESS. With `canRepin` (they're
 * denied only because of the pinned branch but have access elsewhere) it also
 * offers to clear the pin and choose a branch they can use.
 */
export function NoKitchenAccess({ canRepin = false }: { canRepin?: boolean }) {
  const t = useTranslations('access');
  const { logout } = useAuth();
  const router = useRouter();
  const clearStation = useStationStore((s) => s.clear);
  const clearBranch = useBranchStore((s) => s.clear);

  async function onLogout() {
    await logout();
    router.replace('/login');
  }

  function onChangeBranch() {
    clearStation();
    clearBranch();
  }

  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-6 px-8 text-center">
      <h1 className="text-kiosk-xl font-bold text-status-delayed">{t('noAccessTitle')}</h1>
      <p className="max-w-2xl text-kiosk-lg text-kiosk-muted">
        {canRepin ? t('noAccessHereBody') : t('noAccessBody')}
      </p>
      <div className="flex items-center gap-4">
        {canRepin && (
          <button
            type="button"
            onClick={onChangeBranch}
            className="rounded-lg bg-status-ready px-8 py-4 text-kiosk-lg font-semibold text-black hover:opacity-90"
          >
            {t('changeBranch')}
          </button>
        )}
        <button
          type="button"
          onClick={onLogout}
          className="rounded-lg bg-kiosk-panel px-8 py-4 text-kiosk-lg font-semibold hover:bg-kiosk-border"
        >
          {t('logout')}
        </button>
      </div>
    </div>
  );
}
