'use client';

import { useTranslations } from 'next-intl';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchBox({ value, onChange }: Props) {
  const t = useTranslations('search');
  return (
    <div className="px-4 pb-2 pt-3">
      <input
        type="search"
        inputMode="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('placeholder')}
        aria-label={t('placeholder')}
        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-accent focus:bg-white focus:outline-none"
      />
    </div>
  );
}
