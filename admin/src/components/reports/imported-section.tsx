'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type {
  ImportedItemRowResponse,
  ImportedPaymentMethodResponse,
} from '@/api/generated/model';
import { SortableTable, type Column } from '@/components/reports/sortable-table';
import { StatCard } from '@/components/dashboard/stat-card';
import { Badge } from '@/components/ui/badge';
import { formatMoney, fromMinor } from '@/lib/money';
import type { GroupBy } from '@/lib/reports/date-range';
import {
  useImportedByItem,
  useImportedByPaymentMethod,
  useImportedSummary,
  useImportedTimeSeries,
} from '@/lib/sales-import/use-sales-import-data';

const REVENUE_COLOR = '#d97706'; // amber — visually distinct from fiscal teal.

/**
 * Imported (non-fiscal) sales block for the reports view. Rendered only when the
 * "include imported data" filter is on. Everything here is clearly labeled as
 * NON-FISCAL / IMPORTED and wrapped in an amber panel so it can never be
 * mistaken for fiscal revenue.
 */
export function ImportedSection({
  from,
  to,
  groupBy,
  currency,
}: {
  from: string;
  to: string;
  groupBy: GroupBy;
  currency: string;
}) {
  const t = useTranslations('reports');
  const ti = useTranslations('salesImport');

  const { summary, isLoading: summaryLoading } = useImportedSummary(from, to);
  const { buckets, isLoading: tsLoading } = useImportedTimeSeries(from, to, groupBy);
  const { rows: itemRows, isLoading: itemLoading } = useImportedByItem(from, to);
  const { rows: payRows, isLoading: payLoading } = useImportedByPaymentMethod(from, to);

  const m = (v?: number) => (v != null ? formatMoney(v, currency) : '—');

  const chartData = useMemo(
    () =>
      buckets.map((b) => ({
        bucket: b.bucket,
        revenue: fromMinor(b.revenueAmount, currency),
        revenueMinor: b.revenueAmount,
      })),
    [buckets, currency],
  );

  const itemColumns: Column<ImportedItemRowResponse>[] = [
    {
      key: 'item',
      label: t('byItem.item'),
      cell: (r) => r.itemDescription,
      csv: (r) => r.itemDescription,
      sort: (r) => r.itemDescription,
    },
    {
      key: 'qty',
      label: t('byItem.qty'),
      align: 'right',
      cell: (r) => r.quantity,
      csv: (r) => r.quantity,
      sort: (r) => r.quantity,
    },
    {
      key: 'revenue',
      label: t('byItem.revenue'),
      align: 'right',
      cell: (r) => formatMoney(r.revenueAmount, currency),
      csv: (r) => r.revenueAmount,
      sort: (r) => r.revenueAmount,
    },
  ];

  const payColumns: Column<ImportedPaymentMethodResponse>[] = [
    {
      key: 'method',
      label: t('byPayment.method'),
      cell: (r) => r.method,
      csv: (r) => r.method,
      sort: (r) => r.method,
    },
    {
      key: 'amount',
      label: t('byPayment.amount'),
      align: 'right',
      cell: (r) => formatMoney(r.amount, currency),
      csv: (r) => r.amount,
      sort: (r) => r.amount,
    },
  ];

  return (
    <section className="space-y-4 rounded-lg border-2 border-amber-300 bg-amber-50/60 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-amber-900">{ti('reports.sectionTitle')}</h2>
        <Badge tone="amber">{ti('nonFiscalBadge')}</Badge>
      </div>
      <p className="text-sm text-amber-800">{ti('reports.sectionHint')}</p>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard
          label={ti('reports.totalRevenue')}
          value={m(summary?.totalRevenueAmount)}
          loading={summaryLoading}
        />
        <StatCard
          label={ti('reports.saleCount')}
          value={summary?.saleCount ?? 0}
          loading={summaryLoading}
        />
        <StatCard
          label={ti('reports.totalQuantity')}
          value={summary?.totalQuantity ?? 0}
          loading={summaryLoading}
        />
      </div>

      <div className="rounded-lg border border-amber-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">{ti('reports.overTime')}</h3>
        {tsLoading ? (
          <div className="h-64 animate-pulse rounded bg-gray-100" />
        ) : chartData.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-500">{ti('reports.empty')}</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} width={70} />
              <Tooltip
                formatter={(_value: number, _name: string, item) => {
                  const minor = (item?.payload as { revenueMinor: number }).revenueMinor;
                  return [formatMoney(minor, currency), ti('reports.totalRevenue')];
                }}
              />
              <Bar
                dataKey="revenue"
                name={ti('reports.totalRevenue')}
                fill={REVENUE_COLOR}
                radius={[4, 4, 0, 0]}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SortableTable
          title={ti('reports.byItem')}
          rows={itemRows}
          columns={itemColumns}
          csvName="imported-by-item"
          isLoading={itemLoading}
          emptyText={ti('reports.empty')}
        />
        <SortableTable
          title={ti('reports.byPayment')}
          rows={payRows}
          columns={payColumns}
          csvName="imported-by-payment-method"
          isLoading={payLoading}
          emptyText={ti('reports.empty')}
        />
      </div>
    </section>
  );
}
