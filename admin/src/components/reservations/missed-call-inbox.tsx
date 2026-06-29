'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  useMissedCallsControllerDismiss,
  useMissedCallsControllerHandle,
} from '@/api/generated/reservations/reservations';
import {
  MissedCallsControllerListStatus,
  type MissedCallResponse,
} from '@/api/generated/model';
import { Can } from '@/components/auth/can';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CreateFromCallModal } from '@/components/reservations/create-from-call-modal';
import { getErrorMessage } from '@/lib/api-error';
import { PERMISSIONS } from '@/lib/permissions';
import {
  useMissedCalls,
  useMissedCallsInvalidation,
} from '@/lib/reservations/use-missed-calls-data';
import { formatTimeInTz, ymdInTz } from '@/lib/tz';
import { toast } from '@/stores/toast';

type StatusFilter = MissedCallsControllerListStatus | 'ALL';
const STATUSES = Object.values(MissedCallsControllerListStatus);

const statusTone = (s: string): 'green' | 'gray' | 'amber' =>
  s === 'NEW' ? 'amber' : s === 'HANDLED' ? 'green' : 'gray';

export function MissedCallInbox({
  timezone,
  writesEnabled,
}: {
  timezone: string;
  writesEnabled: boolean;
}) {
  const t = useTranslations('reservations');
  const tc = useTranslations('common');
  const invalidate = useMissedCallsInvalidation();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    MissedCallsControllerListStatus.NEW,
  );
  const [creating, setCreating] = useState<MissedCallResponse | null>(null);

  const { calls, isLoading, isError } = useMissedCalls(
    statusFilter === 'ALL' ? undefined : statusFilter,
  );

  const handle = useMissedCallsControllerHandle();
  const dismiss = useMissedCallsControllerDismiss();
  const pending = handle.isPending || dismiss.isPending;

  const onHandle = async (id: string) => {
    try {
      await handle.mutateAsync({ id });
      toast.success(t('toast.callHandled'));
      await invalidate();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };
  const onDismiss = async (id: string) => {
    try {
      await dismiss.mutateAsync({ id });
      toast.success(t('toast.callDismissed'));
      await invalidate();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
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
            {s === 'ALL' ? t('mcAllStatuses') : t(`mcStatus${s}`)}
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
        ) : isError ? (
          <p className="py-10 text-center text-sm text-gray-500">{tc('error')}</p>
        ) : calls.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">{t('noMissedCalls')}</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 font-medium">{t('mcPhone')}</th>
                <th className="px-4 py-2 font-medium">{t('mcCaller')}</th>
                <th className="px-4 py-2 font-medium">{t('mcTime')}</th>
                <th className="px-4 py-2 font-medium">{t('mcStatus')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {calls.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 align-top">
                  <td className="px-4 py-2 font-medium text-gray-800">{c.phoneNumber}</td>
                  <td className="px-4 py-2 text-gray-700">{c.callerName ?? '—'}</td>
                  <td className="px-4 py-2 tabular-nums text-gray-600">
                    {ymdInTz(new Date(c.occurredAt), timezone)}{' '}
                    {formatTimeInTz(c.occurredAt, timezone)}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-col gap-1">
                      <Badge tone={statusTone(c.status)}>{t(`mcStatus${c.status}`)}</Badge>
                      {c.linkedReservationId && (
                        <Badge tone="blue">{t('mcLinked')}</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap justify-end gap-1">
                      <a href={`tel:${c.phoneNumber}`}>
                        <Button size="sm" variant="secondary">
                          {t('mcCallBack')}
                        </Button>
                      </a>
                      <Can permission={PERMISSIONS.RESERVATION_MANAGE}>
                        {c.status === 'NEW' && (
                          <>
                            <Button
                              size="sm"
                              variant="primary"
                              disabled={!writesEnabled}
                              onClick={() => setCreating(c)}
                            >
                              {t('mcCreate')}
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={pending}
                              onClick={() => void onHandle(c.id)}
                            >
                              {t('mcHandle')}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={pending}
                              onClick={() => void onDismiss(c.id)}
                            >
                              {t('mcDismiss')}
                            </Button>
                          </>
                        )}
                      </Can>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {creating && (
        <CreateFromCallModal
          call={creating}
          timezone={timezone}
          onClose={() => setCreating(null)}
        />
      )}
    </div>
  );
}
