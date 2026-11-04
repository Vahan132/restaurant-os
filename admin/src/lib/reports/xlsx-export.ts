import {
  reportExportControllerExportByItem,
  reportExportControllerExportProfit,
  reportExportControllerExportTable,
} from '@/api/generated/reports/reports';
import type { ExportColumnDtoKind, ExportRowDtoStyle } from '@/api/generated/model';
import { downloadBlob } from '@/lib/catalog/download';
import { currencyFractionDigits } from '@/lib/money';

/**
 * REPORT-XLSX-1: every report export goes through the API so all Excel files
 * share the back-office layout (title, "period" line, "warehouses" line, grey
 * header row, totals). Money values passed here are MINOR units; they are
 * converted to major units before sending.
 */

export type XlsxKind = ExportColumnDtoKind;

export interface XlsxColumn<T> {
  header: string;
  kind: XlsxKind;
  value: (row: T) => string | number | null;
  width?: number;
}

export interface XlsxTable<T> {
  /** Worksheet tab name. */
  sheetName: string;
  /** Full title line, e.g. "Sales report from 24.09.2026 to 24.09.2026". */
  title: string;
  infoLines?: string[];
  columns: XlsxColumn<T>[];
  rows: T[];
  /** Optional bold total row (raw values, money in MINOR units). */
  totalRow?: Array<string | number | null>;
  /** Per-row style (group header / subtotal / total). */
  rowStyle?: (row: T) => ExportRowDtoStyle | undefined;
}

export type ReportLang = 'hy' | 'ru' | 'en';

export function reportLang(locale: string): ReportLang {
  return locale === 'hy' || locale === 'ru' ? locale : 'en';
}

/** dd.mm.yyyy from YYYY-MM-DD. */
export function fmtReportDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}.${m}.${y}` : iso;
}

function toCells<T>(
  row: T,
  columns: XlsxColumn<T>[],
  divisor: number,
): Array<string | number | null> {
  return columns.map((c) => {
    const v = c.value(row);
    if (c.kind === 'money' && typeof v === 'number') return v / divisor;
    return v;
  });
}

export async function downloadXlsxTables(
  fileName: string,
  currency: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tables: XlsxTable<any>[],
  opts: { warehousesLabel?: string; branchId?: string; branchLabel?: string } = {},
): Promise<void> {
  const decimals = currencyFractionDigits(currency);
  const divisor = 10 ** decimals;
  const blob = (await reportExportControllerExportTable(
    {
      fileName,
      moneyDecimals: decimals,
      warehousesLabel: opts.warehousesLabel,
      branchId: opts.branchId,
      branchLabel: opts.branchLabel,
      sheets: tables.map((tbl) => {
        const rows = tbl.rows.map((r) => ({
          cells: toCells(r, tbl.columns, divisor),
          style: tbl.rowStyle?.(r),
        }));
        if (tbl.totalRow) {
          rows.push({
            cells: tbl.totalRow.map((v, i) =>
              tbl.columns[i]?.kind === 'money' && typeof v === 'number' ? v / divisor : v,
            ),
            style: 'total',
          });
        }
        return {
          name: tbl.sheetName,
          title: tbl.title,
          infoLines: tbl.infoLines,
          columns: tbl.columns.map((c) => ({ header: c.header, kind: c.kind, width: c.width })),
          // The generated DTO types cells as (string | number)[]; nulls are allowed server-side.
          rows: rows as unknown as { cells: (string | number)[]; style?: ExportRowDtoStyle }[],
        };
      }),
    },
    { responseType: 'blob' },
  )) as unknown as Blob;
  downloadBlob(`${fileName}.xlsx`, blob);
}

export async function downloadProfitXlsx(
  from: string,
  to: string,
  lang: ReportLang,
  branchId?: string,
) {
  const blob = (await reportExportControllerExportProfit(
    { from, to, lang, branchId },
    { responseType: 'blob' },
  )) as unknown as Blob;
  downloadBlob(`profit_${from}_${to}.xlsx`, blob);
}

export async function downloadSalesByItemXlsx(
  from: string,
  to: string,
  lang: ReportLang,
  branchId?: string,
) {
  const blob = (await reportExportControllerExportByItem(
    { from, to, lang, branchId },
    { responseType: 'blob' },
  )) as unknown as Blob;
  downloadBlob(`sales_${from}_${to}.xlsx`, blob);
}
