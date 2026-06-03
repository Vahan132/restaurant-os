'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import {
  useReservationsControllerCreate,
  useReservationsControllerUpdate,
} from '@/api/generated/reservations/reservations';
import type { CreateReservationDto, ReservationResponse } from '@/api/generated/model';
import { TableAvailabilityPicker } from '@/components/reservations/table-availability-picker';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { getErrorMessage, isApiError } from '@/lib/api-error';
import { useReservationsInvalidation } from '@/lib/reservations/use-reservations-data';
import { isoToZonedTime, todayInTz, ymdInTz, zonedToUtcISO } from '@/lib/tz';
import { toast } from '@/stores/toast';

export function ReservationFormModal({
  reservation,
  timezone,
  defaultDate,
  onClose,
}: {
  reservation?: ReservationResponse | null;
  timezone: string;
  defaultDate: string;
  onClose: () => void;
}) {
  const t = useTranslations('reservations');
  const tc = useTranslations('common');
  const invalidate = useReservationsInvalidation();
  const isEdit = !!reservation;

  const [customerName, setCustomerName] = useState(reservation?.customerName ?? '');
  const [customerPhone, setCustomerPhone] = useState(reservation?.customerPhone ?? '');
  const [customerEmail, setCustomerEmail] = useState(reservation?.customerEmail ?? '');
  const [guestCount, setGuestCount] = useState(String(reservation?.guestCount ?? 2));
  const [date, setDate] = useState(
    reservation ? ymdInTz(new Date(reservation.reservedAt), timezone) : defaultDate || todayInTz(timezone),
  );
  const [time, setTime] = useState(
    reservation ? isoToZonedTime(reservation.reservedAt, timezone) : '19:00',
  );
  const [durationMinutes, setDurationMinutes] = useState(
    String(reservation?.durationMinutes ?? 90),
  );
  const [tableId, setTableId] = useState(reservation?.tableId ?? '');
  const [notes, setNotes] = useState(reservation?.notes ?? '');
  const [errors, setErrors] = useState<{ name?: string; phone?: string; time?: string }>({});

  const create = useReservationsControllerCreate();
  const update = useReservationsControllerUpdate();
  const submitting = create.isPending || update.isPending;

  // Window for the table picker (create only).
  const slot = useMemo(() => {
    if (!date || !time) return null;
    const start = zonedToUtcISO(date, time, timezone);
    const end = new Date(
      new Date(start).getTime() + (Number(durationMinutes) || 90) * 60000,
    ).toISOString();
    return { start, end };
  }, [date, time, durationMinutes, timezone]);

  const validate = () => {
    const next: typeof errors = {};
    if (!customerName.trim()) next.name = t('validation.required');
    if (!customerPhone.trim()) next.phone = t('validation.required');
    if (!date || !time) next.time = t('validation.time');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    if (!validate() || !slot) return;
    const guests = Math.max(1, Number(guestCount) || 1);
    const duration = Math.max(1, Number(durationMinutes) || 90);
    try {
      if (isEdit && reservation) {
        // Table assignment is handled by assign/clear endpoints, not update.
        await update.mutateAsync({
          id: reservation.id,
          data: {
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            customerEmail: customerEmail.trim() || undefined,
            guestCount: guests,
            reservedAt: slot.start,
            durationMinutes: duration,
            notes: notes.trim() || undefined,
          },
        });
        toast.success(t('toast.updated'));
        await invalidate(reservation.id);
      } else {
        const data: CreateReservationDto = {
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerEmail: customerEmail.trim() || undefined,
          guestCount: guests,
          reservedAt: slot.start,
          durationMinutes: duration,
          notes: notes.trim() || undefined,
          ...(tableId ? { tableId } : {}),
        };
        await create.mutateAsync({ data });
        toast.success(t('toast.created'));
        await invalidate();
      }
      onClose();
    } catch (err) {
      if (isApiError(err) && err.code === 'RESERVATIONS_DISABLED') toast.error(t('disabledError'));
      else toast.error(getErrorMessage(err));
    }
  };

  return (
    <Modal
      open
      title={isEdit ? t('editReservation') : t('addReservation')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" onClick={save} disabled={submitting}>
            {isEdit ? tc('save') : tc('create')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label={t('customerName')} required error={errors.name}>
          <input className={inputClass} value={customerName} onChange={(e) => setCustomerName(e.target.value)} autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('customerPhone')} required error={errors.phone}>
            <input className={inputClass} value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          </Field>
          <Field label={t('customerEmail')}>
            <input type="email" className={inputClass} value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label={t('date')} error={errors.time}>
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={t('time')}>
            <input type="time" className={inputClass} value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
          <Field label={t('guestCount')}>
            <input type="number" min={1} className={inputClass} value={guestCount} onChange={(e) => setGuestCount(e.target.value)} />
          </Field>
        </div>
        <Field label={t('durationMinutes')}>
          <input type="number" min={1} className={inputClass} value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} />
        </Field>

        {!isEdit && (
          <Field label={t('table')}>
            {slot ? (
              <TableAvailabilityPicker
                windowStart={slot.start}
                windowEnd={slot.end}
                value={tableId}
                onChange={setTableId}
              />
            ) : (
              <p className="text-xs text-gray-500">{t('validation.time')}</p>
            )}
          </Field>
        )}

        <Field label={t('notes')}>
          <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
