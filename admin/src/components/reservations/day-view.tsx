'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import {
  ReservationResponseSource,
  ReservationResponseStatus,
  type ReservationResponse,
  type ReservationsControllerListStatus,
} from '@/api/generated/model';
import { ReservationFormModal } from '@/components/reservations/reservation-form-modal';
import { ReservationStatusActions } from '@/components/reservations/reservation-status-actions';
import { SourceBadge } from '@/components/reservations/source-badge';
import { Can } from '@/components/auth/can';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/ui/form';
import { PERMISSIONS } from '@/lib/permissions';
import { useReservationActions } from '@/lib/reservations/use-reservation-actions';
import {
  useReservationsByDay,
  useReservationsInvalidation,
  useReservationsLive,
} from '@/lib/reservations/use-reservations-data';
import { useTables } from '@/lib/tables/use-tables-data';
import { formatTimeInTz, todayInTz } from '@/lib/tz';

type StatusFilter = ReservationsControllerListStatus | 'ALL';
type SourceFilter = ReservationResponseSource | 'ALL';
const STATUSES = Object.values(ReservationResponseStatus);
const SOURCES = Object.values(ReservationResponseSource);

const badgeTone = (s: ReservationResponseStatus): 'green' | 'gray' | 'red' | 'amber' | 'blue' => {
  switch (s) {
    case 'SEATED':
    case 'ARRIVED':
      return 'green';
    case 'CONFIRMED':
      return 'blue';
    case 'PENDING':
      return 'amber';
    case 'CANCELLED':
    case 'NO_SHOW':
      return 'red';
    default:
      return 'gray';
  }
};

export function DayView({ timezone, writesEnabled }: { timezone: string; writesEnabled: boolean }) {
  const t = useTranslations('reservations');
  const tc = useTranslations('common');
  const invalidate = useReservationsInvalidation();
  const { run: runAction, isPending: actionPending } = useReservationActions();
  const [date, setDate] = useState(() => todayInTz(timezone));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('ALL');

  const { reservations, isLoading, isFetching } = useReservationsByDay(
    date,
    statusFilter === 'ALL' ? undefined : statusFilter,
  );
  const shown = useMemo(
    () => reservations.filter((r) => sourceFilter === 'ALL' || r.source === sourceFilter),
    [reservations, sourceFilter],
  );
  const { tables } = useTables();
  useReservationsLive();

  const tableName = useMemo(() => {
    const map = new Map(tables.map((tb) => [tb.id, tb.name]));
    return (id: string | null) => (id ? (map.get(id) ?? id) : null);
  }, [tables]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ReservationResponse | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (r: ReservationResponse) => {
    setEditing(r);
    setFormOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          className={`${inputClass} w-auto`}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <Button size="sm" variant="secondary" onClick={() => setDate(todayInTz(timezone))}>
          {t('today')}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => void invalidate()}>
          ↻ {t('refresh')}
        </Button>
        <div className="ml-auto">
          <Can permission={PERMISSIONS.RESERVATION_MANAGE}>
            <Button variant="primary" disabled={!writesEnabled} onClick={openCreate}>
              + {t('addReservation')}
            </Button>
          </Can>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {(['ALL', ...STATUSES] as StatusFilter[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'border-brand bg-brand text-brand-fg'
                : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {s === 'ALL' ? tc('all') : t(`status.${s}`)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 text-xs font-medium text-gray-400">{t('sourceFilter')}:</span>
        {(['ALL', ...SOURCES] as SourceFilter[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSourceFilter(s)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              sourceFilter === s
                ? 'border-brand bg-brand text-brand-fg'
                : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {s === 'ALL' ? t('allSources') : t(`source${s}`)}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-gray-100" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">{t('noReservations')}</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 font-medium">{t('time')}</th>
                <th className="px-4 py-2 font-medium">{t('customer')}</th>
                <th className="px-4 py-2 font-medium">{t('guests')}</th>
                <th className="px-4 py-2 font-medium">{t('table')}</th>
                <th className="px-4 py-2 font-medium">{t('statusCol')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const newRequest = r.status === 'PENDING' && r.source === 'PUBLIC';
                return (
                  <tr
                    key={r.id}
                    className={`border-b border-gray-100 align-top ${
                      newRequest ? 'bg-amber-50' : ''
                    }`}
                  >
                    <td className="px-4 py-2 tabular-nums text-gray-800">
                      {formatTimeInTz(r.reservedAt, timezone)}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">{r.customerName}</span>
                        {newRequest && (
                          <Badge tone="amber">{t('newRequest')}</Badge>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">{r.customerPhone}</div>
                    </td>
                    <td className="px-4 py-2 text-gray-700">{r.guestCount}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {tableName(r.tableId) ?? (
                        <span className="text-gray-400">{t('unassigned')}</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-col gap-1">
                        <Badge tone={badgeTone(r.status)}>{t(`status.${r.status}`)}</Badge>
                        <SourceBadge source={r.source} />
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-col items-end gap-1">
                        {newRequest && (
                          <Can permission={PERMISSIONS.RESERVATION_MANAGE}>
                            <Button
                              size="sm"
                              variant="primary"
                              disabled={!writesEnabled || actionPending}
                              onClick={() => void runAction('confirm', r.id)}
                            >
                              {t('confirmRequest')}
                            </Button>
                          </Can>
                        )}
                        <ReservationStatusActions
                          reservation={r}
                          writesEnabled={writesEnabled}
                          onEdit={openEdit}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-gray-400">{isFetching ? t('refresh') + '…' : ''}</p>

      {formOpen && (
        <ReservationFormModal
          reservation={editing}
          timezone={timezone}
          defaultDate={date}
          onClose={() => setFormOpen(false)}
        />
      )}
    </div>
  );
}
