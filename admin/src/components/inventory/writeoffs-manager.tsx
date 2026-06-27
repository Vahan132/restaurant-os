'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import {
  WriteOffsControllerListKind,
  WriteOffsControllerListReason,
  type WriteOffsControllerListParams,
} from '@/api/generated/model';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/ui/form';
import { Pagination, formatDateTime } from '@/components/inventory/shared';
import { ReasonBadge, useLineSummary } from '@/components/inventory/writeoff-shared';
import { WriteOffFormDrawer } from '@/components/inventory/writeoff-form-drawer';
import { WriteOffDetailDrawer } from '@/components/inventory/writeoff-detail-drawer';
import { WasteSummary } from '@/components/inventory/waste-summary';
import { usePermission } from '@/lib/auth/use-permission';
import { usePaginatedWriteOffs } from '@/lib/inventory/use-writeoff-data';
import { formatMoney } from '@/lib/money';
import { useRestaurant } from '@/lib/restaurant/use-restaurant';
import { PERMISSIONS } from '@/lib/permissions';

const PAGE_SIZE = 20;
const REASONS = Object.values(WriteOffsControllerListReason);
type Tab = 'list' | 'summary';

export function WriteOffsManager() {
  const t = useTranslations('inventory');
  const { data: restaurant } = useRestaurant();
  const currency = restaurant?.currency ?? 'USD';
  const canCreate = usePermission(PERMISSIONS.INVENTORY_WRITEOFF_CREATE);
  const lineSummary = useLineSummary();

  const [tab, setTab] = useState<Tab>('list');
  const [reason, setReason] = useState('');
  const [kind, setKind] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => setPage(1), [reason, kind, from, to]);

  const params = useMemo<WriteOffsControllerListParams>(
    () => ({
      page,
      limit: PAGE_SIZE,
      reason: (reason as WriteOffsControllerListParams['reason']) || undefined,
      kind: (kind as WriteOffsControllerListParams['kind']) || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
    [page, reason, kind, from, to],
  );
  const { writeOffs, pagination, isLoading, isFetching, isError } =
    usePaginatedWriteOffs(params);
  const hasNext = pagination?.hasNext ?? writeOffs.length === PAGE_SIZE;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'list', label: t('woTab') },
    { key: 'summary', label: t('woSummaryTab') },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{t('woTitle')}</h1>
        {canCreate && tab === 'list' && (
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            + {t('addWriteOff')}
          </Button>
        )}
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === item.key
                ? 'border-brand text-brand'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'summary' ? (
        <WasteSummary />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className={`${inputClass} w-auto`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              <option value="">{t('allReasons')}</option>
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {t(`reason${r}`)}
                </option>
              ))}
            </select>
            <select
              className={`${inputClass} w-auto`}
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="">{t('allKinds')}</option>
              <option value={WriteOffsControllerListKind.ITEM}>{t('kindITEM')}</option>
              <option value={WriteOffsControllerListKind.DISH}>{t('kindDISH')}</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <span>{t('woFrom')}</span>
              <input
                type="date"
                className={`${inputClass} w-auto`}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <span>{t('woTo')}</span>
              <input
                type="date"
                className={`${inputClass} w-auto`}
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-10 animate-pulse rounded-md bg-gray-100" />
                ))}
              </div>
            ) : isError ? (
              <p className="py-10 text-center text-sm text-gray-500">{t('loadError')}</p>
            ) : writeOffs.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-500">{t('noWriteOffs')}</p>
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-2 font-medium">{t('colOccurredAt')}</th>
                    <th className="px-4 py-2 font-medium">{t('colReason')}</th>
                    <th className="px-4 py-2 font-medium">{t('colLines')}</th>
                    <th className="px-4 py-2 font-medium">{t('colTotalCostWo')}</th>
                    <th className="px-4 py-2 font-medium">{t('colVoided')}</th>
                  </tr>
                </thead>
                <tbody>
                  {writeOffs.map((w) => (
                    <tr
                      key={w.id}
                      className="cursor-pointer border-b border-gray-100 hover:bg-gray-50"
                      onClick={() => setDetailId(w.id)}
                    >
                      <td className="px-4 py-2 text-gray-700">{formatDateTime(w.occurredAt)}</td>
                      <td className="px-4 py-2">
                        <ReasonBadge reason={w.reason} />
                      </td>
                      <td className="px-4 py-2 text-gray-600">
                        {lineSummary(w.itemLineCount, w.dishLineCount)}
                      </td>
                      <td className={`px-4 py-2 ${w.voided ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                        {formatMoney(w.totalCost, currency)}
                      </td>
                      <td className="px-4 py-2">
                        {w.voided && <Badge tone="gray">{t('voidedBadge')}</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <Pagination
            page={page}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => p + 1)}
            hasNext={hasNext}
            isFetching={isFetching}
          />
        </>
      )}

      {createOpen && <WriteOffFormDrawer onClose={() => setCreateOpen(false)} />}
      {detailId && (
        <WriteOffDetailDrawer writeOffId={detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  );
}
