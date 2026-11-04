'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAccessibleBranches } from '@/lib/useBranches';
import { useBranchStore } from '@/stores/branch';
import { toast } from '@/lib/toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

/**
 * Persistent current-branch indicator + session switcher.
 *
 * Shown in the top bar / order header so the active branch is always visible.
 * With a single accessible branch it's a static chip; with several it opens a
 * menu to switch. Switching is confirmed first, and blocked while an order is
 * open (menu/prices/tables differ per branch — the order must be closed or
 * discarded first). On switch we clear cached data so the new branch's
 * menu/prices, tables and orders reload via the X-Branch-Id header, and the
 * realtime socket reconnects into the new branch room.
 */
export function BranchMenu() {
  const t = useTranslations('branch');
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const { branches } = useAccessibleBranches();
  const activeBranchId = useBranchStore((s) => s.activeBranchId);
  const setActiveBranch = useBranchStore((s) => s.setActiveBranch);

  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [blockedOpen, setBlockedOpen] = useState(false);

  const current = branches.find((b) => b.id === activeBranchId) ?? null;
  const canSwitch = branches.length > 1;

  // An order is "open" whenever we're on an order/checkout screen.
  const hasOpenOrder = Boolean(pathname && pathname.startsWith('/orders/'));

  const pendingBranch = branches.find((b) => b.id === pendingId) ?? null;

  function choose(branchId: string) {
    setOpen(false);
    if (branchId === activeBranchId) return;
    if (hasOpenOrder) {
      setBlockedOpen(true);
      return;
    }
    setPendingId(branchId);
  }

  function confirmSwitch() {
    if (!pendingId) return;
    setActiveBranch(pendingId);
    setPendingId(null);
    // Drop every branch-scoped cache so context reloads for the new branch.
    queryClient.clear();
    toast.success(t('switchedTitle'), t('switchedBody'));
    // Return to the table-select home for the freshly loaded branch.
    router.push('/');
  }

  // Single branch: a plain, non-interactive indicator.
  if (!canSwitch) {
    return (
      <span
        className="inline-flex max-w-[10rem] items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5"
        title={current?.name ?? ''}
      >
        <BranchIcon />
        <span className="truncate text-sm font-semibold text-gray-700">
          {current?.name ?? '—'}
        </span>
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex max-w-[12rem] items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 active:scale-95"
        title={current?.name ?? ''}
      >
        <BranchIcon />
        <span className="truncate">{current?.name ?? t('select')}</span>
        <span className="text-gray-400">▾</span>
      </button>

      {open ? (
        <>
          {/* Click-away layer */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl"
          >
            <p className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {t('switchTo')}
            </p>
            {branches.map((branch) => {
              const active = branch.id === activeBranchId;
              return (
                <button
                  key={branch.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => choose(branch.id)}
                  className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-base active:scale-[0.99] ${
                    active ? 'bg-gray-50 font-bold text-gray-900' : 'font-medium text-gray-700'
                  }`}
                >
                  <span className="truncate">{branch.name}</span>
                  {active ? <span className="text-gray-900">✓</span> : null}
                </button>
              );
            })}
          </div>
        </>
      ) : null}

      {/* Confirm a clean switch. */}
      <ConfirmDialog
        open={Boolean(pendingId)}
        title={t('confirmTitle')}
        body={pendingBranch ? t('confirmBody', { branch: pendingBranch.name }) : ''}
        confirmLabel={t('confirmSwitch')}
        onConfirm={confirmSwitch}
        onCancel={() => setPendingId(null)}
      />

      {/* Block switching while an order is open. */}
      <ConfirmDialog
        open={blockedOpen}
        title={t('blockedTitle')}
        body={t('blockedBody')}
        confirmLabel={t('blockedAck')}
        onConfirm={() => setBlockedOpen(false)}
        onCancel={() => setBlockedOpen(false)}
      />
    </div>
  );
}

function BranchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0 text-gray-500"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4 7 4v14" />
      <path d="M9 21v-6h6v6" />
    </svg>
  );
}
