'use client';

import { useTranslations } from 'next-intl';

import { formatInZone } from '@/lib/datetime';

interface Props {
  /** UTC ISO instant echoed back by the backend. */
  reservedAt: string;
  guestCount: number;
  timezone: string;
  /** Branch/location the reservation was requested at (BR-10). */
  locationName: string;
  locale: string;
  onMakeAnother: () => void;
}

/**
 * Post-submit screen. Reiterates that this is a REQUEST awaiting the
 * restaurant's confirmation, and echoes the requested time (restaurant-local)
 * and party size so the customer can sanity-check what they asked for.
 */
export default function ReservationConfirmation({
  reservedAt,
  guestCount,
  timezone,
  locationName,
  locale,
  onMakeAnother,
}: Props) {
  const t = useTranslations('reserve');

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-gray-900">{t('confirmTitle')}</h2>
      <p className="mt-2 text-sm text-gray-500">{t('confirmBody')}</p>

      <dl className="mt-6 w-full divide-y divide-gray-100 rounded-2xl border border-gray-100 text-left">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
            {t('summaryWhere')}
          </dt>
          <dd className="text-sm font-semibold text-gray-900">{locationName}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
            {t('summaryWhen')}
          </dt>
          <dd className="text-sm font-semibold text-gray-900">
            {formatInZone(reservedAt, timezone, locale)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
            {t('summaryParty')}
          </dt>
          <dd className="text-sm font-semibold text-gray-900">
            {t('guests', { count: guestCount })}
          </dd>
        </div>
      </dl>

      <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
        {t('pendingBadge')}
      </span>

      <button
        type="button"
        onClick={onMakeAnother}
        className="mt-6 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700"
      >
        {t('makeAnother')}
      </button>
    </div>
  );
}
