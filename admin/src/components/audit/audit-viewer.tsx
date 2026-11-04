'use client';

import { useTranslations } from 'next-intl';
import { Fragment, useEffect, useMemo, useState } from 'react';

import {
  AuditLogResponseActorType,
  type AuditControllerExportParams,
  type AuditControllerListParams,
} from '@/api/generated/model';
import { AuditFilters, type AuditFilterValues } from '@/components/audit/audit-filters';
import { AuditRowDetail } from '@/components/audit/audit-row-detail';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/api-error';
import { usePermission } from '@/lib/auth/use-permission';
import { humanize } from '@/lib/audit/diff';
import { dayRangeToIso, useAuditExport, useAuditLogs } from '@/lib/audit/use-audit-data';
import { useBranchContext } from '@/lib/branch/use-branch-context';
import { PERMISSIONS } from '@/lib/permissions';
import { useRestaurant } from '@/lib/restaurant/use-restaurant';
import { addDays } from '@/lib/reports/date-range';
import { formatDateTimeInTz, todayInTz } from '@/lib/tz';
import { toast } from '@/stores/toast';

const PAGE_SIZE = 25;
const COLUMN_COUNT = 7;

const DEFAULT_FILTERS: AuditFilterValues = {
  preset: 'today',
  fromYmd: '',
  toYmd: '',
  action: '',
  role: '',
  branchId: '',
  actorId: '',
  entityType: '',
  entityId: '',
};

const actorTone = (type: string): 'blue' | 'amber' | 'gray' => {
  if (type === AuditLogResponseActorType.USER) return 'blue';
  if (type === AuditLogResponseActorType.PLATFORM_USER) return 'amber';
  return 'gray';
};

export function AuditViewer() {
  const t = useTranslations('audit');
  const canView = usePermission(PERMISSIONS.AUDIT_VIEW, 'restaurant');
  const { data: restaurant } = useRestaurant();
  const { accessibleBranches } = useBranchContext();
  const timezone =
    restaurant?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const currency = restaurant?.currency ?? 'USD';

  const [filters, setFilters] = useState<AuditFilterValues>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { exportCsv, isExporting } = useAuditExport();

  // Resolve presets into concrete dates (restaurant tz).
  useEffect(() => {
    if (filters.preset === 'custom') return;
    const today = todayInTz(timezone);
    const from =
      filters.preset === 'today'
        ? today
        : filters.preset === '7d'
          ? addDays(today, -6)
          : addDays(today, -29);
    setFilters((f) => ({ ...f, fromYmd: from, toYmd: today }));
  }, [filters.preset, timezone]);

  // Reset to page 1 whenever any server-side filter changes.
  useEffect(() => {
    setPage(1);
  }, [
    filters.fromYmd,
    filters.toYmd,
    filters.action,
    filters.role,
    filters.branchId,
    filters.actorId,
    filters.entityType,
    filters.entityId,
  ]);

  const onChange = (patch: Partial<AuditFilterValues>) =>
    setFilters((f) => ({ ...f, ...patch }));
  const onReset = () => setFilters({ ...DEFAULT_FILTERS, preset: 'today' });

  const iso = dayRangeToIso(filters.fromYmd, filters.toYmd, timezone);

  // The single filter set, applied to both the table and the export so the CSV
  // matches exactly what's on screen ("what you see is what you export").
  const params: AuditControllerListParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      from: iso.from,
      to: iso.to,
      action: filters.action || undefined,
      role: filters.role || undefined,
      branchId: filters.branchId || undefined,
      actorId: filters.actorId || undefined,
      entityType: filters.entityType.trim() || undefined,
      entityId: filters.entityId.trim() || undefined,
    }),
    [
      page,
      iso.from,
      iso.to,
      filters.action,
      filters.role,
      filters.branchId,
      filters.actorId,
      filters.entityType,
      filters.entityId,
    ],
  );

  const { logs, pagination, isLoading, isFetching } = useAuditLogs(params);

  const actionLabel = (code: string) =>
    t.has(`actionLabel.${code}`) ? t(`actionLabel.${code}`) : humanize(code);
  const roleLabel = (code: string) =>
    t.has(`roleLabel.${code}`) ? t(`roleLabel.${code}`) : humanize(code);
  const branchName = (id: string | null) =>
    id ? (accessibleBranches.find((b) => b.id === id)?.name ?? id.slice(0, 8)) : '—';

  const hasNext = pagination?.hasNext ?? logs.length === PAGE_SIZE;

  const onExport = async () => {
    // Send the same filters currently applied to the table.
    const exportParams: AuditControllerExportParams = { ...params };
    try {
      await exportCsv(exportParams, `activity-log-${todayInTz(timezone)}.csv`);
      toast.success(t('exported'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

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
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>
        <Button variant="secondary" onClick={onExport} disabled={isExporting || isLoading}>
          {isExporting ? t('exporting') : t('export')}
        </Button>
      </div>

      <AuditFilters values={filters} onChange={onChange} onReset={onReset} />

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-gray-100" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">{t('empty')}</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 font-medium">{t('timestamp')}</th>
                <th className="px-4 py-2 font-medium">{t('actor')}</th>
                <th className="px-4 py-2 font-medium">{t('role')}</th>
                <th className="px-4 py-2 font-medium">{t('branch')}</th>
                <th className="px-4 py-2 font-medium">{t('action')}</th>
                <th className="px-4 py-2 font-medium">{t('entity')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
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
                      <td className="px-4 py-2 text-gray-600">
                        {log.actorRoleCode ? roleLabel(log.actorRoleCode) : '—'}
                      </td>
                      <td className="px-4 py-2 text-gray-600">{branchName(log.branchId)}</td>
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
                        <td colSpan={COLUMN_COUNT} className="p-0">
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
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            {t('prev')}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasNext}
          >
            {t('next')}
          </Button>
        </div>
      </div>
    </div>
  );
}
