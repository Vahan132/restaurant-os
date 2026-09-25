'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import {
  CancellationsBreakdown,
  DiscountsBreakdown,
  PaymentMethodBreakdown,
  TableBreakdown,
  WaiterBreakdown,
} from '@/components/reports/breakdowns';
import { ReportExportProvider, useReportExport } from '@/components/reports/export-context';
import { ImportedSection } from '@/components/reports/imported-section';
import { ProductSalesReport } from '@/components/reports/product-sales-report';
import { ProfitReport } from '@/components/reports/profit-report';
import { RangeControls } from '@/components/reports/range-controls';
import { SummaryCards } from '@/components/reports/summary-cards';
import { TimeseriesChart } from '@/components/reports/timeseries-chart';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { usePermission } from '@/lib/auth/use-permission';
import { PERMISSIONS } from '@/lib/permissions';
import { downloadProfitXlsx } from '@/lib/reports/xlsx-export';
import { useReportRange } from '@/lib/reports/use-report-range';
import { useRestaurant } from '@/lib/restaurant/use-restaurant';

const VIEWS = [
  'products',
  'profit',
  'overview',
  'payments',
  'waiters',
  'tables',
  'discounts',
  'cancellations',
  'imported',
] as const;
type View = (typeof VIEWS)[number];

const VIEW_KEY = 'reports-view-v1';

function loadView(): View {
  try {
    const v = window.localStorage.getItem(VIEW_KEY);
    return (VIEWS as readonly string[]).includes(v ?? '') ? (v as View) : 'products';
  } catch {
    return 'products';
  }
}

function FullExportButton() {
  const t = useTranslations('reports');
  const exporter = useReportExport();
  if (!exporter) return null;
  return (
    <Button
      variant="primary"
      disabled={exporter.busy || !exporter.from || !exporter.to}
      onClick={() =>
        exporter.run(() => downloadProfitXlsx(exporter.from, exporter.to, exporter.lang))
      }
      title={t('fullExportHint')}
    >
      {exporter.busy ? t('exporting') : t('fullExport')}
    </Button>
  );
}

/**
 * Reports page. Opens on sales by product (with cost price and profit); the
 * header lists every report so the user can switch to any of them. All tables
 * export to the standard Excel layout for the selected period.
 */
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

  const [view, setViewState] = useState<View>('products');
  useEffect(() => setViewState(loadView()), []);
  const setView = (v: View) => {
    setViewState(v);
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* per-viewer convenience only */
    }
  };
  // "Imported" only exists while imported sales are included.
  const activeView: View = view === 'imported' && !includeImported ? 'products' : view;

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
  const views = VIEWS.filter((v) => v !== 'imported' || includeImported);

  return (
    <ReportExportProvider from={from} to={to} currency={currency}>
      <div className="space-y-5">
        {/* ── Header: title, every report as a selectable option, full export ── */}
        <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>
              <label className="flex items-center gap-2 text-sm text-gray-600 md:hidden">
                <span>{t('viewLabel')}</span>
                <select
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                  value={activeView}
                  onChange={(e) => setView(e.target.value as View)}
                >
                  {views.map((v) => (
                    <option key={v} value={v}>
                      {t(`view.${v}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <FullExportButton />
          </div>

          <nav className="hidden flex-wrap gap-1 md:flex" aria-label={t('viewLabel')}>
            {views.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-current={activeView === v ? 'page' : undefined}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeView === v
                    ? 'bg-brand text-brand-fg'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {t(`view.${v}`)}
              </button>
            ))}
          </nav>

          <div className="flex flex-wrap items-end justify-between gap-3 border-t border-gray-100 pt-3">
            <RangeControls
              preset={preset}
              groupBy={groupBy}
              range={range}
              onPreset={setPreset}
              onCustom={setCustomRange}
              onGroupBy={setGroupBy}
              showGroupBy={activeView === 'overview' || activeView === 'imported'}
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
        </div>

        {includeImported && (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {ti('reports.banner')}
          </p>
        )}

        {activeView === 'products' && (
          <ProductSalesReport from={from} to={to} currency={currency} />
        )}
        {activeView === 'profit' && <ProfitReport from={from} to={to} currency={currency} />}
        {activeView === 'overview' && (
          <>
            <SummaryCards from={from} to={to} currency={currency} />
            <TimeseriesChart from={from} to={to} groupBy={groupBy} currency={currency} />
          </>
        )}
        {activeView === 'payments' && (
          <PaymentMethodBreakdown from={from} to={to} currency={currency} />
        )}
        {activeView === 'waiters' && <WaiterBreakdown from={from} to={to} currency={currency} />}
        {activeView === 'tables' && <TableBreakdown from={from} to={to} currency={currency} />}
        {activeView === 'discounts' && (
          <DiscountsBreakdown from={from} to={to} currency={currency} />
        )}
        {activeView === 'cancellations' && (
          <CancellationsBreakdown from={from} to={to} currency={currency} />
        )}
        {activeView === 'imported' && (
          <ImportedSection from={from} to={to} groupBy={groupBy} currency={currency} />
        )}
      </div>
    </ReportExportProvider>
  );
}
