'use client';

import { useTranslations } from 'next-intl';
import type { AccessibleBranch } from '@/lib/useBranches';
import { useAuthStore } from '@/stores/auth';
import { LanguageSwitcher } from '@/components/shell/LanguageSwitcher';

interface BranchPickerProps {
  branches: AccessibleBranch[];
  /** The user's default branch, highlighted as a hint. */
  defaultBranchId: string | null;
  onPick: (branchId: string) => void;
}

/**
 * Full-screen branch picker shown at session start when a terminal serves a
 * multi-branch user and no branch is selected yet. Large touch targets; the
 * user's default branch is flagged. Picking a branch unblocks the app.
 */
export function BranchPicker({ branches, defaultBranchId, onPick }: BranchPickerProps) {
  const t = useTranslations('branch');
  const clear = useAuthStore((s) => s.clear);

  function signOut() {
    clear();
    window.location.assign(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/login`);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-gray-100">
      <header className="flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">{t('pickerTitle')}</h1>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <button
            type="button"
            onClick={signOut}
            className="min-h-tap select-none rounded-xl border border-gray-300 px-5 text-base font-semibold text-gray-700 active:scale-95"
          >
            {t('signOut')}
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center p-6">
        <p className="mb-6 text-lg text-gray-500">{t('pickerSubtitle')}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {branches.map((branch) => (
            <button
              key={branch.id}
              type="button"
              onClick={() => onPick(branch.id)}
              className="flex min-h-[5rem] select-none flex-col items-start justify-center gap-1 rounded-2xl border border-gray-300 bg-white px-5 py-4 text-left shadow-sm transition active:scale-[0.98] hover:border-gray-900"
            >
              <span className="text-xl font-bold text-gray-900">{branch.name}</span>
              {branch.id === defaultBranchId ? (
                <span className="rounded-full bg-gray-900 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white">
                  {t('default')}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
