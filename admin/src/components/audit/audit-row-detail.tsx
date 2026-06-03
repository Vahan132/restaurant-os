'use client';

import { useTranslations } from 'next-intl';

import type { AuditLogResponse } from '@/api/generated/model';
import { computeDiff, formatAuditValue } from '@/lib/audit/diff';

export function AuditRowDetail({
  log,
  currency,
}: {
  log: AuditLogResponse;
  currency: string;
}) {
  const t = useTranslations('audit');
  const diff = computeDiff(log.oldValue, log.newValue);

  return (
    <div className="space-y-3 bg-gray-50 px-4 py-3">
      {diff.length === 0 ? (
        <p className="text-sm text-gray-500">{t('noChanges')}</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="py-1 pr-3 font-medium">{t('field')}</th>
              <th className="py-1 pr-3 font-medium">{t('oldValue')}</th>
              <th className="py-1 pr-3 font-medium">{t('newValue')}</th>
            </tr>
          </thead>
          <tbody>
            {diff.map((entry) => (
              <tr
                key={entry.key}
                className={`border-t border-gray-100 ${entry.changed ? 'bg-amber-50' : ''}`}
              >
                <td className="py-1 pr-3 font-mono text-xs text-gray-700">{entry.key}</td>
                <td className="py-1 pr-3 text-gray-500">
                  {formatAuditValue(entry.key, entry.oldValue, currency)}
                </td>
                <td className={`py-1 pr-3 ${entry.changed ? 'font-medium text-gray-900' : 'text-gray-500'}`}>
                  {formatAuditValue(entry.key, entry.newValue, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {(log.ip || log.userAgent) && (
        <div className="flex flex-col gap-1 border-t border-gray-200 pt-2 text-xs text-gray-500">
          {log.ip && (
            <span>
              <span className="font-medium">{t('ip')}:</span> {log.ip}
            </span>
          )}
          {log.userAgent && (
            <span className="break-all">
              <span className="font-medium">{t('userAgent')}:</span> {log.userAgent}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
