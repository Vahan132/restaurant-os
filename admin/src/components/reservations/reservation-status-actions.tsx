'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import type { ReservationResponse } from '@/api/generated/model';
import { AssignTableModal } from '@/components/reservations/assign-table-modal';
import { CancelReasonModal } from '@/components/reservations/cancel-reason-modal';
import { Can } from '@/components/auth/can';
import { Button } from '@/components/ui/button';
import { PERMISSIONS } from '@/lib/permissions';
import {
  canAssignTable,
  canEditReservation,
  statusActions,
  type ReservationAction,
} from '@/lib/reservations/transitions';
import { useReservationActions } from '@/lib/reservations/use-reservation-actions';

export function ReservationStatusActions({
  reservation,
  writesEnabled,
  onEdit,
}: {
  reservation: ReservationResponse;
  writesEnabled: boolean;
  onEdit: (reservation: ReservationResponse) => void;
}) {
  const t = useTranslations('reservations');
  const { run, isPending } = useReservationActions();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const actions = statusActions(reservation.status);
  const disabled = !writesEnabled || isPending;

  const onAction = (action: ReservationAction) => {
    if (action === 'cancel') setCancelOpen(true);
    else void run(action, reservation.id);
  };

  return (
    <Can permission={PERMISSIONS.RESERVATION_MANAGE}>
      <div className="flex flex-wrap justify-end gap-1">
        {actions.map((action) => (
          <Button
            key={action}
            size="sm"
            variant={action === 'cancel' ? 'ghost' : 'secondary'}
            disabled={disabled}
            onClick={() => onAction(action)}
          >
            {t(action)}
          </Button>
        ))}

        {canEditReservation(reservation.status) && (
          <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onEdit(reservation)}>
            {t('edit')}
          </Button>
        )}

        {canAssignTable(reservation.status) && (
          <Button size="sm" variant="ghost" disabled={disabled} onClick={() => setAssignOpen(true)}>
            {t('assignTable')}
          </Button>
        )}
        {canAssignTable(reservation.status) && reservation.tableId && (
          <Button
            size="sm"
            variant="ghost"
            disabled={disabled}
            onClick={() => void run('clear', reservation.id)}
          >
            {t('clearTable')}
          </Button>
        )}
      </div>

      {cancelOpen && (
        <CancelReasonModal
          pending={isPending}
          onClose={() => setCancelOpen(false)}
          onConfirm={async (reason) => {
            const ok = await run('cancel', reservation.id, { reason });
            if (ok) setCancelOpen(false);
          }}
        />
      )}
      {assignOpen && (
        <AssignTableModal
          reservation={reservation}
          pending={isPending}
          onClose={() => setAssignOpen(false)}
          onAssign={async (tableId) => {
            const ok = await run('assign', reservation.id, { tableId });
            if (ok) setAssignOpen(false);
          }}
        />
      )}
    </Can>
  );
}
