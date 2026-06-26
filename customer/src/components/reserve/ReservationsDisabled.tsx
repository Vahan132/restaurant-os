'use client';

import { useTranslations } from 'next-intl';

/**
 * Shown when `enableReservations` is false (or the backend rejects with
 * RESERVATIONS_DISABLED). Surfaces the phone number when we have one so the
 * customer can still book by calling.
 */
export default function ReservationsDisabled({ phone }: { phone: string | null }) {
  const t = useTranslations('reserve');

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center">
      <div className="mb-4 text-gray-300">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
        >
          <path d="M3 5.5C3 14.06 9.94 21 18.5 21a2 2 0 0 0 2-1.72l.3-2.1a1.5 1.5 0 0 0-.9-1.6l-2.6-1.12a1.5 1.5 0 0 0-1.7.4l-.9 1.05a13 13 0 0 1-5.3-5.3l1.05-.9a1.5 1.5 0 0 0 .4-1.7L9.93 4.8a1.5 1.5 0 0 0-1.6-.9l-2.1.3A2 2 0 0 0 4.5 6" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-gray-900">{t('disabledTitle')}</h2>
      <p className="mt-2 text-sm text-gray-500">{t('disabledBody')}</p>
      {phone ? (
        <a
          href={`tel:${phone.replace(/\s+/g, '')}`}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white"
        >
          {t('callAction', { phone })}
        </a>
      ) : null}
    </div>
  );
}
