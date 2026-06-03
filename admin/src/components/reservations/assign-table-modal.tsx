'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import type { ReservationResponse } from '@/api/generated/model';
import { TableAvailabilityPicker } from '@/components/reservations/table-availability-picker';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

export function AssignTableModal({
  reservation,
  onClose,
  onAssign,
  pending,
}: {
  reservation: ReservationResponse;
  onClose: () => void;
  onAssign: (tableId: string) => void;
  pending: boolean;
}) {
  const t = useTranslations('reservations');
  const tc = useTranslations('common');
  const [tableId, setTableId] = useState(reservation.tableId ?? '');

  const windowEnd = useMemo(
    () =>
      new Date(
        new Date(reservation.reservedAt).getTime() + reservation.durationMinutes * 60000,
      ).toISOString(),
    [reservation.reservedAt, reservation.durationMinutes],
  );

  return (
    <Modal
      open
      title={t('assignTable')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {tc('cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={() => onAssign(tableId)}
            disabled={pending || !tableId}
          >
            {t('assignTable')}
          </Button>
        </>
      }
    >
      <TableAvailabilityPicker
        windowStart={reservation.reservedAt}
        windowEnd={windowEnd}
        value={tableId}
        onChange={setTableId}
        excludeReservationId={reservation.id}
      />
    </Modal>
  );
}
