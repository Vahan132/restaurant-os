'use client';

import { useTranslations } from 'next-intl';

import LanguageSwitcher from './LanguageSwitcher';

interface Props {
  name: string;
  logoUrl: string | null;
  tableName?: string | null;
  /** Branch/location name, shown for clarity (BR-10). */
  locationName?: string | null;
}

export default function BrandingHeader({ name, logoUrl, tableName, locationName }: Props) {
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
          {locationName ? (
            <p className="flex items-center gap-1 truncate text-xs text-gray-500">
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="shrink-0"
                aria-hidden
              >
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span className="truncate">{locationName}</span>
            </p>
          ) : null}
          {tableName ? (
            <p className="truncate text-xs text-brand-accent">{t('table', { name: tableName })}</p>
          ) : null}
        </div>
        <LanguageSwitcher />
      </div>
    </header>
  );
}
