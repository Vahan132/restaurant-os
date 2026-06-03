'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

function Screen({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center">
      <div className="mb-4 text-gray-300">{icon}</div>
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <p className="mt-2 text-sm text-gray-500">{body}</p>
    </div>
  );
}

const PlateIcon = (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25">
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="4" />
  </svg>
);

export function MenuUnavailable() {
  const t = useTranslations('error');
  return <Screen icon={PlateIcon} title={t('unavailableTitle')} body={t('unavailableBody')} />;
}

export function GenericError() {
  const t = useTranslations('error');
  return <Screen icon={PlateIcon} title={t('genericTitle')} body={t('genericBody')} />;
}

export function EmptyMenu() {
  const t = useTranslations('menu');
  return <Screen icon={PlateIcon} title={t('emptyTitle')} body={t('emptyBody')} />;
}
