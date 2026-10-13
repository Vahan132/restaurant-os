'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import type { ItemRowResponse } from '@/api/generated/model';
import { useReportExport } from '@/components/reports/export-context';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/ui/form';
import { Toggle } from '@/components/ui/toggle';
import { formatMoney } from '@/lib/money';
import { useByItem } from '@/lib/reports/use-reports-data';
import type { XlsxColumn } from '@/lib/reports/xlsx-export';

type SortKey = 'name' | 'qty' | 'revenue' | 'cost' | 'costPct' | 'profit' | 'markup';

interface Agg {
  quantity: number;
  revenueAmount: number;
  costAmount: number;
}

/** A display row: a product, a group subtotal, or the grand total. */
interface Line extends Agg {
  kind: 'item' | 'subtotal' | 'total';
  group: string;
  name: string;
  estimated: boolean;
}

const ratio = (a: number, b: number): number | null => (b !== 0 ? a / b : null);
const pct = (v: number | null) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`);

function sum(rows: Agg[]): Agg {
  return rows.reduce(
    (a, r) => ({
      quantity: a.quantity + r.quantity,
      revenueAmount: a.revenueAmount + r.revenueAmount,
      costAmount: a.costAmount + r.costAmount,
    }),
    { quantity: 0, revenueAmount: 0, costAmount: 0 },
  );
}

function sortValue(r: ItemRowResponse, key: SortKey): number | string {
  switch (key) {
    case 'name':
      return r.name;
    case 'qty':
      return r.quantity;
    case 'revenue':
      return r.revenueAmount;
    case 'cost':
      return r.costAmount;
    case 'costPct':
      return ratio(r.costAmount, r.revenueAmount) ?? -1;
    case 'profit':
      return r.revenueAmount - r.costAmount;
    case 'markup':
      return ratio(r.revenueAmount - r.costAmount, r.costAmount) ?? -1;
  }
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  const color =
    tone === 'good' ? 'text-green-700' : tone === 'bad' ? 'text-red-600' : 'text-gray-900';
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

/**
 * Sales by product — the default view of the reports page, laid out like the
 * back-office "Отчет о продажах": Group | Item | Qty | Revenue | Cost price |
 * Cost % | Gross profit | Markup, grouped by menu category with subtotals.
 */
export function ProductSalesReport({
  from,
  to,
  currency,
}: {
  from: string;
  to: string;
  currency: string;
}) {
  const t = useTranslations('reports.products');
  const tr = useTranslations('reports');
  const exporter = useReportExport();
  const { rows, isLoading, isError } = useByItem(from, to);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [grouped, setGrouped] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('revenue');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');

  const noGroup = t('noGroup');
  const groupOf = (r: ItemRowResponse) => r.categoryName ?? noGroup;

  const categories = useMemo(
    () => [...new Set(rows.map(groupOf))].sort((a, b) => a.localeCompare(b)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, noGroup],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows.filter(
      (r) => (!category || groupOf(r) === category) && (!q || r.name.toLowerCase().includes(q)),
    );
    return list.sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv));
      return dir === 'asc' ? cmp : -cmp;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, category, sortKey, dir, noGroup]);

  const lines = useMemo<Line[]>(() => {
    const toLine = (r: ItemRowResponse): Line => ({
      kind: 'item',
      group: groupOf(r),
      name: r.name,
      estimated: r.costEstimated,
      quantity: r.quantity,
      revenueAmount: r.revenueAmount,
      costAmount: r.costAmount,
    });
    const out: Line[] = [];
    if (grouped) {
      const byGroup = new Map<string, ItemRowResponse[]>();
      for (const r of filtered) {
        const g = groupOf(r);
        byGroup.set(g, [...(byGroup.get(g) ?? []), r]);
      }
      const groups = [...byGroup.entries()].sort((a, b) => a[0].localeCompare(b[0]));
      for (const [g, list] of groups) {
        out.push(...list.map(toLine));
        if (groups.length > 1) {
          out.push({
            kind: 'subtotal',
            group: g,
            name: tr('xlsx.total'),
            estimated: false,
            ...sum(list),
          });
        }
      }
    } else {
      out.push(...filtered.map(toLine));
    }
    out.push({
      kind: 'total',
      group: tr('xlsx.total'),
      name: '',
      estimated: false,
      ...sum(filtered),
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, grouped, noGroup]);

  const total = useMemo(() => sum(filtered), [filtered]);
  const money = (v: number) => formatMoney(v, currency);
  const anyEstimated = filtered.some((r) => r.costEstimated);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setDir(key === 'name' ? 'asc' : 'desc');
    }
  };

  const onExport = () => {
    if (!exporter) return;
    const columns: XlsxColumn<Line>[] = [
      { header: t('group'), kind: 'text', width: 24, value: (l) => l.group },
      {
        header: t('item'),
        kind: 'text',
        width: 40,
        value: (l) => (l.estimated ? `${l.name} *` : l.name),
      },
      { header: t('qty'), kind: 'qty', width: 14, value: (l) => l.quantity },
      { header: t('revenue'), kind: 'money', value: (l) => l.revenueAmount },
      { header: t('cost'), kind: 'money', value: (l) => l.costAmount },
      { header: t('costPct'), kind: 'percent', value: (l) => ratio(l.costAmount, l.revenueAmount) },
      {
        header: t('profit'),
        kind: 'money',
        width: 20,
        value: (l) => l.revenueAmount - l.costAmount,
      },
      {
        header: t('markup'),
        kind: 'percent',
        value: (l) => ratio(l.revenueAmount - l.costAmount, l.costAmount),
      },
    ];
    void exporter.exportTables('sales', [
      {
        sheetName: t('sheet'),
        title: exporter.titleFor(t('xlsxTitle')),
        infoLines: anyEstimated ? [exporter.periodLine, t('estimatedNote')] : [exporter.periodLine],
        columns,
        rows: lines,
        rowStyle: (l: Line) => (l.kind === 'item' ? undefined : l.kind),
      },
    ]);
  };

  const Th = ({ k, label, right = true }: { k: SortKey; label: string; right?: boolean }) => (
    <th
      className={`cursor-pointer select-none px-3 py-2 font-medium hover:text-gray-700 ${
        right ? 'text-right' : 'text-left'
      }`}
      onClick={() => toggleSort(k)}
    >
      {label}
      {sortKey === k ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi label={t('revenue')} value={money(total.revenueAmount)} />
        <Kpi label={t('cost')} value={money(total.costAmount)} />
        <Kpi label={t('costPct')} value={pct(ratio(total.costAmount, total.revenueAmount))} />
        <Kpi
          label={t('profit')}
          value={money(total.revenueAmount - total.costAmount)}
          tone={total.revenueAmount - total.costAmount < 0 ? 'bad' : 'good'}
        />
        <Kpi label={t('qtySold')} value={String(total.quantity)} />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 p-3">
          <input
            className={`${inputClass} max-w-xs`}
            placeholder={t('search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className={`${inputClass} w-auto`}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">{t('allGroups')}</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div className="w-48">
            <Toggle label={t('groupByCategory')} checked={grouped} onChange={setGrouped} />
          </div>
          <div className="ml-auto">
            <Button
              size="sm"
              variant="secondary"
              onClick={onExport}
              disabled={!exporter || exporter.busy || filtered.length === 0}
            >
              {tr('exportXlsx')}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ) : isError ? (
          <p className="py-10 text-center text-sm text-gray-500">{t('loadError')}</p>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">{tr('empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-3 py-2 text-left font-medium">{t('group')}</th>
                  <Th k="name" label={t('item')} right={false} />
                  <Th k="qty" label={t('qty')} />
                  <Th k="revenue" label={t('revenue')} />
                  <Th k="cost" label={t('cost')} />
                  <Th k="costPct" label={t('costPct')} />
                  <Th k="profit" label={t('profit')} />
                  <Th k="markup" label={t('markup')} />
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {lines.map((l, i) => {
                  const profit = l.revenueAmount - l.costAmount;
                  const rowClass =
                    l.kind === 'total'
                      ? 'bg-gray-100 font-semibold text-gray-900'
                      : l.kind === 'subtotal'
                        ? 'bg-gray-50 font-medium italic text-gray-800'
                        : 'text-gray-700';
                  return (
                    <tr
                      key={`${l.kind}-${l.group}-${l.name}-${i}`}
                      className={`border-b border-gray-100 ${rowClass}`}
                    >
                      <td className="px-3 py-1.5 text-gray-500">{l.group}</td>
                      <td className="px-3 py-1.5">
                        {l.name}
                        {l.estimated && (
                          <span className="ml-1 text-amber-600" title={t('estimatedNote')}>
                            *
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right">{l.quantity}</td>
                      <td className="px-3 py-1.5 text-right">{money(l.revenueAmount)}</td>
                      <td className="px-3 py-1.5 text-right">{money(l.costAmount)}</td>
                      <td className="px-3 py-1.5 text-right">
                        {pct(ratio(l.costAmount, l.revenueAmount))}
                      </td>
                      <td className={`px-3 py-1.5 text-right ${profit < 0 ? 'text-red-600' : ''}`}>
                        {money(profit)}
                      </td>
                      <td className="px-3 py-1.5 text-right">{pct(ratio(profit, l.costAmount))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {anyEstimated && (
              <p className="px-3 py-2 text-xs text-amber-700">* {t('estimatedNote')}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
