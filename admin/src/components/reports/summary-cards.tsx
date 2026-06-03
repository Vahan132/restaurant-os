'use client';

import { useTranslations } from 'next-intl';

import { StatCard } from '@/components/dashboard/stat-card';
import { formatMoney } from '@/lib/money';
import { useSummary } from '@/lib/reports/use-reports-data';

export function SummaryCards({
  from,
  to,
  currency,
}: {
  from: string;
  to: string;
  currency: string;
}) {
  const t = useTranslations('reports.summary');
  const { summary, isLoading } = useSummary(from, to);
  const m = (v?: number) => (v != null ? formatMoney(v, currency) : '—');

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
      <StatCard label={t('totalRevenue')} value={m(summary?.totalRevenueAmount)} loading={isLoading} />
      <StatCard label={t('closedOrders')} value={summary?.closedOrderCount ?? 0} loading={isLoading} />
      <StatCard label={t('avgOrderValue')} value={m(summary?.averageOrderValueAmount)} loading={isLoading} />
      <StatCard label={t('totalDiscounts')} value={m(summary?.totalDiscountAmount)} loading={isLoading} />
      <StatCard label={t('cancelledCount')} value={summary?.cancelledOrderCount ?? 0} loading={isLoading} />
      <StatCard label={t('cancelledValue')} value={m(summary?.cancelledOrderValueAmount)} loading={isLoading} />
    </div>
  );
}
