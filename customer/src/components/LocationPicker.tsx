'use client';

import { useTranslations } from 'next-intl';

import type { PublicBranchResponse } from '@/api/generated/model';

interface Props {
  branches: PublicBranchResponse[];
  /** Title + subtitle keys differ for the menu vs. booking entry points. */
  title: string;
  subtitle: string;
  /** Called with the chosen branch slug. */
  onSelect: (branchSlug: string) => void;
}

/**
 * Location/branch picker for the NO-TABLE flow (a plain menu or "book a table"
 * link). When a table QR is scanned the branch is implied by the table and this
 * is never shown. Mobile-first; respects restaurant branding via brand tokens.
 */
export default function LocationPicker({ branches, title, subtitle, onSelect }: Props) {
  const t = useTranslations('location');

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      <p className="mt-1 text-sm text-gray-500">{subtitle}</p>

      {branches.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-500">{t('none')}</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {branches.map((branch) => (
            <li key={branch.slug}>
              <button
                type="button"
                onClick={() => onSelect(branch.slug)}
                className="flex w-full items-center gap-3 rounded-2xl border border-gray-200 px-4 py-3.5 text-left transition active:scale-[0.99] hover:border-brand-accent"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    aria-hidden
                  >
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-gray-900">
                    {branch.name}
                  </span>
                </span>
                <span className="shrink-0 text-gray-300" aria-hidden>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
