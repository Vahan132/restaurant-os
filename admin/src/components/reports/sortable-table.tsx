'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { downloadCsv } from '@/lib/reports/csv';

export interface Column<T> {
  key: string;
  label: string;
  align?: 'left' | 'right';
  cell: (row: T) => ReactNode;
  csv: (row: T) => string | number;
  /** When provided, the column header is clickable to sort. */
  sort?: (row: T) => number | string;
}

export function SortableTable<T>({
  title,
  rows,
  columns,
  csvName,
  isLoading,
  emptyText,
  footer,
}: {
  title: string;
  rows: T[];
  columns: Column<T>[];
  csvName: string;
  isLoading?: boolean;
  emptyText: string;
  footer?: ReactNode;
}) {
  const t = useTranslations('reports');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sort) return rows;
    const sortFn = col.sort;
    return [...rows].sort((a, b) => {
      const av = sortFn(a);
      const bv = sortFn(b);
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv));
      return dir === 'asc' ? cmp : -cmp;
    });
  }, [rows, columns, sortKey, dir]);

  const toggleSort = (col: Column<T>) => {
    if (!col.sort) return;
    if (sortKey === col.key) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(col.key);
      setDir('desc');
    }
  };

  const onExport = () =>
    downloadCsv(
      csvName,
      sorted,
      columns.map((c) => ({ label: c.label, value: c.csv })),
    );

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        <Button size="sm" variant="secondary" onClick={onExport} disabled={rows.length === 0}>
          {t('export')}
        </Button>
      </div>
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-gray-100" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">{emptyText}</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`py-2 font-medium ${c.align === 'right' ? 'text-right' : 'text-left'} ${
                    c.sort ? 'cursor-pointer select-none hover:text-gray-700' : ''
                  }`}
                  onClick={() => toggleSort(c)}
                >
                  {c.label}
                  {sortKey === c.key ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={i} className="border-b border-gray-100">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`py-2 ${c.align === 'right' ? 'text-right tabular-nums' : 'text-left'} text-gray-700`}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer && <tfoot>{footer}</tfoot>}
        </table>
      )}
    </div>
  );
}
