'use client';

import { useTranslations } from 'next-intl';
import { PERMISSIONS, usePermission } from '@/lib/auth/permissions';
import { useProcessesData, useProcessRun } from '@/lib/kds/useProcesses';
import { ProcessCard } from './ProcessCard';

/**
 * The kitchen's prep/production processes for the pinned branch. Lists every
 * ACTIVE process with its inputs (what it consumes) and output (what it makes),
 * and lets a process-capability holder run one — consuming inputs + producing
 * output at the device's branch. Low-stock / will-go-short signals are surfaced
 * but never block a run (parity with serve). Works offline against the edge: the
 * shared mutator routes reads + runs to the hub when the cloud is unreachable.
 */
export function ProcessesView({ branchId }: { branchId: string }) {
  const t = useTranslations('processes');
  const { processes, stockIndex, isLoading, isError } = useProcessesData(branchId);
  const { run, pendingId } = useProcessRun(branchId);
  const canRun = usePermission(PERMISSIONS.PROCESS_RUN);

  if (isLoading && processes.length === 0) {
    return <CenterMessage>{t('loading')}</CenterMessage>;
  }
  if (isError && processes.length === 0) {
    return <CenterMessage tone="error">{t('error')}</CenterMessage>;
  }
  if (processes.length === 0) {
    return <CenterMessage>{t('empty')}</CenterMessage>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {processes.map((process) => (
        <ProcessCard
          key={process.id}
          process={process}
          stockIndex={stockIndex}
          canRun={canRun}
          pending={pendingId === process.id}
          onRun={run}
        />
      ))}
    </div>
  );
}

function CenterMessage({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: 'error';
}) {
  return (
    <div
      className={`flex h-full min-h-[60vh] items-center justify-center text-kiosk-lg ${
        tone === 'error' ? 'text-status-delayed' : 'text-kiosk-muted'
      }`}
    >
      {children}
    </div>
  );
}
