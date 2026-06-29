'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import { useProcessesControllerRemove } from '@/api/generated/inventory-processes/inventory-processes';
import type {
  ProcessResponse,
  ProcessesControllerListParams,
} from '@/api/generated/model';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/ui/form';
import { useConfirm } from '@/components/ui/use-confirm';
import { Pagination } from '@/components/inventory/shared';
import { ProcessFormDrawer } from '@/components/inventory/process-form-drawer';
import { RunProductionModal } from '@/components/inventory/run-production-modal';
import { getErrorMessage } from '@/lib/api-error';
import { usePermission } from '@/lib/auth/use-permission';
import {
  useProcessesInvalidation,
  usePaginatedProcesses,
} from '@/lib/inventory/use-process-data';
import { formatMoney } from '@/lib/money';
import { useRestaurant } from '@/lib/restaurant/use-restaurant';
import { PERMISSIONS } from '@/lib/permissions';
import { toast } from '@/stores/toast';

const PAGE_SIZE = 20;

export function ProcessesManager() {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');
  const { data: restaurant } = useRestaurant();
  const currency = restaurant?.currency ?? 'USD';
  const canManage = usePermission(PERMISSIONS.INVENTORY_PROCESS_MANAGE);
  const canRun = usePermission(PERMISSIONS.INVENTORY_PROCESS_RUN);
  const invalidate = useProcessesInvalidation();
  const { ask, dialog } = useConfirm();

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProcessResponse | null>(null);
  const [running, setRunning] = useState<ProcessResponse | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);
  useEffect(() => setPage(1), [debounced]);

  const params = useMemo<ProcessesControllerListParams>(
    () => ({ page, limit: PAGE_SIZE, search: debounced || undefined }),
    [page, debounced],
  );
  const { processes, pagination, isLoading, isFetching, isError } =
    usePaginatedProcesses(params);
  const hasNext = pagination?.hasNext ?? processes.length === PAGE_SIZE;

  const remove = useProcessesControllerRemove();

  const onDelete = async (process: ProcessResponse) => {
    const ok = await ask({
      title: tc('confirm'),
      message: t('confirmDeleteProcess'),
      confirmLabel: tc('delete'),
      cancelLabel: tc('cancel'),
      danger: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync({ id: process.id });
      toast.success(t('deleted'));
      await invalidate(process.id);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">{t('processesTitle')}</h1>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${inputClass} max-w-xs`}
          placeholder={t('processesSearch')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {canManage && (
          <div className="ml-auto">
            <Button
              variant="primary"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              + {t('addProcess')}
            </Button>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-gray-100" />
            ))}
          </div>
        ) : isError ? (
          <p className="py-10 text-center text-sm text-gray-500">{t('loadError')}</p>
        ) : processes.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">{t('noProcesses')}</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 font-medium">{t('colName')}</th>
                <th className="px-4 py-2 font-medium">{t('colInputs')}</th>
                <th className="px-4 py-2 font-medium">{t('colOutputs')}</th>
                <th className="px-4 py-2 font-medium">{t('colProcessingCost')}</th>
                <th className="px-4 py-2 font-medium">{t('colStatus')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {processes.map((process) => (
                <tr key={process.id} className="border-b border-gray-100">
                  <td className="px-4 py-2 font-medium text-gray-800">{process.name}</td>
                  <td className="px-4 py-2 text-gray-600">{process.inputs.length}</td>
                  <td className="px-4 py-2 text-gray-600">{process.outputs.length}</td>
                  <td className="px-4 py-2 text-gray-700">
                    {formatMoney(process.processingCost_amount, currency)}
                  </td>
                  <td className="px-4 py-2">
                    <Badge tone={process.status === 'ACTIVE' ? 'green' : 'gray'}>
                      {process.status === 'ACTIVE' ? t('statusACTIVE') : t('statusARCHIVED')}
                    </Badge>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1">
                      {canRun && (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => setRunning(process)}
                        >
                          {t('runProduction')}
                        </Button>
                      )}
                      {canManage && (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setEditing(process);
                              setFormOpen(true);
                            }}
                          >
                            {tc('edit')}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onDelete(process)}
                          >
                            {tc('delete')}
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Pagination
        page={page}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => p + 1)}
        hasNext={hasNext}
        isFetching={isFetching}
      />

      {formOpen && (
        <ProcessFormDrawer
          processId={editing?.id ?? null}
          onClose={() => setFormOpen(false)}
        />
      )}
      {running && (
        <RunProductionModal processId={running.id} onClose={() => setRunning(null)} />
      )}
      {dialog}
    </div>
  );
}
