'use client';

import { useTranslations } from 'next-intl';
import { Fragment, useEffect, useMemo, useState } from 'react';

import { AuditLogResponseActorType, type AuditControllerListParams } from '@/api/generated/model';
import { AuditFilters, type AuditFilterValues } from '@/components/audit/audit-filters';
import { AuditRowDetail } from '@/components/audit/audit-row-detail';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePermission } from '@/lib/auth/use-permission';
import { humanize } from '@/lib/audit/diff';
import { dayRangeToIso, useAuditLogs } from '@/lib/audit/use-audit-data';
import { PERMISSIONS } from '@/lib/permissions';
import { useRestaurant } from '@/lib/restaurant/use-restaurant';
import { addDays } from '@/lib/reports/date-range';
import { formatDateTimeInTz, todayInTz } from '@/lib/tz';

const PAGE_SIZE = 25;

const actorTone = (type: string): 'blue' | 'amber' | 'gray' => {
  if (type === AuditLogResponseActorType.USER) return 'blue';
  if (type === AuditLogResponseActorType.PLATFORM_USER) return 'amber';
  return 'gray';
};

export function AuditViewer() {
  const t = useTranslations('audit');
  const canView = usePermission(PERMISSIONS.AUDIT_VIEW);
  const { data: restaurant } = useRestaurant();
  const timezone =
    restaurant?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const currency = restaurant?.currency ?? 'USD';

  const [filters, setFilters] = useState<AuditFilterValues>({
    preset: 'today',
    fromYmd: '',
    toYmd: '',
    action: '',
    entityType: '',
    entityId: '',
    actorFilter: '',
  });
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Resolve presets into concrete dates (restaurant tz).
  useEffect(() => {
    if (filters.preset === 'custom') return;
    const today = todayInTz(timezone);
    const from = filters.preset === 'today' ? today : filters.preset === '7d' ? addDays(today, -6) : addDays(today, -29);
    setFilters((f) => ({ ...f, fromYmd: from, toYmd: today }));
  }, [filters.preset, timezone]);

  // Reset to page 1 whenever a server-side filter changes.
  useEffect(() => {
    setPage(1);
  }, [filters.fromYmd, filters.toYmd, filters.action, filters.entityType, filters.entityId]);

  const onChange = (patch: Partial<AuditFilterValues>) =>
    setFilters((f) => ({ ...f, ...patch }));

  const iso = dayRangeToIso(filters.fromYmd, filters.toYmd, timezone);
  const params: AuditControllerListParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      from: iso.from,
      to: iso.to,
      action: filters.action || undefined,
      entityType: filters.entityType.trim() || undefined,
      entityId: filters.entityId.trim() || undefined,
    }),
    [page, iso.from, iso.to, filters.action, filters.entityType, filters.entityId],
  );

  const { logs, pagination, isLoading, isFetching } = useAuditLogs(params);

  // Client-side quick filter by actor name over the loaded page.
  const visible = useMemo(() => {
    const q = filters.actorFilter.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((l) => (l.actorName ?? '').toLowerCase().includes(q));
  }, [logs, filters.actorFilter]);

  const actionLabel = (code: string) =>
    t.has(`actionLabel.${code}`) ? t(`actionLabel.${code}`) : humanize(code);

  const hasNext = pagination?.hasNext ?? logs.length === PAGE_SIZE;

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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>

      <AuditFilters values={filters} onChange={onChange} />

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-gray-100" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">{t('empty')}</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 font-medium">{t('timestamp')}</th>
                <th className="px-4 py-2 font-medium">{t('actor')}</th>
                <th className="px-4 py-2 font-medium">{t('action')}</th>
                <th className="px-4 py-2 font-medium">{t('entity')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {visible.map((log) => {
                const open = expanded === log.id;
                return (
                  <Fragment key={log.id}>
                    <tr
                      className="cursor-pointer border-b border-gray-100 hover:bg-gray-50"
                      onClick={() => setExpanded(open ? null : log.id)}
                    >
                      <td className="px-4 py-2 tabular-nums text-gray-700">
                        {formatDateTimeInTz(log.createdAt, timezone)}
                      </td>
                      <td className="px-4 py-2">
                        <span className="flex items-center gap-2">
                          <span className="text-gray-800">{log.actorName ?? '—'}</span>
                          <Badge tone={actorTone(log.actorType)}>
                            {t(`actorType.${log.actorType}`)}
                          </Badge>
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-700">{actionLabel(log.action)}</td>
                      <td className="px-4 py-2 text-gray-600">
                        <span>{log.entityType}</span>
                        <span className="ml-1 font-mono text-xs text-gray-400">
                          {log.entityId.slice(0, 8)}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right text-gray-400">{open ? '▾' : '▸'}</td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={5} className="p-0">
                          <AuditRowDetail log={log} currency={currency} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">
          {t('page', { page })}
          {isFetching ? ' …' : ''}
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            {t('prev')}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setPage((p) => p + 1)} disabled={!hasNext}>
            {t('next')}
          </Button>
        </div>
      </div>
    </div>
  );
}
