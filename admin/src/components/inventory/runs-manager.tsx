'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import type { ProcessRunsControllerListParams } from '@/api/generated/model';
import { Badge } from '@/components/ui/badge';
import { inputClass } from '@/components/ui/form';
import { Pagination, formatDateTime } from '@/components/inventory/shared';
import { RunDetailDrawer } from '@/components/inventory/run-detail-drawer';
import { usePaginatedRuns } from '@/lib/inventory/use-process-data';
import { useProcessesForSelect } from '@/lib/inventory/use-process-data';
import { formatMoney } from '@/lib/money';
import { useRestaurant } from '@/lib/restaurant/use-restaurant';

const PAGE_SIZE = 20;

export function RunsManager() {
  const t = useTranslations('inventory');
  const { data: restaurant } = useRestaurant();
  const currency = restaurant?.currency ?? 'USD';

  const [processId, setProcessId] = useState('');
  const [runFrom, setRunFrom] = useState('');
  const [runTo, setRunTo] = useState('');
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => setPage(1), [processId, runFrom, runTo]);

  const { processes } = useProcessesForSelect();
  const params = useMemo<ProcessRunsControllerListParams>(
    () => ({
      page,
      limit: PAGE_SIZE,
      processId: processId || undefined,
      runFrom: runFrom || undefined,
      runTo: runTo || undefined,
    }),
    [page, processId, runFrom, runTo],
  );
  const { runs, pagination, isLoading, isFetching, isError } = usePaginatedRuns(params);
  const hasNext = pagination?.hasNext ?? runs.length === PAGE_SIZE;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">{t('runsTitle')}</h1>

      <div className="flex flex-wrap items-center gap-2">
        <select
          className={`${inputClass} w-auto`}
          value={processId}
          onChange={(e) => setProcessId(e.target.value)}
        >
          <option value="">{t('allProcesses')}</option>
          {processes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <span>{t('runFrom')}</span>
          <input
            type="date"
            className={`${inputClass} w-auto`}
            value={runFrom}
            onChange={(e) => setRunFrom(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <span>{t('runTo')}</span>
          <input
            type="date"
            className={`${inputClass} w-auto`}
            value={runTo}
            onChange={(e) => setRunTo(e.target.value)}
          />
        </label>
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
        ) : runs.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">{t('noRuns')}</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 font-medium">{t('colRunAt')}</th>
                <th className="px-4 py-2 font-medium">{t('colProcess')}</th>
                <th className="px-4 py-2 font-medium">{t('colMultiplier')}</th>
                <th className="px-4 py-2 font-medium">{t('colTotalCost')}</th>
                <th className="px-4 py-2 font-medium">{t('colWentNegative')}</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr
                  key={r.id}
                  className="cursor-pointer border-b border-gray-100 hover:bg-gray-50"
                  onClick={() => setDetailId(r.id)}
                >
                  <td className="px-4 py-2 text-gray-700">{formatDateTime(r.runAt)}</td>
                  <td className="px-4 py-2 font-medium text-gray-800">{r.processName}</td>
                  <td className="px-4 py-2 text-gray-600">×{r.multiplier}</td>
                  <td className="px-4 py-2 text-gray-700">{formatMoney(r.totalCost, currency)}</td>
                  <td className="px-4 py-2">
                    {r.wentNegative && <Badge tone="amber">{t('wentNegativeBadge')}</Badge>}
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

      {detailId && (
        <RunDetailDrawer runId={detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  );
}
