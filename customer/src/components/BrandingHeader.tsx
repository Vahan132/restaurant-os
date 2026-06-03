'use client';

import { useTranslations } from 'next-intl';

import LanguageSwitcher from './LanguageSwitcher';

interface Props {
  name: string;
  logoUrl: string | null;
  tableName?: string | null;
}

export default function BrandingHeader({ name, logoUrl, tableName }: Props) {
  const t = useTranslations('header');

  return (
    <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            className="h-9 w-9 shrink-0 rounded-full object-cover"
            loading="eager"
          />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold text-gray-900">{name}</h1>
          {tableName ? (
            <p className="truncate text-xs text-brand-accent">{t('table', { name: tableName })}</p>
          ) : null}
        </div>
        <LanguageSwitcher />
      </div>
    </header>
  );
}
