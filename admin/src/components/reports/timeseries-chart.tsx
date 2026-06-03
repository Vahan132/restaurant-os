'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatMoney, fromMinor } from '@/lib/money';
import type { GroupBy } from '@/lib/reports/date-range';
import { useTimeSeries } from '@/lib/reports/use-reports-data';

const REVENUE_COLOR = '#0f766e';
const ORDERS_COLOR = '#2563eb';

export function TimeseriesChart({
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
  const { buckets, isLoading } = useTimeSeries(from, to, groupBy);

  const data = useMemo(
    () =>
      buckets.map((b) => ({
        bucket: b.bucket,
        revenue: fromMinor(b.revenueAmount, currency),
        revenueMinor: b.revenueAmount,
        orders: b.orderCount,
      })),
    [buckets, currency],
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">{t('timeseries.title')}</h2>
      {isLoading ? (
        <div className="h-72 animate-pulse rounded bg-gray-100" />
      ) : data.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-500">{t('empty')}</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 12 }} width={70} />
            <YAxis
              yAxisId="right"
              orientation="right"
              allowDecimals={false}
              tick={{ fontSize: 12 }}
              width={40}
            />
            <Tooltip
              formatter={(value: number, name: string, item) => {
                if (name === t('timeseries.revenue')) {
                  const minor = (item?.payload as { revenueMinor: number }).revenueMinor;
                  return [formatMoney(minor, currency), name];
                }
                return [value, name];
              }}
            />
            <Legend />
            <Bar
              yAxisId="left"
              dataKey="revenue"
              name={t('timeseries.revenue')}
              fill={REVENUE_COLOR}
              radius={[4, 4, 0, 0]}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="orders"
              name={t('timeseries.orders')}
              stroke={ORDERS_COLOR}
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
