'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { inputClass } from '@/components/ui/form';
import { ReasonBadge } from '@/components/inventory/writeoff-shared';
import { useWasteSummary } from '@/lib/inventory/use-writeoff-data';
import { formatMoney } from '@/lib/money';
import { useRestaurant } from '@/lib/restaurant/use-restaurant';

function daysAgo(n: number): string {
  const d = new Date(Date.now() - n * 86400000);
  return d.toISOString().slice(0, 10);
}

export function WasteSummary() {
  const t = useTranslations('inventory');
  const { data: restaurant } = useRestaurant();
  const currency = restaurant?.currency ?? 'USD';

  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(daysAgo(0));

  const params = useMemo(() => ({ from: from || undefined, to: to || undefined }), [from, to]);
  const { data: summary, isLoading, isError } = useWasteSummary(params);
  const rows = summary?.byReason ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <span>{t('woFrom')}</span>
          <input
            type="date"
            className={`${inputClass} w-auto`}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <span>{t('woTo')}</span>
          <input
            type="date"
            className={`${inputClass} w-auto`}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-gray-100" />
            ))}
          </div>
        ) : isError ? (
          <p className="py-10 text-center text-sm text-gray-500">{t('loadError')}</p>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">{t('noSummary')}</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 font-medium">{t('sumReason')}</th>
                <th className="px-4 py-2 font-medium">{t('sumLineCount')}</th>
                <th className="px-4 py-2 font-medium">{t('sumTotal')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.reason} className="border-b border-gray-100">
                  <td className="px-4 py-2">
                    <ReasonBadge reason={r.reason} />
                  </td>
                  <td className="px-4 py-2 text-gray-600">{r.lineCount}</td>
                  <td className="px-4 py-2 text-gray-700">{formatMoney(r.totalCost_amount, currency)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 font-medium">
                <td className="px-4 py-2 text-gray-800" colSpan={2}>
                  {t('sumOverall')}
                </td>
                <td className="px-4 py-2 text-gray-900">
                  {formatMoney(summary?.overallTotalCost_amount ?? 0, currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      <p className="text-xs text-gray-400">
        <Badge tone="gray">{t('voidedBadge')}</Badge> {t('sumNote')}
      </p>
    </div>
  );
}
