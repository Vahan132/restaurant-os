'use client';

import { useLocale, useTranslations } from 'next-intl';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { getErrorMessage } from '@/lib/api-error';
import {
  downloadXlsxTables,
  fmtReportDate,
  reportLang,
  type ReportLang,
  type XlsxTable,
} from '@/lib/reports/xlsx-export';
import { toast } from '@/stores/toast';

interface ReportExportValue {
  from: string;
  to: string;
  currency: string;
  lang: ReportLang;
  /** BR-REPORTS-1: report branch filter (undefined = all allowed branches). */
  branchId?: string;
  /** "<title> from dd.mm.yyyy to dd.mm.yyyy". */
  titleFor: (title: string) => string;
  /** "Period: from … to …". */
  periodLine: string;
  busy: boolean;
  /** Export one or more tables into a single workbook (adds the warehouses line). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  exportTables: (fileName: string, tables: XlsxTable<any>[]) => Promise<void>;
  /** Run any download with the shared busy flag + error toast. */
  run: (job: () => Promise<void>) => Promise<void>;
}

const Ctx = createContext<ReportExportValue | null>(null);

/**
 * Supplies the active report period + currency so every table on the reports
 * page exports to the same Excel layout (see lib/reports/xlsx-export).
 */
export function ReportExportProvider({
  from,
  to,
  currency,
  branchId,
  children,
}: {
  from: string;
  to: string;
  currency: string;
  branchId?: string;
  children: ReactNode;
}) {
  const t = useTranslations('reports.xlsx');
  const locale = useLocale();
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (job: () => Promise<void>) => {
    setBusy(true);
    try {
      await job();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }, []);

  const value = useMemo<ReportExportValue>(() => {
    const vars = { from: fmtReportDate(from), to: fmtReportDate(to) };
    return {
      from,
      to,
      currency,
      lang: reportLang(locale),
      branchId,
      titleFor: (title: string) => t('title', { title, ...vars }),
      periodLine: t('period', vars),
      busy,
      run,
      exportTables: (fileName, tables) =>
        run(() =>
          downloadXlsxTables(`${fileName}_${from}_${to}`, currency, tables, {
            warehousesLabel: t('warehouses'),
            branchId,
            branchLabel: t('branch'),
          }),
        ),
    };
  }, [from, to, currency, branchId, locale, busy, run, t]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useReportExport(): ReportExportValue | null {
  return useContext(Ctx);
}
