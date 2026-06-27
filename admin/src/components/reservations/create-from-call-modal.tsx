'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useMissedCallsControllerCreateReservation } from '@/api/generated/reservations/reservations';
import type {
  CreateReservationFromCallDto,
  MissedCallResponse,
} from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { getErrorMessage, isApiError } from '@/lib/api-error';
import { useMissedCallsInvalidation } from '@/lib/reservations/use-missed-calls-data';
import { useReservationsInvalidation } from '@/lib/reservations/use-reservations-data';
import { todayInTz, zonedToUtcISO } from '@/lib/tz';
import { toast } from '@/stores/toast';

export function CreateFromCallModal({
  call,
  timezone,
  onClose,
}: {
  call: MissedCallResponse;
  timezone: string;
  onClose: () => void;
}) {
  const t = useTranslations('reservations');
  const tc = useTranslations('common');
  const invalidateCalls = useMissedCallsInvalidation();
  const invalidateReservations = useReservationsInvalidation();

  const [customerName, setCustomerName] = useState(call.callerName ?? '');
  const [guestCount, setGuestCount] = useState('2');
  const [date, setDate] = useState(todayInTz(timezone));
  const [time, setTime] = useState('19:00');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<{ name?: string; time?: string }>({});

  const create = useMissedCallsControllerCreateReservation();
  const submitting = create.isPending;

  const save = async () => {
    const next: typeof errors = {};
    if (!customerName.trim()) next.name = t('validation.required');
    if (!date || !time) next.time = t('validation.time');
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const data: CreateReservationFromCallDto = {
      customerName: customerName.trim(),
      guestCount: Math.max(1, Number(guestCount) || 1),
      reservedAt: zonedToUtcISO(date, time, timezone),
      customerNote: note.trim() || undefined,
    };
    try {
      await create.mutateAsync({ id: call.id, data });
      toast.success(t('toast.reservationFromCall'));
      await Promise.all([invalidateCalls(), invalidateReservations()]);
      onClose();
    } catch (err) {
      if (isApiError(err) && err.code === 'RESERVATIONS_DISABLED') toast.error(t('disabledError'));
      else toast.error(getErrorMessage(err));
    }
  };

  return (
    <Modal
      open
      title={t('cfcTitle')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" onClick={save} disabled={submitting}>
            {t('cfcCreate')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label={t('customerPhone')}>
          <input className={inputClass} value={call.phone} disabled />
        </Field>
        <Field label={t('customerName')} required error={errors.name}>
          <input
            className={inputClass}
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label={t('date')} error={errors.time}>
            <input
              type="date"
              className={inputClass}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label={t('time')}>
            <input
              type="time"
              className={inputClass}
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </Field>
          <Field label={t('guestCount')}>
            <input
              type="number"
              min={1}
              className={inputClass}
              value={guestCount}
              onChange={(e) => setGuestCount(e.target.value)}
            />
          </Field>
        </div>
        <Field label={t('cfcNote')}>
          <textarea
            className={inputClass}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}
