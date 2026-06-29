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
import { ImportedSection } from '@/components/reports/imported-section';
import { RangeControls } from '@/components/reports/range-controls';
import { SummaryCards } from '@/components/reports/summary-cards';
import { TimeseriesChart } from '@/components/reports/timeseries-chart';
import { Toggle } from '@/components/ui/toggle';
import { usePermission } from '@/lib/auth/use-permission';
import { PERMISSIONS } from '@/lib/permissions';
import { useReportRange } from '@/lib/reports/use-report-range';
import { useRestaurant } from '@/lib/restaurant/use-restaurant';

export function ReportsView() {
  const t = useTranslations('reports');
  const ti = useTranslations('salesImport');
  const canView = usePermission(PERMISSIONS.REPORTS_VIEW);
  const { data: restaurant } = useRestaurant();
  const currency = restaurant?.currency ?? 'USD';
  const timezone =
    restaurant?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const {
    preset,
    groupBy,
    range,
    includeImported,
    setPreset,
    setCustomRange,
    setGroupBy,
    setIncludeImported,
  } = useReportRange(timezone);

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

      <div className="flex flex-wrap items-end justify-between gap-3">
        <RangeControls
          preset={preset}
          groupBy={groupBy}
          range={range}
          onPreset={setPreset}
          onCustom={setCustomRange}
          onGroupBy={setGroupBy}
        />
        <div className="min-w-[16rem]">
          <Toggle
            label={ti('reports.filterLabel')}
            description={ti('reports.filterHint')}
            checked={includeImported}
            onChange={setIncludeImported}
          />
        </div>
      </div>

      {includeImported && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {ti('reports.banner')}
        </p>
      )}

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

      {includeImported && (
        <ImportedSection from={from} to={to} groupBy={groupBy} currency={currency} />
      )}
    </div>
  );
}
