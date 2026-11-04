'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { useBranchContext } from '@/lib/branch/use-branch-context';

/**
 * Top-bar active-branch selector (BR-7 §2). Lists the caller's accessible
 * branches with a default badge. When only one branch is accessible it renders
 * as a static label (no dropdown). The current branch is always visible so
 * staff know which branch they are acting on.
 */
export function BranchSwitcher() {
  const t = useTranslations('branch');
  const { accessibleBranches, activeBranch, activeBranchId, hasMultiple, setActiveBranch } =
    useBranchContext();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // No branches resolved yet (e.g. mid-hydration) — render nothing.
  if (accessibleBranches.length === 0) return null;

  const label = activeBranch?.name ?? t('selectBranch');

  // Single accessible branch -> static label, no dropdown.
  if (!hasMultiple) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-gray-200 px-2.5 py-1 text-sm text-gray-700">
        <span className="text-xs text-gray-400">{t('label')}</span>
        <span className="max-w-[12rem] truncate font-medium">{label}</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-sm text-gray-700 hover:bg-gray-50"
        aria-haspopup="listbox"
        aria-expanded={open}
        title={t('switchTooltip')}
      >
        <span className="text-xs text-gray-400">{t('label')}</span>
        <span className="max-w-[12rem] truncate font-medium">{label}</span>
        <span aria-hidden className="text-gray-400">
          ▾
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-20 mt-1 max-h-80 w-64 overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg"
        >
          {accessibleBranches.map((branch) => {
            const selected = branch.id === activeBranchId;
            return (
              <button
                key={branch.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  setActiveBranch(branch.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100 ${
                  selected ? 'bg-gray-50 font-medium text-brand' : 'text-gray-700'
                }`}
              >
                <span className="min-w-0 truncate">{branch.name}</span>
                <span className="flex shrink-0 items-center gap-1">
                  {branch.isDefault && <Badge tone="blue">{t('default')}</Badge>}
                  {selected && <span aria-hidden className="text-brand">✓</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
