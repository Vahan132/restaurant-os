'use client';

import { keepPreviousData } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import {
  auditControllerExport,
  useAuditControllerList,
} from '@/api/generated/audit/audit';
import type {
  AuditControllerExportParams,
  AuditControllerListParams,
  AuditLogResponse,
} from '@/api/generated/model';
import { downloadBlob } from '@/lib/catalog/download';
import { normalizeList } from '@/lib/normalize-list';
import { addDays } from '@/lib/reports/date-range';
import { zonedToUtcISO } from '@/lib/tz';

export type AuditPreset = 'today' | '7d' | '30d' | 'custom';

/**
 * Convert an inclusive calendar-day range (restaurant tz) into the ISO bounds
 * the API expects: `from` inclusive at 00:00, `to` exclusive at the start of
 * the day after `toYmd`.
 */
export function dayRangeToIso(
  fromYmd: string,
  toYmd: string,
  timeZone: string,
): { from?: string; to?: string } {
  return {
    from: fromYmd ? zonedToUtcISO(fromYmd, '00:00', timeZone) : undefined,
    to: toYmd ? zonedToUtcISO(addDays(toYmd, 1), '00:00', timeZone) : undefined,
  };
}

/** Paginated audit logs, normalized (newest-first ordering is server-side). */
export function useAuditLogs(params: AuditControllerListParams) {
  const query = useAuditControllerList(params, {
    query: { placeholderData: keepPreviousData },
  });
  const { items, pagination } = useMemo(
    () => normalizeList<AuditLogResponse>(query.data),
    [query.data],
  );
  return { ...query, logs: items, pagination };
}

/**
 * Imperative CSV export that respects the active filters. The backend export
 * endpoint takes the same filter parameters as the list ("what you see is what
 * you export"), so callers pass the very params object already applied to the
 * table. The generated GET fetcher is invoked directly with `responseType:
 * 'blob'` (via the axios mutator's request override) so the CSV can be saved
 * client-side without going through React Query's cache.
 */
export function useAuditExport() {
  const [isExporting, setExporting] = useState(false);

  const exportCsv = useCallback(
    async (params: AuditControllerExportParams, filename: string) => {
      setExporting(true);
      try {
        const blob = (await auditControllerExport(params, {
          responseType: 'blob',
        })) as unknown as Blob;
        downloadBlob(filename, blob);
      } finally {
        setExporting(false);
      }
    },
    [],
  );

  return { exportCsv, isExporting };
}
