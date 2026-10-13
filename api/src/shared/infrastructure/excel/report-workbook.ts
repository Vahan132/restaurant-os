import * as ExcelJS from 'exceljs';

/**
 * REPORT-XLSX-1: shared renderer for every report export. Produces the same
 * layout the restaurant already uses in its back-office (iiko-style):
 *
 *   A1  Отчет о продажах с 24.09.2026 по 24.09.2026      (bold, large)
 *   A2  За период: с 24.09.2026 по 24.09.2026
 *   A3  Склад(ы): Bar, Kitchen, ...                      (optional info lines)
 *   A5  | Группа | Элемент номенклатуры | Количество | ...  (grey header row)
 *   ... data rows, optional group / subtotal rows, bold total row
 *
 * Pure (no DI) so any module can render a sheet. Money cells are MAJOR units
 * (the caller converts from minor units) and formatted with `moneyDecimals`.
 */

export type ReportColumnKind = 'text' | 'int' | 'qty' | 'money' | 'percent' | 'date';

export interface ReportColumn {
  header: string;
  kind: ReportColumnKind;
  /** Character width; a sensible default is derived from the kind. */
  width?: number;
}

export type ReportCell = string | number | null;

export interface ReportRow {
  cells: ReportCell[];
  /** group = category header row, subtotal = per-group total, total = grand total. */
  style?: 'group' | 'subtotal' | 'total';
}

export interface ReportSheet {
  /** Worksheet tab name (trimmed to Excel's 31 char limit). */
  name: string;
  /** First line, e.g. "Sales report from 24.09.2026 to 24.09.2026". */
  title: string;
  /** Info lines under the title (period, warehouses, branch, generated at...). */
  infoLines?: string[];
  columns: ReportColumn[];
  rows: ReportRow[];
}

export interface ReportWorkbookOptions {
  /** Fraction digits for money cells (AMD = 0, USD/RUB = 2). */
  moneyDecimals?: number;
}

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFD9D9D9' },
};
const GROUP_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF2F2F2' },
};
const THIN: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FFBFBFBF' } };
const BORDER: Partial<ExcelJS.Borders> = { top: THIN, left: THIN, bottom: THIN, right: THIN };

function defaultWidth(kind: ReportColumnKind): number {
  switch (kind) {
    case 'text':
      return 32;
    case 'date':
      return 18;
    case 'percent':
      return 14;
    default:
      return 18;
  }
}

function numFmt(kind: ReportColumnKind, moneyDecimals: number): string | undefined {
  switch (kind) {
    case 'int':
      return '#,##0';
    case 'qty':
      return '#,##0.###';
    case 'money':
      return moneyDecimals > 0 ? `#,##0.${'0'.repeat(moneyDecimals)}` : '#,##0';
    case 'percent':
      return '0.00%';
    default:
      return undefined;
  }
}

/** dd.mm.yyyy from YYYY-MM-DD (the format used in the report header). */
export function formatReportDate(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-');
  return y && m && d ? `${d}.${m}.${y}` : isoDate;
}

/** Excel-safe sheet name: no []:*?/\ and at most 31 chars, unique per workbook. */
function sheetName(wb: ExcelJS.Workbook, raw: string): string {
  const base = (raw.replace(/[[\]:*?/\\]/g, ' ').trim() || 'Report').slice(0, 31);
  let name = base;
  let i = 2;
  while (wb.getWorksheet(name)) {
    const suffix = ` (${i++})`;
    name = `${base.slice(0, 31 - suffix.length)}${suffix}`;
  }
  return name;
}

export function addReportSheet(
  wb: ExcelJS.Workbook,
  sheet: ReportSheet,
  options: ReportWorkbookOptions = {},
): ExcelJS.Worksheet {
  const moneyDecimals = options.moneyDecimals ?? 2;
  const ws = wb.addWorksheet(sheetName(wb, sheet.name), {
    views: [{ state: 'frozen', ySplit: 0 }],
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9, // A4
    },
  });
  const colCount = Math.max(sheet.columns.length, 1);

  ws.columns = sheet.columns.map((c) => ({ width: c.width ?? defaultWidth(c.kind) }));

  // ── Title block ──────────────────────────────────────────────────────────
  const titleRow = ws.addRow([sheet.title]);
  titleRow.font = { bold: false, size: 18 };
  titleRow.height = 28;
  ws.mergeCells(titleRow.number, 1, titleRow.number, colCount);

  for (const line of sheet.infoLines ?? []) {
    const r = ws.addRow([line]);
    r.font = { size: 12 };
    ws.mergeCells(r.number, 1, r.number, colCount);
  }

  // ── Header ───────────────────────────────────────────────────────────────
  const header = ws.addRow(sheet.columns.map((c) => c.header));
  header.height = 32;
  header.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.border = BORDER;
    cell.font = { bold: false };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  ws.views = [{ state: 'frozen', ySplit: header.number }];
  ws.autoFilter = {
    from: { row: header.number, column: 1 },
    to: { row: header.number, column: colCount },
  };

  // ── Body ─────────────────────────────────────────────────────────────────
  for (const row of sheet.rows) {
    const values = sheet.columns.map((c, i) => {
      const v = row.cells[i];
      if (v === null || v === undefined || v === '') return null;
      if (c.kind === 'text' || c.kind === 'date') return v;
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isFinite(n) ? n : v;
    });
    const r = ws.addRow(values);
    sheet.columns.forEach((c, i) => {
      const cell = r.getCell(i + 1);
      cell.border = BORDER;
      const fmt = numFmt(c.kind, moneyDecimals);
      if (fmt) cell.numFmt = fmt;
      if (c.kind !== 'text' && c.kind !== 'date') cell.alignment = { horizontal: 'right' };
    });
    if (row.style === 'group') {
      r.font = { bold: true };
      r.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = GROUP_FILL;
      });
    } else if (row.style === 'subtotal') {
      r.font = { italic: true, bold: true };
    } else if (row.style === 'total') {
      r.font = { bold: true };
      r.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = HEADER_FILL;
      });
    }
  }
  return ws;
}

export function newReportWorkbook(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Restaurant OS';
  wb.created = new Date();
  return wb;
}

export async function renderReportWorkbook(
  sheets: ReportSheet[],
  options: ReportWorkbookOptions = {},
): Promise<Buffer> {
  const wb = newReportWorkbook();
  for (const s of sheets) addReportSheet(wb, s, options);
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

/** Currency fraction digits via Intl (AMD 0, USD/RUB 2); 2 when unknown. */
export function currencyDecimals(currency: string): number {
  try {
    return (
      new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

export const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
