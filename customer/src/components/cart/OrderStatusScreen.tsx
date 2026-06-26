'use client';

import { useTranslations } from 'next-intl';

import { usePublicOrderRequestsControllerGet } from '@/api/generated/public/public';
import type { PublicOrderRequestResponse } from '@/api/generated/model';
import type { ApiError } from '@/api/mutator';

interface Props {
  orderId: string;
  onBackToMenu: () => void;
}

const TERMINAL = new Set(['CONFIRMED', 'REJECTED']);

export default function OrderStatusScreen({ orderId, onBackToMenu }: Props) {
  const t = useTranslations('status');

  const { data, isLoading, isError } = usePublicOrderRequestsControllerGet<
    PublicOrderRequestResponse,
    ApiError
  >(orderId, {
    query: {
      // Poll every 4s; stop once a terminal status is reached.
      refetchInterval: (query) =>
        TERMINAL.has(query.state.data?.status ?? '') ? false : 4000,
      refetchIntervalInBackground: true,
    },
  });

  const status = data?.status;
  const reason =
    data?.rejectedReason ?? (data as { reason?: string } | undefined)?.reason ?? null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 text-center">
        {status === 'CONFIRMED' ? (
          <>
            <CheckIcon />
            <h1 className="mt-4 text-lg font-semibold text-gray-900">{t('confirmedTitle')}</h1>
            <p className="mt-2 text-sm text-gray-500">{t('confirmedBody')}</p>
          </>
        ) : status === 'REJECTED' ? (
          <>
            <XIcon />
            <h1 className="mt-4 text-lg font-semibold text-gray-900">{t('rejectedTitle')}</h1>
            <p className="mt-2 text-sm text-gray-500">{reason || t('rejectedBody')}</p>
          </>
        ) : isError ? (
          <>
            <XIcon />
            <h1 className="mt-4 text-lg font-semibold text-gray-900">{t('errorTitle')}</h1>
            <p className="mt-2 text-sm text-gray-500">{t('errorBody')}</p>
          </>
        ) : (
          <>
            <Spinner />
            <h1 className="mt-4 text-lg font-semibold text-gray-900">
              {isLoading ? t('sendingTitle') : t('pendingTitle')}
            </h1>
            <p className="mt-2 text-sm text-gray-500">{t('pendingBody')}</p>
          </>
        )}

        {status && TERMINAL.has(status) ? (
          <button
            type="button"
            onClick={onBackToMenu}
            className="mt-8 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white"
          >
            {t('backToMenu')}
          </button>
        ) : (
          <button
            type="button"
            onClick={onBackToMenu}
            className="mt-8 text-sm font-medium text-gray-400"
          >
            {t('backToMenu')}
          </button>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-brand-accent" />
  );
}
function CheckIcon() {
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </div>
  );
}
function XIcon() {
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-600">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </div>
  );
}
