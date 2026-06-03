'use client';

import { useTranslations } from 'next-intl';

export function ComingSoon({ titleKey }: { titleKey: string }) {
  const tNav = useTranslations('nav');
  const tc = useTranslations('common');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">{tNav(titleKey)}</h1>
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
        <p className="text-lg font-medium text-gray-700">{tc('comingSoon')}</p>
        <p className="mt-2 text-sm text-gray-500">{tc('comingSoonBody')}</p>
      </div>
    </div>
  );
}
