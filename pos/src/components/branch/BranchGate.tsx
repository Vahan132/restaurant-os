'use client';

import { useEffect, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/stores/auth';
import { useBranchStore } from '@/stores/branch';
import { useAccessibleBranches } from '@/lib/useBranches';
import { BranchPicker } from './BranchPicker';

/**
 * Gates the authenticated app on a selected branch.
 *
 *  - Not signed in → passthrough (AuthGate handles routing to /login).
 *  - Exactly one accessible branch → auto-select it (land straight in the branch).
 *  - More than one → require a pick before anything else renders, so orders can't
 *    be taken until the terminal's branch is chosen.
 *  - A previously persisted branch the user can no longer access is dropped and
 *    re-prompted (or auto-corrected when only one option remains).
 */
export function BranchGate({ children }: { children: ReactNode }) {
  const t = useTranslations('branch');
  const accessToken = useAuthStore((s) => s.accessToken);

  const branchHydrated = useBranchStore((s) => s.hydrated);
  const activeBranchId = useBranchStore((s) => s.activeBranchId);
  const setActiveBranch = useBranchStore((s) => s.setActiveBranch);
  const clearBranch = useBranchStore((s) => s.clearBranch);

  const { branches, defaultBranchId, isLoading, isError, refetch } =
    useAccessibleBranches();

  const isAuthed = Boolean(accessToken);
  const activeIsValid =
    Boolean(activeBranchId) && branches.some((b) => b.id === activeBranchId);

  // Resolve the selection once auth + branches + persisted state are ready.
  useEffect(() => {
    if (!isAuthed || !branchHydrated || isLoading || isError) return;
    if (activeIsValid) return;
    if (branches.length === 1) {
      // Single-branch user → land directly in their branch.
      setActiveBranch(branches[0].id);
    } else if (activeBranchId) {
      // Stale/invalid persisted branch with 0 or many options → drop it so the
      // picker starts clean (no header is sent for an inaccessible branch).
      clearBranch();
    }
  }, [
    isAuthed,
    branchHydrated,
    isLoading,
    isError,
    activeIsValid,
    activeBranchId,
    branches,
    setActiveBranch,
    clearBranch,
  ]);

  // Unauthenticated: let the login flow proceed untouched.
  if (!isAuthed) return <>{children}</>;

  // Wait for persisted branch + /auth/me so we don't flash the picker.
  if (!branchHydrated || isLoading) {
    return <BranchFullScreen>{t('loading')}</BranchFullScreen>;
  }

  if (isError) {
    return (
      <BranchFullScreen>
        <p className="text-lg text-red-600">{t('loadError')}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="min-h-tap rounded-xl bg-gray-900 px-6 font-semibold text-white active:scale-95"
        >
          {t('retry')}
        </button>
      </BranchFullScreen>
    );
  }

  if (activeIsValid) return <>{children}</>;

  // No usable selection yet.
  if (branches.length === 0) {
    return (
      <BranchFullScreen>
        <h1 className="text-2xl font-bold text-gray-900">{t('noneTitle')}</h1>
        <p className="max-w-sm text-center text-lg text-gray-500">{t('noneBody')}</p>
      </BranchFullScreen>
    );
  }

  // Exactly one → the effect is selecting it; show a brief loading frame.
  if (branches.length === 1) {
    return <BranchFullScreen>{t('loading')}</BranchFullScreen>;
  }

  // Multiple → the terminal must be told which branch it's at.
  return (
    <BranchPicker
      branches={branches}
      defaultBranchId={defaultBranchId}
      onPick={setActiveBranch}
    />
  );
}

/** Shared centered full-screen frame for gate states. */
function BranchFullScreen({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-gray-100 p-6 text-lg text-gray-500">
      {children}
    </div>
  );
}
