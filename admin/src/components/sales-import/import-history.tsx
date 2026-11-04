'use client';

import { useTranslations } from 'next-intl';

import type { ImportBatchResponse } from '@/api/generated/model';
import { Badge } from '@/components/ui/badge';
import { useImportBatches } from '@/lib/sales-import/use-sales-import-data';
import { formatDateTimeInTz } from '@/lib/tz';
import { useRestaurant } from '@/lib/restaurant/use-restaurant';
import { useAuthStore } from '@/stores/auth';

type Tone = 'green' | 'amber' | 'red' | 'gray';

const STATUS_TONE: Record<string, Tone> = {
  COMPLETED: 'green',
  PARTIAL: 'amber',
  FAILED: 'red',
  PENDING: 'gray',
};

export function ImportHistory() {
  const t = useTranslations('salesImport');
  const { batches, isLoading } = useImportBatches();
  const { data: restaurant } = useRestaurant();
  const timezone =
    restaurant?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const currentUser = useAuthStore((s) => s.user);

  const whom = (batch: ImportBatchResponse) =>
    currentUser && batch.importedByUserId === currentUser.id
      ? t('history.you')
      : batch.importedByUserId;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">{t('history.title')}</h2>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-gray-100" />
          ))}
        </div>
      ) : batches.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">{t('history.empty')}</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="py-2 font-medium">{t('history.file')}</th>
              <th className="py-2 font-medium">{t('history.date')}</th>
              <th className="py-2 font-medium">{t('history.by')}</th>
              <th className="py-2 text-right font-medium">{t('history.total')}</th>
              <th className="py-2 text-right font-medium">{t('history.imported')}</th>
              <th className="py-2 text-right font-medium">{t('history.failed')}</th>
              <th className="py-2 font-medium">{t('history.status')}</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id} className="border-b border-gray-100">
                <td className="py-2 pr-3 font-medium text-gray-800">{b.fileName}</td>
                <td className="py-2 pr-3 text-gray-600">
                  {formatDateTimeInTz(b.createdAt, timezone)}
                </td>
                <td className="py-2 pr-3 text-gray-600">{whom(b)}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-gray-700">{b.rowCount}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-green-700">
                  {b.successCount}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-red-700">{b.errorCount}</td>
                <td className="py-2">
                  <Badge tone={STATUS_TONE[b.status] ?? 'gray'}>{t(`status.${b.status}`)}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
