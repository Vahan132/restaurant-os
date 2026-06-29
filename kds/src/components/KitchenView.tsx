'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PERMISSIONS, usePermission } from '@/lib/auth/permissions';
import { useBranchStore } from '@/lib/branch/store';
import { TicketBoard } from './board/TicketBoard';
import { ProcessesView } from './processes/ProcessesView';

type Tab = 'tickets' | 'processes';

/**
 * Main kitchen surface for a pinned branch + station. Line cooks see only the
 * ticket board (unchanged). Process-capability holders (Chef / Sous-Chef) get a
 * tab switch to the prep/production processes view as well; the controls there
 * are gated on the same capability, so the tab never appears for staff who can't
 * run a process.
 */
export function KitchenView() {
  const t = useTranslations('nav');
  const branchId = useBranchStore((s) => s.branchId);
  const canProcesses = usePermission(PERMISSIONS.PROCESS_RUN);
  const [tab, setTab] = useState<Tab>('tickets');

  if (!branchId || !canProcesses) {
    return <TicketBoard />;
  }

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex gap-2">
        <TabButton active={tab === 'tickets'} onClick={() => setTab('tickets')}>
          {t('tickets')}
        </TabButton>
        <TabButton active={tab === 'processes'} onClick={() => setTab('processes')}>
          {t('processes')}
        </TabButton>
      </nav>
      {tab === 'tickets' ? <TicketBoard /> : <ProcessesView branchId={branchId} />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-5 py-2 text-kiosk font-bold transition-colors ${
        active
          ? 'bg-status-sent text-black'
          : 'border border-kiosk-border text-kiosk-muted hover:bg-kiosk-border'
      }`}
    >
      {children}
    </button>
  );
}
