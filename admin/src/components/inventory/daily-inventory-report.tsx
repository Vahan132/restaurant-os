'use client';

import { keepPreviousData } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { useDailyInventoryReportControllerGet } from '@/api/generated/inventory-daily-report/inventory-daily-report';
import type {
  DailyInventoryReportResponse,
  DailyItemRowView,
  QtyValueView,
} from '@/api/generated/model';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/ui/form';
import { Toggle } from '@/components/ui/toggle';
import { itemDisplayName } from '@/lib/inventory/display-name';
import {
  BASE_UNIT_ABBR,
  formatNumber,
  largestAlternate,
  type BaseUnit,
} from '@/lib/inventory/units';
import { getErrorMessage } from '@/lib/api-error';
import { formatMoney } from '@/lib/money';
import {
  downloadXlsxTables,
  fmtReportDate,
  type XlsxColumn,
} from '@/lib/reports/xlsx-export';
import { useRestaurant } from '@/lib/restaurant/use-restaurant';
import { toast } from '@/stores/toast';

const abbr = (u: string) => BASE_UNIT_ABBR[u as BaseUnit] ?? u;

function shiftDate(dateStr: string, days: number): string {
  const [y = 1970, m = 1, d = 1] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Qty in the item's largest alternate unit when it reads better (4,800 g -> 4.8 kg). */
function fmtQty(qty: number, row: Pick<DailyItemRowView, 'baseUnit' | 'alternateUnits'>): string {
  if (qty === 0) return '·';
  const alt = largestAlternate(row.alternateUnits);
  if (alt && Math.abs(qty) >= alt.factor) {
    return `${formatNumber(qty / alt.factor, 2)} ${alt.name}`;
  }
  return `${formatNumber(qty)} ${abbr(row.baseUnit)}`;
}

/** MICRO unit cost shown per kg / L when the unit is g / ml, else per base unit. */
function fmtUnitPrice(micro: string | null, baseUnit: string, currency: string): string {
  if (micro == null) return '—';
  const perBase = Number(micro) / 1_000_000;
  if (baseUnit === 'GRAM') return `${formatMoney(perBase * 1000, currency)} / kg`;
  if (baseUnit === 'MILLILITER') return `${formatMoney(perBase * 1000, currency)} / L`;
  return `${formatMoney(perBase, currency)} / ${abbr(baseUnit)}`;
}

function Tile({
  label,
  value,
  tone = 'default',
  hint,
}: {
  label: string;
  value: string;
  tone?: 'default' | 'good' | 'bad';
  hint?: string;
}) {
  const color =
    tone === 'good' ? 'text-green-700' : tone === 'bad' ? 'text-red-600' : 'text-gray-900';
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${color}`}>{value}</p>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

/**
 * DAILY-INV-1: end-of-day inventory report for the active branch — what the
 * branch started with, what came in, what was sold / produced / wasted, what the
 * physical counts corrected, and what is left (qty + value), plus the day's
 * ingredient price switches and the dish cost-price changes they caused.
 */
export function DailyInventoryReport() {
  const t = useTranslations('inventory');
  const locale = useLocale();
  const { data: restaurant } = useRestaurant();
  const currency = restaurant?.currency ?? 'USD';

  const [date, setDate] = useState<string>('');
  /** Range end ('' = single day). */
  const [endDate, setEndDate] = useState<string>('');
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState('');
  const [movedOnly, setMovedOnly] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const isRange = Boolean(date && endDate && endDate !== date);
  const params = useMemo(
    () =>
      isRange
        ? { from: date, to: endDate }
        : {
            ...(date ? { date } : {}),
            ...(refreshKey > 0 ? { refresh: 'true' as const } : {}),
          },
    [date, endDate, isRange, refreshKey],
  );
  const query = useDailyInventoryReportControllerGet(params, {
    query: { placeholderData: keepPreviousData },
  });
  const report = query.data as DailyInventoryReportResponse | undefined;
  const shownDate = date || report?.businessDate || '';
  const shownEnd = endDate || shownDate;
  const shift = (days: number) => {
    if (!shownDate) return;
    setRefreshKey(0);
    setDate(shiftDate(shownDate, days));
    if (endDate) setEndDate(shiftDate(shownEnd, days));
  };

  const name = (r: { name: string | null; catalogName: DailyItemRowView['catalogName'] }) =>
    itemDisplayName({ name: r.name, catalogName: r.catalogName ?? null }, locale);

  const moved = (r: DailyItemRowView) =>
    [
      r.received,
      r.sold,
      r.produced,
      r.usedInProduction,
      r.wasted,
      r.countVariance,
      r.adjusted,
      r.transferred,
    ].some((p: QtyValueView) => p.qty !== 0 || p.value !== 0);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (report?.items ?? []).filter((r) => {
      if (movedOnly && !moved(r)) return false;
      if (q && !name(r).toLowerCase().includes(q)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, search, movedOnly, locale]);

  const tot = report?.totals;
  const money = (v: number) => formatMoney(v, currency);

  const onExport = async () => {
    if (!report) return;
    const from = report.businessDate;
    const to = report.endDate ?? report.businessDate;
    const columns: XlsxColumn<DailyItemRowView>[] = [
      { header: t('dailyXlsxGroup'), kind: 'text', width: 22, value: (r) => r.categoryName ?? '' },
      { header: t('repItemCol'), kind: 'text', width: 34, value: (r) => name(r) },
      { header: t('dailyXlsxUnit'), kind: 'text', width: 8, value: (r) => abbr(r.baseUnit) },
      { header: t('dailyOpening'), kind: 'qty', value: (r) => r.opening.qty },
      { header: t('dailyXlsxOpeningValue'), kind: 'money', value: (r) => r.opening.value },
      { header: t('dailyReceived'), kind: 'qty', value: (r) => r.received.qty },
      { header: t('dailyProduced'), kind: 'qty', value: (r) => r.produced.qty },
      { header: t('dailySold'), kind: 'qty', value: (r) => -r.sold.qty },
      { header: t('dailyXlsxSoldValue'), kind: 'money', value: (r) => -r.sold.value },
      { header: t('dailyUsedInProduction'), kind: 'qty', value: (r) => -r.usedInProduction.qty },
      { header: t('dailyWasted'), kind: 'qty', value: (r) => -r.wasted.qty },
      { header: t('dailyXlsxWastedValue'), kind: 'money', value: (r) => -r.wasted.value },
      { header: t('dailyCountVariance'), kind: 'qty', value: (r) => r.countVariance.qty },
      {
        header: t('dailyAdjusted'),
        kind: 'qty',
        value: (r) => r.adjusted.qty + r.transferred.qty,
      },
      { header: t('dailyClosing'), kind: 'qty', value: (r) => r.closing.qty },
      { header: t('dailyClosingValue'), kind: 'money', value: (r) => r.closing.value },
    ];
    const tt = report.totals;
    setExporting(true);
    try {
      await downloadXlsxTables(
        `inventory_${from}_${to}`,
        currency,
        [
          {
            sheetName: t('dailyXlsxSheet'),
            title: t('dailyXlsxTitle', { from: fmtReportDate(from), to: fmtReportDate(to) }),
            infoLines: [
              t('dailyXlsxPeriod', { from: fmtReportDate(from), to: fmtReportDate(to) }),
            ],
            columns,
            rows,
            totalRow: [
              t('dailyXlsxTotal'),
              null,
              null,
              null,
              tt.openingValue,
              null,
              null,
              null,
              -tt.soldValue,
              null,
              null,
              -tt.wastedValue,
              null,
              null,
              null,
              tt.closingValue,
            ],
          },
        ],
        { warehousesLabel: t('dailyXlsxWarehouses') },
      );
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4 print:space-y-2">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3 print:hidden">
        <div className="flex items-end gap-1">
          <Button size="sm" variant="secondary" onClick={() => shift(-1)}>
            ‹
          </Button>
          <label className="text-xs text-gray-600">
            <span className="mr-1 block">{t('dailyFrom')}</span>
            <input
              type="date"
              className={`${inputClass} w-auto`}
              value={shownDate}
              max={endDate || undefined}
              onChange={(e) => {
                setRefreshKey(0);
                setDate(e.target.value);
              }}
            />
          </label>
          <label className="text-xs text-gray-600">
            <span className="mr-1 block">{t('dailyTo')}</span>
            <input
              type="date"
              className={`${inputClass} w-auto`}
              value={shownEnd}
              min={shownDate || undefined}
              onChange={(e) => {
                setRefreshKey(0);
                if (!date && shownDate) setDate(shownDate);
                setEndDate(e.target.value);
              }}
            />
          </label>
          <Button size="sm" variant="secondary" onClick={() => shift(1)}>
            ›
          </Button>
          {isRange && (
            <Button size="sm" variant="ghost" onClick={() => setEndDate('')}>
              {t('dailySingleDay')}
            </Button>
          )}
        </div>
        <input
          className={`${inputClass} max-w-xs`}
          placeholder={t('dailySearch')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="w-52">
          <Toggle label={t('dailyMovedOnly')} checked={movedOnly} onChange={setMovedOnly} />
        </div>
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={!report || exporting}
            onClick={() => void onExport()}
          >
            {t('dailyExportXlsx')}
          </Button>
          {report && !report.inProgress && !isRange && (
            <Button
              size="sm"
              variant="secondary"
              disabled={query.isFetching}
              onClick={() => setRefreshKey((k) => k + 1)}
            >
              {t('dailyRebuild')}
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => window.print()}>
            {t('dailyPrint')}
          </Button>
        </div>
      </div>

      {query.isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : query.isError || !report || !tot ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          {t('loadError')}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <span className="font-medium text-gray-900">
              {(report.endDate ?? report.businessDate) !== report.businessDate
                ? t('dailyHeadingRange', {
                    from: report.businessDate,
                    to: report.endDate ?? report.businessDate,
                  })
                : t('dailyHeading', { date: report.businessDate })}
            </span>
            {report.inProgress ? (
              <Badge tone="blue">{t('dailyInProgress')}</Badge>
            ) : report.frozen ? (
              <Badge tone="green">
                {t('dailyClosed', { at: new Date(report.generatedAt).toLocaleString(locale) })}
              </Badge>
            ) : null}
            <span className="text-xs text-gray-400">{report.timezone}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
            <Tile label={t('dailyOpening')} value={money(tot.openingValue)} />
            <Tile label={t('dailyReceived')} value={money(tot.receivedValue)} tone="good" />
            <Tile label={t('dailySold')} value={money(-tot.soldValue)} hint={t('dailySoldHint')} />
            <Tile
              label={t('dailyProduction')}
              value={money(tot.producedValue + tot.usedInProductionValue)}
              hint={t('dailyProductionHint', {
                in: money(tot.producedValue),
                out: money(-tot.usedInProductionValue),
              })}
            />
            <Tile
              label={t('dailyWasted')}
              value={money(-tot.wastedValue)}
              tone={tot.wastedValue < 0 ? 'bad' : 'default'}
            />
            <Tile
              label={t('dailyCountVariance')}
              value={money(tot.countVarianceValue)}
              tone={
                tot.countVarianceValue < 0 ? 'bad' : tot.countVarianceValue > 0 ? 'good' : 'default'
              }
              hint={t('dailyCountVarianceHint')}
            />
            <Tile label={t('dailyAdjusted')} value={money(tot.adjustedValue)} />
            <Tile
              label={t('dailyClosing')}
              value={money(tot.closingValue)}
              hint={
                tot.negativeItems > 0
                  ? t('dailyNegativeItems', { n: tot.negativeItems })
                  : t('dailyItemsMoved', { n: tot.itemsMoved })
              }
              tone={tot.negativeItems > 0 ? 'bad' : 'default'}
            />
          </div>

          {/* Per-item movement table */}
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            {rows.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-500">{t('dailyNoMovement')}</p>
            ) : (
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-200 text-left uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-2 font-medium">{t('repItemCol')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('dailyOpening')}</th>
                    <th className="px-3 py-2 text-right font-medium">+ {t('dailyReceived')}</th>
                    <th className="px-3 py-2 text-right font-medium">+ {t('dailyProduced')}</th>
                    <th className="px-3 py-2 text-right font-medium">− {t('dailySold')}</th>
                    <th className="px-3 py-2 text-right font-medium">
                      − {t('dailyUsedInProduction')}
                    </th>
                    <th className="px-3 py-2 text-right font-medium">− {t('dailyWasted')}</th>
                    <th className="px-3 py-2 text-right font-medium">
                      ± {t('dailyCountVariance')}
                    </th>
                    <th className="px-3 py-2 text-right font-medium">± {t('dailyAdjusted')}</th>
                    <th className="px-3 py-2 text-right font-medium">= {t('dailyClosing')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('dailyClosingValue')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('dailyCurrentPrice')}</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {rows.map((r) => (
                    <tr key={r.itemId} className="border-b border-gray-100">
                      <td className="px-3 py-1.5">
                        <span className="font-medium text-gray-800">{name(r)}</span>
                        {r.categoryName && (
                          <span className="block text-[11px] text-gray-400">{r.categoryName}</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right text-gray-600">
                        {fmtQty(r.opening.qty, r)}
                      </td>
                      <td className="px-3 py-1.5 text-right text-green-700">
                        {fmtQty(r.received.qty, r)}
                      </td>
                      <td className="px-3 py-1.5 text-right text-green-700">
                        {fmtQty(r.produced.qty, r)}
                      </td>
                      <td className="px-3 py-1.5 text-right text-gray-700">
                        {fmtQty(-r.sold.qty, r)}
                      </td>
                      <td className="px-3 py-1.5 text-right text-gray-700">
                        {fmtQty(-r.usedInProduction.qty, r)}
                      </td>
                      <td className="px-3 py-1.5 text-right text-red-600">
                        {fmtQty(-r.wasted.qty, r)}
                      </td>
                      <td
                        className={`px-3 py-1.5 text-right ${
                          r.countVariance.qty < 0
                            ? 'text-red-600'
                            : r.countVariance.qty > 0
                              ? 'text-green-700'
                              : 'text-gray-400'
                        }`}
                      >
                        {fmtQty(r.countVariance.qty, r)}
                      </td>
                      <td className="px-3 py-1.5 text-right text-gray-600">
                        {fmtQty(r.adjusted.qty + r.transferred.qty, r)}
                      </td>
                      <td
                        className={`px-3 py-1.5 text-right font-medium ${
                          r.closing.qty < 0 ? 'text-red-600' : 'text-gray-900'
                        }`}
                      >
                        {r.closing.qty === 0 ? `0 ${abbr(r.baseUnit)}` : fmtQty(r.closing.qty, r)}
                      </td>
                      <td className="px-3 py-1.5 text-right text-gray-700">
                        {money(r.closing.value)}
                      </td>
                      <td className="px-3 py-1.5 text-right text-gray-500">
                        {fmtUnitPrice(r.currentUnitCostMicro, r.baseUnit, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Price changes */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <h3 className="text-sm font-semibold text-gray-800">{t('dailyItemPriceChanges')}</h3>
              <p className="text-xs text-gray-400">{t('dailyItemPriceChangesHint')}</p>
              {report.itemCostChanges.length === 0 ? (
                <p className="mt-2 text-xs text-gray-400">{t('dailyNoPriceChanges')}</p>
              ) : (
                <ul className="mt-2 space-y-1.5 text-xs">
                  {report.itemCostChanges.map((c, i) => {
                    const up =
                      c.oldUnitCostMicro != null &&
                      Number(c.newUnitCostMicro) > Number(c.oldUnitCostMicro);
                    return (
                      <li key={i} className="flex flex-wrap items-baseline justify-between gap-2">
                        <span>
                          <span className="font-medium text-gray-800">{name(c)}</span>
                          <span className="text-gray-400">
                            {' · '}
                            {new Date(c.occurredAt).toLocaleTimeString(locale, {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                            {c.supplierName ? ` · ${c.supplierName}` : ''}
                            {` · ${t(`dailyTrigger${c.trigger}` as 'dailyTriggerRECEIPT')}`}
                          </span>
                        </span>
                        <span className={up ? 'text-red-600' : 'text-green-700'}>
                          {fmtUnitPrice(c.oldUnitCostMicro, c.baseUnit, currency)} →{' '}
                          {fmtUnitPrice(c.newUnitCostMicro, c.baseUnit, currency)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <h3 className="text-sm font-semibold text-gray-800">{t('dailyDishCostChanges')}</h3>
              <p className="text-xs text-gray-400">{t('dailyDishCostChangesHint')}</p>
              {report.dishCostChanges.length === 0 ? (
                <p className="mt-2 text-xs text-gray-400">{t('dailyNoPriceChanges')}</p>
              ) : (
                <ul className="mt-2 space-y-1.5 text-xs">
                  {report.dishCostChanges.map((c, i) => {
                    const up = c.oldCostAmount != null && c.newCostAmount > c.oldCostAmount;
                    return (
                      <li key={i} className="flex flex-wrap items-baseline justify-between gap-2">
                        <span>
                          <span className="font-medium text-gray-800">{c.menuItemName ?? '—'}</span>
                          {c.causeItemId && (
                            <span className="text-gray-400">
                              {' · '}
                              {t('costChangeCause', {
                                name: name({
                                  name: c.causeItemName,
                                  catalogName: c.causeCatalogName,
                                }),
                              })}
                            </span>
                          )}
                        </span>
                        <span className={up ? 'text-red-600' : 'text-green-700'}>
                          {c.oldCostAmount != null ? money(c.oldCostAmount) : '—'} →{' '}
                          {money(c.newCostAmount)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
