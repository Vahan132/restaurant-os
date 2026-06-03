'use client';

import { useTranslations } from 'next-intl';

import {
  CancellationsBreakdown,
  DiscountsBreakdown,
  ItemBreakdown,
  PaymentMethodBreakdown,
  TableBreakdown,
  WaiterBreakdown,
} from '@/components/reports/breakdowns';
import { RangeControls } from '@/components/reports/range-controls';
import { SummaryCards } from '@/components/reports/summary-cards';
import { TimeseriesChart } from '@/components/reports/timeseries-chart';
import { usePermission } from '@/lib/auth/use-permission';
import { PERMISSIONS } from '@/lib/permissions';
import { useReportRange } from '@/lib/reports/use-report-range';
import { useRestaurant } from '@/lib/restaurant/use-restaurant';

export function ReportsView() {
  const t = useTranslations('reports');
  const canView = usePermission(PERMISSIONS.REPORTS_VIEW);
  const { data: restaurant } = useRestaurant();
  const currency = restaurant?.currency ?? 'USD';
  const timezone =
    restaurant?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const { preset, groupBy, range, setPreset, setCustomRange, setGroupBy } =
    useReportRange(timezone);

  if (!canView) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          {t('restricted')}
        </p>
      </div>
    );
  }

  const { from, to } = range;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>

      <RangeControls
        preset={preset}
        groupBy={groupBy}
        range={range}
        onPreset={setPreset}
        onCustom={setCustomRange}
        onGroupBy={setGroupBy}
      />

      <SummaryCards from={from} to={to} currency={currency} />
      <TimeseriesChart from={from} to={to} groupBy={groupBy} currency={currency} />

      <PaymentMethodBreakdown from={from} to={to} currency={currency} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WaiterBreakdown from={from} to={to} currency={currency} />
        <TableBreakdown from={from} to={to} currency={currency} />
      </div>
      <ItemBreakdown from={from} to={to} currency={currency} />
      <DiscountsBreakdown from={from} to={to} currency={currency} />
      <CancellationsBreakdown from={from} to={to} currency={currency} />
    </div>
  );
}
