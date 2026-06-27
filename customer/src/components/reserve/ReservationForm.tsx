'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { usePublicReservationsControllerCreate } from '@/api/generated/public/public';
import type { PublicReservationsInfoResponse } from '@/api/generated/model';
import { isApiError, type ApiError } from '@/api/mutator';
import { todayInZone, zoneAbbrev, zonedWallTimeToUtc } from '@/lib/datetime';

import type { SubmittedReservation } from './ReservePage';
import QuantityStepper from '../cart/QuantityStepper';

interface Props {
  info: PublicReservationsInfoResponse;
  /** Restaurant + branch the booking is scoped to (BR-10 branch endpoint). */
  restaurantSlug: string;
  branchSlug: string;
  locale: string;
  onSubmitted: (res: SubmittedReservation) => void;
  /** Backend reported reservations are off (race with the info toggle). */
  onDisabled: () => void;
}

type FieldErrors = Partial<
  Record<'customerName' | 'customerPhone' | 'customerEmail' | 'date' | 'time', string>
>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The public reservation DTO caps party size at 20 (no per-branch override in
// the current API).
const MAX_PARTY_SIZE = 20;

export default function ReservationForm({
  info,
  restaurantSlug,
  branchSlug,
  locale,
  onSubmitted,
  onDisabled,
}: Props) {
  const t = useTranslations('reserve');
  const { timezone } = info;

  const today = useMemo(() => todayInZone(timezone), [timezone]);
  const tzLabel = useMemo(() => zoneAbbrev(timezone, locale), [timezone, locale]);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [guestCount, setGuestCount] = useState(2);
  const [date, setDate] = useState(today);
  const [time, setTime] = useState('19:00');
  const [customerNote, setCustomerNote] = useState('');

  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const create = usePublicReservationsControllerCreate<ApiError>({
    mutation: {
      onSuccess: (res) => onSubmitted({ reservedAt: res.reservedAt, guestCount }),
      onError: (err) => {
        if (isApiError(err) && err.code === 'RESERVATIONS_DISABLED') {
          onDisabled();
          return;
        }
        setFormError(isApiError(err) ? err.message : t('submitError'));
      },
    },
  });

  function validate(): { ok: false } | { ok: true; reservedAt: string } {
    const next: FieldErrors = {};

    if (!customerName.trim()) next.customerName = t('errName');
    if (!customerPhone.trim()) next.customerPhone = t('errPhone');
    if (customerEmail.trim() && !EMAIL_RE.test(customerEmail.trim())) {
      next.customerEmail = t('errEmail');
    }
    if (!date) next.date = t('errDate');
    if (!time) next.time = t('errTime');

    let reservedAt = '';
    if (date && time) {
      const utc = zonedWallTimeToUtc(date, time, timezone);
      if (!utc) {
        next.time = t('errTime');
      } else if (utc.getTime() <= Date.now()) {
        next.time = t('errPast');
      } else {
        reservedAt = utc.toISOString();
      }
    }

    setErrors(next);
    if (Object.keys(next).length > 0 || !reservedAt) return { ok: false };
    return { ok: true, reservedAt };
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const result = validate();
    if (!result.ok) return;

    create.mutate({
      restaurantSlug,
      branchSlug,
      data: {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        ...(customerEmail.trim() ? { customerEmail: customerEmail.trim() } : {}),
        guestCount,
        reservedAt: result.reservedAt,
        ...(customerNote.trim() ? { customerNote: customerNote.trim() } : {}),
      },
    });
  }

  const inputClass =
    'w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-accent focus:outline-none';
  const labelClass = 'mb-1 block text-xs font-medium text-gray-600';

  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-2xl space-y-4 px-4 py-4">
      <p className="rounded-lg bg-gray-50 px-3 py-2.5 text-xs text-gray-500">
        {t('requestIntro')}
      </p>

      <div>
        <label className={labelClass} htmlFor="r-name">
          {t('nameLabel')}
        </label>
        <input
          id="r-name"
          type="text"
          autoComplete="name"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder={t('namePlaceholder')}
          className={inputClass}
          aria-invalid={!!errors.customerName}
        />
        {errors.customerName ? <FieldError msg={errors.customerName} /> : null}
      </div>

      <div>
        <label className={labelClass} htmlFor="r-phone">
          {t('phoneLabel')}
        </label>
        <input
          id="r-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value)}
          placeholder={t('phonePlaceholder')}
          className={inputClass}
          aria-invalid={!!errors.customerPhone}
        />
        {errors.customerPhone ? <FieldError msg={errors.customerPhone} /> : null}
      </div>

      <div>
        <label className={labelClass} htmlFor="r-email">
          {t('emailLabel')}
        </label>
        <input
          id="r-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={customerEmail}
          onChange={(e) => setCustomerEmail(e.target.value)}
          placeholder={t('emailPlaceholder')}
          className={inputClass}
          aria-invalid={!!errors.customerEmail}
        />
        {errors.customerEmail ? <FieldError msg={errors.customerEmail} /> : null}
      </div>

      <div>
        <span className={labelClass}>{t('partyLabel')}</span>
        <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
          <span className="text-sm text-gray-700">{t('guests', { count: guestCount })}</span>
          <QuantityStepper
            value={guestCount}
            onChange={setGuestCount}
            min={1}
            max={MAX_PARTY_SIZE}
            ariaLabel={t('partyLabel')}
          />
        </div>
        <p className="mt-1 text-xs text-gray-400">{t('partyHint', { max: MAX_PARTY_SIZE })}</p>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className={labelClass} htmlFor="r-date">
            {t('dateLabel')}
          </label>
          <input
            id="r-date"
            type="date"
            value={date}
            min={today}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
            aria-invalid={!!errors.date}
          />
          {errors.date ? <FieldError msg={errors.date} /> : null}
        </div>
        <div className="flex-1">
          <label className={labelClass} htmlFor="r-time">
            {t('timeLabel')}
          </label>
          <input
            id="r-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className={inputClass}
            aria-invalid={!!errors.time}
          />
          {errors.time ? <FieldError msg={errors.time} /> : null}
        </div>
      </div>
      <p className="-mt-2 text-xs text-gray-400">{t('timezoneNote', { tz: tzLabel })}</p>

      <div>
        <label className={labelClass} htmlFor="r-note">
          {t('noteLabel')}
        </label>
        <textarea
          id="r-note"
          rows={2}
          value={customerNote}
          onChange={(e) => setCustomerNote(e.target.value)}
          placeholder={t('notePlaceholder')}
          className={`${inputClass} resize-none`}
        />
      </div>

      {formError ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="pt-1">
        <button
          type="submit"
          disabled={create.isPending}
          className="w-full rounded-xl bg-brand px-4 py-3.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {create.isPending ? t('submitting') : t('submit')}
        </button>
        <p className="mt-2 text-center text-xs text-gray-400">{t('submitDisclaimer')}</p>
      </div>
    </form>
  );
}

function FieldError({ msg }: { msg: string }) {
  return (
    <p className="mt-1 text-xs text-rose-600" role="alert">
      {msg}
    </p>
  );
}
