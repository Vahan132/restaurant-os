'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

import {
  RowResultResponseStatus,
  type ImportResultResponse,
  type RowResultResponse,
} from '@/api/generated/model';
import { StatCard } from '@/components/dashboard/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { downloadCsv } from '@/lib/reports/csv';

type Tone = 'green' | 'amber' | 'red' | 'gray';

const STATUS_TONE: Record<string, Tone> = {
  COMPLETED: 'green',
  PARTIAL: 'amber',
  FAILED: 'red',
  PENDING: 'gray',
};

const ROW_TONE: Record<string, Tone> = {
  [RowResultResponseStatus.ERROR]: 'red',
  [RowResultResponseStatus.SKIPPED_DUPLICATE]: 'amber',
  [RowResultResponseStatus.IMPORTED]: 'green',
};

/** Post-import summary: counts, structural note, and a per-row problem list. */
export function ImportResult({ result }: { result: ImportResultResponse }) {
  const t = useTranslations('salesImport');

  // Rows that were not imported (errors + skipped duplicates) are what the user
  // needs to review, fix, and re-upload.
  const problemRows = useMemo(
    () => result.rows.filter((r) => r.status !== RowResultResponseStatus.IMPORTED),
    [result.rows],
  );

  const onDownload = () =>
    downloadCsv<RowResultResponse>(
      `sales-import-errors-${result.batchId}`,
      problemRows,
      [
        { label: t('result.row'), value: (r) => r.row },
        { label: t('result.status'), value: (r) => r.status },
        { label: t('result.reason'), value: (r) => r.message ?? '' },
      ],
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[result.status] ?? 'gray'}>
          {t(`status.${result.status}`)}
        </Badge>
        <Badge tone="amber">{t('nonFiscalBadge')}</Badge>
        <span className="text-xs text-gray-500">
          {t('result.fileName', { name: result.fileName })}
        </span>
      </div>

      {result.note && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {result.note}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t('result.total')} value={result.rowCount} />
        <StatCard label={t('result.imported')} value={result.successCount} />
        <StatCard label={t('result.failed')} value={result.errorCount} />
        <StatCard label={t('result.duplicates')} value={result.duplicateCount} />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">{t('result.problemsTitle')}</h2>
          <Button
            size="sm"
            variant="secondary"
            onClick={onDownload}
            disabled={problemRows.length === 0}
          >
            {t('result.download')}
          </Button>
        </div>

        {problemRows.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">{t('result.allImported')}</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="py-2 font-medium">{t('result.row')}</th>
                <th className="py-2 font-medium">{t('result.status')}</th>
                <th className="py-2 font-medium">{t('result.reason')}</th>
              </tr>
            </thead>
            <tbody>
              {problemRows.map((r) => (
                <tr key={r.row} className="border-b border-gray-100 align-top">
                  <td className="py-2 pr-3 tabular-nums text-gray-700">{r.row}</td>
                  <td className="py-2 pr-3">
                    <Badge tone={ROW_TONE[r.status] ?? 'gray'}>{t(`rowStatus.${r.status}`)}</Badge>
                  </td>
                  <td className="py-2 text-gray-700">{r.message ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
