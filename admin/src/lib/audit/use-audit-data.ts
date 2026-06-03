'use client';

import { keepPreviousData } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useAuditControllerList } from '@/api/generated/audit/audit';
import type { AuditControllerListParams, AuditLogResponse } from '@/api/generated/model';
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
