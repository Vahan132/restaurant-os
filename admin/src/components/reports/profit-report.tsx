'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { useReportExportControllerGetProfit } from '@/api/generated/reports/reports';
import type { ProfitTotalsResponse } from '@/api/generated/model';
import { useReportExport } from '@/components/reports/export-context';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/money';
import { downloadProfitXlsx } from '@/lib/reports/xlsx-export';

type Key = keyof ProfitTotalsResponse;

/** Rows of the period P&L; `sign` is how the line affects profit (for the ± prefix). */
const LINES: { key: Key; sign: 1 | -1 | 0; strong?: boolean }[] = [
  { key: 'salesAmount', sign: 0 },
  { key: 'discountAmount', sign: -1 },
  { key: 'revenueAmount', sign: 0, strong: true },
  { key: 'costAmount', sign: -1 },
  { key: 'grossProfitAmount', sign: 0, strong: true },
  { key: 'writeOffAmount', sign: -1 },
  { key: 'expenseAmount', sign: -1 },
  { key: 'netProfitAmount', sign: 0, strong: true },
];

/**
 * PROFIT-XLSX-1: the period profit statement — revenue, FIFO cost price of what
 * was sold, write-offs and non-stock expenses — plus the full Excel download.
 */
export function ProfitReport({
  from,
  to,
  currency,
}: {
  from: string;
  to: string;
  currency: string;
}) {
  const t = useTranslations('reports.profit');
  const exporter = useReportExport();
  const q = useReportExportControllerGetProfit(
    { from, to, branchId: exporter?.branchId },
    { query: { enabled: Boolean(from && to) } },
  );
  const totals = q.data as ProfitTotalsResponse | undefined;
  const money = (v: number) => formatMoney(v, currency);
  const share = (v: number) =>
    totals && totals.revenueAmount !== 0
      ? `${((v / totals.revenueAmount) * 100).toFixed(1)}%`
      : '—';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{t('title')}</h2>
          <p className="text-xs text-gray-500">{t('hint')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/inventory/write-offs?tab=expenses"
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            {t('manageExpenses')}
          </Link>
          <Button
            variant="primary"
            disabled={!exporter || exporter.busy}
            onClick={() =>
              exporter?.run(() => downloadProfitXlsx(from, to, exporter.lang, exporter.branchId))
            }
          >
            {t('download')}
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {q.isLoading ? (
          <div className="space-y-2 p-4">
            {LINES.map((l) => (
              <div key={l.key} className="h-8 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ) : q.isError || !totals ? (
          <p className="py-10 text-center text-sm text-gray-500">{t('loadError')}</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 text-left font-medium">{t('metric')}</th>
                <th className="px-4 py-2 text-right font-medium">{t('amount')}</th>
                <th className="px-4 py-2 text-right font-medium">{t('share')}</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {LINES.map((l) => {
                const v = totals[l.key];
                const isNet = l.key === 'netProfitAmount';
                return (
                  <tr
                    key={l.key}
                    className={`border-b border-gray-100 ${
                      isNet ? 'bg-gray-100' : l.strong ? 'bg-gray-50' : ''
                    }`}
                  >
                    <td
                      className={`px-4 py-2 ${
                        l.strong ? 'font-semibold text-gray-900' : 'pl-8 text-gray-700'
                      }`}
                    >
                      {l.sign === -1 ? '− ' : ''}
                      {t(`line.${l.key}`)}
                    </td>
                    <td
                      className={`px-4 py-2 text-right ${l.strong ? 'font-semibold' : ''} ${
                        l.strong && v < 0
                          ? 'text-red-600'
                          : isNet
                            ? 'text-green-700'
                            : 'text-gray-800'
                      }`}
                    >
                      {money(v)}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-500">{share(v)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-xs text-gray-400">{t('footnote')}</p>
    </div>
  );
}
